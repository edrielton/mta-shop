/**
 * security.ts — Utilidades de segurança
 * 
 * - parseDevice: identifica o navegador/OS a partir do User-Agent
 * - hashSessionToken: cria hash SHA-256 da session ID para armazenar no banco
 * - detectSuspiciousActivity: verifica se uma compra parece suspeita
 */

import crypto from "crypto";

/** Gera um hash SHA-256 da session ID do express-session para armazenar no banco */
export function hashSessionToken(sessionId: string): string {
  return crypto.createHash("sha256").update(sessionId).digest("hex");
}

/** Extrai um nome amigável do dispositivo a partir do User-Agent */
export function parseDeviceName(userAgent?: string): string {
  if (!userAgent) return "Dispositivo desconhecido";

  const ua = userAgent.toLowerCase();

  // OS
  let os = "Desconhecido";
  if (ua.includes("windows"))       os = "Windows";
  else if (ua.includes("mac os"))   os = "Mac";
  else if (ua.includes("android"))  os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("linux"))    os = "Linux";

  // Browser
  let browser = "Navegador";
  if (ua.includes("chrome") && !ua.includes("edg"))      browser = "Chrome";
  else if (ua.includes("firefox"))                         browser = "Firefox";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("edg"))                             browser = "Edge";
  else if (ua.includes("opera") || ua.includes("opr"))    browser = "Opera";

  return `${browser} no ${os}`;
}

/**
 * Detecta atividade suspeita em uma compra.
 * Retorna { suspicious: false } ou { suspicious: true, reason: "..." }
 */
export function detectSuspiciousActivity(opts: {
  purchaseIp: string;
  lastLoginIp?: string | null;
  userCreatedAt?: Date | null;
  purchaseAmount: number;
  userTotalPurchases: number;
}): { suspicious: boolean; reason?: string } {
  const { purchaseIp, lastLoginIp, userCreatedAt, purchaseAmount, userTotalPurchases } = opts;

  // Compra de IP diferente do último login
  if (lastLoginIp && purchaseIp !== lastLoginIp) {
    return {
      suspicious: true,
      reason: `IP de compra (${purchaseIp}) diferente do último login (${lastLoginIp})`,
    };
  }

  // Conta criada há menos de 5 minutos comprando produto caro (>R$50)
  if (userCreatedAt && purchaseAmount > 50) {
    const ageMs = Date.now() - userCreatedAt.getTime();
    const ageMinutes = ageMs / 1000 / 60;
    if (ageMinutes < 5) {
      return {
        suspicious: true,
        reason: `Conta com ${Math.floor(ageMinutes)} min de vida comprando R$${purchaseAmount.toFixed(2)}`,
      };
    }
  }

  // Primeira compra acima de R$200
  if (userTotalPurchases === 0 && purchaseAmount > 200) {
    return {
      suspicious: true,
      reason: `Primeira compra de alto valor: R$${purchaseAmount.toFixed(2)}`,
    };
  }

  return { suspicious: false };
}
