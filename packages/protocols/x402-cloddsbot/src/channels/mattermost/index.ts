/**
 * Mattermost Channel - Self-hosted team communication
 * Supports DM pairing, allowlists, and channel messages
 *
 * Uses Mattermost WebSocket API for real-time messaging
 * Requires: Bot access token and server URL
 */

import WebSocket from 'ws';
import { logger } from '../../utils/logger';
import type { ChannelCallbacks, ChannelAdapter } from '../index';
import type { OutgoingMessage, IncomingMessage, MessageAttachment } from '../../types';
import type { PairingService } from '../../pairing/index';
import { guessAttachmentType } from '../../utils/attachments';

export interface MattermostConfig {
  enabled: boolean;
  /** Mattermost server URL (e.g., https://mattermost.example.com) */
  serverUrl: string;
  /** Bot access token */
  accessToken: string;
  /** DM policy: 'open', 'allowlist', 'pairing', 'disabled' */
  dmPolicy?: 'open' | 'allowlist' | 'pairing' | 'disabled';
  /** Static allowlist of Mattermost user IDs */
  allowFrom?: string[];
  /** Per-channel group policies */
  groups?: Record<string, { requireMention?: boolean }>;
}

interface MattermostUser {
  id: string;
  username: string;
  nickname?: string;
}

interface MattermostPost {
  id: string;
  channel_id: string;
  user_id: string;
  message: string;
  create_at: number;
  file_ids?: string[];
}

interface MattermostChannel {
  id: string;
  type: string; // 'D' = DM, 'O' = public, 'P' = private, 'G' = group
  name: string;
}

