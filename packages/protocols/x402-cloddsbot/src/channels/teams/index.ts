/**
 * Microsoft Teams Channel - Bot Framework integration
 *
 * Features:
 * - Bot Framework messaging
 * - Adaptive Cards support
 * - Team/channel/DM routing
 * - Mentions and reactions
 */

import { logger } from '../../utils/logger';
import type { ChannelAdapter, ChannelCallbacks } from '../index';
import type { IncomingMessage, OutgoingMessage, MessageAttachment } from '../../types';
import type { PairingService } from '../../pairing/index';

export interface TeamsConfig {
  enabled: boolean;
  /** Microsoft App ID */
  appId: string;
  /** Microsoft App Password */
  appPassword: string;
  /** DM policy */
  dmPolicy?: 'pairing' | 'open';
  /** Allowed user IDs */
  allowFrom?: string[];
  /** Allowed teams/channels */
  teamAllowlist?: string[];
  /** Per-conversation group policies */
  groups?: Record<string, { requireMention?: boolean }>;
}

/** Teams activity types */
interface TeamsActivity {
  type: string;
  id: string;
  timestamp: string;
  channelId: string;
  from: {
    id: string;
    name: string;
    aadObjectId?: string;
  };
  conversation: {
    id: string;
    conversationType: 'personal' | 'groupChat' | 'channel';
    tenantId?: string;
    isGroup?: boolean;
  };
  recipient: {
    id: string;
    name: string;
  };
  text?: string;
  textFormat?: string;
  attachments?: Array<{
    contentType: string;
    content: unknown;
    contentUrl?: string;
    name?: string;
  }>;
  entities?: Array<{
    type: string;
    mentioned?: { id: string; name: string };
    text?: string;
  }>;
  channelData?: {
    team?: { id: string; name: string };
    channel?: { id: string; name: string };
  };
  serviceUrl: string;
}

/** Outgoing activity */
interface OutgoingActivity {
  type: 'message';
  text?: string;
  attachments?: Array<{
    contentType: string;
    content: unknown;
    contentUrl?: string;
    name?: string;
  }>;
}

