/**
 * adminGuard.ts
 * Middleware de proteção do painel admin por IP + subdomínio.
 *
 * Bloqueia qualquer acesso às rotas /admin e /api/admin
 * que não venha do IP autorizado.
 */

import { Request, Response, NextFunction } from "express";

// IPs permitidos — separados por vírgula no .env
// Ex: ADMIN_ALLOWED_IPS=177.37.234.78,192.168.1.1
function getAllowedIps(): string[] {
  const raw = process.env.ADMIN_ALLOWED_IPS || "";
  return raw
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
}

function getClientIp(req: Request): string {
  // Cloudflare coloca o IP real do visitante neste header
  const cfIp = req.headers["cf-connecting-ip"];
  if (cfIp) return String(cfIp).trim();

  // Fallback: X-Forwarded-For (Railway, Render, proxies comuns)
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }

  return req.ip || "";
}

export function adminIpGuard(req: Request, res: Response, next: NextFunction) {
  const allowedIps = getAllowedIps();

  // Se não configurou IPs, bloqueia tudo por segurança
  if (allowedIps.length === 0) {
    return res.status(503).json({
      message: "Painel admin desativado. Configure ADMIN_ALLOWED_IPS no servidor.",
    });
  }

  const clientIp = getClientIp(req);

  if (!allowedIps.includes(clientIp)) {
    // Log da tentativa de acesso negado
    console.warn(
      `[AdminGuard] Acesso NEGADO — IP: ${clientIp} | Rota: ${req.path} | ${new Date().toISOString()}`
    );

    // Retorna 404 em vez de 403 para não revelar que o painel existe
    return res.status(404).send("Not Found");
  }

  next();
}

export function logAdminAccess(req: Request, _res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  console.log(`[AdminGuard] Acesso PERMITIDO — IP: ${ip} | Rota: ${req.path}`);
  next();
}
