/**
 * Zalo Channel - Vietnamese messaging platform
 * Supports Official Account (OA) and Personal account modes
 *
 * Uses Zalo Open API for Official Accounts
 * Requires: OA ID, access token, and secret key
 */

import { logger } from '../../utils/logger';
import type { ChannelCallbacks, ChannelAdapter } from '../index';
import type { OutgoingMessage, IncomingMessage, MessageAttachment } from '../../types';
import type { PairingService } from '../../pairing/index';
import { createServer, IncomingMessage as HttpRequest, ServerResponse } from 'http';
import * as crypto from 'crypto';
import { guessAttachmentType } from '../../utils/attachments';

export interface ZaloConfig {
  enabled: boolean;
  /** Account mode: 'oa' (Official Account) or 'personal' */
  mode: 'oa' | 'personal';
  /** Official Account ID */
  oaId?: string;
  /** Access token */
  accessToken: string;
  /** Secret key for webhook verification */
  secretKey?: string;
  /** Webhook port */
  webhookPort?: number;
  /** DM policy: 'open', 'allowlist', 'pairing', 'disabled' */
  dmPolicy?: 'open' | 'allowlist' | 'pairing' | 'disabled';
  /** Static allowlist of Zalo user IDs */
  allowFrom?: string[];
}

interface ZaloMessage {
  event_name: string;
  app_id: string;
  sender: {
    id: string;
  };
  recipient: {
    id: string;
  };
  message: {
    msg_id: string;
    text?: string;
    attachments?: Array<{
      type: string;
      payload: {
        url?: string;
        thumbnail?: string;
        id?: string;
      };
    }>;
  };
  timestamp: string;
}

export async function createZaloChannel(
  config: ZaloConfig,
  callbacks: ChannelCallbacks,
  pairing?: PairingService
): Promise<ChannelAdapter> {
  const staticAllowlist = new Set<string>(config.allowFrom || []);
  let server: ReturnType<typeof createServer> | null = null;

  function isUserAllowed(userId: string): boolean {
    if (staticAllowlist.has(userId)) return true;
    if (pairing?.isPaired('zalo', userId)) return true;
    return false;
  }

  function verifyWebhook(body: string, signature: string): boolean {
    if (!config.secretKey) return true; // Skip verification if no secret
    const hash = crypto.createHmac('sha256', config.secretKey).update(body).digest('hex');
    if (hash.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  }

  async function sendTextMessage(userId: string, text: string): Promise<string | null> {
    try {
      const response = await fetch('https://openapi.zalo.me/v2.0/oa/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: config.accessToken,
        },
        body: JSON.stringify({
          recipient: { user_id: userId },
          message: { text },
        }),
      });

      const data = (await response.json()) as { error: number; message?: string; data?: { message_id?: string } };
      if (data.error !== 0) {
        logger.error({ error: data.message }, 'Zalo API error');
        return null;
      }
      return data.data?.message_id || null;
    } catch (error) {
      logger.error({ error }, 'Failed to send Zalo message');
      return null;
    }
  }

  async function handleWebhook(event: ZaloMessage): Promise<void> {
    if (event.event_name !== 'user_send_text' && event.event_name !== 'user_send_image') {
      return;
    }

    const userId = event.sender.id;
    const text = event.message.text || '';

    // DM Policy enforcement (all Zalo OA messages are effectively DMs)
    switch (config.dmPolicy) {
      case 'allowlist':
        if (!isUserAllowed(userId)) {
          logger.info({ userId }, 'Ignoring Zalo message from non-allowlisted user');
          return;
        }
        break;

      case 'pairing':
        if (!isUserAllowed(userId)) {
          const potentialCode = text.trim().toUpperCase();
          if (/^[A-Z0-9]{8}$/.test(potentialCode) && pairing) {
            const request = await pairing.validateCode(potentialCode);
            if (request) {
              await sendTextMessage(userId, 'Successfully paired! You can now chat with Clodds.');
              logger.info({ userId, code: potentialCode }, 'Zalo user paired');
              return;
            }
          }

          if (pairing) {
            const code = await pairing.createPairingRequest('zalo', userId);
            if (code) {
              await sendTextMessage(
                userId,
                `Pairing Required\n\nYour pairing code: ${code}\n\nRun 'clodds pairing approve zalo ${code}' to complete.\n\nCode expires in 1 hour.`
              );
              logger.info({ userId, code }, 'Generated Zalo pairing code');
            } else {
              await sendTextMessage(userId, 'Pairing Required\n\nToo many pending requests. Try again later.');
            }
          }
          return;
        }
        break;

      case 'disabled':
        await sendTextMessage(userId, 'Messages are currently disabled.');
        return;
    }

    const attachments: MessageAttachment[] = [];
    if (event.message.attachments) {
      for (const att of event.message.attachments) {
        if (att.payload.url) {
          attachments.push({
            type: guessAttachmentType(att.type, ''),
            url: att.payload.url,
            filename: att.payload.id || 'attachment',
          });
        }
      }
    }

    const incomingMessage: IncomingMessage = {
      id: event.message.msg_id,
      platform: 'zalo',
      userId,
      chatId: userId, // In OA mode, each user has their own chat
      chatType: 'dm',
      text,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: new Date(parseInt(event.timestamp, 10) || Date.now()),
    };

    logger.info({ userId }, 'Received Zalo message');
    await callbacks.onMessage(incomingMessage);
  }

  function parseBody(req: HttpRequest): Promise<string> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => resolve(body));
    });
  }

  return {
    platform: 'zalo',

    async start() {
      const port = config.webhookPort || 3002;
      logger.info({ port, mode: config.mode }, 'Starting Zalo bot');

      server = createServer(async (req, res) => {
        // Handle webhook verification
        if (req.method === 'GET') {
          const url = new URL(req.url || '/', `http://localhost:${port}`);
          const challenge = url.searchParams.get('challenge');
          if (challenge) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(challenge);
            return;
          }
        }

        if (req.method !== 'POST') {
          res.writeHead(405);
          res.end();
          return;
        }

        try {
          const body = await parseBody(req);
          const signature = req.headers['x-zalooa-signature'] as string;

          if (!verifyWebhook(body, signature)) {
            logger.warn('Invalid Zalo webhook signature');
            res.writeHead(401);
            res.end();
            return;
          }

          const event = JSON.parse(body) as ZaloMessage;
          await handleWebhook(event);

          res.writeHead(200);
          res.end('OK');
        } catch (error) {
          logger.error({ error }, 'Zalo webhook error');
          res.writeHead(500);
          res.end();
        }
      });

      server.listen(port);
      logger.info({ port }, 'Zalo bot started');
    },

    async stop() {
      logger.info('Stopping Zalo bot');
      if (server) {
        server.close();
        server = null;
      }
    },

    async sendMessage(message: OutgoingMessage): Promise<string | null> {
      return sendTextMessage(message.chatId, message.text);
    },
  };
}

