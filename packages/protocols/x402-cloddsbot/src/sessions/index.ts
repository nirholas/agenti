/**
 * Session Manager - Clawdbot-style session management
 *
 * Features:
 * - Session scopes: main, per-peer, per-channel-peer
 * - Daily reset at configurable hour
 * - Idle reset after configurable minutes
 * - Manual reset via commands
 * - Transcript encryption (AES-256-GCM)
 */

import { Session, SessionContext, User, IncomingMessage, ConversationMessage, Config } from '../types';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Re-export Session type for consumers
export type { Session } from '../types';
import { Database } from '../db';
import { logger } from '../utils/logger';

// =============================================================================
// TRANSCRIPT ENCRYPTION (AES-256-GCM)
// =============================================================================

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

interface EncryptedData {
  encrypted: string;  // base64
  iv: string;         // base64
  authTag: string;    // base64
  salt: string;       // base64
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32);
}

function encryptTranscript(data: string, password: string): EncryptedData {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(password, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return {
    encrypted,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    salt: salt.toString('base64'),
  };
}

function decryptTranscript(encryptedData: EncryptedData, password: string): string {
  const salt = Buffer.from(encryptedData.salt, 'base64');
  const key = deriveKey(password, salt);
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export { encryptTranscript, decryptTranscript, EncryptedData };

export type DmScope = 'main' | 'per-peer' | 'per-channel-peer';

export interface SessionConfig {
  dmScope: DmScope;
  reset: {
    mode: 'daily' | 'idle' | 'both' | 'manual';
    atHour: number;
    idleMinutes: number;
  };
  resetTriggers: string[];
  cleanup: {
    enabled: boolean;
    maxAgeDays: number;
    idleDays: number;
  };
  /** Encryption settings for transcript storage */
  encryption?: {
    enabled: boolean;
    /** Password for encryption (or use CLODDS_SESSION_KEY env var) */
    password?: string;
  };
}

export interface SessionManager {
  getOrCreateSession: (message: IncomingMessage) => Promise<Session>;
  getSession: (key: string) => Session | undefined;
  getSessionById: (id: string) => Session | undefined;
  updateSession: (session: Session) => void;
  deleteSession: (key: string) => void;
  /** Add a message to conversation history */
  addToHistory: (session: Session, role: 'user' | 'assistant', content: string) => void;
  /** Get conversation history for Claude API */
  getHistory: (session: Session) => ConversationMessage[];
  /** Clear conversation history */
  clearHistory: (session: Session) => void;
  /** Reset a session by ID (clears history, keeps context) */
  reset: (sessionId: string) => void;
  /** Save a checkpoint for resumption */
  saveCheckpoint: (session: Session, summary?: string) => void;
  /** Restore session history from checkpoint */
  restoreCheckpoint: (session: Session) => boolean;
  /** Check and perform scheduled resets */
  checkScheduledResets: () => void;
  /** Get session config */
  getConfig: () => SessionConfig;
  /** Dispose timers and background work */
  dispose: () => void;
}

/** Max messages to keep in the session JSON blob for LLM context.
 *  Full history lives in the messages table (unlimited, append-only). */
const MAX_LLM_CONTEXT = 20;

/** When compacting, keep this many recent messages and summarize the rest */
const COMPACT_KEEP_RECENT = 10;

/**
 * Extractive summary: compress messages into a concise recap.
 * No LLM call needed — just extracts key lines from each message.
 */
function compactMessages(messages: ConversationMessage[]): string {
  const lines: string[] = [];
  for (const msg of messages) {
    const text = msg.content.trim();
    if (!text) continue;
    const prefix = msg.role === 'user' ? 'User' : 'Assistant';
    // Take first meaningful sentence (up to 120 chars)
    const firstLine = text.split(/[.!?\n]/).filter(s => s.trim().length > 5)[0]?.trim() || text.slice(0, 120);
    lines.push(`- ${prefix}: ${firstLine.slice(0, 120)}`);
  }
  return lines.join('\n');
}

/** Default session configuration */
const DEFAULT_CONFIG: SessionConfig = {
  dmScope: 'per-channel-peer',
  reset: {
    mode: 'manual',
    atHour: 4, // 4 AM
    idleMinutes: 60,
  },
  resetTriggers: ['/new', '/reset'],
  cleanup: {
    enabled: true,
    maxAgeDays: 30,
    idleDays: 14,
  },
  encryption: {
    enabled: false,
  },
};

/**
 * Get encryption password from config or environment
 */
function getEncryptionPassword(config: SessionConfig): string | null {
  if (!config.encryption?.enabled) return null;
  return config.encryption.password || process.env.CLODDS_SESSION_KEY || null;
}

/**
 * Encrypt session context if encryption is enabled
 */
function maybeEncryptContext(context: SessionContext, password: string | null): string {
  const json = JSON.stringify(context);
  if (!password) return json;

  try {
    const encrypted = encryptTranscript(json, password);
    return JSON.stringify({ __encrypted: true, ...encrypted });
  } catch (err) {
    logger.warn({ error: err }, 'Failed to encrypt session context, storing plaintext');
    return json;
  }
}

/**
 * Decrypt session context if encryption was used
 */
function maybeDecryptContext(data: string, password: string | null): SessionContext {
  try {
    const parsed = JSON.parse(data);

    // Check if this is encrypted data
    if (parsed.__encrypted && password) {
      const decrypted = decryptTranscript(parsed as EncryptedData, password);
      return JSON.parse(decrypted) as SessionContext;
    }

    return parsed as SessionContext;
  } catch (err) {
    logger.warn({ error: err }, 'Failed to decrypt session context');
    return { messageCount: 0, lastMarkets: [], preferences: {}, conversationHistory: [] };
  }
}

/**
 * Generate a session key based on scope
 */
function generateSessionKey(
  message: IncomingMessage,
  scope: DmScope,
  agentId: string = 'main'
): string {
  const isGroup = message.chatType === 'group';
  const platformSegment = message.accountId
    ? `${message.platform}:${message.accountId}`
    : message.platform;

  if (isGroup) {
    // Groups always get their own key
    return `agent:${agentId}:${platformSegment}:group:${message.chatId}`;
  }

  // DM scoping
  switch (scope) {
    case 'main':
      // All DMs share one session (per agent)
      return `agent:${agentId}:dm:main`;

    case 'per-peer':
      // Isolate by sender across all channels
      return `agent:${agentId}:dm:peer:${message.userId}`;

    case 'per-channel-peer':
    default:
      // Isolate by channel + sender (most specific)
      return `agent:${agentId}:${platformSegment}:dm:${message.chatId}:${message.userId}`;
  }
}

export function createSessionManager(db: Database, configInput?: Config['session']): SessionManager {
  const sessions = new Map<string, Session>();
  const sessionsById = new Map<string, Session>();
  /** Prevent concurrent getOrCreateSession from creating duplicate sessions for the same key */
  const pendingCreates = new Map<string, Promise<Session>>();

  // Merge with defaults
  const config: SessionConfig = {
    dmScope: configInput?.dmScope || DEFAULT_CONFIG.dmScope,
    reset: {
      mode: configInput?.reset?.mode || DEFAULT_CONFIG.reset.mode,
      atHour: configInput?.reset?.atHour ?? DEFAULT_CONFIG.reset.atHour,
      idleMinutes: configInput?.reset?.idleMinutes ?? DEFAULT_CONFIG.reset.idleMinutes,
    },
    resetTriggers: configInput?.resetTriggers || DEFAULT_CONFIG.resetTriggers,
    cleanup: {
      enabled: configInput?.cleanup?.enabled ?? DEFAULT_CONFIG.cleanup.enabled,
      maxAgeDays: configInput?.cleanup?.maxAgeDays ?? DEFAULT_CONFIG.cleanup.maxAgeDays,
      idleDays: configInput?.cleanup?.idleDays ?? DEFAULT_CONFIG.cleanup.idleDays,
    },
  };

  logger.info({ config }, 'Session manager initialized');

  // Track last reset date for daily reset
  let lastDailyResetDate: string | null = null;

  // Schedule daily reset check
  const dailyResetInterval = setInterval(() => {
    if (config.reset.mode === 'daily' || config.reset.mode === 'both') {
      checkDailyReset();
    }
  }, 60000); // Check every minute

  // Schedule idle reset check
  const idleResetInterval = setInterval(() => {
    if (config.reset.mode === 'idle' || config.reset.mode === 'both') {
      checkIdleResets();
    }
  }, 60000); // Check every minute

  const cleanupInterval = setInterval(() => {
    if (config.cleanup.enabled) {
      cleanupOldSessions();
    }
  }, 60 * 60 * 1000); // Hourly cleanup

  function resetSessionContext(context: SessionContext): SessionContext {
    return {
      ...context,
      messageCount: 0,
      conversationHistory: [],
      contextSummary: undefined,
      checkpoint: undefined,
      checkpointRestoredAt: undefined,
    };
  }

  function resetSessionInMemory(session: Session): void {
    session.history = [];
    session.context = resetSessionContext(session.context);
    session.lastActivity = new Date();
    session.updatedAt = new Date();
  }

  function resetSessionsInDb(whereClause: string, params: Array<string | number>, reason: string): number {
    const rows = db.query<{ key: string; context: string }>(
      `SELECT key, context FROM sessions ${whereClause}`,
      params
    );
    if (rows.length === 0) return 0;

    let resetCount = 0;
    const now = Date.now();
    for (const row of rows) {
      let context: SessionContext;
      try {
        context = JSON.parse(row.context || '{}') as SessionContext;
      } catch {
        context = { messageCount: 0, lastMarkets: [], preferences: {}, conversationHistory: [] };
      }

      if (!context.conversationHistory || context.conversationHistory.length === 0) {
        continue;
      }

      const updated = resetSessionContext(context);
      db.run('UPDATE sessions SET context = ?, updated_at = ? WHERE key = ?', [
        JSON.stringify(updated),
        now,
        row.key,
      ]);
      resetCount++;
    }

    if (resetCount > 0) {
      logger.info({ resetCount, reason }, 'Session reset persisted to database');
    }

    return resetCount;
  }

  function checkDailyReset() {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currentHour = now.getUTCHours();

    // Only reset once per day at the configured hour
    if (currentHour === config.reset.atHour && lastDailyResetDate !== today) {
      logger.info({ hour: config.reset.atHour }, 'Performing daily session reset');

      // Clear all sessions
      for (const session of sessions.values()) {
        resetSessionInMemory(session);
        db.updateSession(session);
      }

      resetSessionsInDb('', [], 'daily');

      lastDailyResetDate = today;
      logger.info({ sessionsReset: sessions.size }, 'Daily reset complete');
    }
  }

  function checkIdleResets() {
    const now = Date.now();
    const idleThreshold = config.reset.idleMinutes * 60 * 1000;
    let resetCount = 0;

    for (const [key, session] of sessions) {
      const idleTime = now - session.updatedAt.getTime();
      if (idleTime > idleThreshold && session.context.conversationHistory.length > 0) {
        resetSessionInMemory(session);
        db.updateSession(session);
        resetCount++;
        logger.debug({ sessionKey: key, idleMinutes: Math.round(idleTime / 60000) }, 'Session reset due to idle');
      }
    }

    if (resetCount > 0) {
      logger.info({ resetCount }, 'Idle sessions reset');
    }

    const cutoff = now - idleThreshold;
    resetSessionsInDb('WHERE updated_at < ?', [cutoff], 'idle');
  }

  function cleanupOldSessions() {
    const now = Date.now();
    const maxAgeMs = config.cleanup.maxAgeDays * 24 * 60 * 60 * 1000;
    const idleMs = config.cleanup.idleDays * 24 * 60 * 60 * 1000;
    // Use Math.max to pick the more recent cutoff (stricter threshold).
    // With maxAgeDays=30 and idleDays=14, we want the 14-day cutoff so
    // sessions idle for 14+ days are cleaned up, not only those idle 30+ days.
    const cutoff = Math.max(now - maxAgeMs, now - idleMs);

    if (!Number.isFinite(cutoff)) return;

    // Purge from in-memory cache
    let removed = 0;
    for (const [key, session] of sessions) {
      const updatedAt = session.updatedAt?.getTime?.() ?? 0;
      // Treat unparseable dates (updatedAt === 0) as stale so they get cleaned up
      if (updatedAt === 0 || updatedAt < cutoff) {
        sessions.delete(key);
        sessionsById.delete(session.id);
        removed++;
      }
    }

    // Purge from DB
    const deleted = db.deleteSessionsBefore(cutoff);
    if (removed > 0 || deleted > 0) {
      logger.info({ removed, deleted, cutoff }, 'Session cleanup completed');
    }
  }

  return {
    async getOrCreateSession(message: IncomingMessage): Promise<Session> {
      const key = generateSessionKey(message, config.dmScope);

      // Check memory cache first
      let session = sessions.get(key);
      if (session) {
        return session;
      }

      // Deduplicate concurrent creates for the same key
      const pending = pendingCreates.get(key);
      if (pending) {
        return pending;
      }

      const createPromise = (async (): Promise<Session> => {
        try {
          // Re-check cache after acquiring the "lock" (another caller may have resolved first)
          let s = sessions.get(key);
          if (s) return s;

          // Check database
          s = db.getSession(key);
          if (s) {
            sessions.set(key, s);
            sessionsById.set(s.id, s);
            return s;
          }

          // Ensure user exists
          let user = db.getUserByPlatformId(message.platform, message.userId);
          if (!user) {
            user = {
              id: crypto.randomUUID(),
              platform: message.platform,
              platformUserId: message.userId,
              settings: {
                alertsEnabled: true,
                digestEnabled: false,
                defaultPlatforms: ['polymarket'],
                notifyOnEdge: false,
                edgeThreshold: 0.1,
              },
              createdAt: new Date(),
              lastActiveAt: new Date(),
            };
            db.createUser(user);
          }

          // Create new session
          s = {
            id: crypto.randomUUID(),
            key,
            userId: user.id,
            channel: message.platform,
            accountId: message.accountId,
            chatId: message.chatId,
            chatType: message.chatType,
            context: {
              messageCount: 0,
              lastMarkets: [],
              preferences: {},
              conversationHistory: [],
            },
            history: [],
            lastActivity: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          db.createSession(s);
          sessions.set(key, s);
          sessionsById.set(s.id, s);

          logger.info({ key, scope: config.dmScope }, 'Created new session');
          return s;
        } finally {
          pendingCreates.delete(key);
        }
      })();

      pendingCreates.set(key, createPromise);
      return createPromise;
    },

    getSession(key: string): Session | undefined {
      const cached = sessions.get(key);
      if (cached) return cached;

      const fromDb = db.getSession(key);
      if (fromDb) {
        sessions.set(key, fromDb);
        sessionsById.set(fromDb.id, fromDb);
      }
      return fromDb;
    },

    getSessionById(id: string): Session | undefined {
      const cached = sessionsById.get(id);
      if (cached) return cached;

      // Fallback to scan DB by loading all sessions is expensive; return undefined if not cached.
      return undefined;
    },

    updateSession(session: Session): void {
      session.updatedAt = new Date();
      sessions.set(session.key, session);
      sessionsById.set(session.id, session);
      db.updateSession(session);
    },

    deleteSession(key: string): void {
      const existing = sessions.get(key) || db.getSession(key);
      sessions.delete(key);
      if (existing) {
        sessionsById.delete(existing.id);
      }
      db.deleteSession(key);
    },

    addToHistory(session: Session, role: 'user' | 'assistant', content: string): void {
      // Write to messages table (append-only, one row per message)
      if (db.insertMessage) {
        db.insertMessage(session.id, role, content);
      }

      // Keep in-memory LLM context window (last N messages only)
      if (!session.context.conversationHistory) {
        session.context.conversationHistory = [];
      }
      session.context.conversationHistory.push({
        role,
        content,
        timestamp: Date.now(),
      });

      // Compact: when history exceeds window, summarize oldest and keep recent
      if (session.context.conversationHistory.length > MAX_LLM_CONTEXT) {
        const overflow = session.context.conversationHistory.length - COMPACT_KEEP_RECENT;
        if (overflow > 0) {
          const evicted = session.context.conversationHistory.slice(0, overflow);
          const newSummary = compactMessages(evicted);
          // Append to existing summary (cap at ~3000 chars to keep JSON blob small)
          const combined = session.context.contextSummary
            ? session.context.contextSummary + '\n' + newSummary
            : newSummary;
          // If too long, keep only the most recent portion
          session.context.contextSummary = combined.length > 3000
            ? combined.slice(-3000)
            : combined;
          // Keep only the recent messages
          session.context.conversationHistory = session.context.conversationHistory.slice(overflow);
        }
      }

      this.updateSession(session);
    },

    getHistory(session: Session): ConversationMessage[] {
      const history = session.context.conversationHistory || [];
      let recent = history.slice(-MAX_LLM_CONTEXT);

      // Prepend context summary so the LLM has awareness of earlier conversation
      if (session.context.contextSummary) {
        // Ensure recent starts with 'user' to maintain alternation after our synthetic pair
        if (recent.length > 0 && recent[0].role === 'assistant') {
          recent = recent.slice(1);
        }
        return [
          { role: 'user' as const, content: `[Previous conversation summary]\n${session.context.contextSummary}`, timestamp: 0 },
          { role: 'assistant' as const, content: 'Understood. I have context from our earlier conversation.', timestamp: 0 },
          ...recent,
        ];
      }

      return recent;
    },

    clearHistory(session: Session): void {
      session.context.conversationHistory = [];
      session.context.contextSummary = undefined;
      // Clear messages table too
      if (db.deleteSessionMessages) {
        db.deleteSessionMessages(session.id);
      }
      this.updateSession(session);
      logger.info({ sessionKey: session.key }, 'Conversation history cleared');
    },

    saveCheckpoint(session: Session, summary?: string): void {
      const history = session.context.conversationHistory || [];
      session.context.checkpoint = {
        createdAt: Date.now(),
        messageCount: session.context.messageCount,
        summary,
        history: history.slice(-MAX_LLM_CONTEXT),
      };
      this.updateSession(session);
      logger.info({ sessionKey: session.key }, 'Session checkpoint saved');
    },

    restoreCheckpoint(session: Session): boolean {
      const checkpoint = session.context.checkpoint;
      if (!checkpoint || !checkpoint.history?.length) {
        return false;
      }

      session.context.conversationHistory = checkpoint.history.slice();
      session.context.messageCount = checkpoint.messageCount;
      session.context.checkpointRestoredAt = Date.now();
      this.updateSession(session);
      logger.info({ sessionKey: session.key }, 'Session checkpoint restored');
      return true;
    },

    reset(sessionId: string): void {
      const session = sessionsById.get(sessionId);
      if (session) {
        resetSessionInMemory(session);
        this.updateSession(session);
        logger.info({ sessionId }, 'Session reset');
      }
    },

    checkScheduledResets(): void {
      if (config.reset.mode === 'daily' || config.reset.mode === 'both') {
        checkDailyReset();
      }
      if (config.reset.mode === 'idle' || config.reset.mode === 'both') {
        checkIdleResets();
      }
    },

    getConfig(): SessionConfig {
      return config;
    },

    dispose(): void {
      clearInterval(dailyResetInterval);
      clearInterval(idleResetInterval);
      clearInterval(cleanupInterval);
    },
  };
}