export async function createTeamsChannel(
  config: TeamsConfig,
  callbacks: ChannelCallbacks,
  pairing?: PairingService
): Promise<ChannelAdapter> {
  logger.info('Creating Microsoft Teams channel');

  const dmPolicy = config.dmPolicy || 'pairing';
  const allowFrom = new Set(config.allowFrom || []);
  const teamAllowlist = new Set(config.teamAllowlist || []);

  // Store service URLs for sending messages (bounded to prevent memory leaks)
  const serviceUrls = new Map<string, string>();
  const MAX_SERVICE_URLS = 10000;

  /** Get access token for Bot Framework (cached with expiry) */
  let cachedToken: { token: string; expiresAt: number } | null = null;

  async function getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s safety margin)
    if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
      return cachedToken.token;
    }

    const response = await fetch(
      'https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: config.appId,
          client_secret: config.appPassword,
          scope: 'https://api.botframework.com/.default',
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.status}`);
    }

    const data = await response.json() as { access_token: string; expires_in?: number };
    const expiresInMs = (data.expires_in ?? 3600) * 1000;
    cachedToken = { token: data.access_token, expiresAt: Date.now() + expiresInMs };
    return data.access_token;
  }

  /** Check if user is allowed */
  function isAllowed(activity: TeamsActivity): boolean {
    // Team/channel messages
    if (activity.conversation.conversationType === 'channel') {
      if (teamAllowlist.size > 0) {
        const teamId = activity.channelData?.team?.id;
        return teamId ? teamAllowlist.has(teamId) : false;
      }
      return true;
    }

    // DM/group chat
    if (dmPolicy === 'open') {
      if (allowFrom.size === 0) return true;
      return allowFrom.has(activity.from.id) || allowFrom.has('*');
    }

    // Pairing mode
    if (pairing) {
      return pairing.isPaired('teams', activity.from.id);
    }

    return false;
  }

  /** Extract text from activity (remove bot mention) */
  function extractText(activity: TeamsActivity): string {
    let text = activity.text || '';

    // Remove bot mentions
    if (activity.entities) {
      for (const entity of activity.entities) {
        if (entity.type === 'mention' && entity.mentioned?.id === activity.recipient.id) {
          text = text.replace(entity.text || '', '').trim();
        }
      }
    }

    return text;
  }

  /** Handle incoming activity */
  async function handleActivity(activity: TeamsActivity): Promise<OutgoingActivity | null> {
    // Store service URL for this conversation (evict oldest if at capacity)
    if (serviceUrls.size >= MAX_SERVICE_URLS) {
      const oldest = serviceUrls.keys().next().value as string | undefined;
      if (oldest) serviceUrls.delete(oldest);
    }
    serviceUrls.set(activity.conversation.id, activity.serviceUrl);

    // Only handle message activities
    if (activity.type !== 'message') {
      return null;
    }

    // Check allowlist
    if (!isAllowed(activity)) {
      if (dmPolicy === 'pairing' && pairing) {
        const code = await pairing.createPairingRequest(
          'teams',
          activity.from.id,
          activity.from.name
        );
        if (code) {
          return {
            type: 'message',
            text: `Hi! I need to verify you first.\n\nYour pairing code is: **${code}**\n\nAsk an admin to approve it.`,
          };
        }
      }
      return {
        type: 'message',
        text: "Sorry, you're not authorized to use this bot.",
      };
    }

    const text = extractText(activity);
    const hasAttachments = Boolean(activity.attachments && activity.attachments.length > 0);
    if (!text && !hasAttachments) {
      return null;
    }

    if (activity.conversation.conversationType !== 'personal') {
      const requireMention =
        (config as any).groups?.[activity.conversation.id]?.requireMention ?? true;
      if (requireMention) {
        const isMentioned = activity.entities?.some(
          (entity) => entity.type === 'mention' && entity.mentioned?.id === activity.recipient.id
        );
        if (!isMentioned) {
          return null;
        }
      }
    }

    // Create incoming message
    const attachments: MessageAttachment[] = [];
    if (activity.attachments && activity.attachments.length > 0) {
      for (const attachment of activity.attachments) {
        attachments.push({
          type: attachment.contentType?.startsWith('image/')
            ? 'image'
            : attachment.contentType?.startsWith('video/')
              ? 'video'
              : attachment.contentType?.startsWith('audio/')
                ? 'audio'
                : 'document',
          url: attachment.contentUrl,
          filename: attachment.name,
          mimeType: attachment.contentType,
        });
      }
    }

    const message: IncomingMessage = {
      id: activity.id,
      platform: 'teams',
      userId: activity.from.id,
      chatId: activity.conversation.id,
      chatType: activity.conversation.conversationType === 'personal' ? 'dm' : 'group',
      text,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: new Date(activity.timestamp),
    };

    // Process through callback
    await callbacks.onMessage(message);

    // Response will be sent via sendMessage
    return null;
  }

  /** Send message to Teams */
  async function sendMessage(message: OutgoingMessage): Promise<string | null> {
    const serviceUrl = serviceUrls.get(message.chatId);
    if (!serviceUrl) {
      logger.warn({ chatId: message.chatId }, 'No service URL for conversation');
      return null;
    }

    const token = await getAccessToken();

    const attachments = message.attachments || [];
    const activity: OutgoingActivity = {
      type: 'message',
      text: message.text,
      attachments: attachments.length > 0
        ? attachments.map((attachment) => {
            if (attachment.url) {
              return {
                contentType: attachment.mimeType || 'application/octet-stream',
                contentUrl: attachment.url,
                name: attachment.filename,
                content: undefined,
              };
            }
            if (attachment.data && attachment.mimeType) {
              return {
                contentType: attachment.mimeType,
                contentUrl: `data:${attachment.mimeType};base64,${attachment.data}`,
                name: attachment.filename,
                content: undefined,
              };
            }
            return {
              contentType: attachment.mimeType || 'application/octet-stream',
              content: attachment.data || attachment.filename || 'attachment',
              name: attachment.filename,
            };
          })
        : undefined,
    };

    const response = await fetch(
      `${serviceUrl}v3/conversations/${encodeURIComponent(message.chatId)}/activities`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(activity),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send Teams message: ${response.status} ${error}`);
    }

    const payload = await response.json() as { id?: string };
    logger.debug({ chatId: message.chatId }, 'Teams message sent');
    return payload.id ?? null;
  }

  async function editMessage(message: OutgoingMessage & { messageId: string }): Promise<void> {
    const serviceUrl = serviceUrls.get(message.chatId);
    if (!serviceUrl) {
      logger.warn({ chatId: message.chatId }, 'No service URL for conversation');
      return;
    }

    const token = await getAccessToken();
    const activity: OutgoingActivity = {
      type: 'message',
      text: message.text,
    };

    const response = await fetch(
      `${serviceUrl}v3/conversations/${encodeURIComponent(message.chatId)}/activities/${encodeURIComponent(message.messageId)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(activity),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to edit Teams message: ${response.status} ${error}`);
    }
  }

  async function deleteMessage(message: OutgoingMessage & { messageId: string }): Promise<void> {
    const serviceUrl = serviceUrls.get(message.chatId);
    if (!serviceUrl) {
      logger.warn({ chatId: message.chatId }, 'No service URL for conversation');
      return;
    }

    const token = await getAccessToken();
    const response = await fetch(
      `${serviceUrl}v3/conversations/${encodeURIComponent(message.chatId)}/activities/${encodeURIComponent(message.messageId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete Teams message: ${response.status} ${error}`);
    }
  }

  return {
    platform: 'teams',

    async start(): Promise<void> {
      logger.info('Microsoft Teams channel started (webhook mode)');
      // Teams uses webhooks - the webhook handler should call handleActivity
    },

    async stop(): Promise<void> {
      logger.info('Microsoft Teams channel stopped');
    },

    async sendMessage(message: OutgoingMessage): Promise<string | null> {
      return sendMessage(message);
    },
    async editMessage(message: OutgoingMessage & { messageId: string }): Promise<void> {
      await editMessage(message);
    },
    async deleteMessage(message: OutgoingMessage & { messageId: string }): Promise<void> {
      await deleteMessage(message);
    },

    // Expose activity handler for webhook integration
    // WARNING: Teams webhook events should be verified at the gateway layer by
    // validating the JWT Bearer token in the Authorization header against
    // the Bot Framework OpenID metadata. This adapter does not perform
    // JWT verification itself — callers MUST validate before invoking.
    handleEvent: handleActivity as (event: unknown) => Promise<unknown>,
  };
}

/**
 * Create Adaptive Card for rich messages
 */
export function createAdaptiveCard(options: {
  title?: string;
  body: string;
  actions?: Array<{
    type: 'openUrl' | 'submit';
    title: string;
    url?: string;
    data?: unknown;
  }>;
}): unknown {
  const card: Record<string, unknown> = {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      ...(options.title
        ? [
            {
              type: 'TextBlock',
              text: options.title,
              weight: 'bolder',
              size: 'large',
            },
          ]
        : []),
      {
        type: 'TextBlock',
        text: options.body,
        wrap: true,
      },
    ],
  };

  if (options.actions && options.actions.length > 0) {
    card.actions = options.actions.map((action) => {
      if (action.type === 'openUrl') {
        return {
          type: 'Action.OpenUrl',
          title: action.title,
          url: action.url,
        };
      }
      return {
        type: 'Action.Submit',
        title: action.title,
        data: action.data,
      };
    });
  }

  return {
    contentType: 'application/vnd.microsoft.card.adaptive',
    content: card,
  };
}
