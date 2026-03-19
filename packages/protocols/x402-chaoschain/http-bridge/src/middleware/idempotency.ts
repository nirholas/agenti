import { createClient } from '@supabase/supabase-js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';

// In-memory cache for idempotency when Supabase not configured
const inMemoryCache = new Map<string, { response: any; createdAt: number }>();

// Lazy load Supabase (optional for testing)
function getSupabaseClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return null;
  }
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

/**
 * Get idempotency key from header or derive stable hash from payload
 */
export function getIdempotencyKey(req: FastifyRequest): string {
  const hdr = (req.headers['idempotency-key'] as string) || '';
  if (hdr) return hdr;

  // Derive stable hash from route + body for automatic deduplication
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const seed = `${req.routerPath}|${body}`;
  return crypto.createHash('sha256').update(seed).digest('hex');
}

/**
 * Try to serve cached response if it exists
 * Returns true if response was served from cache
 */
export async function tryServeCachedResponse(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> {
  const key = getIdempotencyKey(request);
  const supabase = getSupabaseClient();
  
  // Try Supabase first if configured
  if (supabase) {
    try {
      const { data } = await supabase
        .from('idempotency_store')
        .select('response')
        .eq('key', key)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .single();

      if (data?.response) {
        // Serve the exact same JSON that was stored (timestamps included)
        reply.code(200).send(data.response);
        return true;
      }
    } catch (error) {
      // Continue to in-memory cache
    }
  }

  // Fallback to in-memory cache (for testing without Supabase)
  const cached = inMemoryCache.get(key);
  if (cached && (Date.now() - cached.createdAt < 24 * 60 * 60 * 1000)) {
    // Serve the exact same JSON that was stored (timestamps included)
    reply.code(200).send(cached.response);
    return true;
  }

  return false;
}

/**
 * Store response for future idempotency checks
 * Stores the EXACT response object that was returned
 */
export async function storeResponseForIdempotency(
  request: FastifyRequest,
  responseBody: any
): Promise<void> {
  const key = getIdempotencyKey(request);
  const supabase = getSupabaseClient();
  
  // Try Supabase first if configured
  if (supabase) {
    try {
      await supabase
        .from('idempotency_store')
        .upsert({
          key,
          response: responseBody,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      // Log error but continue to in-memory fallback
      console.error('[Idempotency] Failed to store in Supabase:', error);
    }
  }

  // Always store in memory as well (for testing without Supabase)
  inMemoryCache.set(key, {
    response: responseBody,
    createdAt: Date.now(),
  });

  // Cleanup old entries from in-memory cache
  const now = Date.now();
  for (const [cacheKey, value] of inMemoryCache.entries()) {
    if (now - value.createdAt > 24 * 60 * 60 * 1000) {
      inMemoryCache.delete(cacheKey);
    }
  }
}
