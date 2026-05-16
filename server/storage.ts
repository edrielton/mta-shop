import {
  users, products, transactions, systemLogs, mtaSettings, userSessions,
  type User, type InsertUser,
  type Product, type InsertProduct,
  type Transaction, type InsertTransaction,
  type SystemLog, type InsertSystemLog,
  type MtaSettings, type InsertMtaSettings,
  type UserSession, type InsertUserSession,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lt, isNull, or } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserStats(userId: string): Promise<{ totalPurchases: number; totalSpent: number }>;

  // Security: account locking
  incrementFailedLogins(userId: string): Promise<{ attempts: number; locked: boolean }>;
  resetFailedLogins(userId: string): Promise<void>;
  isAccountLocked(userId: string): Promise<{ locked: boolean; until?: Date }>;

  // Security: sessions
  createSession(session: InsertUserSession): Promise<UserSession>;
  getSession(token: string): Promise<UserSession | undefined>;
  getUserSessions(userId: string): Promise<UserSession[]>;
  updateSessionLastSeen(token: string): Promise<void>;
  revokeSession(sessionId: string, userId: string): Promise<boolean>;
  revokeAllSessionsExcept(userId: string, currentToken: string): Promise<number>;
  cleanExpiredSessions(): Promise<void>;

  // Products
  getProduct(id: string): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  getProducts(options?: { category?: string; active?: boolean; limit?: number }): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, data: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  // Transactions
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionByStripeSession(sessionId: string): Promise<Transaction | undefined>;
  getUserTransactions(userId: string): Promise<Transaction[]>;
  getAllTransactions(): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction | undefined>;
  getSuspiciousTransactions(): Promise<Transaction[]>;

  // System Logs
  createLog(log: InsertSystemLog): Promise<SystemLog>;
  getLogs(options?: { type?: string; limit?: number }): Promise<SystemLog[]>;

  // MTA Settings
  getMtaSettings(): Promise<MtaSettings | undefined>;
  updateMtaSettings(data: Partial<MtaSettings>): Promise<MtaSettings | undefined>;
  createMtaSettings(settings: InsertMtaSettings): Promise<MtaSettings>;

  // Admin stats
  getAdminStats(): Promise<{
    todayRevenue: number;
    pendingOrders: number;
    activeUsers: number;
    failedActivations: number;
    suspiciousActivity: number;
    lockedAccounts: number;
  }>;
}

// Threshold: bloqueia após N tentativas falhas por X minutos
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

