/**
 * Type declarations for tmi.js
 * https://github.com/tmijs/tmi.js
 */

declare module 'tmi.js' {
  export interface Options {
    options?: {
      debug?: boolean;
      messagesLogLevel?: string;
      joinInterval?: number;
      clientId?: string;
    };
    connection?: {
      server?: string;
      port?: number;
      reconnect?: boolean;
      maxReconnectAttempts?: number;
      maxReconnectInterval?: number;
      reconnectDecay?: number;
      reconnectInterval?: number;
      secure?: boolean;
      timeout?: number;
    };
    identity?: {
      username: string;
      password: string;
    };
    channels?: string[];
    logger?: {
      info: (message: string) => void;
      warn: (message: string) => void;
      error: (message: string) => void;
    };
  }

  export interface Tags {
    id?: string;
    username?: string;
    'display-name'?: string;
    'user-id'?: string;
    'tmi-sent-ts'?: string;
    mod?: boolean;
    subscriber?: boolean;
    turbo?: boolean;
    badges?: Record<string, string>;
    'badge-info'?: Record<string, string>;
    color?: string;
    emotes?: Record<string, string[]>;
    'emote-only'?: boolean;
    'message-type'?: string;
    'room-id'?: string;
    [key: string]: unknown;
  }

  export type MessageHandler = (channel: string, tags: Tags, message: string, self: boolean) => void;
  export type WhisperHandler = (from: string, tags: Tags, message: string, self: boolean) => void;
  export type ConnectedHandler = (addr: string, port: number) => void;
  export type DisconnectedHandler = (reason: string) => void;

  export class Client {
    constructor(options?: Options);
    connect(): Promise<[string, number]>;
    disconnect(): Promise<[string, number]>;
    on(event: 'message', handler: MessageHandler): this;
    on(event: 'whisper', handler: WhisperHandler): this;
    on(event: 'connected', handler: ConnectedHandler): this;
    on(event: 'disconnected', handler: DisconnectedHandler): this;
    on(event: string, handler: (...args: unknown[]) => void): this;
    say(channel: string, message: string): Promise<[string]>;
    whisper(username: string, message: string): Promise<[string, string]>;
    join(channel: string): Promise<[string]>;
    part(channel: string): Promise<[string]>;
    ping(): Promise<[number]>;
    color(color: string): Promise<[string]>;
    getOptions(): Options;
    getChannels(): string[];
    isMod(channel: string, username: string): boolean;
    readyState(): string;
  }

  export function client(options?: Options): Client;
}
