/**
 * BlueBubbles Channel - iMessage alternative via BlueBubbles server
 * Supports DM pairing and group chat interactions
 *
 * Uses BlueBubbles REST API
 * Requires: BlueBubbles server URL and password
 */

import { logger } from '../../utils/logger';
import type { ChannelCallbacks, ChannelAdapter } from '../index';
import type { OutgoingMessage, IncomingMessage, MessageAttachment } from '../../types';
import type { PairingService } from '../../pairing/index';
import { guessAttachmentType } from '../../utils/attachments';

export interface BlueBubblesConfig {
  enabled: boolean;
  /** BlueBubbles server URL (e.g., http://localhost:1234) */
  serverUrl: string;
  /** Server password */
  password: string;
  /** DM policy: 'open', 'allowlist', 'pairing', 'disabled' */
  dmPolicy?: 'open' | 'allowlist' | 'pairing' | 'disabled';
  /** Static allowlist of phone numbers or email addresses */
  allowFrom?: string[];
  /** Polling interval in milliseconds */
  pollIntervalMs?: number;
}

interface BBMessage {
  guid: string;
  text: string;
  handle: {
    id: string;
    address: string;
  };
  chats: Array<{
    guid: string;
    chatIdentifier: string;
    participants: Array<{ address: string }>;
  }>;
  dateCreated: number;
  isFromMe: boolean;
  attachments?: Array<{
    guid: string;
    mimeType: string;
    transferName: string;
    totalBytes: number;
  }>;
}

interface BBChat {
  guid: string;
  chatIdentifier: string;
  participants: Array<{ address: string }>;
  displayName?: string;
}

export async function createBlueBubblesChannel(
  config: BlueBubblesConfig,
  callbacks: ChannelCallbacks,
  pairing?: PairingService
): Promise<ChannelAdapter> {
  const staticAllowlist = new Set<string>(
    (config.allowFrom || []).map((a) => a.toLowerCase())
  );
  let pollTimer: NodeJS.Timeout | null = null;
  let lastMessageDate = Date.now();
  const pollInterval = config.pollIntervalMs || 2000;

  const baseUrl = config.serverUrl.replace(/\/$/, '');

  function normalizeAddress(address: string): string {
    return address.toLowerCase().replace(/[^\w@.+]/g, '');
  }

  function isUserAllowed(address: string): boolean {
    const normalized = normalizeAddress(address);
    if (staticAllowlist.has(normalized)) return true;
    if (pairing?.isPaired('bluebubbles', normalized)) return true;
    return false;
  }

  async function apiRequest<T>(
    endpoint: string,
    method: string = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${baseUrl}/api/v1${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const params = new URLSearchParams({ password: config.password });
    const fullUrl = method === 'GET' ? `${url}?${params}` : url;

    const response = await fetch(fullUrl, {
      method,
      headers,
      body: method !== 'GET' ? JSON.stringify({ ...(body ?? {}), password: config.password }) : undefined,
    });

    if (!response.ok) {
      throw new Error(`BlueBubbles API error: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as { data: T };
    return json.data;
  }

  async function sendText(chatGuid: string, message: string): Promise<void> {
    await apiRequest('/message/text', 'POST', {
      chatGuid,
      message,
      method: 'apple-script',
    });
  }

  async function getMessages(after: number): Promise<BBMessage[]> {
    return apiRequest<BBMessage[]>(`/message?after=${after}&limit=50`);
  }

  async function handleMessage(msg: BBMessage): Promise<void> {
    if (msg.isFromMe) return;
    if (!msg.text && (!msg.attachments || msg.attachments.length === 0)) return;

    const address = msg.handle?.address || 'unknown';
    const chat = msg.chats?.[0];
    const chatGuid = chat?.guid || `dm-${address}`;
    const isDM = chat?.participants?.length === 1;
    const text = msg.text || '';

    // DM Policy enforcement
    if (isDM) {
      switch (config.dmPolicy) {
        case 'allowlist':
          if (!isUserAllowed(address)) {
            logger.info({ address }, 'Ignoring BlueBubbles message from non-allowlisted user');
            return;
          }
          break;

        case 'pairing':
          if (!isUserAllowed(address)) {
            const potentialCode = text.trim().toUpperCase();
            if (/^[A-Z0-9]{8}$/.test(potentialCode) && pairing) {
              const request = await pairing.validateCode(potentialCode);
              if (request) {
                await sendText(chatGuid, 'Successfully paired! You can now chat with Clodds.');
                logger.info({ address, code: potentialCode }, 'BlueBubbles user paired');
                return;
              }
            }

            if (pairing) {
              const code = await pairing.createPairingRequest('bluebubbles', normalizeAddress(address));
              if (code) {
                await sendText(
                  chatGuid,
                  `Pairing Required\n\nYour pairing code: ${code}\n\nRun 'clodds pairing approve bluebubbles ${code}' to complete.\n\nCode expires in 1 hour.`
                );
                logger.info({ address, code }, 'Generated BlueBubbles pairing code');
              } else {
                await sendText(chatGuid, 'Pairing Required\n\nToo many pending requests. Try again later.');
              }
            }
            return;
          }
          break;

        case 'disabled':
          await sendText(chatGuid, 'DMs are currently disabled.');
          return;
      }
    }

    const attachments: MessageAttachment[] = [];
    if (msg.attachments) {
      for (const att of msg.attachments) {
        attachments.push({
          type: guessAttachmentType(att.mimeType, att.transferName),
          url: `${baseUrl}/api/v1/attachment/${att.guid}/download?password=${encodeURIComponent(config.password)}`,
          filename: att.transferName,
          mimeType: att.mimeType,
          size: att.totalBytes,
        });
      }
    }

    const incomingMessage: IncomingMessage = {
      id: msg.guid,
      platform: 'bluebubbles',
      userId: normalizeAddress(address),
      chatId: chatGuid,
      chatType: isDM ? 'dm' : 'group',
      text,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: new Date(msg.dateCreated),
    };

    logger.info({ address, chatType: incomingMessage.chatType }, 'Received BlueBubbles message');
    await callbacks.onMessage(incomingMessage);
  }

  async function poll(): Promise<void> {
    try {
      const messages = await getMessages(lastMessageDate);

      for (const msg of messages) {
        if (msg.dateCreated > lastMessageDate) {
          lastMessageDate = msg.dateCreated;
        }
        await handleMessage(msg);
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to poll BlueBubbles messages');
    }
  }

  return {
    platform: 'bluebubbles',

    async start() {
      logger.info('Starting BlueBubbles bot');

      // Initialize lastMessageDate to now to avoid processing old messages
      lastMessageDate = Date.now();

      // Verify connection
      try {
        await apiRequest('/server/info');
        logger.info('Connected to BlueBubbles server');
      } catch (error) {
        logger.error({ error }, 'Failed to connect to BlueBubbles server');
        throw error;
      }

      pollTimer = setInterval(poll, pollInterval);
      logger.info('BlueBubbles bot started');
    },

    async stop() {
      logger.info('Stopping BlueBubbles bot');
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    },

    async sendMessage(message: OutgoingMessage): Promise<string | null> {
      try {
        await sendText(message.chatId, message.text);
        return null; // BlueBubbles doesn't return message IDs synchronously
      } catch (error) {
        logger.error({ error, chatId: message.chatId }, 'Failed to send BlueBubbles message');
        return null;
      }
    },
  };
}
