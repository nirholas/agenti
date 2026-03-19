/**
 * Line Channel Module - LINE Messaging API integration
 *
 * Features:
 * - LINE Bot messaging
 * - Rich messages (flex, template)
 * - Push/Reply messaging
 * - Webhook handling
 * - User/Group management
 */

import { EventEmitter } from 'events';
import type { ChannelAdapter, ChannelCallbacks } from '../index';
import type { IncomingMessage, OutgoingMessage, MessageAttachment } from '../../types';
import type { PairingService } from '../../pairing/index';
import * as http from 'http';
import * as https from 'https';
import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '../../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface LineConfig {
  channelAccessToken: string;
  channelSecret: string;
  webhookPort?: number;
  webhookPath?: string;
}

export interface LineMessage {
  type: 'text' | 'image' | 'video' | 'audio' | 'location' | 'sticker' | 'flex' | 'template';
  text?: string;
  originalContentUrl?: string;
  previewImageUrl?: string;
  title?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  packageId?: string;
  stickerId?: string;
  altText?: string;
  contents?: FlexContainer;
  template?: TemplateMessage;
}

export interface FlexContainer {
  type: 'bubble' | 'carousel';
  header?: FlexBox;
  hero?: FlexImage;
  body?: FlexBox;
  footer?: FlexBox;
  contents?: FlexBubble[];
}

export interface FlexBox {
  type: 'box';
  layout: 'horizontal' | 'vertical' | 'baseline';
  contents: FlexComponent[];
  spacing?: string;
  margin?: string;
}

export interface FlexImage {
  type: 'image';
  url: string;
  size?: string;
  aspectRatio?: string;
  aspectMode?: string;
}

export interface FlexComponent {
  type: 'box' | 'button' | 'image' | 'text' | 'separator' | 'spacer';
  text?: string;
  url?: string;
  action?: Action;
  [key: string]: unknown;
}

export interface FlexBubble extends FlexContainer {
  type: 'bubble';
}

export interface TemplateMessage {
  type: 'buttons' | 'confirm' | 'carousel' | 'image_carousel';
  title?: string;
  text?: string;
  thumbnailImageUrl?: string;
  actions?: Action[];
  columns?: TemplateColumn[];
}

export interface TemplateColumn {
  thumbnailImageUrl?: string;
  title?: string;
  text: string;
  actions: Action[];
}

export interface Action {
  type: 'message' | 'uri' | 'postback' | 'datetimepicker';
  label: string;
  text?: string;
  uri?: string;
  data?: string;
  mode?: string;
  initial?: string;
  max?: string;
  min?: string;
}

export interface LineWebhookEvent {
  type: 'message' | 'follow' | 'unfollow' | 'join' | 'leave' | 'postback' | 'beacon';
  replyToken?: string;
  source: {
    type: 'user' | 'group' | 'room';
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  timestamp: number;
  message?: {
    type: string;
    id: string;
    text?: string;
    fileName?: string;
    fileSize?: number;
    title?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    packageId?: string;
    stickerId?: string;
  };
  postback?: {
    data: string;
    params?: Record<string, string>;
  };
  beacon?: {
    hwid: string;
    type: string;
    dm?: string;
  };
}

export interface LineWebhookPayload {
  events?: LineWebhookEvent[];
}

export interface LineChannelConfig extends LineConfig {
  enabled: boolean;
  /** DM policy */
  dmPolicy?: 'pairing' | 'open';
  /** Allowed user IDs */
  allowFrom?: string[];
  /** Allowed group IDs */
  groupAllowlist?: string[];
  /** Allowed room IDs */
  roomAllowlist?: string[];
  /** If true, start internal webhook server instead of gateway */
  useInternalWebhookServer?: boolean;
  /** Per-group policies */
  groups?: Record<string, { requireMention?: boolean }>;
}

export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  language?: string;
}

export interface LineGroupSummary {
  groupId: string;
  groupName: string;
  pictureUrl?: string;
}

// =============================================================================
// LINE CLIENT
// =============================================================================

export class LineClient extends EventEmitter {
  private config: LineConfig;
  private baseUrl = 'https://api.line.me/v2';
  private dataUrl = 'https://api-data.line.me/v2';
  private webhookServer: http.Server | null = null;

