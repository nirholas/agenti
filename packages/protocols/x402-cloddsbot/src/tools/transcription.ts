/**
 * Transcription Tool - speech-to-text with OpenAI + local CLI fallbacks
 */

import { createHash } from 'crypto';
import { existsSync, statSync } from 'fs';
import { assertSandboxPath, resolveSandboxPath } from '../permissions';
import {
  createTranscriptionService,
  type TranscriptionOptions,
  type TranscriptionResult,
} from '../media';
import { logger } from '../utils/logger';

export interface TranscribeOptions extends TranscriptionOptions {
  /** Path relative to workspace root (or absolute within sandbox) */
  path: string;
}

export interface TranscriptionTool {
  isAvailable(): boolean;
  transcribe(options: TranscribeOptions): Promise<TranscriptionResult>;
}

interface RateLimitState {
  windowStart: number;
  count: number;
}

const RATE_LIMIT_MAX = Number(process.env.CLODDS_TRANSCRIBE_RATE_MAX || 10);
const RATE_LIMIT_WINDOW_MS = Number(process.env.CLODDS_TRANSCRIBE_RATE_WINDOW_MS || 60_000);
const CACHE_TTL_MS = Number(process.env.CLODDS_TRANSCRIBE_CACHE_TTL_MS || 5 * 60_000);

const MAX_CACHE_ENTRIES = 50;
type CacheEntry = { expiresAt: number; value: TranscriptionResult };
const cache = new Map<string, CacheEntry>();
let rateLimitState: RateLimitState = { windowStart: 0, count: 0 };

function enforceRateLimit(): void {
  const now = Date.now();
  if (!rateLimitState.windowStart || now - rateLimitState.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitState = { windowStart: now, count: 0 };
  }

  if (rateLimitState.count >= RATE_LIMIT_MAX) {
    const retryInMs = RATE_LIMIT_WINDOW_MS - (now - rateLimitState.windowStart);
    throw new Error(`Transcription rate limit exceeded. Try again in ${Math.max(1, Math.ceil(retryInMs / 1000))}s.`);
  }

  rateLimitState.count += 1;
}

function hashOptions(options: TranscriptionOptions): string {
  const stable = {
    engine: options.engine,
    language: options.language,
    model: options.model,
    prompt: options.prompt ? options.prompt.slice(0, 500) : undefined,
    temperature: options.temperature,
    timestamps: options.timestamps,
  };
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

function makeCacheKey(resolvedPath: string, options: TranscriptionOptions): string {
  const stats = statSync(resolvedPath);
  const basis = {
    path: resolvedPath,
    size: stats.size,
    mtimeMs: Math.floor(stats.mtimeMs),
    opts: hashOptions(options),
  };
  return createHash('sha256').update(JSON.stringify(basis)).digest('hex');
}

function getCached(key: string): TranscriptionResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key: string, value: TranscriptionResult): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [k, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(k);
    }
  }
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function createTranscriptionTool(workspaceRoot: string): TranscriptionTool {
  const sandboxRoot = workspaceRoot;
  const service = createTranscriptionService();

  function resolvePathWithinSandbox(inputPath: string): string {
    const resolved = resolveSandboxPath(inputPath, { root: sandboxRoot, allowSymlinks: false });
    // Extra guard for absolute paths that resolveSandboxPath accepts.
    assertSandboxPath(resolved, { root: sandboxRoot, allowSymlinks: false });
    return resolved;
  }

  return {
    isAvailable() {
      return service.isAvailable();
    },

    async transcribe(options: TranscribeOptions): Promise<TranscriptionResult> {
      if (!options?.path?.trim()) {
        throw new Error('Transcription requires a path');
      }

      const resolvedPath = resolvePathWithinSandbox(options.path.trim());
      if (!existsSync(resolvedPath)) {
        throw new Error(`Audio file not found: ${options.path}`);
      }

      const { path, ...rest } = options;
      const serviceOptions: TranscriptionOptions = { ...rest };

      const cacheKey = makeCacheKey(resolvedPath, serviceOptions);
      const cached = getCached(cacheKey);
      if (cached) {
        logger.debug({ path: options.path }, 'Transcription cache hit');
        return cached;
      }

      enforceRateLimit();
      logger.info({ path: options.path }, 'Transcribing audio');

      const result = await service.transcribe(resolvedPath, serviceOptions);
      setCached(cacheKey, result);
      return result;
    },
  };
}
