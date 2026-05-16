import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import {
  loginSchema, registerSchema, insertProductSchema, changePasswordSchema
} from "@shared/schema";
import session from "express-session";
import bcrypt from "bcrypt";
import { z } from "zod";
import crypto from "crypto";
import { hashSessionToken, parseDeviceName, detectSuspiciousActivity } from "./security";

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

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

// ============ AUTH MIDDLEWARE ============

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user?.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

/** Verifica se conta está suspensa ou bloqueada. Bloqueia o acesso se sim. */
async function requireActiveAccount(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return next();

  const user = await storage.getUser(req.session.userId);
  if (!user) return next();

  if (user.isSuspended) {
    req.session.destroy(() => {});
    return res.status(403).json({
      message: "Conta suspensa.",
      reason: user.suspendedReason || "Entre em contato com o suporte.",
      code: "ACCOUNT_SUSPENDED",
    });
  }

  const lockStatus = await storage.isAccountLocked(user.id);
  if (lockStatus.locked) {
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

// ============ PROCESS PAYMENT (centralizado) ============

async function processCompletedPayment(stripeSessionId: string, paymentIntentId: string | null) {
  const transaction = await storage.getTransactionByStripeSession(stripeSessionId);
  if (!transaction || transaction.status === "completed") return;

  await storage.updateTransaction(transaction.id, {
    status: "completed",
    stripePaymentIntentId: paymentIntentId ?? undefined,
  });

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
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "mta-store-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  });

  // Aplica verificação de conta em todas as rotas autenticadas
  app.use("/api/user", requireAuth, requireActiveAccount);
  app.use("/api/checkout", requireActiveAccount);
  app.use("/api/admin", requireActiveAccount);

  // ============ STRIPE WEBHOOK ============

  app.post("/api/checkout/webhook", async (req: any, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event: any;

    try {
      const stripe = await getUncachableStripeClient();
      if (webhookSecret && sig && req.rawBody) {
        event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, webhookSecret);
      } else {
        const raw = req.rawBody instanceof Buffer ? req.rawBody.toString("utf8") : JSON.stringify(req.body);
        event = JSON.parse(raw);
      }
    } catch (err) {
      return res.status(400).json({ message: "Webhook signature invalid" });
    }

    try {
      if (event.type === "checkout.session.completed") {
        const s = event.data.object;
        if (s.payment_status === "paid") await processCompletedPayment(s.id, s.payment_intent);
      } else if (event.type === "payment_intent.payment_failed") {
        const pi = event.data.object;
        await storage.createLog({
          type: "payment", level: "error",
          message: `Pagamento falhou: ${pi.last_payment_error?.message || "desconhecido"}`,
        });
      }
      res.json({ received: true });
    } catch (error) {
      console.error("[Webhook] Error:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
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

      // Registra sessão
      await storage.createSession({
        userId: user.id,
        sessionToken: hashSessionToken(req.sessionID),
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
        deviceName: parseDeviceName(req.get("user-agent")),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isRevoked: false,
      });

      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser });
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

      // Timing attack prevention
      const dummyHash = "$2b$12$invalidhashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
      const validPassword = await bcrypt.compare(data.password, user ? user.password : dummyHash);

      if (!user || !validPassword) {
        // Incrementa tentativas falhas se o usuário existe
        if (user) {
          const { attempts, locked } = await storage.incrementFailedLogins(user.id);
          await storage.createLog({
            type: "security", level: "warn",
            message: `Login falhou para ${user.username} (tentativa ${attempts}/${5})`,
            userId: user.id, ipAddress: req.ip, userAgent: req.get("user-agent"),
          });

          if (locked) {
            return res.status(403).json({
              message: `Conta bloqueada por ${30} minutos após 5 tentativas falhas.`,
              code: "ACCOUNT_LOCKED",
            });
          }
        }
        return res.status(401).json({ message: "Usuário ou senha inválidos" });
      }

      // Verifica se conta está suspensa
      if (user.isSuspended) {
        return res.status(403).json({
          message: "Conta suspensa. Entre em contato com o suporte.",
          reason: user.suspendedReason,
          code: "ACCOUNT_SUSPENDED",
        });
      }

      // Verifica bloqueio ativo
      const lockStatus = await storage.isAccountLocked(user.id);
      if (lockStatus.locked) {
        return res.status(403).json({
          message: "Conta temporariamente bloqueada. Tente novamente mais tarde.",
          lockedUntil: lockStatus.until,
          code: "ACCOUNT_LOCKED",
        });
      }

      // Login bem-sucedido — reseta tentativas e atualiza lastLogin
      await storage.resetFailedLogins(user.id);
      await storage.updateUser(user.id, {
        lastLoginAt: new Date(),
        lastLoginIp: req.ip,
      });

      req.session.userId = user.id;

      // Registra sessão no banco
      await storage.createSession({
        userId: user.id,
        sessionToken: hashSessionToken(req.sessionID),
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
      res.json({ user: safeUser });
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
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  // Usuário atual
  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
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

  // ============ CHECKOUT ROUTES ============

  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (error) {
      res.status(500).json({ message: "Failed to get Stripe key" });
    }
  });

  app.post("/api/checkout", requireAuth, rateLimit(3, 60 * 1000, true), async (req, res) => {
    try {
      const { productId } = req.body;
      if (!productId || typeof productId !== "string") {
        return res.status(400).json({ message: "Product ID is required" });
      }

      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ message: "Product not found" });
      if (!product.isActive) return res.status(400).json({ message: "Product is not available" });
      if (product.stockQuantity !== null && product.stockQuantity !== undefined && product.stockQuantity <= 0) {
        return res.status(400).json({ message: "Produto fora de estoque" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Verifica suspensão e bloqueio antes do checkout
      if (user.isSuspended) {
        return res.status(403).json({ message: "Conta suspensa. Compra não autorizada.", code: "ACCOUNT_SUSPENDED" });
      }

      // ── Detecção de atividade suspeita ─────────────────────────
      const userStats = await storage.getUserStats(user.id);
      const purchaseAmount = parseFloat(product.price);
      const purchaseIp = req.ip || "unknown";

      const suspicion = detectSuspiciousActivity({
        purchaseIp,
        lastLoginIp: user.lastLoginIp,
        userCreatedAt: user.createdAt,
        purchaseAmount,
        userTotalPurchases: userStats.totalPurchases,
      });

      if (suspicion.suspicious) {
        await storage.createLog({
          type: "security", level: "warn",
          message: `Compra suspeita detectada: ${suspicion.reason}`,
          userId: user.id, ipAddress: purchaseIp,
          metadata: { productId, amount: purchaseAmount },
        });
      }

      const stripe = await getUncachableStripeClient();
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user.id, username: user.username },
        });
        customerId = customer.id;
        await storage.updateUser(user.id, { stripeCustomerId: customerId });
      }

      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const baseUrl = `${protocol}://${req.headers.host}`;

      const stripeSession = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: (product.currency || "brl").toLowerCase(),
            product_data: { name: product.name, description: product.description || undefined },
            unit_amount: Math.round(purchaseAmount * 100),
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/checkout/cancel`,
        metadata: { productId: product.id, userId: user.id },
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      });

      await storage.createTransaction({
        userId: user.id,
        productId: product.id,
        stripeCheckoutSessionId: stripeSession.id,
        amount: product.price,
        currency: product.currency || "BRL",
        status: "pending",
        paymentMethod: "stripe",
        purchaseIp,
        isSuspicious: suspicion.suspicious,
        suspiciousReason: suspicion.reason,
      });

      await storage.createLog({
        type: "payment", level: "info",
        message: `Checkout criado: ${product.name}${suspicion.suspicious ? " ⚠️ SUSPEITO" : ""}`,
        userId: user.id,
        metadata: { productId: product.id, sessionId: stripeSession.id, suspicious: suspicion.suspicious },
      });

      res.json({ url: stripeSession.url });
    } catch (error) {
      console.error("Checkout error:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  app.get("/api/checkout/verify", requireAuth, async (req, res) => {
    try {
      const sessionId = req.query.session_id as string;
      if (!sessionId) return res.status(400).json({ message: "Session ID required" });

      const stripe = await getUncachableStripeClient();
      const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);

      if (stripeSession.payment_status === "paid") {
        await processCompletedPayment(sessionId, stripeSession.payment_intent as string | null);
        const transaction = await storage.getTransactionByStripeSession(sessionId);
        return res.json(transaction || { status: "completed" });
      }

      res.json({ status: stripeSession.payment_status });
    } catch (error) {
      res.status(500).json({ message: "Failed to verify checkout" });
    }
  });

  // ============ ADMIN ROUTES ============

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
