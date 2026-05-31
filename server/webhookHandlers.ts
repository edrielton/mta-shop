// webhookHandlers.ts — placeholder (webhook handled directly in routes.ts)
export class WebhookHandlers {
  static async processWebhook(_payload: Buffer, _signature: string, _uuid: string): Promise<void> {
    // Webhook processing moved to /api/checkout/webhook route in routes.ts
  }
}
