import crypto from 'crypto';

export interface SettlementWebhookPayload {
  event: 'payment.settled';
  facilitatorId: string;
  timestamp: string;
  transaction: {
    id: string;
    fromAddress: string;
    toAddress: string;
    amount: string;
    asset: string;
    network: string;
    transactionHash: string | null;
    settledAt: string;
  };
}

export interface ProductWebhookPayload {
  event: 'product.payment';
  productId: string;
  productName: string;
  timestamp: string;
  payment: {
    id: string;
    payerAddress: string;
    amount: string;
    asset: string;
    network: string;
    transactionHash: string;
  };
}

/** @deprecated Use ProductWebhookPayload instead */
export type PaymentLinkWebhookPayload = ProductWebhookPayload;

export interface TestWebhookPayload {
  event: 'webhook.test';
  facilitatorId: string;
  webhookId?: string;
  timestamp: string;
  test: boolean;
  message: string;
}

export type WebhookPayload = SettlementWebhookPayload | ProductWebhookPayload | TestWebhookPayload;

/**
 * Generate a webhook secret (32 bytes, hex encoded)
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create HMAC signature for webhook payload
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Deliver a webhook with retries
 * Returns true if delivered successfully, false otherwise
 */
export async function deliverWebhook(
  url: string,
  secret: string,
  payload: WebhookPayload,
  maxRetries: number = 3
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const body = JSON.stringify(payload);
  const signature = signWebhookPayload(body, secret);
  const timestamp = Date.now().toString();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp,
          'X-Webhook-Event': payload.event,
          'User-Agent': 'OpenFacilitator-Webhook/1.0',
        },
        body,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.ok) {
        console.log(`[Webhook] Delivered to ${url} (attempt ${attempt})`);
        return { success: true, statusCode: response.status };
      }

      // Non-retryable client errors (4xx except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        console.error(`[Webhook] Failed (${response.status}): ${url}`);
        return { success: false, statusCode: response.status, error: `HTTP ${response.status}` };
      }

      // Retryable error, continue to next attempt
      console.warn(`[Webhook] Attempt ${attempt} failed (${response.status}): ${url}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[Webhook] Attempt ${attempt} error: ${message}`);

      if (attempt === maxRetries) {
        return { success: false, error: message };
      }
    }

    // Wait before retry (exponential backoff: 1s, 2s, 4s)
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Send a settlement webhook (fire and forget - doesn't block settlement)
 */
export function sendSettlementWebhook(
  webhookUrl: string,
  webhookSecret: string,
  facilitatorId: string,
  transaction: {
    id: string;
    fromAddress: string;
    toAddress: string;
    amount: string;
    asset: string;
    network: string;
    transactionHash: string | null;
  }
): void {
  const payload: SettlementWebhookPayload = {
    event: 'payment.settled',
    facilitatorId,
    timestamp: new Date().toISOString(),
    transaction: {
      ...transaction,
      settledAt: new Date().toISOString(),
    },
  };

  // Fire and forget - don't await, don't block the settlement response
  deliverWebhook(webhookUrl, webhookSecret, payload).catch((error) => {
    console.error('[Webhook] Delivery failed:', error);
  });
}
