import type { Context, Next } from 'hono';
import { createHash } from 'crypto';
import type { IdempotencyStore } from '../store/idempotency-store';

export function idempotencyMiddleware(store: IdempotencyStore) {
  return async (c: Context, next: Next) => {
    const key = c.req.header('Idempotency-Key');
    if (!key) {
      return c.json({ error: 'Idempotency-Key header required' }, 400);
    }

    // Validate key format (UUID-like, max 128 chars)
    if (key.length > 128) {
      return c.json({ error: 'Idempotency-Key too long' }, 400);
    }

    // Hash the request body for conflict detection
    const body = await c.req.text();
    const payloadHash = createHash('sha256').update(body).digest('hex');

    // Check for existing response
    const existing = store.get(key);
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        return c.json({ error: 'Idempotency key already used with different payload' }, 409);
      }
      // Return cached response
      c.header('X-Idempotent-Replayed', 'true');
      return c.json(JSON.parse(existing.response));
    }

    // Store key and payload hash on context for downstream use
    c.set('idempotencyKey', key);
    c.set('payloadHash', payloadHash);
    c.set('requestBody', body);

    await next();
  };
}
