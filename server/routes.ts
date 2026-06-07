import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  loginSchema, registerSchema, insertProductSchema, changePasswordSchema
} from "@shared/schema";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcrypt";
import { z } from "zod";
import crypto from "crypto";
import { broadcastPlayerData, broadcastAdmin } from "./websocket";
import { hashSessionToken, parseDeviceName, detectSuspiciousActivity, getRealIp } from "./security";
import { getPaymentClient, getPreferenceClient, getMercadoPagoPublicKey } from "./mercadopagoClient";






declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

// ============ RATE LIMITER ============
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimit(maxRequests: number, windowMs: number, useUserId = false) {
  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = useUserId && req.session?.userId
      ? req.session.userId
      : (req.ip || "unknown");
    const key = `${identifier}-${req.path}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= maxRequests) {
      return res.status(429).json({ message: "Muitas tentativas. Aguarde alguns instantes." });
    }
    entry.count++;
    next();
  };
}

const rateLimitCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

// Permite cancelar o interval em testes ou shutdown gracioso
export function clearRateLimitInterval() { clearInterval(rateLimitCleanupInterval); }

// ============ AUTH MIDDLEWARE ============

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) return next();
  return res.status(401).json({ message: "Authentication required" });
}

// Middleware global que hidrata req.session.userId via cookie OU header X-Session-Token
async function hydrateSession(req: Request, _res: Response, next: NextFunction) {
  if (req.session?.userId) return next();

  const tokenHeader = req.headers["x-session-token"] as string | undefined;
  if (tokenHeader) {
    try {
      const sessionRow = await storage.getSession(hashSessionToken(tokenHeader));
      if (sessionRow?.userId && !sessionRow.isRevoked && new Date(sessionRow.expiresAt) > new Date()) {
        req.session.userId = sessionRow.userId;
      }
    } catch { /* ignora */ }
  }
  next();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // Método 1: sessão do browser (site web)
  if (req.session.userId) {
    const user = await storage.getUser(req.session.userId);
    if (user?.isAdmin) {
      (req as any).adminUser = user;
      return next();
    }
    return res.status(403).json({ message: "Admin access required" });
  }

  // Método 2: token MTA (painel in-game e scanner)
  const mtaToken = req.headers["x-api-token"] as string;
  if (mtaToken) {
    const settings = await storage.getMtaSettings();
    if (settings && mtaToken === settings.apiToken) {
      (req as any).adminUser = { username: "mta-admin", isAdmin: true };
      return next();
    }
  }

  return res.status(401).json({ message: "Authentication required" });
}

/** Verifica se conta está suspensa ou bloqueada. Bloqueia o acesso se sim. */
async function requireActiveAccount(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return next();

  const user = await storage.getUser(req.session.userId);
  if (!user) return next();

  if (user.isSuspended) {
    console.warn("[Auth] Sessão destruída por conta suspensa", {
      sessionUserId: req.session.userId,
      userId: user.id,
      isSuspended: user.isSuspended,
      suspendedReason: user.suspendedReason,
    });
    req.session.destroy(() => {});
    return res.status(403).json({
      message: "Conta suspensa.",
      reason: user.suspendedReason || "Entre em contato com o suporte.",
      code: "ACCOUNT_SUSPENDED",
    });
  }


  const lockStatus = await storage.isAccountLocked(user.id);
  if (lockStatus.locked) {
    console.warn("[Auth] Sessão destruída por conta bloqueada", {
      sessionUserId: req.session.userId,
      userId: user.id,
      lockedUntil: lockStatus.until,
    });
    req.session.destroy(() => {});
    return res.status(403).json({
      message: "Conta temporariamente bloqueada por excesso de tentativas de login.",
      lockedUntil: lockStatus.until,
      code: "ACCOUNT_LOCKED",
    });
  }


  // Atualiza lastSeen da sessão a cada requisição
  const sessionToken = hashSessionToken(req.sessionID);
  storage.updateSessionLastSeen(sessionToken).catch(() => {});

  next();
}

// ============ MTA COMMUNICATION ============

async function sendMtaActivation(
  transactionId: string, userId: string, productId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await storage.getMtaSettings();
    if (!settings || !settings.isActive) return { success: false, error: "MTA server not configured" };

    const user = await storage.getUser(userId);
    const product = await storage.getProduct(productId);

    if (!user || !product) return { success: false, error: "User or product not found" };
    if (!user.mtaSerial && !user.mtaAccount) return { success: false, error: "User has no MTA serial/account linked" };

    const mtaPayload = {
      command: product.mtaCommand, serial: user.mtaSerial,
      account: user.mtaAccount, params: product.mtaParams, transactionId,
    };

    const signature = crypto
      .createHmac("sha256", settings.apiToken)
      .update(JSON.stringify(mtaPayload))
      .digest("hex");

    const response = await fetch(`${settings.serverUrl}:${settings.serverPort}/mta_store/activate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Token": settings.apiToken,
        "X-Signature": signature,
      },
      body: JSON.stringify(mtaPayload),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return { success: false, error: `MTA error: ${await response.text()}` };
    const result = await response.json();
    return { success: result.success, error: result.error };
  } catch (error) {
    return { success: false, error: `Cannot connect to MTA: ${error instanceof Error ? error.message : "Unknown"}` };
  }
}

// ============ PROCESS PIX PAYMENT (confirmação manual pelo admin) ============

/**
 * Processa um pagamento PIX confirmado.
 * Como não há webhook automático para PIX nativo, a confirmação é feita
 * pelo admin via POST /api/admin/transactions/:id/confirm ou por integração futura.
 */
