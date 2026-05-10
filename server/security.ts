import crypto from "crypto";

export function hashSessionToken(sessionId: string | undefined | null) {
  if (!sessionId) return "";
  // Hash determinístico para comparar tokens (sem armazenar sessionID puro)
  return crypto.createHash("sha256").update(String(sessionId)).digest("hex");
}

export function parseDeviceName(userAgent: string | undefined | null) {
  const ua = String(userAgent || "");
  if (!ua) return null;

  const uaLower = ua.toLowerCase();

  const isWindows = uaLower.includes("windows");
  const isMac = uaLower.includes("mac os");
  const isLinux = uaLower.includes("linux");

  const isAndroid = uaLower.includes("android");
  const isiOS = uaLower.includes("iphone") || uaLower.includes("ipad") || uaLower.includes("ipod");

  let platform = "";
  if (isiOS) platform = "iOS";
  else if (isAndroid) platform = "Android";
  else if (isWindows) platform = "Windows";
  else if (isMac) platform = "macOS";
  else if (isLinux) platform = "Linux";
  else platform = "Unknown";

  // Browser
  let browser = "";
  if (uaLower.includes("chrome") && !uaLower.includes("edg") && !uaLower.includes("opr")) browser = "Chrome";
  else if (uaLower.includes("safari") && !uaLower.includes("chrome")) browser = "Safari";
  else if (uaLower.includes("firefox")) browser = "Firefox";
  else if (uaLower.includes("edg") || uaLower.includes("edge")) browser = "Edge";
  else if (uaLower.includes("opr") || uaLower.includes("opera")) browser = "Opera";
  else browser = "Browser";

  // Versão não é essencial aqui
  return `${browser} no ${platform}`;
}

export function detectSuspiciousActivity(input: {
  purchaseIp: string;
  lastLoginIp?: string | null;
  userCreatedAt?: Date | string | null;
  purchaseAmount: number;
  userTotalPurchases?: number | null;
}): { suspicious: boolean; reason: string } {
  const { purchaseIp, lastLoginIp, userCreatedAt, purchaseAmount, userTotalPurchases } = input;

  const normalizedLastLoginIp = (lastLoginIp || "").trim();
  const ipMismatch = normalizedLastLoginIp && purchaseIp !== normalizedLastLoginIp;

  const createdAtDate = userCreatedAt ? new Date(userCreatedAt) : null;
  const accountAgeMs = createdAtDate ? Date.now() - createdAtDate.getTime() : null;
  const accountIsNew = accountAgeMs !== null && accountAgeMs < 1000 * 60 * 60 * 24; // < 24h

  const totalPurchases = typeof userTotalPurchases === "number" ? userTotalPurchases : 0;
  const highAmount = purchaseAmount >= 500; // heurística simples
  const firstPurchaseButHigh = totalPurchases <= 0 && highAmount;

  // heurística simples (mantém o comportamento funcional do projeto)
  if (firstPurchaseButHigh) {
    return { suspicious: true, reason: "Primeira compra com valor alto" };
  }

  if (accountIsNew && ipMismatch && highAmount) {
    return { suspicious: true, reason: "Conta nova, IP mudou e valor alto" };
  }

  if (ipMismatch && highAmount) {
    return { suspicious: true, reason: "IP mudou e valor alto" };
  }

  return { suspicious: false, reason: "" };
}

