import { createClient } from '@supabase/supabase-js';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Supabase is optional - we can run without it
function getSupabaseClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return null;
  }
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

// Simple in-memory rate limiter (production should use Redis)
const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

// Simple global rate limiter (no API keys needed - public service like PayAI)
const DEFAULT_RATE_LIMIT_RPM = 1000;

export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ip = request.ip;
  const now = Date.now();
  const windowKey = `${ip}:${Math.floor(now / 60000)}`; // 1-minute window per IP
  
  const current = rateLimitCache.get(windowKey) || { count: 0, resetAt: now + 60000 };
  current.count += 1;

  if (current.count > DEFAULT_RATE_LIMIT_RPM) {
    reply.code(429).send({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((current.resetAt - now) / 1000),
    });
    return;
  }

  rateLimitCache.set(windowKey, current);
  
  // Cleanup old entries
  for (const [key, value] of rateLimitCache.entries()) {
    if (value.resetAt < now) {
      rateLimitCache.delete(key);
    }
  }
}