export async function processPixPayment(transactionId: string): Promise<{ success: boolean; error?: string }> {
  const transaction = await storage.getTransaction(transactionId);
  if (!transaction) return { success: false, error: "Transação não encontrada" };
  if (transaction.status === "completed") return { success: true }; // idempotente

  await storage.updateTransaction(transaction.id, { status: "completed" });

  if (transaction.productId) {
    const activationResult = await sendMtaActivation(transaction.id, transaction.userId, transaction.productId);
    await storage.updateTransaction(transaction.id, {
      mtaActivationStatus: activationResult.success ? "success" : "failed",
      mtaActivationError: activationResult.error,
      mtaActivationAttempts: (transaction.mtaActivationAttempts || 0) + 1,
    });
    await storage.createLog({
      type: "mta_activation",
      level: activationResult.success ? "info" : "error",
      message: activationResult.success
        ? `Ativação OK: transação ${transaction.id}`
        : `Falha na ativação: ${activationResult.error}`,
      userId: transaction.userId,
      transactionId: transaction.id,
    });
    return activationResult;
  }

  return { success: true };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  const isProd = process.env.NODE_ENV === "production";
  const sessionTTL = 7 * 24 * 60 * 60 * 1000; // 7 dias em ms

  // Session store PostgreSQL
  const PgStore = connectPgSimple(session);
  const sessionStore = process.env.DATABASE_URL
    ? new PgStore({
        conString: process.env.DATABASE_URL,
        tableName: "user_sessions_store",
        createTableIfMissing: true,
        ttl: Math.floor(sessionTTL / 1000),
        pruneSessionInterval: 60 * 60,
        errorLog: (err: any) => console.error("[SessionStore]", err),
      })
    : undefined;

  console.log("[Session] Store:", sessionStore ? "PostgreSQL" : "MemoryStore");

  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "mta-store-secret-dev-only",
      name: "mta.sid",
      resave: true,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        secure: false,   // NUNCA true — Cloudflare termina TLS, Railway recebe HTTP
        httpOnly: true,
        sameSite: "lax",
        maxAge: sessionTTL,
      },
    })
  );

  // Middleware: aceita sessão via cookie OU via header X-Session-Token
  app.use(hydrateSession);

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  });

  app.use("/api/user", requireAuth, requireActiveAccount);
  app.use("/api/admin", requireActiveAccount);
  app.use("/api/player", (_req: Request, _res: Response, next: NextFunction) => next());
  app.use("/api/mta", (_req: Request, _res: Response, next: NextFunction) => next());

  // ============ DIAGNÓSTICO (remover após resolver) ============
  app.get("/api/debug", async (req, res) => {
    const tokenHeader = req.headers["x-session-token"] as string | undefined;
    const cookieHeader = req.headers["cookie"];
    
    let sessionFromToken = null;
    if (tokenHeader) {
      try {
        sessionFromToken = await storage.getSession(hashSessionToken(tokenHeader));
      } catch (e: any) { sessionFromToken = { error: e.message }; }
    }

    res.json({
      sessionID: req.sessionID,
      sessionUserId: req.session?.userId || null,
      cookieHeader: cookieHeader || "NENHUM COOKIE",
      tokenHeader: tokenHeader ? tokenHeader.slice(0, 16) + "..." : "NENHUM TOKEN",
      sessionFromToken,
      isProd: process.env.NODE_ENV === "production",
      storeType: sessionStore ? "PostgreSQL" : "Memory",
    });
  });

  // ============ AUTH ROUTES ============

  // Registro
  app.post("/api/auth/register", rateLimit(5, 15 * 60 * 1000), async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);

      if (await storage.getUserByUsername(data.username)) {
        return res.status(400).json({ message: "Nome de usuário já em uso" });
      }
      if (await storage.getUserByEmail(data.email)) {
        return res.status(400).json({ message: "E-mail já cadastrado" });
      }

      const user = await storage.createUser(data);

      await storage.createLog({
        type: "auth", level: "info",
        message: `Novo usuário: ${user.username}`,
        userId: user.id, ipAddress: req.ip, userAgent: req.get("user-agent"),
      });

      req.session.userId = user.id;

      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashSessionToken(rawToken);

      // Registra sessão
      await storage.createSession({
        userId: user.id,
        sessionToken: tokenHash,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
        deviceName: parseDeviceName(req.get("user-agent")),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isRevoked: false,
      });

      const { password: _, ...safeUser } = user;

      req.session.save((err) => {
        if (err) console.error("[Register] session.save error:", err);
        res.json({ user: safeUser, sessionToken: rawToken });
      });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
      console.error("Register error:", error);
      res.status(500).json({ message: "Falha no registro" });
    }
  });

  // Login
  app.post("/api/auth/login", rateLimit(10, 15 * 60 * 1000), async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(data.username);

      // Timing attack prevention — sempre computa bcrypt
      const dummyHash = "$2b$12$invalidhashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
      const validPassword = await bcrypt.compare(data.password, user ? user.password : dummyHash);

      // 1. Usuário não existe ou senha errada
      if (!user || !validPassword) {
        if (user) {
          const { attempts, locked } = await storage.incrementFailedLogins(user.id);
          await storage.createLog({
            type: "security", level: "warn",
            message: `Login falhou para ${user.username} (tentativa ${attempts}/5)`,
            userId: user.id, ipAddress: req.ip, userAgent: req.get("user-agent"),
          });
          if (locked) {
            return res.status(403).json({
              message: "Conta bloqueada por 30 minutos após 5 tentativas falhas.",
              code: "ACCOUNT_LOCKED",
            });
          }
        }
        return res.status(401).json({ message: "Usuário ou senha inválidos" });
      }

      // 2. Senha correta — verifica suspensão ANTES do bloqueio
      if (user.isSuspended) {
        return res.status(403).json({
          message: "Conta suspensa. Entre em contato com o suporte.",
          reason: user.suspendedReason,
          code: "ACCOUNT_SUSPENDED",
        });
      }

      // 3. Verifica bloqueio (reseta automaticamente se já expirou)
      const lockStatus = await storage.isAccountLocked(user.id);
      if (lockStatus.locked) {
        const until = lockStatus.until
          ? new Date(lockStatus.until).toLocaleTimeString("pt-BR")
          : "em breve";
        return res.status(403).json({
          message: `Conta bloqueada até ${until}. Aguarde ou contate o admin.`,
          lockedUntil: lockStatus.until,
          code: "ACCOUNT_LOCKED",
        });
      }

      // 4. Login OK — reseta contador de tentativas
      await storage.resetFailedLogins(user.id);
      await storage.updateUser(user.id, {
        lastLoginAt: new Date(),
        lastLoginIp: req.ip,
      });

      req.session.userId = user.id;

      // Gera token único para este login (fallback para quando cookie falha)
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashSessionToken(rawToken);

      // Registra sessão no banco
      await storage.createSession({
        userId: user.id,
        sessionToken: tokenHash,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
        deviceName: parseDeviceName(req.get("user-agent")),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isRevoked: false,
      });

      await storage.createLog({
        type: "auth", level: "info",
        message: `Login: ${user.username} de ${req.ip}`,
        userId: user.id, ipAddress: req.ip, userAgent: req.get("user-agent"),
      });

      const { password: _, ...safeUser } = user;

      req.session.save((err) => {
        if (err) console.error("[Login] session.save error:", err);
        res.json({ user: safeUser, sessionToken: rawToken });
      });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
      console.error("Login error:", error);
      res.status(500).json({ message: "Falha no login" });
    }
  });

  // Logout
  app.post("/api/auth/logout", async (req, res) => {
    if (req.sessionID) {
      const token = hashSessionToken(req.sessionID);
      const sessions = await storage.getUserSessions(req.session.userId || "");
      const current = sessions.find(s => s.sessionToken === token);
      if (current) await storage.revokeSession(current.id, req.session.userId || "");
    }
    const sessionSecure = isProd;

    req.session.destroy(() => {
      res.clearCookie("mta.sid", {
        path: "/",
        secure: sessionSecure,
        httpOnly: true,
        sameSite: isProd ? "none" : "lax",
      });
      res.json({ success: true });
    });
  });

  // Usuário atual
  app.get("/api/auth/me", async (req, res) => {
    let userId = req.session?.userId;

    // Fallback: verifica header X-Session-Token se não tem sessão
    if (!userId) {
      const tokenHeader = req.headers["x-session-token"] as string | undefined;
      if (tokenHeader) {
        try {
          const sessionRow = await storage.getSession(hashSessionToken(tokenHeader));
          if (sessionRow?.userId && !sessionRow.isRevoked && new Date(sessionRow.expiresAt) > new Date()) {
            userId = sessionRow.userId;
            req.session.userId = userId;
          }
        } catch { /* ignora */ }
      }
    }

    console.log("[/api/auth/me] userId:", userId || "none");

    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  // ============ PRODUCTS ROUTES ============

  app.get("/api/products", async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const search = req.query.search as string | undefined;

      const products = await storage.getProducts({
        category: category !== "all" ? category : undefined,
        active: true, limit,
      });

      const filtered = search
        ? products.filter(p =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
          )
        : products;

      res.json({ products: filtered });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.json({ product });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // ============ USER ROUTES ============

  app.get("/api/user/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getUserStats(req.session.userId!);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/user/transactions", requireAuth, async (req, res) => {
    try {
      const txs = await storage.getUserTransactions(req.session.userId!);
      res.json({ transactions: txs });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.patch("/api/user/profile", requireAuth, async (req, res) => {
    try {
      const allowedFields = ["mtaSerial", "mtaAccount"];
      const update: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) update[field] = String(req.body[field]).trim().slice(0, 255);
      }
      const updated = await storage.updateUser(req.session.userId!, update);
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = updated;
      res.json({ user: safeUser });
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // ── NOVO: Trocar senha ──────────────────────────────────────────
  app.post("/api/user/change-password", requireAuth, rateLimit(3, 10 * 60 * 1000, true), async (req, res) => {
    try {
      const data = changePasswordSchema.parse(req.body);
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });

      const validCurrent = await bcrypt.compare(data.currentPassword, user.password);
      if (!validCurrent) {
        await storage.createLog({
          type: "security", level: "warn",
          message: `Tentativa de troca de senha com senha atual incorreta: ${user.username}`,
          userId: user.id, ipAddress: req.ip,
        });
        return res.status(400).json({ message: "Senha atual incorreta" });
      }

      if (data.newPassword === data.currentPassword) {
        return res.status(400).json({ message: "A nova senha deve ser diferente da atual" });
      }

      const newHash = await bcrypt.hash(data.newPassword, 12);
      await storage.updateUser(user.id, { password: newHash });

      // Revoga todas as outras sessões por segurança
      const currentToken = hashSessionToken(req.sessionID);
      const revokedCount = await storage.revokeAllSessionsExcept(user.id, currentToken);

      await storage.createLog({
        type: "security", level: "info",
        message: `Senha alterada: ${user.username} (${revokedCount} sessão(ões) revogada(s))`,
        userId: user.id, ipAddress: req.ip,
      });

      res.json({ success: true, sessionsRevoked: revokedCount });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // ── NOVO: Listar sessões ativas ─────────────────────────────────
  app.get("/api/user/sessions", requireAuth, async (req, res) => {
    try {
      const sessions = await storage.getUserSessions(req.session.userId!);
      const currentToken = hashSessionToken(req.sessionID);

      const safeSessions = sessions.map(s => ({
        id: s.id,
        deviceName: s.deviceName,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        expiresAt: s.expiresAt,
        isCurrent: s.sessionToken === currentToken,
      }));

      res.json({ sessions: safeSessions });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  // ── NOVO: Revogar sessão específica ────────────────────────────
  app.delete("/api/user/sessions/:id", requireAuth, async (req, res) => {
    try {
      const currentToken = hashSessionToken(req.sessionID);
      const sessions = await storage.getUserSessions(req.session.userId!);
      const target = sessions.find(s => s.id === req.params.id);

      if (!target) return res.status(404).json({ message: "Sessão não encontrada" });
      if (target.sessionToken === currentToken) {
        return res.status(400).json({ message: "Não é possível revogar a sessão atual. Use logout." });
      }

      await storage.revokeSession(req.params.id, req.session.userId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to revoke session" });
    }
  });

  // ── NOVO: Revogar todas as outras sessões ──────────────────────
  app.delete("/api/user/sessions", requireAuth, async (req, res) => {
    try {
      const currentToken = hashSessionToken(req.sessionID);
      const count = await storage.revokeAllSessionsExcept(req.session.userId!, currentToken);

      await storage.createLog({
        type: "security", level: "info",
        message: `Usuário revogou ${count} sessão(ões) remotas`,
        userId: req.session.userId, ipAddress: req.ip,
      });

      res.json({ success: true, revokedCount: count });
    } catch (error) {
      res.status(500).json({ message: "Failed to revoke sessions" });
    }
  });

  // ============ CHECKOUT — MERCADO PAGO ============

  // Retorna a public key para o frontend
  app.get("/api/checkout/public-key", (_req, res) => {
    try {
      res.json({ publicKey: getMercadoPagoPublicKey() });
    } catch {
      res.status(500).json({ message: "Chave pública não configurada." });
    }
  });

  /**
   * POST /api/checkout/pix
   * Cria um pagamento PIX via Mercado Pago.
   * O MP gera o QR Code e confirma automaticamente via webhook.
   */
  app.post("/api/checkout/pix", requireAuth, rateLimit(3, 60 * 1000, true), async (req, res) => {
    try {
      const { productId } = req.body;
      if (!productId || typeof productId !== "string") {
        return res.status(400).json({ message: "Product ID é obrigatório" });
      }

      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ message: "Produto não encontrado" });
      if (!product.isActive) return res.status(400).json({ message: "Produto indisponível" });
      if (product.stockQuantity !== null && product.stockQuantity !== undefined && product.stockQuantity <= 0) {
        return res.status(400).json({ message: "Produto fora de estoque" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Usuário não encontrado" });
      if (user.isSuspended) {
        return res.status(403).json({ message: "Conta suspensa.", code: "ACCOUNT_SUSPENDED" });
      }

      const purchaseAmount = parseFloat(product.price);
      const purchaseIp = getRealIp(req);

      const suspicion = detectSuspiciousActivity({
        purchaseIp, lastLoginIp: user.lastLoginIp,
        userCreatedAt: user.createdAt, purchaseAmount,
        userTotalPurchases: (await storage.getUserStats(user.id)).totalPurchases,
      });

      if (suspicion.suspicious) {
        await storage.createLog({
          type: "security", level: "warn",
          message: `Compra suspeita: ${suspicion.reason}`,
          userId: user.id, ipAddress: purchaseIp,
          metadata: { productId, amount: purchaseAmount },
        });
      }

      // Cria a transação no banco primeiro para ter o ID como referência externa
      const tx = await storage.createTransaction({
        userId: user.id,
        productId: product.id,
        amount: product.price,
        currency: "BRL",
        status: "pending",
        paymentMethod: "pix",
        purchaseIp,
        isSuspicious: suspicion.suspicious,
        suspiciousReason: suspicion.reason,
      } as any);

      // Chama a API do Mercado Pago para criar o pagamento PIX
      const paymentClient = getPaymentClient();
      const mpPayment = await paymentClient.create({
        body: {
          transaction_amount: purchaseAmount,
          description: product.name,
          payment_method_id: "pix",
          payer: {
            email: user.email,
            first_name: user.username,
          },
          external_reference: tx.id, // nossa transação como referência
          notification_url: `${process.env.APP_URL}/api/checkout/webhook`,
        },
      });

      // Salva o ID do pagamento MP na transação
      await storage.updateTransaction(tx.id, {
        mpPaymentId: String(mpPayment.id),
        mpExternalReference: tx.id,
      } as any);

      await storage.createLog({
        type: "payment", level: "info",
        message: `PIX MP criado: ${product.name} — MP#${mpPayment.id}`,
        userId: user.id,
        transactionId: tx.id,
        metadata: { mpPaymentId: mpPayment.id },
      });

      const pixData = mpPayment.point_of_interaction?.transaction_data;

      res.json({
        paymentMethod: "pix",
        transactionId: tx.id,
        mpPaymentId: mpPayment.id,
        pixQrCode: pixData?.qr_code,           // string EMV copia-e-cola
        pixQrCodeBase64: pixData?.qr_code_base64, // imagem QR pronta
        amount: product.price,
        expiresAt: mpPayment.date_of_expiration,
      });
    } catch (error) {
      console.error("[Checkout PIX] Erro:", error);
      res.status(500).json({ message: "Falha ao criar pagamento PIX" });
    }
  });

  /**
   * POST /api/checkout/card
   * Cria uma Preference do Checkout Pro (cartão, PIX, boleto via link MP).
   * Retorna um link de redirecionamento para o ambiente seguro do MP.
   */
  app.post("/api/checkout/card", requireAuth, rateLimit(3, 60 * 1000, true), async (req, res) => {
    try {
      const { productId } = req.body;
      if (!productId || typeof productId !== "string") {
        return res.status(400).json({ message: "Product ID é obrigatório" });
      }

      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ message: "Produto não encontrado" });
      if (!product.isActive) return res.status(400).json({ message: "Produto indisponível" });

      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Usuário não encontrado" });
      if (user.isSuspended) {
        return res.status(403).json({ message: "Conta suspensa.", code: "ACCOUNT_SUSPENDED" });
      }

      const purchaseAmount = parseFloat(product.price);
      const purchaseIp = getRealIp(req);

      const suspicion = detectSuspiciousActivity({
        purchaseIp, lastLoginIp: user.lastLoginIp,
        userCreatedAt: user.createdAt, purchaseAmount,
        userTotalPurchases: (await storage.getUserStats(user.id)).totalPurchases,
      });

      const tx = await storage.createTransaction({
        userId: user.id,
        productId: product.id,
        amount: product.price,
        currency: "BRL",
        status: "pending",
        paymentMethod: "card",
        purchaseIp,
        isSuspicious: suspicion.suspicious,
        suspiciousReason: suspicion.reason,
      } as any);

      const preferenceClient = getPreferenceClient();
      const appUrl = process.env.APP_URL || "http://localhost:5000";

      const preference = await preferenceClient.create({
        body: {
          items: [{
            id: product.id,
            title: product.name,
            description: product.description || product.name,
            quantity: 1,
            currency_id: "BRL",
            unit_price: purchaseAmount,
          }],
          payer: { email: user.email, name: user.username },
          external_reference: tx.id,
          notification_url: `${appUrl}/api/checkout/webhook`,
          back_urls: {
            success: `${appUrl}/checkout/success?tx=${tx.id}`,
            failure: `${appUrl}/checkout/cancel?tx=${tx.id}`,
            pending: `${appUrl}/checkout/success?tx=${tx.id}`,
          },
          auto_return: "approved",
        },
      });

      await storage.updateTransaction(tx.id, {
        mpPreferenceId: preference.id,
        mpExternalReference: tx.id,
      } as any);

      await storage.createLog({
        type: "payment", level: "info",
        message: `Checkout Pro criado: ${product.name} — pref ${preference.id}`,
        userId: user.id, transactionId: tx.id,
      });

      res.json({
        paymentMethod: "card",
        transactionId: tx.id,
        preferenceId: preference.id,
        checkoutUrl: preference.init_point,       // produção
        sandboxUrl: preference.sandbox_init_point, // testes
      });
    } catch (error) {
      console.error("[Checkout Card] Erro:", error);
      res.status(500).json({ message: "Falha ao criar sessão de pagamento" });
    }
  });

  /**
   * POST /api/checkout/webhook
   * Recebe notificações IPN do Mercado Pago e confirma pagamentos automaticamente.
   * Docs: https://www.mercadopago.com.br/developers/pt/docs/notifications/ipn
   */
  app.post("/api/checkout/webhook", async (req: any, res) => {
    try {
      const { type, data } = req.body;

      // MP envia também query params ?topic=payment&id=xxx (IPN legado)
      const topic = req.query.topic as string | undefined;
      const queryId = req.query.id as string | undefined;

      const paymentId = data?.id || queryId;
      const eventType = type || topic;

      if ((eventType === "payment" || eventType === "payment.updated") && paymentId) {
        const paymentClient = getPaymentClient();
        const mpPayment = await paymentClient.get({ id: String(paymentId) });

        const externalRef = mpPayment.external_reference;
        if (!externalRef) {
          return res.status(200).json({ received: true }); // ignora sem referência
        }

        const transaction = await storage.getTransactionByExternalRef(externalRef);
        if (!transaction) {
          console.warn("[Webhook MP] Transação não encontrada:", externalRef);
          return res.status(200).json({ received: true });
        }

        // Salva o ID do MP caso ainda não tenha (pagamentos via Checkout Pro)
        if (!transaction.mpPaymentId) {
          await storage.updateTransaction(transaction.id, {
            mpPaymentId: String(mpPayment.id),
          } as any);
        }

        const mpStatus = mpPayment.status; // approved | pending | rejected | cancelled

        if (mpStatus === "approved" && transaction.status !== "completed") {
          await processPixPayment(transaction.id);
          await storage.createLog({
            type: "payment", level: "info",
            message: `Pagamento MP aprovado automaticamente: tx ${transaction.id} / MP#${mpPayment.id}`,
            transactionId: transaction.id,
          });
        } else if (mpStatus === "rejected" || mpStatus === "cancelled") {
          await storage.updateTransaction(transaction.id, { status: "failed" } as any);
          await storage.createLog({
            type: "payment", level: "warn",
            message: `Pagamento MP ${mpStatus}: tx ${transaction.id}`,
            transactionId: transaction.id,
          });
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("[Webhook MP] Erro:", error);
      // Sempre 200 para o MP não retentar indefinidamente em erros nossos
      res.status(200).json({ received: true, error: "internal" });
    }
  });

  // Consulta status de uma transação pelo ID
  app.get("/api/checkout/status/:transactionId", requireAuth, async (req, res) => {
    try {
      const tx = await storage.getTransaction(req.params.transactionId);
      if (!tx) return res.status(404).json({ message: "Transação não encontrada" });
      if (tx.userId !== req.session.userId) return res.status(403).json({ message: "Acesso negado" });
      res.json({
        id: tx.id,
        status: tx.status,
        mtaActivationStatus: tx.mtaActivationStatus,
        paymentMethod: tx.paymentMethod,
        mpPaymentId: tx.mpPaymentId,
        amount: tx.amount,
        createdAt: tx.createdAt,
      });
    } catch (error) {
      res.status(500).json({ message: "Falha ao consultar transação" });
    }
  });

  /**
   * POST /api/claim/:productId
   * Resgata um item gratuito — sem pagamento, ativa direto no MTA.
   * Cada usuário pode resgatar o mesmo item até claimLimit vezes (padrão: 1).
   */
  app.post("/api/claim/:productId", requireAuth, rateLimit(10, 60 * 1000, true), async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.productId);
      if (!product) return res.status(404).json({ message: "Produto não encontrado" });
      if (!product.isActive) return res.status(400).json({ message: "Produto indisponível" });
      if (!product.isFree) return res.status(400).json({ message: "Este produto não é gratuito" });

      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Usuário não encontrado" });
      if (user.isSuspended) return res.status(403).json({ message: "Conta suspensa" });

      // Verifica limite de resgates por usuário
      const claimLimit = product.claimLimit ?? 1;
      const previousClaims = await storage.countUserClaimsForProduct(userId, product.id);
      if (previousClaims >= claimLimit) {
        return res.status(400).json({
          message: claimLimit === 1
            ? "Você já resgatou este item"
            : `Limite de ${claimLimit} resgates atingido para este item`,
        });
      }

      // Verifica estoque
      if (product.stockQuantity !== null && product.stockQuantity !== undefined && product.stockQuantity <= 0) {
        return res.status(400).json({ message: "Item esgotado" });
      }

      // Cria transação gratuita
      const tx = await storage.createTransaction({
        userId,
        productId: product.id,
        amount: "0.00",
        currency: "BRL",
        status: "completed",
        paymentMethod: "free",
        purchaseIp: getRealIp(req),
        isSuspicious: false,
      } as any);

      // Ativa no servidor MTA
      const activation = await sendMtaActivation(tx.id, userId, product.id);
      await storage.updateTransaction(tx.id, {
        mtaActivationStatus: activation.success ? "success" : "failed",
        mtaActivationError: activation.error,
        mtaActivationAttempts: 1,
      } as any);

      await storage.createLog({
        type: "payment", level: "info",
        message: `Resgate gratuito: ${product.name} por ${user.username}`,
        userId, transactionId: tx.id,
      });

      res.json({
        success: true,
        transactionId: tx.id,
        activated: activation.success,
        message: activation.success
          ? `"${product.name}" ativado com sucesso!`
          : `Resgate registrado. A ativação será processada em breve.`,
      });
    } catch (error) {
      console.error("[Claim]", error);
      res.status(500).json({ message: "Falha ao resgatar item" });
    }
  });

  // Proteção de IP removida do middleware global (Cloudflare muda o IP)
  // A segurança é feita pelo requireAdmin (sessão + login)
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      res.json(await storage.getAdminStats());
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/products", requireAdmin, async (req, res) => {
    try {
      res.json({ products: await storage.getProducts() });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.post("/api/admin/products", requireAdmin, async (req, res) => {
    try {
      const data = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(data);
      await storage.createLog({ type: "admin", level: "info", message: `Produto criado: ${product.name}`, userId: req.session.userId });
      res.json({ product });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.patch("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const product = await storage.updateProduct(req.params.id, req.body);
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.json({ product });
    } catch (error) {
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteProduct(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  app.get("/api/admin/transactions", requireAdmin, async (req, res) => {
    try {
      res.json({ transactions: await storage.getAllTransactions() });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // ── NOVO: Transações suspeitas ─────────────────────────────────
  app.get("/api/admin/transactions/suspicious", requireAdmin, async (req, res) => {
    try {
      res.json({ transactions: await storage.getSuspiciousTransactions() });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch suspicious transactions" });
    }
  });

  app.post("/api/admin/transactions/:id/retry", requireAdmin, async (req, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) return res.status(404).json({ message: "Transaction not found" });
      if (!transaction.productId) return res.status(400).json({ message: "Transaction has no product" });
      if ((transaction.mtaActivationAttempts || 0) >= 5) {
        return res.status(400).json({ message: "Limite de 5 tentativas atingido." });
      }

      const result = await sendMtaActivation(transaction.id, transaction.userId, transaction.productId);
      await storage.updateTransaction(transaction.id, {
        mtaActivationStatus: result.success ? "success" : "failed",
        mtaActivationError: result.error,
        mtaActivationAttempts: (transaction.mtaActivationAttempts || 0) + 1,
      });
      res.json({ success: result.success, error: result.error });
    } catch (error) {
      res.status(500).json({ message: "Failed to retry activation" });
    }
  });

  // Confirmação manual de pagamento PIX pelo admin
  app.post("/api/admin/transactions/:id/confirm-pix", requireAdmin, async (req, res) => {
    try {
      const result = await processPixPayment(req.params.id);
      if (!result.success) return res.status(400).json({ message: result.error });

      await storage.createLog({
        type: "payment", level: "info",
        message: `Admin confirmou pagamento PIX: transação ${req.params.id}`,
        userId: req.session.userId,
        transactionId: req.params.id,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Falha ao confirmar pagamento" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const safeUsers = allUsers.map(({ password: _, ...u }) => u);
      res.json({ users: safeUsers });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const allowedFields = ["isAdmin", "isVip", "vipExpiresAt", "coinBalance"];
      const update: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) update[field] = req.body[field];
      }
      const updated = await storage.updateUser(req.params.id, update);
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = updated;
      res.json({ user: safeUser });
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // ── NOVO: Suspender / desbloquear conta ────────────────────────
  app.post("/api/admin/users/:id/suspend", requireAdmin, async (req, res) => {
    try {
      const { reason } = req.body;
      const target = await storage.getUser(req.params.id);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.isAdmin) return res.status(400).json({ message: "Não é possível suspender um admin" });

      await storage.updateUser(req.params.id, {
        isSuspended: true,
        suspendedReason: reason || "Violação dos termos de uso",
      });

      // Revoga todas as sessões ativas do usuário suspenso
      const sessions = await storage.getUserSessions(req.params.id);
      for (const s of sessions) await storage.revokeSession(s.id, req.params.id);

      await storage.createLog({
        type: "security", level: "warn",
        message: `Admin suspendeu conta: ${target.username}. Motivo: ${reason || "não informado"}`,
        userId: req.session.userId,
        metadata: { targetUserId: req.params.id },
      });

      res.json({ success: true, sessionsRevoked: sessions.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to suspend user" });
    }
  });

  app.post("/api/admin/users/:id/unsuspend", requireAdmin, async (req, res) => {
    try {
      const target = await storage.getUser(req.params.id);
      if (!target) return res.status(404).json({ message: "User not found" });

      await storage.updateUser(req.params.id, { isSuspended: false, suspendedReason: null });

      await storage.createLog({
        type: "security", level: "info",
        message: `Admin reativou conta: ${target.username}`,
        userId: req.session.userId,
        metadata: { targetUserId: req.params.id },
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to unsuspend user" });
    }
  });

  // ── NOVO: Desbloquear conta (resetar tentativas) ───────────────
  app.post("/api/admin/users/:id/unlock", requireAdmin, async (req, res) => {
    try {
      const target = await storage.getUser(req.params.id);
      if (!target) return res.status(404).json({ message: "User not found" });

      await storage.resetFailedLogins(req.params.id);

      await storage.createLog({
        type: "security", level: "info",
        message: `Admin desbloqueou conta: ${target.username}`,
        userId: req.session.userId,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to unlock user" });
    }
  });

  // ── NOVO: Ver sessões de um usuário (admin) ────────────────────
  app.get("/api/admin/users/:id/sessions", requireAdmin, async (req, res) => {
    try {
      const sessions = await storage.getUserSessions(req.params.id);
      const safe = sessions.map(({ sessionToken: _, ...s }) => s);
      res.json({ sessions: safe });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user sessions" });
    }
  });

  app.get("/api/admin/logs", requireAdmin, async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      res.json({ logs: await storage.getLogs({ type, limit: 100 }) });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });




  // ── ALTERNATIVA: autenticação admin via token MTA para painel/scan ──
  // O scanner/painel pode não ter sessão/cookie.
  // Permitimos header x-api-token (mesmo usado em requireAdmin) sem precisar login.


  app.get("/api/admin/mta-settings", requireAdmin, async (req, res) => {
    try {
      res.json({ settings: await storage.getMtaSettings() });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch MTA settings" });
    }
  });

  app.post("/api/admin/mta-settings", requireAdmin, async (req, res) => {
    try {
      const { serverUrl, serverPort, apiToken, isActive } = req.body;
      if (serverUrl && !serverUrl.startsWith("http")) {
        return res.status(400).json({ message: "URL deve começar com http:// ou https://" });
      }

      let settings = await storage.getMtaSettings();
      settings = settings
        ? await storage.updateMtaSettings({ serverUrl, serverPort, apiToken, isActive })
        : await storage.createMtaSettings({ serverUrl, serverPort, apiToken, isActive });

      await storage.createLog({ type: "admin", level: "info", message: "Configurações MTA atualizadas", userId: req.session.userId });
      res.json({ settings });
    } catch (error) {
      res.status(500).json({ message: "Failed to update MTA settings" });
    }
  });

  app.get("/api/admin/mta-health", requireAdmin, async (_req, res) => {
    try {
      const settings = await storage.getMtaSettings();
      if (!settings || !settings.isActive) {
        return res.json({ status: "offline", reason: "not_configured", checkedAt: new Date().toISOString() });
      }

      let status: "online" | "offline" = "offline";
      try {
        const resp = await fetch(`${settings.serverUrl}:${settings.serverPort}/mta_store/health`, {
          method: "GET",
          headers: { "X-API-Token": settings.apiToken },
          signal: AbortSignal.timeout(5000),
        });
        status = resp.ok ? "online" : "offline";
      } catch { status = "offline"; }

      res.json({ status, checkedAt: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ message: "Failed to check MTA health" });
    }
  });





  // Alias usado pelo painel admin ("Testar conexão")
  app.get("/api/admin/mta-test", requireAdmin, async (_req, res) => {
    try {
      const settings = await storage.getMtaSettings();
      if (!settings?.serverUrl) {
        return res.json({ success: false, message: "Servidor MTA não configurado" });
      }
      try {
        const resp = await fetch(`${settings.serverUrl}:${settings.serverPort}/mta_store/health`, {
          method: "GET",
          headers: { "X-API-Token": settings.apiToken },
          signal: AbortSignal.timeout(5000),
        });
        if (resp.ok) return res.json({ success: true, message: "Servidor MTA respondeu com sucesso" });
        return res.json({ success: false, message: `Servidor retornou HTTP ${resp.status}` });
      } catch (e: any) {
        return res.json({ success: false, message: `Sem resposta: ${e.message}` });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: "Erro interno" });
    }
  });

  // Recebe sync disparado pelo comando /storesync no MTA
  app.post("/api/mta/sync", async (req, res) => {
    try {
      const apiToken = req.headers["x-api-token"];
      const settings = await storage.getMtaSettings();

      if (!settings || apiToken !== settings.apiToken) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const { detected = [], resources = [], trigger, scannedAt } = req.body;

      let created = 0;
      let skipped = 0;

      for (const item of detected) {
        const sku = `AUTO-${item.resourceName}-${item.mtaCommand}-${JSON.stringify(item.mtaParams || {}).slice(0, 20)}`
          .replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 80);

        const existing = await storage.getProductBySku(sku);
        if (existing) { skipped++; continue; }

        await storage.createProduct({
          name:        item.suggestedName,
          description: item.suggestedDesc || "",
          sku,
          price:       "0.00",
          currency:    "BRL",
          category:    item.category || "item",
          mtaCommand:  item.mtaCommand,
          mtaParams:   item.mtaParams || {},
          isActive:    false,
        });
        created++;
      }

      await storage.createLog({
        type:    "admin",
        level:   "info",
        message: `Sync via comando MTA por "${trigger}": ${resources.length} mods, ${detected.length} detectados, ${created} criados, ${skipped} existiam.`,
      });

      // Notifica admins online via WebSocket
      broadcastAdmin("command_sync", {
        trigger,
        scannedAt,
        total:   detected.length,
        created,
        skipped,
        message: `Sync concluído por ${trigger}: ${created} produto(s) criado(s).`,
      });

      res.json({ success: true, total: detected.length, created, skipped });
    } catch (error) {
      console.error("Command sync error:", error);
      res.status(500).json({ success: false, error: "Internal error" });
    }
  });

  // Auto-cria produtos a partir dos itens detectados pelo scanner
  app.post("/api/admin/mta-auto-sync", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getMtaSettings();
      if (!settings || !settings.isActive) {
        return res.status(400).json({ message: "Servidor MTA não configurado." });
      }

      // Busca scan fresh do servidor
      const scanUrl = `${settings.serverUrl}:${settings.serverPort}/mta_store/scan`;
      const response = await fetch(scanUrl, {
        method: "GET",
        headers: { "X-API-Token": settings.apiToken },
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        return res.status(502).json({ message: "Erro ao buscar scan do MTA." });
      }

      const scanData = await response.json();
      const detected: any[] = scanData.detected || [];

      if (detected.length === 0) {
        return res.json({ created: 0, skipped: 0, message: "Nenhum item detectado automaticamente." });
      }

      let created = 0;
      let skipped = 0;

      for (const item of detected) {
        // Verifica se produto com mesmo comando+params já existe
        const sku = `AUTO-${item.resourceName}-${item.mtaCommand}-${JSON.stringify(item.mtaParams || {}).slice(0, 20)}`.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 80);

        const existing = await storage.getProductBySku(sku);
        if (existing) { skipped++; continue; }

        await storage.createProduct({
          name:        item.suggestedName,
          description: item.suggestedDesc,
          sku,
          price:       "0.00",   // admin define o preço
          currency:    "BRL",
          category:    item.category || "item",
          mtaCommand:  item.mtaCommand,
          mtaParams:   item.mtaParams || {},
          isActive:    false,    // começa inativo até admin ativar
        });

        created++;
      }

      await storage.createLog({
        type: "admin",
        level: "info",
        message: `Auto-sync: ${created} produto(s) criado(s), ${skipped} já existiam.`,
      });

      res.json({
        created,
        skipped,
        total: detected.length,
        message: `${created} produto(s) criado(s) automaticamente! Configure o preço e ative-os no painel de Produtos.`,
      });
    } catch (error) {
      console.error("Auto-sync error:", error);
      res.status(500).json({ message: "Falha no auto-sync." });
    }
  });

  // ── SCAN DE RESOURCES DO SERVIDOR MTA ──────────────────────────────
  // Escaneia todos os resources instalados e retorna para o painel admin
  // Permite autenticação via token (header x-api-token) ou sessão (cookie)
  app.get("/api/admin/mta-scan", async (req, res) => {
    try {
      const apiToken = req.headers["x-api-token"] as string | undefined;

      // valida token se enviado; caso não, valida sessão
      if (!req.session?.userId) {
        if (!apiToken) return res.status(401).json({ message: "Authentication required" });

        const settings = await storage.getMtaSettings();
        if (!settings || apiToken !== settings.apiToken) {
          return res.status(401).json({ message: "Authentication required" });
        }
      } else {
        // sessão presente: exige admin
        const user = await storage.getUser(req.session.userId);
        if (!user?.isAdmin) return res.status(403).json({ message: "Admin access required" });
        (req as any).adminUser = user;
      }

      const settings = await storage.getMtaSettings();
      if (!settings || !settings.isActive) {
        return res.status(400).json({ message: "Servidor MTA não configurado ou inativo." });
      }


      const scanUrl = `${settings.serverUrl}:${settings.serverPort}/mta_store/scan`;
      const response = await fetch(scanUrl, {
        method: "GET",
        headers: { "X-API-Token": settings.apiToken },
        signal: AbortSignal.timeout(15000), // scan pode demorar um pouco
      });

      if (!response.ok) {
        return res.status(502).json({ message: "MTA retornou erro ao escanear resources." });
      }

      const data = await response.json();

      await storage.createLog({
        type: "admin",
        level: "info",
        message: `Scan de resources executado: ${data.total} encontrados, ${data.running} rodando`,
      });

      res.json(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({ message: `Falha ao escanear: ${msg}` });
    }
  });

  // Sincroniza um resource com a loja (cria produto baseado no resource)
  app.post("/api/admin/mta-sync", async (req, res) => {
    try {
      const apiToken = req.headers["x-api-token"] as string | undefined;

      if (!req.session?.userId) {
        if (!apiToken) return res.status(401).json({ message: "Authentication required" });
        const settings = await storage.getMtaSettings();
        if (!settings || apiToken !== settings.apiToken) {
          return res.status(401).json({ message: "Authentication required" });
        }
      } else {
        const user = await storage.getUser(req.session.userId);
        if (!user?.isAdmin) return res.status(403).json({ message: "Admin access required" });
        (req as any).adminUser = user;
      }

      const { resourceName, productName, description, price, category, mtaCommand, mtaParams } = req.body;

      if (!resourceName || !productName || !price || !mtaCommand) {
        return res.status(400).json({ message: "Campos obrigatórios: resourceName, productName, price, mtaCommand" });
      }

      const sku = `SYNC-${resourceName.toUpperCase()}-${Date.now()}`;

      const product = await storage.createProduct({
        name: productName,
        description: description || `Produto sincronizado do resource: ${resourceName}`,
        sku,
        price: String(price),
        currency: "BRL",
        category: category || "item",
        mtaCommand,
        mtaParams: mtaParams || {},
        isActive: false,
      });

      await storage.createLog({
        type: "admin",
        level: "info",
        message: `Resource "${resourceName}" sincronizado como produto "${productName}" (inativo até aprovação)`,
      });

      res.json({ product, message: "Produto criado! Ative-o no painel de produtos quando estiver pronto." });
    } catch (error) {
      res.status(500).json({ message: "Falha ao sincronizar resource." });
    }
  });



  // ══════════════════════════════════════════════════════════════════
  // PLAYER SYNC — recebe dados do servidor MTA e auto-login
  // ══════════════════════════════════════════════════════════════════

  // MTA envia token de auto-login gerado no servidor
  // (rota separada para tokens. Evita duplicar /api/player/sync)
  app.post("/api/player/token", async (req, res) => {
    try {
      const apiToken = req.headers["x-api-token"];
      const settings = await storage.getMtaSettings();

      if (!settings || apiToken !== settings.apiToken) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const { serial, token, expiresIn = 300 } = req.body;
      if (!serial) {
        return res.status(400).json({ success: false, error: "serial obrigatório" });
      }
      if (!token) {
        return res.status(400).json({ success: false, error: "token obrigatório" });
      }

      const expiresAt = new Date(Date.now() + Number(expiresIn) * 1000);
      await storage.upsertPlayerToken({ serial, token, expiresAt });

      res.json({ success: true });
    } catch (error) {
      console.error("Player token error:", error);
      res.status(500).json({ success: false, error: "Internal error" });
    }
  });


  // MTA sincroniza dados do jogador
  app.post("/api/player/sync", async (req, res) => {
    try {
      const apiToken = req.headers["x-api-token"];

      const settings = await storage.getMtaSettings();
      // Se não existe mtaSettings criado, mas o mod está enviando token via header,
      // não bloqueamos aqui: ajudamos a diagnosticar. (volta a bloquear quando criar settings)
      if (!settings) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized: mtaSettings not configured",
          receivedTokenPresent: Boolean(apiToken),
        });
      }

      if (apiToken !== settings.apiToken) {
        return res.status(401).json({ success: false, error: "Unauthorized: invalid api token" });
      }

      const { serial, online, ...playerData } = req.body;
      if (!serial) {
        return res.status(400).json({ success: false, error: "serial obrigatório" });
      }

      await storage.upsertPlayerData({ serial, online: online ?? false, ...playerData });

      // Transmite em tempo real para o dashboard do jogador
      broadcastPlayerData(serial, { serial, online: online ?? false, ...playerData });

      // Transmite para admins online
      if (online === false) {
        broadcastAdmin("player_offline", { serial });
      } else {
        broadcastAdmin("player_online", { serial });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Player sync error:", error);
      res.status(500).json({ success: false, error: "Internal error" });
    }
  });

  // Site valida token e faz auto-login
  app.post("/api/player/auto-login", rateLimit(10, 60 * 1000), async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ message: "Token obrigatório" });

      const playerToken = await storage.getPlayerToken(token);

      if (!playerToken) {
        return res.status(401).json({ message: "Token inválido ou expirado" });
      }

      if (playerToken.used) {
        return res.status(401).json({ message: "Token já utilizado" });
      }

      if (new Date(playerToken.expiresAt) < new Date()) {
        return res.status(401).json({ message: "Token expirado. Digite /loja no servidor para gerar um novo." });
      }

      // Marca token como usado
      await storage.markPlayerTokenUsed(token);

      // Busca ou cria o usuário vinculado ao serial
      let user = await storage.getUserByMtaSerial(playerToken.serial);

      if (!user) {
        // Cria conta automaticamente pelo serial.
        // Username usa o serial truncado (único por definição) para evitar colisões.
        const playerData = await storage.getPlayerData(playerToken.serial);
        const serialSuffix = playerToken.serial.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toLowerCase();
        const baseName = playerData?.nome
          ? playerData.nome.replace(/\s+/g, "").toLowerCase().slice(0, 12)
          : "jogador";
        const username = `${baseName}_${serialSuffix}`;

        // Senha gerada com crypto — não é usável via login normal (conta somente MTA)
        const securePassword = crypto.randomBytes(32).toString("hex");

        user = await storage.createUser({
          username,
          email: `${serialSuffix}@mtastore.local`,
          password: securePassword,
          mtaSerial: playerToken.serial,
        });
      }

      // Faz login
      req.session.userId = user.id;

      const { password: _, ...safeUser } = user;

      await storage.createLog({
        type: "auth",
        level: "info",
        message: `Auto-login via MTA serial: ${user.username}`,
        userId: user.id,
        ipAddress: req.ip,
      });

      res.json({ success: true, user: safeUser });
    } catch (error) {
      console.error("Auto-login error:", error);
      res.status(500).json({ message: "Erro no auto-login" });
    }
  });

  // Retorna dados do jogador — somente o próprio usuário ou admin
  app.get("/api/player/data/:serial?", async (req, res) => {
    try {
      const requestedSerial = req.params.serial;

      // Resolve o serial do usuário logado (se houver)
      let ownerSerial: string | null = null;
      if (req.session.userId) {
        const me = await storage.getUser(req.session.userId);
        ownerSerial = me?.mtaSerial ?? null;

        // Admin pode ver qualquer serial
        if (me?.isAdmin && requestedSerial) {
          const data = await storage.getPlayerData(requestedSerial);
          if (!data) return res.status(404).json({ message: "Jogador não encontrado" });
          return res.json({ player: data });
        }
      }

      // Sem sessão: não retorna nada
      if (!req.session.userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Usuário comum só pode ver o próprio serial
      const serial = requestedSerial || ownerSerial;
      if (!serial) return res.status(400).json({ message: "Serial não encontrado" });

      if (requestedSerial && requestedSerial !== ownerSerial) {
        return res.status(403).json({ message: "Acesso negado: você só pode ver seus próprios dados." });
      }

      const data = await storage.getPlayerData(serial);
      if (!data) return res.status(404).json({ message: "Jogador não encontrado" });

      res.json({ player: data });
    } catch (error) {
      console.error("Player data error:", error);
      res.status(500).json({ message: "Erro ao buscar dados" });
    }
  });

  // Health check público — usado pelo Cloudflare, Docker e Railway
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      env: process.env.NODE_ENV,
    });
  });



  return httpServer;
}

