import { Command } from 'commander';
import yaml from 'js-yaml';
import { SettingsManager } from '../settings/manager.js';

export function registerHooksCommand(program: Command) {
  const cmd = program
    .command('hooks')
    .description('Manage event hooks (fire on interactions, payments, messages)');

  cmd
    .command('list')
    .description('Show configured hooks')
    .action(() => {
      const settings = new SettingsManager();
      const hooks = settings.loadHooks();
      console.log(yaml.dump(hooks, { lineWidth: -1 }));
    });

  cmd
    .command('add <event> <action>')
    .description('Add a hook (events: pre-message, post-payment, pre-sign, ...)')
    .option('--config <json>', 'Hook config as JSON')
    .action((event: string, action: string, opts: any) => {
      const settings = new SettingsManager();
      const hooks = settings.loadHooks();

      if (!hooks.hooks) hooks.hooks = {};
      if (!hooks.hooks[event]) hooks.hooks[event] = [];

      const entry: any = { action };
      if (opts.config) {
        entry.config = JSON.parse(opts.config);
      }

      hooks.hooks[event].push(entry);
      settings.saveHooks(hooks);

      console.log(`Added hook: ${event} -> ${action}`);
    });

  cmd
    .command('remove <event> <action>')
    .description('Remove a hook')
    .action((event: string, action: string) => {
      const settings = new SettingsManager();
      const hooks = settings.loadHooks();

      if (!hooks.hooks?.[event]) {
        console.error(`No hooks for event: ${event}`);
        return;
      }

      const before = hooks.hooks[event].length;
      hooks.hooks[event] = hooks.hooks[event].filter((h: any) => h.action !== action);
      const removed = before - hooks.hooks[event].length;

      if (removed === 0) {
        console.error(`No hook found: ${event} -> ${action}`);
        return;
      }

      if (hooks.hooks[event].length === 0) {
        delete hooks.hooks[event];
      }

      settings.saveHooks(hooks);
      console.log(`Removed ${removed} hook(s): ${event} -> ${action}`);
    });
}
