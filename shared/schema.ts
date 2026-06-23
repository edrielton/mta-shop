import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  mtaSerial: text("mta_serial"),
  mtaAccount: text("mta_account"),
  isAdmin: boolean("is_admin").default(false),
  isVip: boolean("is_vip").default(false),
  vipExpiresAt: timestamp("vip_expires_at"),
  coinBalance: integer("coin_balance").default(0),
  mpCustomerId: text("mp_customer_id"),  // ID do cliente no Mercado Pago
  createdAt: timestamp("created_at").defaultNow(),

  // ── SEGURANÇA ──────────────────────────────────────────────────
  // Bloqueio por tentativas falhas
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lockedUntil: timestamp("locked_until"),          // null = não bloqueado

  // Suspensão manual pelo admin
  isSuspended: boolean("is_suspended").default(false),
  suspendedReason: text("suspended_reason"),

  // Rastreamento de último acesso
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: text("last_login_ip"),
});

// Sessões ativas (rastreamento por dispositivo)
export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionToken: text("session_token").notNull().unique(), // hash da session ID
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceName: text("device_name"),    // ex: "Chrome no Windows"
  createdAt: timestamp("created_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  isRevoked: boolean("is_revoked").default(false),
});

// Products table
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  sku: text("sku").notNull().unique(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").default("BRL"),
  category: text("category").notNull(),
  imageUrl: text("image_url"),
  mtaCommand: text("mta_command").notNull(),
  mtaParams: jsonb("mta_params"),
  isActive: boolean("is_active").default(true),
  isFree: boolean("is_free").default(false),           // item gratuito — não exige pagamento
  claimLimit: integer("claim_limit"),                  // null = ilimitado, N = só N resgates por usuário
  stockQuantity: integer("stock_quantity"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Transactions/Orders table
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  productId: varchar("product_id").references(() => products.id),
  // Mercado Pago
  mpPaymentId: text("mp_payment_id"),           // ID do pagamento retornado pelo MP
  mpPreferenceId: text("mp_preference_id"),     // ID da preference (Checkout Pro)
  mpExternalReference: text("mp_external_reference"), // nossa ref interna enviada ao MP
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("BRL"),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method"),
  mtaActivationStatus: text("mta_activation_status").default("pending"),
  mtaActivationError: text("mta_activation_error"),
  mtaActivationAttempts: integer("mta_activation_attempts").default(0),
  metadata: jsonb("metadata"),
  // IP de onde veio a compra (para auditoria)
  purchaseIp: text("purchase_ip"),
  isSuspicious: boolean("is_suspicious").default(false),
  suspiciousReason: text("suspicious_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// System logs table
export const systemLogs = pgTable("system_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  level: text("level").notNull().default("info"),
  message: text("message").notNull(),
  userId: varchar("user_id").references(() => users.id),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// MTA Server settings
export const mtaSettings = pgTable("mta_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serverUrl: text("server_url").notNull(),
  serverPort: integer("server_port").notNull().default(22005),
  apiToken: text("api_token").notNull(),
  isActive: boolean("is_active").default(true),
  lastHealthCheck: timestamp("last_health_check"),
  healthStatus: text("health_status").default("unknown"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


// Scanner data (último scan recebido do scanner app)
export const scannerData = pgTable("scanner_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: text("source").notNull().default("scanner_app"),
  trigger: text("trigger"),
  totalResources: integer("total_resources").default(0),
  detectedItems: integer("detected_items").default(0),
  scannedAt: timestamp("scanned_at").defaultNow(),
  resources: jsonb("resources").default([]),
  detected: jsonb("detected").default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pending activations (polling reverso: MTA busca ativações pendentes)
export const pendingActivations = pgTable("pending_activations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: text("transaction_id").notNull(),
  serial: text("serial"),
  account: text("account"),
  command: text("command").notNull(),
  params: jsonb("params").default({}),
  status: text("status").notNull().default("pending"), // pending | processed | failed
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

// Player tokens (auto-login via MTA)
export const playerTokens = pgTable("player_tokens", {
  id:        varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serial:    text("serial").notNull(),
  token:     text("token").notNull().unique(),
  used:      boolean("used").default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Player data (synced from MTA RP server)
export const playerData = pgTable("player_data", {
  serial:       text("serial").primaryKey(),
  online:       boolean("online").default(false),
  nome:         text("nome"),
  idade:        integer("idade").default(0),
  sexo:         text("sexo").default("M"),
  skin:         integer("skin").default(0),
  horasJogadas: integer("horas_jogadas").default(0),
  dinheiro:     integer("dinheiro").default(0),
  banco:        integer("banco").default(0),
  faccao:       text("faccao").default("Nenhuma"),
  cargo:        text("cargo").default("Membro"),
  emprego:      text("emprego").default("Desempregado"),
  nivel:        integer("nivel").default(1),
  xp:           integer("xp").default(0),
  vida:         integer("vida").default(100),
  colete:       integer("colete").default(0),
  cnh:          boolean("cnh").default(false),
  rg:           boolean("rg").default(false),
  porteArma:    boolean("porte_arma").default(false),
  veiculos:     jsonb("veiculos").default([]),
  inventario:   jsonb("inventario").default([]),
  propriedades: jsonb("propriedades").default([]),
  updatedAt:    timestamp("updated_at").defaultNow(),
});

export type PlayerToken = typeof playerTokens.$inferSelect;
export type PlayerDataRow = typeof playerData.$inferSelect;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  logs: many(systemLogs),
  sessions: many(userSessions),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, { fields: [userSessions.userId], references: [users.id] }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  product: one(products, { fields: [transactions.productId], references: [products.id] }),
  logs: many(systemLogs),
}));

export const systemLogsRelations = relations(systemLogs, ({ one }) => ({
  user: one(users, { fields: [systemLogs.userId], references: [users.id] }),
  transaction: one(transactions, { fields: [systemLogs.transactionId], references: [transactions.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true, createdAt: true, isAdmin: true, isVip: true, vipExpiresAt: true,
  coinBalance: true, mpCustomerId: true, failedLoginAttempts: true,
  lockedUntil: true, isSuspended: true, suspendedReason: true,
  lastLoginAt: true, lastLoginIp: true,
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({ id: true, createdAt: true });
export const insertMtaSettingsSchema = createInsertSchema(mtaSettings).omit({
  id: true, createdAt: true, updatedAt: true, lastHealthCheck: true, healthStatus: true,
});
export const insertScannerDataSchema = createInsertSchema(scannerData).omit({
  id: true, createdAt: true,
});
export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true, createdAt: true, lastSeenAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;
export type SystemLog = typeof systemLogs.$inferSelect;

export type InsertMtaSettings = z.infer<typeof insertMtaSettingsSchema>;
export type MtaSettings = typeof mtaSettings.$inferSelect;

export type InsertScannerData = z.infer<typeof insertScannerDataSchema>;
export type ScannerData = typeof scannerData.$inferSelect;

export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;

// Auth schemas
export const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  mtaSerial: z.string().optional(),
  mtaAccount: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8, "Nova senha deve ter pelo menos 8 caracteres"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;



export { mods } from "./mods.schema";