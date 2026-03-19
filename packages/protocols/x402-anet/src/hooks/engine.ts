import fs from 'fs';
import path from 'path';
import { SettingsManager } from '../settings/manager.js';
import { HookEvent, HookAction, HookContext, HookHandler } from './types.js';
import { getBuiltinActions } from './actions.js';

export class HookEngine {
  private settings: SettingsManager;
  private builtins: Map<string, HookHandler>;

  constructor(settings: SettingsManager) {
    this.settings = settings;
    this.builtins = getBuiltinActions();
  }

  async fire(event: HookEvent, data: Record<string, any>): Promise<{ allow: boolean; reason?: string }> {
    const hooks = this.settings.loadHooks();
    const actions: HookAction[] = hooks?.hooks?.[event] || [];

    const ctx: HookContext = { event, data, timestamp: Date.now() };

    for (const action of actions) {
      const handler = this.builtins.get(action.action);
      if (!handler) {
        console.warn(`Unknown hook action: ${action.action}`);
        continue;
      }

      // Merge action config into context data
      const enrichedCtx = {
        ...ctx,
        data: { ...ctx.data, _hookConfig: action.config || {} },
      };

      const result = await handler(enrichedCtx);
      if (!result.allow) {
        return result;
      }
    }

    return { allow: true };
  }
}
