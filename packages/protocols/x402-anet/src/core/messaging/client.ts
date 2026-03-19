import { MessageHandler, type ServiceHandler } from './handler.js';
import type { SkillDefinition } from '../../skills/types.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface XMTPClientOptions {
  env?: 'production' | 'dev';
  encryptionKey?: string;
  dbPath?: string;
  maxMessagesPerMinute?: number;
  skills?: SkillDefinition[];
  agentName?: string;
  agentId?: number;
  httpEndpoint?: string;
  textWebhook?: string;
  textScript?: string;
}

export class AgentMessagingClient {
  private privateKey: string;
  private options: XMTPClientOptions;
  private handler: MessageHandler;
  private agent: any = null;  // Agent from @xmtp/agent-sdk
  private messageLog: string;
  private running: boolean = false;
  private walletAddress: string = '';
  private reachabilityCache: Map<string, { reachable: boolean; ts: number }> = new Map();
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(privateKey: string, options: XMTPClientOptions = {}) {
    this.privateKey = privateKey;
    this.options = options;
    this.handler = new MessageHandler({
      maxMessagesPerMinute: options.maxMessagesPerMinute,
      skills: options.skills,
      agentName: options.agentName,
      agentId: options.agentId,
      httpEndpoint: options.httpEndpoint,
      textWebhook: options.textWebhook,
      textScript: options.textScript,
    });
    this.messageLog = path.join(options.dbPath || process.cwd(), 'xmtp-messages.jsonl');
  }

  registerService(name: string, handler: ServiceHandler): void {
    this.handler.registerService(name, handler);
  }

  async start(): Promise<void> {
    let Agent: any, createUser: any, createSigner: any;
    try {
      ({ Agent, createUser, createSigner } = await import('@xmtp/agent-sdk'));
    } catch {
      throw new Error('XMTP Agent SDK not installed. Run: npm install @xmtp/agent-sdk');
    }

    const pk = this.privateKey.replace(/^0x/, '');
    const user = createUser(`0x${pk}` as `0x${string}`);
    this.walletAddress = user.account.address;
    const signer = createSigner(user);

    // Encryption key: load persisted or generate new
    const dbDir = this.options.dbPath || process.cwd();
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    const keyPath = path.join(dbDir, 'xmtp-encryption-key');
    let encKeyHex: string;
    if (this.options.encryptionKey) {
      encKeyHex = this.options.encryptionKey.replace(/^0x/, '');
    } else if (fs.existsSync(keyPath)) {
      encKeyHex = fs.readFileSync(keyPath, 'utf8').trim().replace(/^0x/, '');
    } else {
      encKeyHex = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(keyPath, encKeyHex, { mode: 0o600 });
    }

    const dbPath = path.join(dbDir, `xmtp-${user.account.address}.db3`);
    const env = this.options.env || 'production';

    try {
      this.agent = await Agent.create(signer, {
        env,
        dbPath,
        dbEncryptionKey: `0x${encKeyHex}` as `0x${string}`,
      });
    } catch (e: any) {
      throw new Error(`XMTP client creation failed (${env}): ${e.message}`);
    }

    console.log('XMTP client created');
    console.log('  Inbox ID:', this.agent.client.inboxId);
    console.log('  Address:', user.account.address);
    console.log('  Network:', env);

    this.running = true;
  }

  async startListening(): Promise<void> {
    if (!this.agent) throw new Error('Client not started. Call start() first.');

    await this.agent.client.conversations.syncAll();

    console.log('Listening for messages...\n');

    // Stream 1: All messages in existing conversations
    const messageStream = await this.agent.client.conversations.streamAllMessages();
    (async () => {
      try {
        for await (const message of messageStream) {
          if (message.senderInboxId === this.agent?.client?.inboxId) continue;
          await this.handleIncoming(message);
        }
      } catch (err: any) {
        if (this.running) {
          console.error('Message stream ended unexpectedly:', err.message);
        }
      }
    })();

    // Stream 2: New conversations (so we catch first messages from new contacts)
    const convStream = await this.agent.client.conversations.stream();
    (async () => {
      try {
        for await (const conv of convStream) {
          // Sync the new conversation to pick up its messages
          await conv.sync();
        }
      } catch (err: any) {
        if (this.running) {
          console.error('Conversation stream ended unexpectedly:', err.message);
        }
      }
    })();
  }

  private async handleIncoming(message: any): Promise<void> {
    const content = typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content);

    const timestamp = new Date().toISOString().substring(11, 19);
    console.log(`[${timestamp}] ${message.senderInboxId}: ${content}`);

    try {
      const response = await this.handler.handleMessage(
        message.senderInboxId,
        content
      );

      const convId = message.conversationId;
      const conversations = await this.agent.client.conversations.list();
      const conv = conversations.find((c: any) => c.id === convId);
      if (conv) {
        await conv.sendText(response);
      }

      this.logMessage(message.senderInboxId, content, response);
    } catch (err: any) {
      console.error(`  Error handling message: ${err.message}`);
    }
  }

  async sendMessage(recipientAddress: string, message: string): Promise<string | undefined> {
    if (!this.agent) throw new Error('Client not started. Call start() first.');

    const addr = recipientAddress.toLowerCase();

    // Check cache first
    const cached = this.reachabilityCache.get(addr);
    if (cached && Date.now() - cached.ts < AgentMessagingClient.CACHE_TTL) {
      if (!cached.reachable) {
        console.log(`  ${recipientAddress} is not on XMTP network (cached)`);
        return undefined;
      }
    } else {
      // Check if recipient is on XMTP
      try {
        const identifier = { identifier: addr, identifierKind: 0 as const };
        const canMsg = await this.agent.client.canMessage([identifier]);
        const reachable = canMsg.get(addr) ?? canMsg.get(recipientAddress) ?? false;
        this.reachabilityCache.set(addr, { reachable, ts: Date.now() });

        if (!reachable) {
          console.log(`  ${recipientAddress} is not on XMTP network`);
          return undefined;
        }
      } catch (e: any) {
        console.error(`  canMessage check failed: ${e.message}`);
      }
    }

    try {
      const dm = await this.agent.createDmWithAddress(addr as `0x${string}`);
      const msgId = await dm.sendText(message);
      this.logMessage('self', message, `-> ${recipientAddress}`);
      console.log(`  Sent (msg: ${msgId})`);
      return msgId;
    } catch (e: any) {
      console.error(`  Send failed: ${e.message}`);
      return undefined;
    }
  }

  async getConversations(): Promise<any[]> {
    if (!this.agent) return [];
    await this.agent.client.conversations.syncAll();
    // Include both allowed and unknown consent states to see incoming DMs
    try {
      return await this.agent.client.conversations.list({ consentStates: [0, 1] });
    } catch {
      return this.agent.client.conversations.list();
    }
  }

  getAddress(): string {
    return this.walletAddress;
  }

  getInboxId(): string | undefined {
    return this.agent?.client?.inboxId;
  }

  private logMessage(sender: string, incoming: string, outgoing: string): void {
    const entry = {
      timestamp: new Date().toISOString(),
      sender,
      incoming: incoming.substring(0, 500),
      outgoing: outgoing.substring(0, 500),
    };
    try {
      fs.appendFileSync(this.messageLog, JSON.stringify(entry) + '\n');
    } catch {
      // non-critical
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  isLive(): boolean {
    return this.agent !== null;
  }

  async stop(): Promise<void> {
    this.running = false;
    this.handler.destroy();
    if (this.agent) {
      try { await this.agent.stop(); } catch {}
    }
    this.agent = null;
  }
}