  constructor(config: LineConfig) {
    super();
    this.config = {
      webhookPort: 3000,
      webhookPath: '/webhook',
      ...config,
    };
  }

  /** Make an API request */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    isDataApi = false
  ): Promise<T> {
    const baseUrl = isDataApi ? this.dataUrl : this.baseUrl;
    const url = `${baseUrl}${path}`;

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.channelAccessToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LINE API error: ${response.status} - ${error}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  /** Verify webhook signature (timing-safe comparison) */
  verifySignature(body: string, signature: string): boolean {
    const hash = createHmac('sha256', this.config.channelSecret)
      .update(body)
      .digest('base64');
    if (hash.length !== signature.length) return false;
    return timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  }

  /** Start webhook server */
  startWebhook(): Promise<void> {
    return new Promise((resolve) => {
      this.webhookServer = http.createServer((req, res) => {
        if (req.method !== 'POST' || req.url !== this.config.webhookPath) {
          res.statusCode = 404;
          res.end();
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          const signature = req.headers['x-line-signature'] as string;

          if (!this.verifySignature(body, signature)) {
            res.statusCode = 401;
            res.end('Invalid signature');
            return;
          }

          try {
            const data = JSON.parse(body);
            for (const event of data.events || []) {
              this.handleEvent(event);
            }
            res.statusCode = 200;
            res.end('OK');
          } catch (error) {
            logger.error({ error }, 'Webhook error');
            res.statusCode = 500;
            res.end('Error');
          }
        });
      });

      this.webhookServer.listen(this.config.webhookPort, () => {
        logger.info({ port: this.config.webhookPort, path: this.config.webhookPath }, 'LINE webhook server started');
        resolve();
      });
    });
  }

  /** Stop webhook server */
  stopWebhook(): Promise<void> {
    return new Promise((resolve) => {
      if (this.webhookServer) {
        this.webhookServer.close(() => {
          this.webhookServer = null;
          logger.info('LINE webhook server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /** Handle webhook event */
  private handleEvent(event: LineWebhookEvent): void {
    this.emit('event', event);
    this.emit(event.type, event);

    switch (event.type) {
      case 'message':
        this.emit(`message:${event.message?.type}`, event);
        break;
    }
  }

  /** Handle webhook payload from external server */
  handleWebhookPayload(payload: LineWebhookPayload | LineWebhookEvent): void {
    if (!payload) return;
    if (Array.isArray((payload as LineWebhookPayload).events)) {
      for (const event of (payload as LineWebhookPayload).events || []) {
        this.handleEvent(event);
      }
      return;
    }
    this.handleEvent(payload as LineWebhookEvent);
  }

  /** Reply to a message */
  async reply(replyToken: string, messages: LineMessage[]): Promise<void> {
    await this.request('POST', '/bot/message/reply', {
      replyToken,
      messages: messages.slice(0, 5), // Max 5 messages per reply
    });
  }

  /** Reply with text */
  async replyText(replyToken: string, text: string): Promise<void> {
    await this.reply(replyToken, [{ type: 'text', text }]);
  }

  /** Push message to user/group/room */
  async push(to: string, messages: LineMessage[]): Promise<void> {
    await this.request('POST', '/bot/message/push', {
      to,
      messages: messages.slice(0, 5),
    });
  }

  /** Push text message */
  async pushText(to: string, text: string): Promise<void> {
    await this.push(to, [{ type: 'text', text }]);
  }

  /** Multicast messages to multiple users */
  async multicast(to: string[], messages: LineMessage[]): Promise<void> {
    await this.request('POST', '/bot/message/multicast', {
      to: to.slice(0, 500), // Max 500 users
      messages: messages.slice(0, 5),
    });
  }

  /** Broadcast to all friends */
  async broadcast(messages: LineMessage[]): Promise<void> {
    await this.request('POST', '/bot/message/broadcast', {
      messages: messages.slice(0, 5),
    });
  }

  /** Get user profile */
  async getProfile(userId: string): Promise<LineProfile> {
    return this.request<LineProfile>('GET', `/bot/profile/${userId}`);
  }

  /** Get group member profile */
  async getGroupMemberProfile(groupId: string, userId: string): Promise<LineProfile> {
    return this.request<LineProfile>('GET', `/bot/group/${groupId}/member/${userId}`);
  }

  /** Get room member profile */
  async getRoomMemberProfile(roomId: string, userId: string): Promise<LineProfile> {
    return this.request<LineProfile>('GET', `/bot/room/${roomId}/member/${userId}`);
  }

  /** Get group summary */
  async getGroupSummary(groupId: string): Promise<LineGroupSummary> {
    return this.request<LineGroupSummary>('GET', `/bot/group/${groupId}/summary`);
  }

  /** Get group member count */
  async getGroupMemberCount(groupId: string): Promise<number> {
    const result = await this.request<{ count: number }>('GET', `/bot/group/${groupId}/members/count`);
    return result.count;
  }

  /** Get room member count */
  async getRoomMemberCount(roomId: string): Promise<number> {
    const result = await this.request<{ count: number }>('GET', `/bot/room/${roomId}/members/count`);
    return result.count;
  }

  /** Leave a group */
  async leaveGroup(groupId: string): Promise<void> {
    await this.request('POST', `/bot/group/${groupId}/leave`);
  }

  /** Leave a room */
  async leaveRoom(roomId: string): Promise<void> {
    await this.request('POST', `/bot/room/${roomId}/leave`);
  }

  /** Get message content (for images, videos, etc.) */
  async getContent(messageId: string): Promise<Buffer> {
    const url = `${this.dataUrl}/bot/message/${messageId}/content`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.config.channelAccessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get content: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /** Get rich menu */
  async getRichMenu(richMenuId: string): Promise<unknown> {
    return this.request('GET', `/bot/richmenu/${richMenuId}`);
  }

  /** Create rich menu */
  async createRichMenu(richMenu: unknown): Promise<{ richMenuId: string }> {
    return this.request('POST', '/bot/richmenu', richMenu);
  }

  /** Delete rich menu */
  async deleteRichMenu(richMenuId: string): Promise<void> {
    await this.request('DELETE', `/bot/richmenu/${richMenuId}`);
  }

  /** Link rich menu to user */
  async linkRichMenuToUser(userId: string, richMenuId: string): Promise<void> {
    await this.request('POST', `/bot/user/${userId}/richmenu/${richMenuId}`);
  }

  /** Unlink rich menu from user */
  async unlinkRichMenuFromUser(userId: string): Promise<void> {
    await this.request('DELETE', `/bot/user/${userId}/richmenu`);
  }

  /** Set default rich menu */
  async setDefaultRichMenu(richMenuId: string): Promise<void> {
    await this.request('POST', `/bot/user/all/richmenu/${richMenuId}`);
  }

  /** Get number of sent messages */
  async getMessageQuota(): Promise<{ type: string; value: number }> {
    return this.request('GET', '/bot/message/quota');
  }

  /** Get bot info */
  async getBotInfo(): Promise<{
    userId: string;
    basicId: string;
    displayName: string;
    pictureUrl?: string;
  }> {
    return this.request('GET', '/bot/info');
  }
}

// =============================================================================
// MESSAGE BUILDERS
// =============================================================================

export class MessageBuilder {
  /** Create text message */
  static text(text: string): LineMessage {
    return { type: 'text', text };
  }

  /** Create image message */
  static image(originalUrl: string, previewUrl?: string): LineMessage {
    return {
      type: 'image',
      originalContentUrl: originalUrl,
      previewImageUrl: previewUrl || originalUrl,
    };
  }

  /** Create video message */
  static video(videoUrl: string, previewUrl: string): LineMessage {
    return {
      type: 'video',
      originalContentUrl: videoUrl,
      previewImageUrl: previewUrl,
    };
  }

  /** Create audio message */
  static audio(audioUrl: string, duration: number): LineMessage {
    return {
      type: 'audio',
      originalContentUrl: audioUrl,
      // duration is in milliseconds
    } as LineMessage;
  }

  /** Create location message */
  static location(title: string, address: string, latitude: number, longitude: number): LineMessage {
    return {
      type: 'location',
      title,
      address,
      latitude,
      longitude,
    };
  }

  /** Create sticker message */
  static sticker(packageId: string, stickerId: string): LineMessage {
    return {
      type: 'sticker',
      packageId,
      stickerId,
    };
  }

  /** Create button template */
  static buttons(config: {
    title?: string;
    text: string;
    thumbnailImageUrl?: string;
    actions: Action[];
  }): LineMessage {
    return {
      type: 'template',
      altText: config.title || config.text,
      template: {
        type: 'buttons',
        title: config.title,
        text: config.text,
        thumbnailImageUrl: config.thumbnailImageUrl,
        actions: config.actions.slice(0, 4), // Max 4 actions
      },
    };
  }

  /** Create confirm template */
  static confirm(text: string, actions: [Action, Action]): LineMessage {
    return {
      type: 'template',
      altText: text,
      template: {
        type: 'confirm',
        text,
        actions,
      },
    };
  }

  /** Create carousel template */
  static carousel(columns: TemplateColumn[]): LineMessage {
    return {
      type: 'template',
      altText: 'Carousel',
      template: {
        type: 'carousel',
        columns: columns.slice(0, 10), // Max 10 columns
      },
    };
  }

  /** Create flex message */
  static flex(altText: string, contents: FlexContainer): LineMessage {
    return {
      type: 'flex',
      altText,
      contents,
    };
  }

  /** Create simple flex bubble */
  static flexBubble(config: {
    header?: string;
    body: string;
    footer?: string;
    action?: Action;
  }): LineMessage {
    const contents: FlexContainer = {
      type: 'bubble',
    };

    if (config.header) {
      contents.header = {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'text',
          text: config.header,
        }],
      };
    }

    contents.body = {
      type: 'box',
      layout: 'vertical',
      contents: [{
        type: 'text',
        text: config.body,
      }],
    };

    if (config.footer) {
      contents.footer = {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'button',
          text: config.footer,
          action: config.action,
        }],
      };
    }

    return MessageBuilder.flex(config.body.slice(0, 100), contents);
  }
}

// =============================================================================
// ACTION BUILDERS
// =============================================================================

export class ActionBuilder {
  /** Create message action */
  static message(label: string, text: string): Action {
    return { type: 'message', label, text };
  }

  /** Create URI action */
  static uri(label: string, uri: string): Action {
    return { type: 'uri', label, uri };
  }

  /** Create postback action */
  static postback(label: string, data: string, displayText?: string): Action {
    return { type: 'postback', label, data, text: displayText };
  }

  /** Create datetime picker action */
  static datetimePicker(label: string, data: string, mode: 'date' | 'time' | 'datetime'): Action {
    return { type: 'datetimepicker', label, data, mode };
  }
}

// =============================================================================
// LINE CHANNEL ADAPTER
// =============================================================================

export class LineChannel extends EventEmitter {
  private client: LineClient;
  private isConnected = false;
  private config: LineChannelConfig;
  private dmPolicy: 'pairing' | 'open';
  private allowFrom: Set<string>;
  private groupAllowlist: Set<string>;
  private roomAllowlist: Set<string>;
  private callbacks?: ChannelCallbacks;
  private pairing?: PairingService;

  constructor(config: LineConfig, callbacks?: ChannelCallbacks, pairing?: PairingService) {
    super();
    this.config = config as LineChannelConfig;
    this.client = new LineClient(config);
    this.callbacks = callbacks;
    this.pairing = pairing;
    const policy = (config as LineChannelConfig).dmPolicy || 'pairing';
    this.dmPolicy = policy;
    this.allowFrom = new Set((config as LineChannelConfig).allowFrom || []);
    this.groupAllowlist = new Set((config as LineChannelConfig).groupAllowlist || []);
    this.roomAllowlist = new Set((config as LineChannelConfig).roomAllowlist || []);

    this.client.on('message:text', (event: LineWebhookEvent) => {
      this.handleTextMessage(event).catch((error) => {
        logger.error({ error }, 'LINE message handler failed');
      });
    });

    const mediaHandler = (event: LineWebhookEvent) => {
      this.handleMediaMessage(event).catch((error) => {
        logger.error({ error }, 'LINE media handler failed');
      });
    };
    this.client.on('message:image', mediaHandler);
    this.client.on('message:video', mediaHandler);
    this.client.on('message:audio', mediaHandler);
    this.client.on('message:file', mediaHandler);
    this.client.on('message:sticker', mediaHandler);

    this.client.on('follow', (event: LineWebhookEvent) => {
      this.emit('follow', { userId: event.source.userId, raw: event });
    });

    this.client.on('unfollow', (event: LineWebhookEvent) => {
      this.emit('unfollow', { userId: event.source.userId, raw: event });
    });

    this.client.on('join', (event: LineWebhookEvent) => {
      this.emit('join', {
        groupId: event.source.groupId,
        roomId: event.source.roomId,
        raw: event,
      });
    });

    this.client.on('leave', (event: LineWebhookEvent) => {
      this.emit('leave', {
        groupId: event.source.groupId,
        roomId: event.source.roomId,
        raw: event,
      });
    });

    this.client.on('postback', (event: LineWebhookEvent) => {
      this.emit('postback', {
        data: event.postback?.data,
        params: event.postback?.params,
        userId: event.source.userId,
        replyToken: event.replyToken,
        raw: event,
      });
    });
  }

  /** Check if sender is allowed */
  private isAllowed(event: LineWebhookEvent): boolean {
    const userId = event.source.userId;
    if (!userId) return false;

    // Group/room messages
    if (event.source.groupId) {
      if (this.groupAllowlist.size > 0) {
        return this.groupAllowlist.has(event.source.groupId);
      }
      return true;
    }
    if (event.source.roomId) {
      if (this.roomAllowlist.size > 0) {
        return this.roomAllowlist.has(event.source.roomId);
      }
      return true;
    }

    // DM policy
    if (this.dmPolicy === 'open') {
      if (this.allowFrom.size === 0) return true;
      return this.allowFrom.has(userId) || this.allowFrom.has('*');
    }

    if (this.pairing) {
      return this.pairing.isPaired('line', userId);
    }

    return false;
  }

  private async handleTextMessage(event: LineWebhookEvent): Promise<void> {
    if (!this.callbacks) return;
    if (!event.message?.text) return;
    if (!event.source.userId) return;

    if (!this.isAllowed(event)) {
      if (this.dmPolicy === 'pairing' && this.pairing) {
        const code = await this.pairing.createPairingRequest('line', event.source.userId);
        if (code && event.replyToken) {
          await this.reply(event.replyToken, `Hi! I need to verify you first.\n\nYour pairing code is: **${code}**\n\nAsk an admin to approve it.`);
        }
      }
      return;
    }

    const chatId = event.source.groupId || event.source.roomId || event.source.userId;
    if (!chatId) return;
    const chatType = event.source.groupId || event.source.roomId ? 'group' : 'dm';

    if (chatType === 'group') {
      const requireMention =
        this.config.groups?.[chatId]?.requireMention ?? false;
      if (requireMention) {
        // LINE doesn't expose mentions in webhook events; skip when required.
        return;
      }
    }

    const message: IncomingMessage = {
      id: event.message.id,
      platform: 'line',
      userId: event.source.userId,
      chatId,
      chatType,
      text: event.message.text,
      timestamp: new Date(event.timestamp),
    };

    await this.callbacks.onMessage(message);
  }

  private async handleMediaMessage(event: LineWebhookEvent): Promise<void> {
    if (!this.callbacks) return;
    if (!event.message?.id) return;
    if (!event.source.userId) return;

    if (!this.isAllowed(event)) {
      if (this.dmPolicy === 'pairing' && this.pairing) {
        const code = await this.pairing.createPairingRequest('line', event.source.userId);
        if (code && event.replyToken) {
          await this.reply(event.replyToken, `Hi! I need to verify you first.\n\nYour pairing code is: **${code}**\n\nAsk an admin to approve it.`);
        }
      }
      return;
    }

    const chatId = event.source.groupId || event.source.roomId || event.source.userId;
    if (!chatId) return;
    const chatType = event.source.groupId || event.source.roomId ? 'group' : 'dm';

    let attachmentType: MessageAttachment['type'] = 'document';
    if (event.message.type === 'image') attachmentType = 'image';
    if (event.message.type === 'video') attachmentType = 'video';
    if (event.message.type === 'audio') attachmentType = 'audio';
    if (event.message.type === 'sticker') attachmentType = 'sticker';

    let data: string | undefined;
    try {
      const buffer = await this.client.getContent(event.message.id);
      data = buffer.toString('base64');
    } catch (error) {
      logger.warn({ error }, 'Failed to download LINE media content');
    }

    const message: IncomingMessage = {
      id: event.message.id,
      platform: 'line',
      userId: event.source.userId,
      chatId,
      chatType,
      text: event.message?.text || '',
      attachments: [{
        type: attachmentType,
        data,
      }],
      timestamp: new Date(event.timestamp),
    };

    await this.callbacks.onMessage(message);
  }

  /** Connect (start webhook) */
  async connect(): Promise<void> {
    await this.client.startWebhook();
    this.isConnected = true;
    this.emit('connected');
    logger.info('LINE channel connected');
  }

  /** Disconnect */
  async disconnect(): Promise<void> {
    await this.client.stopWebhook();
    this.isConnected = false;
    this.emit('disconnected');
    logger.info('LINE channel disconnected');
  }

  /** Send message */
  async send(to: string, message: string | LineMessage): Promise<void> {
    const msg = typeof message === 'string' ? MessageBuilder.text(message) : message;
    await this.client.push(to, [msg]);
  }

  /** Reply to message */
  async reply(replyToken: string, message: string | LineMessage): Promise<void> {
    const msg = typeof message === 'string' ? MessageBuilder.text(message) : message;
    await this.client.reply(replyToken, [msg]);
  }

  /** Get underlying client */
  getClient(): LineClient {
    return this.client;
  }

  /** Check if connected */
  connected(): boolean {
    return this.isConnected;
  }

  async sendOutgoing(message: OutgoingMessage): Promise<void> {
    const target = message.chatId;
    if (!target) return;
    const replyToken = message.thread?.threadId || message.thread?.replyToMessageId;
    if (replyToken) {
      await this.reply(replyToken, message.text);
      return;
    }
    const attachments = message.attachments || [];
    if (attachments.length > 0) {
      if (message.text) {
        await this.send(target, message.text);
      }
      for (const attachment of attachments) {
        if (!attachment.url) {
          logger.warn({ attachment }, 'LINE attachment missing public URL');
          continue;
        }
        switch (attachment.type) {
          case 'image':
            await this.send(target, MessageBuilder.image(attachment.url, attachment.url));
            break;
          case 'video':
            await this.send(target, MessageBuilder.video(attachment.url, attachment.url));
            break;
          case 'audio':
          case 'voice':
            await this.send(target, MessageBuilder.audio(attachment.url, attachment.duration || 1));
            break;
          case 'document':
            await this.send(
              target,
              `${attachment.filename || 'file'}: ${attachment.url}`
            );
            break;
          default:
            await this.send(
              target,
              `${attachment.filename || 'file'}: ${attachment.url}`
            );
            break;
        }
      }
      return;
    }
    await this.send(target, message.text);
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createLineClient(config: LineConfig): LineClient {
  return new LineClient(config);
}

export function createLineChannel(
  config: LineChannelConfig,
  callbacks: ChannelCallbacks,
  pairing?: PairingService
): ChannelAdapter {
  const channel = new LineChannel(config, callbacks, pairing);
  const useInternalWebhook = Boolean(config.useInternalWebhookServer || config.webhookPort || config.webhookPath);

  return {
    platform: 'line',
    async start(): Promise<void> {
      if (useInternalWebhook) {
        await channel.connect();
      } else {
        logger.info('LINE channel started (gateway webhook mode)');
      }
    },
    async stop(): Promise<void> {
      if (useInternalWebhook) {
        await channel.disconnect();
      }
    },
    async sendMessage(message: OutgoingMessage): Promise<string | null> {
      await channel.sendOutgoing(message);
      return null;
    },
    async editMessage(message: OutgoingMessage & { messageId: string }): Promise<void> {
      logger.warn(
        { chatId: message.chatId, messageId: message.messageId },
        'LINE does not support message editing'
      );
    },
    async deleteMessage(message: OutgoingMessage & { messageId: string }): Promise<void> {
      logger.warn(
        { chatId: message.chatId, messageId: message.messageId },
        'LINE does not support message deletion'
      );
    },
    async handleEvent(event: unknown, req?: unknown): Promise<unknown> {
      // Optional signature verification if raw body + signature are provided
      const rawBody = (req as { rawBody?: string } | undefined)?.rawBody;
      const signature = (req as { headers?: Record<string, unknown> } | undefined)?.headers?.['x-line-signature'];
      if (rawBody && typeof signature === 'string') {
        const ok = channel.getClient().verifySignature(rawBody, signature);
        if (!ok) {
          throw new Error('Invalid LINE signature');
        }
      }

      channel.getClient().handleWebhookPayload(event as LineWebhookPayload);
      return null;
    },
  };
}