/**
 * Zalo Personal - Uses personal account instead of OA
 * This is a separate integration using different APIs
 */
export interface ZaloPersonalConfig {
  enabled: boolean;
  /** IMEI for device identification */
  imei: string;
  /** Session cookies */
  cookies: string;
  /** DM policy */
  dmPolicy?: 'open' | 'allowlist' | 'pairing' | 'disabled';
  /** Static allowlist */
  allowFrom?: string[];
  /** Poll interval */
  pollIntervalMs?: number;
}

export async function createZaloPersonalChannel(
  config: ZaloPersonalConfig,
  callbacks: ChannelCallbacks,
  pairing?: PairingService
): Promise<ChannelAdapter> {
  const staticAllowlist = new Set<string>(config.allowFrom || []);
  let pollTimer: NodeJS.Timeout | null = null;
  const pollInterval = config.pollIntervalMs || 3000;

  function isUserAllowed(userId: string): boolean {
    if (staticAllowlist.has(userId)) return true;
    if (pairing?.isPaired('zalo-personal', userId)) return true;
    return false;
  }

  // Note: Zalo Personal API is unofficial and may change
  // This is a simplified implementation
  async function apiRequest<T>(endpoint: string, body?: unknown): Promise<T> {
    const response = await fetch(`https://chat.zalo.me/api${endpoint}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Cookie: config.cookies,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Zalo Personal API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async function sendMessage(userId: string, text: string): Promise<void> {
    await apiRequest('/message/sms', {
      toid: userId,
      message: text,
      imei: config.imei,
    });
  }

  async function poll(): Promise<void> {
    // Polling implementation would go here
    // Note: This requires reverse-engineering Zalo's internal API
    logger.debug('Zalo Personal polling not fully implemented');
  }

  return {
    platform: 'zalo-personal',

    async start() {
      logger.info('Starting Zalo Personal bot');
      pollTimer = setInterval(poll, pollInterval);
      logger.info('Zalo Personal bot started');
    },

    async stop() {
      logger.info('Stopping Zalo Personal bot');
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    },

    async sendMessage(message: OutgoingMessage): Promise<string | null> {
      try {
        await sendMessage(message.chatId, message.text);
        return null;
      } catch (error) {
        logger.error({ error, chatId: message.chatId }, 'Failed to send Zalo Personal message');
        return null;
      }
    },
  };
}
