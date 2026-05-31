/**
 * adminGuard.ts
 * Protege rotas /api/admin por IP.
 * Lê o IP real do visitante pelos headers do Cloudflare e Railway.
 */

import { Request, Response, NextFunction } from "express";

function getAllowedIps(): string[] {
  const raw = process.env.ADMIN_ALLOWED_IPS || "";
  return raw.split(",").map((ip) => ip.trim()).filter(Boolean);
}

function getClientIp(req: Request): string {
  // Cloudflare: IP real do visitante
  const cfIp = req.headers["cf-connecting-ip"];
  if (cfIp) return String(cfIp).trim();

  // X-Forwarded-For (Railway, proxies)
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();

  // Fallback direto
  return req.ip || req.socket?.remoteAddress || "";
}

export function adminIpGuard(req: Request, res: Response, next: NextFunction) {
  const allowedIps = getAllowedIps();

  // Se ADMIN_ALLOWED_IPS não estiver configurado, libera (evita bloqueio acidental)
  if (allowedIps.length === 0) {
    console.warn("[AdminGuard] ADMIN_ALLOWED_IPS não configurado — acesso admin liberado para todos. Configure para proteger.");
    return next();
  }

  const clientIp = getClientIp(req);

  if (!allowedIps.includes(clientIp)) {
    console.warn(`[AdminGuard] Acesso NEGADO — IP: ${clientIp} | Rota: ${req.path}`);
    return res.status(403).json({ message: "Acesso negado." });
  }

  console.log(`[AdminGuard] Acesso OK — IP: ${clientIp} | Rota: ${req.path}`);
  next();
}

export function logAdminAccess(req: Request, _res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  console.log(`[Admin] ${req.method} ${req.path} — IP: ${ip}`);
  next();
}
