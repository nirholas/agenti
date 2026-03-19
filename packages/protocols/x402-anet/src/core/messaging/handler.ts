import axios from 'axios';
import { execSync } from 'child_process';
import { RateLimiter } from './ratelimit.js';
import type { AgentMessage, ServiceRequest, ServiceInquiry, FriendRequest, FriendAccept, CapabilitiesResponse } from './types.js';
import type { SkillDefinition } from '../../skills/types.js';

export type ServiceHandler = (sender: string, payload: any) => Promise<any>;
export type FriendRequestHandler = (sender: string, request: FriendRequest) => Promise<void>;
export type FriendAcceptHandler = (sender: string, accept: FriendAccept) => Promise<void>;

export interface MessageHandlerOptions {
  maxMessagesPerMinute?: number;
  reputationChecker?: (address: string) => Promise<number>;
  onFriendRequest?: FriendRequestHandler;
  onFriendAccept?: FriendAcceptHandler;
  skills?: SkillDefinition[];
  agentName?: string;
  agentId?: number;
  httpEndpoint?: string;
  textWebhook?: string;
  textScript?: string;
}

export class MessageHandler {
  private services: Map<string, ServiceHandler> = new Map();
  private rateLimiter: RateLimiter;
  private reputationChecker?: (address: string) => Promise<number>;
  private onFriendRequest?: FriendRequestHandler;
  private onFriendAccept?: FriendAcceptHandler;
  private skills: SkillDefinition[];
  private agentName: string;
  private agentId?: number;
  private httpEndpoint?: string;
  private textWebhook?: string;
  private textScript?: string;

  constructor(options: MessageHandlerOptions = {}) {
    this.rateLimiter = new RateLimiter(options.maxMessagesPerMinute);
    this.reputationChecker = options.reputationChecker;
    this.onFriendRequest = options.onFriendRequest;
    this.onFriendAccept = options.onFriendAccept;
    this.skills = options.skills || [];
    this.agentName = options.agentName || 'anet-agent';
    this.agentId = options.agentId;
    this.httpEndpoint = options.httpEndpoint;
    this.textWebhook = options.textWebhook;
    this.textScript = options.textScript;

    // Auto-register free skill handlers from skill definitions
    for (const skill of this.skills) {
      if (!skill.price && !this.services.has(skill.name)) {
        this.registerSkillHandler(skill);
      }
    }
  }

  private registerSkillHandler(skill: SkillDefinition): void {
    this.services.set(skill.name, async (_sender: string, payload: any) => {
      switch (skill.handler) {
        case 'webhook': {
          if (!skill.webhook) throw new Error('Webhook URL not configured');
          const resp = await axios({
            method: 'POST',
            url: skill.webhook,
            data: payload,
            headers: { 'content-type': 'application/json' },
            timeout: 30000,
          });
          return resp.data;
        }
        case 'script': {
          if (!skill.script) throw new Error('Script path not configured');
          const output = execSync(skill.script, {
            input: JSON.stringify(payload),
            encoding: 'utf8',
            timeout: 30000,
          });
          try { return JSON.parse(output); } catch { return { output: output.trim() }; }
        }
        case 'placeholder':
        default:
          return { status: 'ok', skill: skill.name, description: skill.description };
      }
    });
  }

  registerService(name: string, handler: ServiceHandler): void {
    this.services.set(name, handler);
  }

  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  async handleMessage(sender: string, content: string): Promise<string> {
    if (!this.rateLimiter.checkLimit(sender)) {
      return JSON.stringify({ type: 'error', error: 'Rate limit exceeded' });
    }

    try {
      const message: AgentMessage = JSON.parse(content);
      return await this.handleStructuredMessage(sender, message);
    } catch {
      return await this.handleTextMessage(sender, content);
    }
  }

  private async handleStructuredMessage(sender: string, message: AgentMessage): Promise<string> {
    if (message.type === 'service-request' && this.reputationChecker) {
      const rep = await this.reputationChecker(sender);
      if (rep < 30) {
        return JSON.stringify({
          type: 'service-response',
          status: 'error',
          result: 'Insufficient reputation',
        });
      }
    }

    switch (message.type) {
      case 'service-request':
        return this.handleServiceRequest(sender, message as ServiceRequest);
      case 'service-inquiry':
        return this.handleServiceInquiry(message as ServiceInquiry);
      case 'friend-request':
        if (this.onFriendRequest) {
          await this.onFriendRequest(sender, message as FriendRequest);
          return JSON.stringify({ type: 'ack', received: 'friend-request' });
        }
        return JSON.stringify({ type: 'ack', received: 'friend-request', note: 'no handler registered' });
      case 'friend-accept':
        if (this.onFriendAccept) {
          await this.onFriendAccept(sender, message as FriendAccept);
          return JSON.stringify({ type: 'ack', received: 'friend-accept' });
        }
        return JSON.stringify({ type: 'ack', received: 'friend-accept', note: 'no handler registered' });
      default:
        return JSON.stringify({ type: 'ack', received: message.type });
    }
  }

