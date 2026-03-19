export type HookEvent =
  | 'pre-message'
  | 'post-message'
  | 'pre-sign'
  | 'post-payment'
  | 'post-interaction'
  | 'post-friend-add'
  | 'pre-call'
  | 'post-call';

export interface HookAction {
  action: string;
  config?: Record<string, any>;
}

export interface HookContext {
  event: HookEvent;
  data: Record<string, any>;
  timestamp: number;
}

export type HookHandler = (ctx: HookContext) => Promise<{ allow: boolean; reason?: string }>;
