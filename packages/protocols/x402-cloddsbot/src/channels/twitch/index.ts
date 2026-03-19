/**
 * Twitch Channel - Twitch chat integration
 * Supports channel chat and whisper (DM) messages
 *
 * Uses TMI.js for Twitch IRC
 * Requires: OAuth token and bot username
 */

import * as tmi from 'tmi.js';
import { logger } from '../../utils/logger';
import type { ChannelCallbacks, ChannelAdapter } from '../index';
import type { OutgoingMessage, IncomingMessage } from '../../types';
import type { PairingService } from '../../pairing/index';

export interface TwitchConfig {
  enabled: boolean;
  /** Bot username on Twitch */
  username: string;
  /** OAuth token (oauth:xxx format) */
  oauthToken: string;
  /** Channels to join (without #) */
  channels: string[];
  /** DM policy for whispers: 'open', 'allowlist', 'pairing', 'disabled' */
  dmPolicy?: 'open' | 'allowlist' | 'pairing' | 'disabled';
  /** Static allowlist of Twitch usernames */
  allowFrom?: string[];
  /** Require @ mention in channels */
  requireMention?: boolean;
}

export async function createTwitchChannel(
  config: TwitchConfig,
  callbacks: ChannelCallbacks,
  pairing?: PairingService
): Promise<ChannelAdapter> {
  const staticAllowlist = new Set<string>(
    (config.allowFrom || []).map((u) => u.toLowerCase())
  );

  function isUserAllowed(username: string): boolean {
    const lower = username.toLowerCase();
    if (staticAllowlist.has(lower)) return true;
    if (pairing?.isPaired('twitch', lower)) return true;
    return false;
  }

  const client = new tmi.Client({
    options: { debug: false },
    identity: {
      username: config.username,
      password: config.oauthToken,
    },
    channels: config.channels.map((c) => (c.startsWith('#') ? c : `#${c}`)),
  });

  // Handle channel messages
  client.on('message', async (channel, tags, message, self) => {
    try {
      if (self) return;

      const username = tags.username || tags['display-name'] || 'anonymous';
      const channelName = channel.replace('#', '');

      // Check mention requirement
      if (config.requireMention !== false) {
        const botMention = `@${config.username.toLowerCase()}`;
        if (!message.toLowerCase().includes(botMention)) {
          return;
        }
      }

      const escapedUsername = config.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const cleanMessage = message
        .replace(new RegExp(`@${escapedUsername}`, 'gi'), '')
        .trim();

      const incomingMessage: IncomingMessage = {
        id: tags.id || `${Date.now()}`,
        platform: 'twitch',
        userId: tags['user-id'] || username,
        chatId: channelName,
        chatType: 'group',
        text: cleanMessage,
        timestamp: new Date(parseInt(tags['tmi-sent-ts'] || String(Date.now()), 10)),
      };

      logger.info({ username, channel: channelName }, 'Received Twitch message');
      await callbacks.onMessage(incomingMessage);
    } catch (error) {
      logger.error({ error }, 'Twitch message handler failed');
    }
  });

  // Handle whispers (DMs)
  client.on('whisper', async (from, tags, message, self) => {
    try {
      if (self) return;

      const username = tags.username || from.replace('#', '');

      // DM Policy enforcement
      switch (config.dmPolicy) {
        case 'allowlist':
          if (!isUserAllowed(username)) {
            logger.info({ username }, 'Ignoring Twitch whisper from non-allowlisted user');
            return;
          }
          break;

        case 'pairing':
          if (!isUserAllowed(username)) {
            const potentialCode = message.trim().toUpperCase();
            if (/^[A-Z0-9]{8}$/.test(potentialCode) && pairing) {
              const request = await pairing.validateCode(potentialCode);
              if (request) {
                client.whisper(username, 'Successfully paired! You can now chat with Clodds.');
                logger.info({ username, code: potentialCode }, 'Twitch user paired');
                return;
              }
            }

            if (pairing) {
              const code = await pairing.createPairingRequest('twitch', username.toLowerCase());
              if (code) {
                client.whisper(
                  username,
                  `Pairing Required - Your code: ${code} - Run 'clodds pairing approve twitch ${code}' - Code expires in 1 hour.`
                );
                logger.info({ username, code }, 'Generated Twitch pairing code');
              } else {
                client.whisper(username, 'Pairing Required - Too many pending requests. Try again later.');
              }
            }
            return;
          }
          break;

        case 'disabled':
          return;
      }

      const incomingMessage: IncomingMessage = {
        id: tags.id || `${Date.now()}`,
        platform: 'twitch',
        userId: tags['user-id'] || username,
        chatId: username, // Use username as chat ID for whispers
        chatType: 'dm',
        text: message,
        timestamp: new Date(),
      };

      logger.info({ username }, 'Received Twitch whisper');
      await callbacks.onMessage(incomingMessage);
    } catch (error) {
      logger.error({ error }, 'Twitch whisper handler failed');
    }
  });

  client.on('connected', (addr, port) => {
    logger.info({ address: addr, port }, 'Connected to Twitch IRC');
  });

  client.on('disconnected', (reason) => {
    logger.warn({ reason }, 'Disconnected from Twitch IRC');
  });

  return {
    platform: 'twitch',

    async start() {
      logger.info({ channels: config.channels }, 'Starting Twitch bot');
      await client.connect();
      logger.info('Twitch bot started');
    },

    async stop() {
      logger.info('Stopping Twitch bot');
      await client.disconnect();
    },

    async sendMessage(message: OutgoingMessage): Promise<string | null> {
      try {
        // If chatId looks like a channel, send to channel
        // Otherwise, send as whisper
        const isChannel = config.channels.some(
          (c) => c.toLowerCase() === message.chatId.toLowerCase()
        );

        if (isChannel) {
          await client.say(message.chatId, message.text);
        } else {
          // Whisper - note: Twitch has strict rate limits on whispers
          await client.whisper(message.chatId, message.text);
        }
        return null; // Twitch doesn't return message IDs
      } catch (error) {
        logger.error({ error, chatId: message.chatId }, 'Failed to send Twitch message');
        return null;
      }
    },
  };
}