export class DatabaseStorage implements IStorage {
  // ── USERS ──────────────────────────────────────────────────────

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 12); // custo 12 (mais seguro)
    const [user] = await db.insert(users).values({ ...insertUser, password: hashedPassword }).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUserStats(userId: string): Promise<{ totalPurchases: number; totalSpent: number }> {
    const userTxs = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.status, "completed")));

    const totalSpent = userTxs.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    return { totalPurchases: userTxs.length, totalSpent };
  }

  // ── SECURITY: ACCOUNT LOCKING ──────────────────────────────────

  async incrementFailedLogins(userId: string): Promise<{ attempts: number; locked: boolean }> {
    const user = await this.getUser(userId);
    if (!user) return { attempts: 0, locked: false };

    const newAttempts = (user.failedLoginAttempts || 0) + 1;
    const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;

    const update: Partial<User> = { failedLoginAttempts: newAttempts };
    if (shouldLock) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + LOCK_DURATION_MINUTES);
      update.lockedUntil = lockUntil;
    }

    await db.update(users).set(update).where(eq(users.id, userId));
    return { attempts: newAttempts, locked: shouldLock };
  }

  async resetFailedLogins(userId: string): Promise<void> {
    await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, userId));
  }

  async isAccountLocked(userId: string): Promise<{ locked: boolean; until?: Date }> {
    const user = await this.getUser(userId);
    if (!user || !user.lockedUntil) return { locked: false };

    const now = new Date();
    if (user.lockedUntil > now) {
      return { locked: true, until: user.lockedUntil };
    }

    // Bloqueio expirou automaticamente — limpa
    await this.resetFailedLogins(userId);
    return { locked: false };
  }

  // ── SECURITY: SESSIONS ─────────────────────────────────────────

  async createSession(session: InsertUserSession): Promise<UserSession> {
    const [created] = await db.insert(userSessions).values(session).returning();
    return created;
  }

  async getSession(token: string): Promise<UserSession | undefined> {
    const now = new Date();
    const [session] = await db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.sessionToken, token),
          eq(userSessions.isRevoked, false),
          gte(userSessions.expiresAt, now)
        )
      );
    return session || undefined;
  }

  async getUserSessions(userId: string): Promise<UserSession[]> {
    const now = new Date();
    return db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.userId, userId),
          eq(userSessions.isRevoked, false),
          gte(userSessions.expiresAt, now)
        )
      )
      .orderBy(desc(userSessions.lastSeenAt));
  }

  async updateSessionLastSeen(token: string): Promise<void> {
    await db
      .update(userSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(userSessions.sessionToken, token));
  }

  async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const result = await db
      .update(userSessions)
      .set({ isRevoked: true })
      .where(and(eq(userSessions.id, sessionId), eq(userSessions.userId, userId)));
    return true;
  }

  async revokeAllSessionsExcept(userId: string, currentToken: string): Promise<number> {
    await db
      .update(userSessions)
      .set({ isRevoked: true })
      .where(
        and(
          eq(userSessions.userId, userId),
          eq(userSessions.isRevoked, false),
          // Exclui a sessão atual
          // Usando raw SQL para != 
        )
      );
    // Workaround para "not equal" no drizzle sem importar sql
    const sessions = await db
      .select()
      .from(userSessions)
      .where(and(eq(userSessions.userId, userId), eq(userSessions.isRevoked, false)));

    let count = 0;
    for (const session of sessions) {
      if (session.sessionToken !== currentToken) {
        await db.update(userSessions).set({ isRevoked: true }).where(eq(userSessions.id, session.id));
        count++;
      }
    }
    return count;
  }

  async cleanExpiredSessions(): Promise<void> {
    await db
      .update(userSessions)
      .set({ isRevoked: true })
      .where(lt(userSessions.expiresAt, new Date()));
  }

  // ── PRODUCTS ───────────────────────────────────────────────────

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku));
    return product || undefined;
  }

  async getProducts(options?: { category?: string; active?: boolean; limit?: number }): Promise<Product[]> {
    let query = db.select().from(products);
    const conditions = [];

    if (options?.active !== undefined) conditions.push(eq(products.isActive, options.active));
    if (options?.category) conditions.push(eq(products.category, options.category));

    if (conditions.length > 0) query = query.where(and(...conditions)) as any;

    return query.orderBy(desc(products.createdAt)).limit(options?.limit || 100);
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(product).returning();
    return created;
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<Product | undefined> {
    const [updated] = await db.update(products).set(data).where(eq(products.id, id)).returning();
    return updated || undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    await db.delete(products).where(eq(products.id, id));
    return true;
  }

  // ── TRANSACTIONS ───────────────────────────────────────────────

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
    return tx || undefined;
  }

  async getTransactionByStripeSession(sessionId: string): Promise<Transaction | undefined> {
    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.stripeCheckoutSessionId, sessionId));
    return tx || undefined;
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    return db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(100);
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [created] = await db.insert(transactions).values(transaction).returning();
    return created;
  }

  async updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction | undefined> {
    const [updated] = await db
      .update(transactions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(transactions.id, id))
      .returning();
    return updated || undefined;
  }

  async getSuspiciousTransactions(): Promise<Transaction[]> {
    return db
      .select()
      .from(transactions)
      .where(eq(transactions.isSuspicious, true))
      .orderBy(desc(transactions.createdAt))
      .limit(100);
  }

  // ── SYSTEM LOGS ────────────────────────────────────────────────

  async createLog(log: InsertSystemLog): Promise<SystemLog> {
    const [created] = await db.insert(systemLogs).values(log).returning();
    return created;
  }

  async getLogs(options?: { type?: string; limit?: number }): Promise<SystemLog[]> {
    let query = db.select().from(systemLogs);
    if (options?.type) query = query.where(eq(systemLogs.type, options.type)) as any;
    return query.orderBy(desc(systemLogs.createdAt)).limit(options?.limit || 100);
  }

  // ── MTA SETTINGS ───────────────────────────────────────────────

  async getMtaSettings(): Promise<MtaSettings | undefined> {
    const [settings] = await db.select().from(mtaSettings).limit(1);
    return settings || undefined;
  }

  async updateMtaSettings(data: Partial<MtaSettings>): Promise<MtaSettings | undefined> {
    const existing = await this.getMtaSettings();
    if (!existing) return undefined;
    const [updated] = await db
      .update(mtaSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(mtaSettings.id, existing.id))
      .returning();
    return updated || undefined;
  }

  async createMtaSettings(settings: InsertMtaSettings): Promise<MtaSettings> {
    const [created] = await db.insert(mtaSettings).values(settings).returning();
    return created;
  }

  // ── ADMIN STATS ────────────────────────────────────────────────

  async getAdminStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTxs = await db
      .select()
      .from(transactions)
      .where(and(gte(transactions.createdAt, today), eq(transactions.status, "completed")));

    const pendingTxs = await db.select().from(transactions).where(eq(transactions.status, "pending"));
    const allUsers = await db.select().from(users);
    const failedTxs = await db.select().from(transactions).where(eq(transactions.mtaActivationStatus, "failed"));
    const suspiciousTxs = await db.select().from(transactions).where(eq(transactions.isSuspicious, true));
    const lockedUsers = await db
      .select()
      .from(users)
      .where(and(gte(users.lockedUntil, new Date())));

    return {
      todayRevenue: todayTxs.reduce((sum, tx) => sum + parseFloat(tx.amount), 0),
      pendingOrders: pendingTxs.length,
      activeUsers: allUsers.length,
      failedActivations: failedTxs.length,
      suspiciousActivity: suspiciousTxs.length,
      lockedAccounts: lockedUsers.length,
    };
  }
}

export const storage = new DatabaseStorage();

// Limpeza automática de sessões expiradas a cada hora
setInterval(() => {
  storage.cleanExpiredSessions().catch(console.error);
}, 60 * 60 * 1000);
