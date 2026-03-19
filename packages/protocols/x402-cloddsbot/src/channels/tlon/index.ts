/**
 * Tlon Channel - Urbit messaging via Landscape
 * Supports DM pairing and group chat interactions
 *
 * Uses Urbit HTTP API (Eyre) for messaging
 * Requires: Urbit ship URL and +code
 */

import { logger } from '../../utils/logger';
import type { ChannelCallbacks, ChannelAdapter } from '../index';
import type { OutgoingMessage, IncomingMessage } from '../../types';
import type { PairingService } from '../../pairing/index';

export interface TlonConfig {
  enabled: boolean;
  /** Urbit ship URL (e.g., http://localhost:8080) */
  shipUrl: string;
  /** Ship name (e.g., ~zod) */
  shipName: string;
  /** +code for authentication */
  code: string;
  /** DM policy: 'open', 'allowlist', 'pairing', 'disabled' */
  dmPolicy?: 'open' | 'allowlist' | 'pairing' | 'disabled';
  /** Static allowlist of ship names */
  allowFrom?: string[];
  /** Polling interval in milliseconds */
  pollIntervalMs?: number;
}

interface UrbitEvent {
  id: number;
  response: string;
  json?: unknown;
}

export async function createTlonChannel(
  config: TlonConfig,
  callbacks: ChannelCallbacks,
  pairing?: PairingService
): Promise<ChannelAdapter> {
  const staticAllowlist = new Set<string>(config.allowFrom || []);
  let sessionCookie: string | null = null;
  let eventSource: EventSource | null = null;
  let channelId: string | null = null;
  let eventId = 0;
  let pollInterval: NodeJS.Timeout | null = null;

  const baseUrl = config.shipUrl.replace(/\/$/, '');

  function isUserAllowed(ship: string): boolean {
    const normalized = ship.startsWith('~') ? ship : `~${ship}`;
    if (staticAllowlist.has(normalized)) return true;
    if (pairing?.isPaired('tlon', normalized)) return true;
    return false;
  }

  async function login(): Promise<void> {
    const response = await fetch(`${baseUrl}/~/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `password=${encodeURIComponent(config.code)}`,
    });

    if (!response.ok) {
      throw new Error(`Urbit login failed: ${response.status}`);
    }

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      sessionCookie = setCookie.split(';')[0];
    }
  }

  async function poke(app: string, mark: string, json: unknown): Promise<void> {
    if (!sessionCookie || !channelId) {
      throw new Error('Not connected to Urbit');
    }

    const response = await fetch(`${baseUrl}/~/channel/${channelId}`, {
      method: 'PUT',
      headers: {
        Cookie: sessionCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          id: ++eventId,
          action: 'poke',
          ship: config.shipName.replace('~', ''),
          app,
          mark,
          json,
        },
      ]),
    });

    if (!response.ok) {
      throw new Error(`Urbit poke failed: ${response.status}`);
    }
  }

  async function subscribe(app: string, path: string): Promise<void> {
    if (!sessionCookie || !channelId) {
      throw new Error('Not connected to Urbit');
    }

    const response = await fetch(`${baseUrl}/~/channel/${channelId}`, {
      method: 'PUT',
      headers: {
        Cookie: sessionCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          id: ++eventId,
          action: 'subscribe',
          ship: config.shipName.replace('~', ''),
          app,
          path,
        },
      ]),
    });

    if (!response.ok) {
      throw new Error(`Urbit subscribe failed: ${response.status}`);
    }
  }

  async function sendMessage(chatPath: string, content: string): Promise<string> {
    const memo = {
      content: [{ inline: [content] }],
      author: config.shipName,
      sent: Date.now(),
    };

    await poke('chat', 'chat-action', {
      'add-message': {
        path: chatPath,
        memo,
      },
    });

    return `${Date.now()}`;
  }

  async function handleChatEvent(event: unknown): Promise<void> {
    // Parse chat events from Urbit
    const data = event as {
      'add-message'?: {
        path: string;
        memo: {
          author: string;
          content: Array<{ inline?: string[] }>;
          sent: number;
        };
      };
    };

    if (!data['add-message']) return;

    const { path, memo } = data['add-message'];
    const author = memo.author.startsWith('~') ? memo.author : `~${memo.author}`;

    if (author === config.shipName) return;

    // Extract text content
    const text = memo.content
      .flatMap((c) => c.inline || [])
      .join(' ');

    if (!text) return;

    const isDM = path.includes('/dm/');

    // DM Policy enforcement
    if (isDM) {
      switch (config.dmPolicy) {
        case 'allowlist':
          if (!isUserAllowed(author)) {
            logger.info({ ship: author }, 'Ignoring Tlon message from non-allowlisted ship');
            return;
          }
          break;

        case 'pairing':
          if (!isUserAllowed(author)) {
            const potentialCode = text.trim().toUpperCase();
            if (/^[A-Z0-9]{8}$/.test(potentialCode) && pairing) {
              const request = await pairing.validateCode(potentialCode);
              if (request) {
                await sendMessage(path, 'Successfully paired! You can now chat with Clodds.');
                logger.info({ ship: author, code: potentialCode }, 'Tlon user paired');
                return;
              }
            }

            if (pairing) {
              const code = await pairing.createPairingRequest('tlon', author);
              if (code) {
                await sendMessage(
                  path,
                  `Pairing Required\n\nYour pairing code: ${code}\n\nRun 'clodds pairing approve tlon ${code}' to complete.\n\nCode expires in 1 hour.`
                );
                logger.info({ ship: author, code }, 'Generated Tlon pairing code');
              } else {
                await sendMessage(path, 'Pairing Required\n\nToo many pending requests. Try again later.');
              }
            }
            return;
          }
          break;

        case 'disabled':
          return;
      }
    }

    const incomingMessage: IncomingMessage = {
      id: String(memo.sent),
      platform: 'tlon',
      userId: author,
      chatId: path,
      chatType: isDM ? 'dm' : 'group',
      text,
      timestamp: new Date(memo.sent),
    };

    logger.info({ ship: author, chatType: incomingMessage.chatType }, 'Received Tlon message');
    await callbacks.onMessage(incomingMessage);
  }

  function connectEventSource(): void {
    if (!sessionCookie) return;

    channelId = `clodds-${Date.now()}`;
    const url = `${baseUrl}/~/channel/${channelId}`;

    // Use fetch for SSE since EventSource doesn't support custom headers
    const pollChannel = async () => {
      try {
        const response = await fetch(url, {
          headers: { Cookie: sessionCookie! },
        });

        if (!response.ok) {
          logger.warn({ status: response.status }, 'Tlon channel poll failed');
          return;
        }

        const text = await response.text();
        const events = text.split('\n\n').filter(Boolean);

        for (const event of events) {
          const dataMatch = event.match(/data: (.+)/);
          if (dataMatch) {
            try {
              const data = JSON.parse(dataMatch[1]);
              if (data.json) {
                await handleChatEvent(data.json);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      } catch (error) {
        logger.warn({ error }, 'Tlon channel poll error');
      }
    };

    // Poll periodically
    pollInterval = setInterval(pollChannel, config.pollIntervalMs || 2000);
  }

  return {
    platform: 'tlon',

    async start() {
      logger.info({ ship: config.shipName }, 'Starting Tlon bot');

      await login();
      connectEventSource();

      // Subscribe to chat updates
      await subscribe('chat', '/updates');

      logger.info('Tlon bot started');
    },

    async stop() {
      logger.info('Stopping Tlon bot');
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    },

    async sendMessage(message: OutgoingMessage): Promise<string | null> {
      try {
        return await sendMessage(message.chatId, message.text);
      } catch (error) {
        logger.error({ error, chatId: message.chatId }, 'Failed to send Tlon message');
        return null;
      }
    },
  };
}
