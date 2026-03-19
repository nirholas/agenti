/**
 * Webhook Management Tool
 */

import { randomBytes, createHmac } from 'crypto';
import type { IncomingMessage, OutgoingMessage, Session } from '../types';
import type { WebhookManager, Webhook } from '../automation/webhooks';
import type { SessionManager } from '../sessions';
import type { CommandRegistry } from '../commands/registry';
import type { FeedManager } from '../feeds';
import type { Database } from '../db';
import type { MemoryService } from '../memory';
import { logger } from '../utils/logger';
import { normalizeIncomingMessage } from '../messages/unified';

export interface WebhookTarget {
  platform: string;
  chatId: string;
  userId: string;
  username?: string;
}

export interface RegisterWebhookOptions {
  id?: string;
  path: string;
  description?: string;
  rateLimit?: number;
  enabled?: boolean;
  secret?: string;
  target: WebhookTarget;
  template?: string;
}

export interface WebhookInfo {
  id: string;
  path: string;
  url: string;
  description?: string;
  rateLimit?: number;
  enabled: boolean;
  triggerCount: number;
  lastTriggered?: string;
  target: WebhookTarget;
  secret?: string;
}

export interface WebhookTool {
  register(options: RegisterWebhookOptions): Promise<WebhookInfo>;
  list(includeSecrets?: boolean): Promise<WebhookInfo[]>;
  remove(id: string): Promise<{ ok: boolean }>;
  setEnabled(id: string, enabled: boolean): Promise<{ ok: boolean; enabled: boolean }>;
  rotateSecret(id: string): Promise<{ ok: boolean; secret?: string }>;
  sign(id: string, payload: unknown): Promise<{ signature: string }>;
  trigger(id: string, payload: unknown, signature?: string): Promise<{ success: boolean; error?: string }>;
}

interface WebhookToolDeps {
  manager: WebhookManager;
  gatewayPort: number;
  sessions: SessionManager;
  commands: CommandRegistry;
  feeds: FeedManager;
  db: Database;
  memory?: MemoryService;
  sendMessage: (msg: OutgoingMessage) => Promise<string | null>;
  handleAgentMessage: (message: IncomingMessage, session: Session) => Promise<string | null>;
}

type RuntimeWebhook = Webhook & {
  target: WebhookTarget;
  template?: string;
};

function ensureWebhookPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) throw new Error('Webhook path is required');

  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (withSlash.startsWith('/webhook/')) return withSlash;
  if (withSlash === '/webhook') return '/webhook';
  return `/webhook${withSlash}`;
}

function generateWebhookId(): string {
  return randomBytes(8).toString('hex');
}

export function signPayload(secret: string, payload: unknown): string {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return createHmac('sha256', secret).update(body).digest('hex');
}

function renderTemplate(template: string, payload: unknown): string {
  const payloadJson = JSON.stringify(payload);
  return template.replaceAll('{{payload}}', payloadJson);
}

function payloadToText(payload: unknown, template?: string): string {
  if (template?.trim()) {
    return renderTemplate(template.trim(), payload);
  }

  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object' && 'text' in payload) {
    const value = (payload as { text?: unknown }).text;
    if (typeof value === 'string' && value.trim()) return value;
  }

  return JSON.stringify(payload);
}

function toWebhookInfo(baseUrl: string, webhook: RuntimeWebhook, includeSecrets: boolean): WebhookInfo {
  return {
    id: webhook.id,
    path: webhook.path,
    url: `${baseUrl}${webhook.path}`,
    description: webhook.description,
    rateLimit: webhook.rateLimit,
    enabled: webhook.enabled,
    triggerCount: webhook.triggerCount,
    lastTriggered: webhook.lastTriggered?.toISOString(),
    target: webhook.target,
    secret: includeSecrets ? webhook.secret : undefined,
  };
}

