/**
 * mercadopagoClient.ts — Cliente centralizado do Mercado Pago
 *
 * Suporta:
 *  - PIX (pagamento instantâneo com QR Code)
 *  - Cartão de crédito (via Checkout Pro ou Cards API)
 *
 * Docs: https://www.mercadopago.com.br/developers/pt/docs
 */

import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

let _client: MercadoPagoConfig | null = null;

export function getMercadoPagoClient(): MercadoPagoConfig {
  if (_client) return _client;

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MP_ACCESS_TOKEN não definida nas variáveis de ambiente.");
  }

  _client = new MercadoPagoConfig({
    accessToken,
    options: { timeout: 10000 },
  });

  return _client;
}

/** Cria uma instância de Payment (PIX, cartão, etc.) */
export function getPaymentClient(): Payment {
  return new Payment(getMercadoPagoClient());
}

/** Cria uma instância de Preference (Checkout Pro — cartão + outros métodos) */
export function getPreferenceClient(): Preference {
  return new Preference(getMercadoPagoClient());
}

/** Retorna a public key para o frontend inicializar o SDK JS do MP */
export function getMercadoPagoPublicKey(): string {
  const key = process.env.MP_PUBLIC_KEY;
  if (!key) throw new Error("MP_PUBLIC_KEY não definida nas variáveis de ambiente.");
  return key;
}
