/**
 * Heartbeat Service - Proactive task runner via HEARTBEAT.md
 *
 * Reads HEARTBEAT.md from workspace directory on a schedule.
 * If the file has actionable content, runs it through the agent.
 * If the agent responds with HEARTBEAT_OK, nothing is delivered.
 * Otherwise, the response is sent to the last active channel.
 *
 * Features:
 * - Configurable interval (default 30 minutes)
 * - Quiet hours (default 10pm-8am)
 * - Deduplication (same message won't repeat within 24h)
 * - triggerNow() for webhook-driven immediate wakeups
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HeartbeatConfig {
  /** Whether heartbeats are enabled */
  enabled: boolean;
  /** Interval in minutes between checks (default 30) */
  intervalMinutes?: number;
  /** Quiet hours start hour 0-23 (default 22) */
  quietHoursStart?: number;
  /** Quiet hours end hour 0-23 (default 8) */
  quietHoursEnd?: number;
  /** Workspace directory containing HEARTBEAT.md */
  workspaceDir?: string;
}

/** Function to run agent turn and get response */
export type AgentTurnFn = (message: string) => Promise<string | null>;

/** Function to deliver a message to the last active channel */
export type DeliverFn = (text: string) => Promise<void>;

export interface HeartbeatService {
  /** Start the heartbeat timer */
  start(): void;
  /** Stop the heartbeat timer */
  stop(): void;
  /** Trigger an immediate heartbeat check */
  triggerNow(context?: string): void;
  /** Run a single heartbeat check (exposed for testing) */
  check(): Promise<void>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HEARTBEAT_OK = 'HEARTBEAT_OK';
const DEDUP_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const HEARTBEAT_FILE = 'HEARTBEAT.md';

// ─── Implementation ─────────────────────────────────────────────────────────

export function createHeartbeatService(
  config: HeartbeatConfig,
  agentTurn: AgentTurnFn,
  deliver: DeliverFn,
): HeartbeatService {
  const intervalMs = (config.intervalMinutes ?? 30) * 60 * 1000;
  const quietStart = config.quietHoursStart ?? 22;
  const quietEnd = config.quietHoursEnd ?? 8;
  const workspaceDir = config.workspaceDir ?? process.cwd();

  let timer: NodeJS.Timeout | null = null;
  let pendingContext: string | null = null;

  // Dedup: hash → expiry timestamp
  const sentHashes = new Map<string, number>();

  function isQuietHours(): boolean {
    const hour = new Date().getHours();
    if (quietStart < quietEnd) {
      return hour >= quietStart && hour < quietEnd;
    }
    // Wraps around midnight (e.g. 22-8)
    return hour >= quietStart || hour < quietEnd;
  }

  function hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  function isDuplicate(content: string): boolean {
    const now = Date.now();
    // Clean expired entries
    for (const [key, expiry] of sentHashes) {
      if (expiry < now) sentHashes.delete(key);
    }
    const hash = hashContent(content);
    if (sentHashes.has(hash)) return true;
    sentHashes.set(hash, now + DEDUP_TTL_MS);
    return false;
  }

  /** Read HEARTBEAT.md, return content or null if empty/missing */
  async function readHeartbeatFile(): Promise<string | null> {
    try {
      const filePath = join(workspaceDir, HEARTBEAT_FILE);
      const content = await readFile(filePath, 'utf-8');
      // Strip comments and whitespace
      const meaningful = content
        .split('\n')
        .filter((line) => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith('<!--') && !trimmed.startsWith('//');
        })
        .join('\n')
        .trim();

      return meaningful.length > 0 ? meaningful : null;
    } catch {
      // File doesn't exist or can't be read — that's fine
      return null;
    }
  }

  const service: HeartbeatService = {
    async check() {
      if (!config.enabled) return;
      if (isQuietHours()) {
        logger.debug('Heartbeat skipped: quiet hours');
        return;
      }

      // Read context from wake trigger or HEARTBEAT.md
      const wakeContext = pendingContext;
      pendingContext = null;

      const fileContent = await readHeartbeatFile();

      if (!fileContent && !wakeContext) {
        logger.debug('Heartbeat skipped: no content in HEARTBEAT.md and no wake context');
        return;
      }

      // Build prompt
      const parts: string[] = [];
      parts.push(
        'You are running a scheduled heartbeat check. ' +
        'Review the tasks below and take any actions needed. ' +
        'If there is nothing actionable, respond with exactly: HEARTBEAT_OK',
      );
      if (fileContent) {
        parts.push('', '## HEARTBEAT.md', '', fileContent);
      }
      if (wakeContext) {
        parts.push('', '## Wake Context', '', wakeContext);
      }

      const prompt = parts.join('\n');

      try {
        const response = await agentTurn(prompt);

        if (!response || response.trim() === HEARTBEAT_OK) {
          logger.debug('Heartbeat: agent said OK, nothing to deliver');
          return;
        }

        // Check dedup
        if (isDuplicate(response)) {
          logger.debug('Heartbeat: response is duplicate, skipping delivery');
          return;
        }

        await deliver(response);
        logger.info('Heartbeat: delivered agent response');
      } catch (error) {
        logger.error({ error }, 'Heartbeat: agent turn failed');
      }
    },

    triggerNow(context?: string) {
      if (context) {
        pendingContext = context;
      }
      // Run immediately (don't await — fire-and-forget)
      service.check().catch((error) => {
        logger.error({ error }, 'Heartbeat: triggerNow failed');
      });
    },

    start() {
      if (!config.enabled) {
        logger.info('Heartbeat service disabled');
        return;
      }

      // Clear any existing timer
      if (timer) {
        clearInterval(timer);
      }

      timer = setInterval(() => {
        service.check().catch((error) => {
          logger.error({ error }, 'Heartbeat check failed');
        });
      }, intervalMs);

      logger.info(
        { intervalMinutes: config.intervalMinutes ?? 30, quietStart, quietEnd },
        'Heartbeat service started',
      );
    },

    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      logger.info('Heartbeat service stopped');
    },
  };

  return service;
}