export function createWebhookTool(deps: WebhookToolDeps): WebhookTool {
  const baseUrl = `http://localhost:${deps.gatewayPort}`;
  const runtime = new Map<string, RuntimeWebhook>();

  async function handleIncoming(target: WebhookTarget, text: string): Promise<void> {
    const incoming: IncomingMessage = normalizeIncomingMessage({
      id: `webhook-${Date.now()}`,
      platform: target.platform,
      userId: target.userId,
      chatId: target.chatId,
      chatType: 'dm',
      text,
      timestamp: new Date(),
    });

    const session = await deps.sessions.getOrCreateSession(incoming);

    const commandResult = await deps.commands.handle(incoming, {
      session,
      sessions: deps.sessions,
      feeds: deps.feeds,
      db: deps.db,
      memory: deps.memory,
      send: deps.sendMessage,
    });

    if (commandResult !== null) {
      await deps.sendMessage({ platform: target.platform, chatId: target.chatId, text: commandResult });
      return;
    }

    const result = await deps.handleAgentMessage(incoming, session);
    if (result !== null) {
      await deps.sendMessage({ platform: target.platform, chatId: target.chatId, text: result });
    }
  }

  return {
    async register(options: RegisterWebhookOptions): Promise<WebhookInfo> {
      if (!options?.target?.platform || !options.target.chatId || !options.target.userId) {
        throw new Error('Webhook target requires platform, chatId, and userId');
      }

      const id = options.id?.trim() || generateWebhookId();
      const path = ensureWebhookPath(options.path);

      const secret = deps.manager.register(
        id,
        path,
        async (payload: unknown) => {
          const webhook = runtime.get(id);
          const text = payloadToText(payload, webhook?.template);
          await handleIncoming(webhook?.target || options.target, text);
        },
        {
          secret: options.secret,
          description: options.description,
          rateLimit: options.rateLimit,
          enabled: options.enabled,
        }
      );

      const webhook = deps.manager.get(id) as RuntimeWebhook | undefined;
      if (!webhook) {
        throw new Error('Webhook registration failed');
      }

      const enriched: RuntimeWebhook = {
        ...webhook,
        target: options.target,
        template: options.template,
      };

      runtime.set(id, enriched);
      logger.info({ id, path, target: options.target }, 'Webhook registered via tool');

      return toWebhookInfo(baseUrl, { ...enriched, secret }, true);
    },

    async list(includeSecrets = false): Promise<WebhookInfo[]> {
      const list = deps.manager.list() as RuntimeWebhook[];
      return list.map((w) => {
        const enriched = runtime.get(w.id) || ({ ...w, target: { platform: 'unknown', chatId: 'unknown', userId: 'unknown' } } as RuntimeWebhook);
        return toWebhookInfo(baseUrl, enriched, includeSecrets);
      });
    },

    async remove(id: string): Promise<{ ok: boolean }> {
      runtime.delete(id);
      const ok = deps.manager.unregister(id);
      return { ok };
    },

    async setEnabled(id: string, enabled: boolean): Promise<{ ok: boolean; enabled: boolean }> {
      const webhook = deps.manager.get(id);
      if (!webhook) return { ok: false, enabled };
      deps.manager.setEnabled(id, enabled);
      return { ok: true, enabled };
    },

    async rotateSecret(id: string): Promise<{ ok: boolean; secret?: string }> {
      const secret = deps.manager.regenerateSecret(id);
      if (!secret) return { ok: false };
      const webhook = runtime.get(id);
      if (webhook) webhook.secret = secret;
      return { ok: true, secret };
    },

    async sign(id: string, payload: unknown): Promise<{ signature: string }> {
      const webhook = deps.manager.get(id) as RuntimeWebhook | undefined;
      if (!webhook) throw new Error('Webhook not found');
      return { signature: signPayload(webhook.secret, payload) };
    },

    async trigger(id: string, payload: unknown, signature?: string): Promise<{ success: boolean; error?: string }> {
      const webhook = deps.manager.get(id);
      if (!webhook) return { success: false, error: 'Webhook not found' };
      const path = webhook.path;
      const providedSignature = signature || signPayload(webhook.secret, payload);
      return deps.manager.handle(path, payload, providedSignature);
    },
  };
}