export async function createMattermostChannel(
  config: MattermostConfig,
  callbacks: ChannelCallbacks,
  pairing?: PairingService
): Promise<ChannelAdapter> {
  const staticAllowlist = new Set<string>(config.allowFrom || []);
  let ws: WebSocket | null = null;
  let botUserId: string | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let running = false;
  let seq = 1;

  const baseUrl = config.serverUrl.replace(/\/$/, '');
  const wsUrl = baseUrl.replace(/^http/, 'ws') + '/api/v4/websocket';

  function isUserAllowed(userId: string): boolean {
    if (staticAllowlist.has(userId)) return true;
    if (pairing?.isPaired('mattermost', userId)) return true;
    return false;
  }

  async function apiRequest<T>(
    endpoint: string,
    method: string = 'GET',
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${baseUrl}/api/v4${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`Mattermost API error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  async function getChannel(channelId: string): Promise<MattermostChannel> {
    return apiRequest<MattermostChannel>(`/channels/${channelId}`);
  }

  async function createPost(channelId: string, message: string, fileIds?: string[]): Promise<MattermostPost> {
    return apiRequest<MattermostPost>('/posts', 'POST', {
      channel_id: channelId,
      message,
      file_ids: fileIds,
    });
  }

  async function updatePost(postId: string, message: string): Promise<MattermostPost> {
    return apiRequest<MattermostPost>(`/posts/${postId}/patch`, 'PUT', { message });
  }

  async function deletePost(postId: string): Promise<void> {
    await apiRequest(`/posts/${postId}`, 'DELETE');
  }

  async function handlePost(post: MattermostPost): Promise<void> {
    if (post.user_id === botUserId) return;

    const channel = await getChannel(post.channel_id);
    const isDM = channel.type === 'D';
    const text = post.message;

    // DM Policy enforcement
    if (isDM) {
      switch (config.dmPolicy) {
        case 'allowlist':
          if (!isUserAllowed(post.user_id)) {
            logger.info({ userId: post.user_id }, 'Ignoring Mattermost message from non-allowlisted user');
            return;
          }
          break;

        case 'pairing':
          if (!isUserAllowed(post.user_id)) {
            const potentialCode = text.trim().toUpperCase();
            if (/^[A-Z0-9]{8}$/.test(potentialCode) && pairing) {
              const request = await pairing.validateCode(potentialCode);
              if (request) {
                await createPost(post.channel_id, ':white_check_mark: **Successfully paired!**\n\nYou can now chat with Clodds.');
                logger.info({ userId: post.user_id, code: potentialCode }, 'Mattermost user paired via direct code');
                return;
              }
            }

            if (pairing) {
              const code = await pairing.createPairingRequest('mattermost', post.user_id);
              if (code) {
                await createPost(
                  post.channel_id,
                  `:lock: **Pairing Required**\n\n` +
                    `Your pairing code: \`${code}\`\n\n` +
                    `Run \`clodds pairing approve mattermost ${code}\` to complete pairing.\n\n` +
                    `Code expires in 1 hour.`
                );
                logger.info({ userId: post.user_id, code }, 'Generated Mattermost pairing code');
              } else {
                await createPost(post.channel_id, ':lock: **Pairing Required**\n\nToo many pending requests. Try again later.');
              }
            }
            return;
          }
          break;

        case 'disabled':
          await createPost(post.channel_id, 'DMs are currently disabled.');
          return;
      }
    }

    // Check mention requirement for non-DM channels
    if (!isDM) {
      const requireMention = config.groups?.[post.channel_id]?.requireMention ?? true;
      if (requireMention && botUserId) {
        const escapedBotId = botUserId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const mentionPattern = new RegExp(`@${escapedBotId}|@clodds`, 'i');
        if (!mentionPattern.test(text)) {
          return;
        }
      }
    }

    const attachments: MessageAttachment[] = [];
    if (post.file_ids?.length) {
      for (const fileId of post.file_ids) {
        try {
          const fileInfo = await apiRequest<{ id: string; name: string; mime_type: string; size: number }>(
            `/files/${fileId}/info`
          );
          attachments.push({
            type: guessAttachmentType(fileInfo.mime_type, fileInfo.name),
            url: `${baseUrl}/api/v4/files/${fileId}`,
            filename: fileInfo.name,
            mimeType: fileInfo.mime_type,
            size: fileInfo.size,
          });
        } catch (error) {
          logger.warn({ error, fileId }, 'Failed to get Mattermost file info');
        }
      }
    }

    const cleanText = botUserId ? text.replace(new RegExp(`@${botUserId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), '').trim() : text;
    const incomingMessage: IncomingMessage = {
      id: post.id,
      platform: 'mattermost',
      userId: post.user_id,
      chatId: post.channel_id,
      chatType: isDM ? 'dm' : 'group',
      text: cleanText,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: new Date(post.create_at),
    };

    logger.info({ userId: post.user_id, chatType: incomingMessage.chatType }, 'Received Mattermost message');
    await callbacks.onMessage(incomingMessage);
  }

  function connect(): void {
    if (ws) {
      ws.close();
    }

    ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      logger.info('Mattermost WebSocket connected');
      // Authenticate
      ws?.send(
        JSON.stringify({
          seq: seq++,
          action: 'authentication_challenge',
          data: { token: config.accessToken },
        })
      );
    });

    ws.on('message', async (data: WebSocket.Data) => {
      try {
        const event = JSON.parse(data.toString());
        if (event.event === 'posted') {
          const post = JSON.parse(event.data.post) as MattermostPost;
          await handlePost(post);
        }
      } catch (error) {
        logger.warn({ error }, 'Failed to parse Mattermost WebSocket message');
      }
    });

    ws.on('close', () => {
      if (!running) return;
      logger.warn('Mattermost WebSocket closed, reconnecting...');
      reconnectTimer = setTimeout(connect, 5000);
    });

    ws.on('error', (error) => {
      logger.error({ error }, 'Mattermost WebSocket error');
    });
  }

  return {
    platform: 'mattermost',

    async start() {
      running = true;
      logger.info('Starting Mattermost bot');
      try {
        const me = await apiRequest<MattermostUser>('/users/me');
        botUserId = me.id;
        logger.info({ botUserId, username: me.username }, 'Mattermost bot authenticated');
      } catch (error) {
        logger.error({ error }, 'Failed to authenticate Mattermost bot');
        throw error;
      }
      connect();
    },

    async stop() {
      running = false;
      logger.info('Stopping Mattermost bot');
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (ws) {
        ws.close();
        ws = null;
      }
    },

    async sendMessage(message: OutgoingMessage): Promise<string | null> {
      try {
        const post = await createPost(message.chatId, message.text);
        return post.id;
      } catch (error) {
        logger.error({ error, chatId: message.chatId }, 'Failed to send Mattermost message');
        return null;
      }
    },

    async editMessage(message: OutgoingMessage & { messageId: string }) {
      try {
        await updatePost(message.messageId, message.text);
      } catch (error) {
        logger.error({ error }, 'Failed to edit Mattermost message');
      }
    },

    async deleteMessage(message: OutgoingMessage & { messageId: string }) {
      try {
        await deletePost(message.messageId);
      } catch (error) {
        logger.error({ error }, 'Failed to delete Mattermost message');
      }
    },
  };
}