  private async handleServiceRequest(sender: string, request: ServiceRequest): Promise<string> {
    // Check if it's a paid skill — redirect to HTTP
    const skill = this.skills.find(s => s.name === request.service);
    if (skill?.price) {
      return JSON.stringify({
        type: 'service-response',
        requestId: request.id,
        status: 'payment-required',
        result: `${request.service} costs ${skill.price}. Use HTTP with X402 payment:`,
        httpEndpoint: this.httpEndpoint ? `${this.httpEndpoint}/api/${request.service}` : undefined,
        usage: `anet call ${this.agentId || '<agent-id>'} ${request.service}`,
      });
    }

    const handler = this.services.get(request.service);
    if (!handler) {
      const caps = this.buildCapabilities();
      return JSON.stringify({
        type: 'service-response',
        requestId: request.id,
        status: 'error',
        result: `Unknown service: ${request.service}`,
        available: caps.services.map(s => s.name),
      });
    }

    try {
      const result = await handler(sender, request.payload);
      return JSON.stringify({
        type: 'service-response',
        requestId: request.id,
        status: 'success',
        result,
      });
    } catch (error) {
      return JSON.stringify({
        type: 'service-response',
        requestId: request.id,
        status: 'error',
        result: String(error),
      });
    }
  }

  private async handleServiceInquiry(inquiry: ServiceInquiry): Promise<string> {
    const skill = this.skills.find(s => s.name === inquiry.service);
    if (skill) {
      return JSON.stringify({
        type: 'service-details',
        service: skill.name,
        available: true,
        description: skill.description,
        price: skill.price || null,
        method: skill.method || 'POST',
        paid: !!skill.price,
        httpEndpoint: this.httpEndpoint ? `${this.httpEndpoint}/api/${skill.name}` : undefined,
        usage: skill.price
          ? `anet call ${this.agentId || '<agent-id>'} ${skill.name}`
          : { type: 'service-request', service: skill.name, payload: {} },
      });
    }

    return JSON.stringify({
      type: 'service-details',
      service: inquiry.service,
      available: false,
      allServices: this.skills.map(s => s.name),
    });
  }

  private async handleTextMessage(sender: string, content: string): Promise<string> {
    // Try webhook handler first
    if (this.textWebhook) {
      try {
        const resp = await axios({
          method: 'POST',
          url: this.textWebhook,
          data: { sender, message: content, timestamp: new Date().toISOString() },
          headers: { 'content-type': 'application/json' },
          timeout: 30000,
        });
        const data = resp.data;
        return typeof data === 'string' ? data : JSON.stringify(data.response || data);
      } catch {
        // Webhook failed — fall through to capabilities
      }
    }

    // Try script handler
    if (this.textScript) {
      try {
        const input = JSON.stringify({ sender, message: content, timestamp: new Date().toISOString() });
        const output = execSync(this.textScript, {
          input,
          encoding: 'utf8',
          timeout: 30000,
        });
        return output.trim();
      } catch {
        // Script failed — fall through to capabilities
      }
    }

    // No handler configured — return capabilities or "not configured" message
    if (this.skills.length === 0) {
      return JSON.stringify({
        type: 'not-configured',
        message: `This agent (${this.agentName}) has not been configured with any services yet. Check back later.`,
      });
    }

    return JSON.stringify(this.buildCapabilities());
  }

  buildCapabilities(): CapabilitiesResponse {
    const freeSkills = this.skills.filter(s => !s.price);
    const paidSkills = this.skills.filter(s => !!s.price);
    const firstFree = freeSkills[0];

    return {
      type: 'capabilities',
      agentId: this.agentId,
      name: this.agentName,
      services: this.skills.map(s => ({
        name: s.name,
        description: s.description,
        price: s.price || null,
        method: s.method || 'POST',
      })),
      freeServices: freeSkills.map(s => s.name),
      paidServices: paidSkills.map(s => s.name),
      httpEndpoint: this.httpEndpoint,
      usage: {
        free: firstFree ? { type: 'service-request', service: firstFree.name, payload: {} } : null,
        paid: paidSkills.length > 0
          ? `Use HTTP with X402: anet call ${this.agentId || '<agent-id>'} <service>`
          : null,
      },
    };
  }

  destroy(): void {
    this.rateLimiter.destroy();
  }
}
