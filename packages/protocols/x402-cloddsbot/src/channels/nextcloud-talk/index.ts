/**
 * Nextcloud Talk Channel - Self-hosted video/chat platform
 * Supports DM pairing, allowlists, and room messages
 *
 * Uses Nextcloud Talk API (OCS) for messaging
 * Requires: Nextcloud server URL, username, and app password
 */

import { logger } from '../../utils/logger';
import type { ChannelCallbacks, ChannelAdapter } from '../index';
import type { OutgoingMessage, IncomingMessage } from '../../types';
import type { PairingService } from '../../pairing/index';

export interface NextcloudTalkConfig {
  enabled: boolean;
  /** Nextcloud server URL (e.g., https://cloud.example.com) */
  serverUrl: string;
  /** Bot username */
  username: string;
  /** App password for the bot */
  appPassword: string;
  /** DM policy: 'open', 'allowlist', 'pairing', 'disabled' */
  dmPolicy?: 'open' | 'allowlist' | 'pairing' | 'disabled';
  /** Static allowlist of Nextcloud user IDs */
  allowFrom?: string[];
  /** Polling interval in milliseconds */
  pollIntervalMs?: number;
}

interface TalkMessage {
  id: number;
  token: string; // conversation token
  actorType: string;
  actorId: string;
  actorDisplayName: string;
  message: string;
  timestamp: number;
  messageType: string;
}

interface TalkConversation {
  id: number;
  token: string;
  type: number; // 1 = one-to-one, 2 = group, 3 = public, 4 = changelog
  name: string;
  displayName: string;
}

export async function createNextcloudTalkChannel(
  config: NextcloudTalkConfig,
  callbacks: ChannelCallbacks,
  pairing?: PairingService
): Promise<ChannelAdapter> {
  const staticAllowlist = new Set<string>(config.allowFrom || []);
  let pollTimer: NodeJS.Timeout | null = null;
  const lastMessageId = new Map<string, number>();
  const pollInterval = config.pollIntervalMs || 3000;

  const baseUrl = config.serverUrl.replace(/\/$/, '');
  const authHeader = 'Basic ' + Buffer.from(`${config.username}:${config.appPassword}`).toString('base64');

  function isUserAllowed(userId: string): boolean {
    if (staticAllowlist.has(userId)) return true;
    if (pairing?.isPaired('nextcloud-talk', userId)) return true;
    return false;
  }

  async function apiRequest<T>(
    endpoint: string,
    method: string = 'GET',
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${baseUrl}/ocs/v2.php/apps/spreed/api/v1${endpoint}`, {
      method,
      headers: {
        Authorization: authHeader,
        'OCS-APIRequest': 'true',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`Nextcloud Talk API error: ${response.status} ${response.statusText}`);
    }
    const json = (await response.json()) as { ocs: { data: T } };
    return json.ocs.data;
  }

  async function getConversations(): Promise<TalkConversation[]> {
    return apiRequest<TalkConversation[]>('/room');
  }

  async function getMessages(token: string, lookIntoFuture: number = 0, lastKnownId?: number): Promise<TalkMessage[]> {
    let endpoint = `/chat/${token}?lookIntoFuture=${lookIntoFuture}&limit=100`;
    if (lastKnownId) {
      endpoint += `&lastKnownMessageId=${lastKnownId}`;
    }
    return apiRequest<TalkMessage[]>(endpoint);
  }

  async function sendChatMessage(token: string, message: string): Promise<TalkMessage> {
    return apiRequest<TalkMessage>(`/chat/${token}`, 'POST', { message });
  }

  async function handleMessage(msg: TalkMessage, conversation: TalkConversation): Promise<void> {
    if (msg.actorId === config.username) return;
    if (msg.messageType !== 'comment') return;

    const isDM = conversation.type === 1;
    const text = msg.message;

    // DM Policy enforcement
    if (isDM) {
      switch (config.dmPolicy) {
        case 'allowlist':
          if (!isUserAllowed(msg.actorId)) {
            logger.info({ userId: msg.actorId }, 'Ignoring Nextcloud Talk message from non-allowlisted user');
            return;
          }
          break;

        case 'pairing':
          if (!isUserAllowed(msg.actorId)) {
            const potentialCode = text.trim().toUpperCase();
            if (/^[A-Z0-9]{8}$/.test(potentialCode) && pairing) {
              const request = await pairing.validateCode(potentialCode);
              if (request) {
                await sendChatMessage(msg.token, 'Successfully paired! You can now chat with Clodds.');
                logger.info({ userId: msg.actorId, code: potentialCode }, 'Nextcloud Talk user paired');
                return;
              }
            }

            if (pairing) {
              const code = await pairing.createPairingRequest('nextcloud-talk', msg.actorId);
              if (code) {
                await sendChatMessage(
                  msg.token,
                  `Pairing Required\n\nYour pairing code: ${code}\n\nRun 'clodds pairing approve nextcloud-talk ${code}' to complete.\n\nCode expires in 1 hour.`
                );
                logger.info({ userId: msg.actorId, code }, 'Generated Nextcloud Talk pairing code');
              } else {
                await sendChatMessage(msg.token, 'Pairing Required\n\nToo many pending requests. Try again later.');
              }
            }
            return;
          }
          break;

        case 'disabled':
          await sendChatMessage(msg.token, 'DMs are currently disabled.');
          return;
      }
    }

    const incomingMessage: IncomingMessage = {
      id: String(msg.id),
      platform: 'nextcloud-talk',
      userId: msg.actorId,
      chatId: msg.token,
      chatType: isDM ? 'dm' : 'group',
      text,
      timestamp: new Date(msg.timestamp * 1000),
    };

    logger.info({ userId: msg.actorId, chatType: incomingMessage.chatType }, 'Received Nextcloud Talk message');
    await callbacks.onMessage(incomingMessage);
  }

  async function poll(): Promise<void> {
    try {
      const conversations = await getConversations();

      for (const conv of conversations) {
        try {
          const lastId = lastMessageId.get(conv.token);
          const messages = await getMessages(conv.token, 1, lastId);

          for (const msg of messages) {
            if (!lastId || msg.id > lastId) {
              await handleMessage(msg, conv);
            }
            lastMessageId.set(conv.token, Math.max(lastMessageId.get(conv.token) || 0, msg.id));
          }
        } catch (error) {
          logger.warn({ error, conversation: conv.token }, 'Failed to poll Nextcloud Talk conversation');
        }
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to poll Nextcloud Talk conversations');
    }
  }

  return {
    platform: 'nextcloud-talk',

    async start() {
      logger.info('Starting Nextcloud Talk bot');
      // Initial poll to get last message IDs
      try {
        const conversations = await getConversations();
        for (const conv of conversations) {
          const messages = await getMessages(conv.token, 0);
          if (messages.length > 0) {
            lastMessageId.set(conv.token, Math.max(...messages.map((m) => m.id)));
          }
        }
      } catch (error) {
        logger.warn({ error }, 'Failed to initialize Nextcloud Talk message tracking');
      }

      pollTimer = setInterval(poll, pollInterval);
      logger.info('Nextcloud Talk bot started');
    },

    async stop() {
      logger.info('Stopping Nextcloud Talk bot');
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    },

    async sendMessage(message: OutgoingMessage): Promise<string | null> {
      try {
        const msg = await sendChatMessage(message.chatId, message.text);
        return String(msg.id);
      } catch (error) {
        logger.error({ error, chatId: message.chatId }, 'Failed to send Nextcloud Talk message');
        return null;
      }
    },
  };
}
