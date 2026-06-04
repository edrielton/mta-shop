/**
 * stripeClient.ts — Cliente Stripe padrão (sem dependência do Replit)
 * Usa variáveis de ambiente STRIPE_SECRET_KEY e STRIPE_PUBLISHABLE_KEY
 */
import Stripe from "stripe";

let _stripe: Stripe | null = null;

export async function getUncachableStripeClient(): Promise<Stripe> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY não definida nas variáveis de ambiente.");
  }
  if (!_stripe) {
    _stripe = new Stripe(secret, {
      // Para evitar incompatibilidade de types/slugs do SDK, deixamos o SDK escolher a apiVersion.
      // (ainda depende da versão instalada do pacote stripe).
    });


  }
  return _stripe;
}

export async function getStripePublishableKey(): Promise<string> {
  const key = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error("STRIPE_PUBLISHABLE_KEY não definida nas variáveis de ambiente.");
  }
  return key;
}
