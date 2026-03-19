import { Command } from 'commander';
import yaml from 'js-yaml';
import { SettingsManager } from '../settings/manager.js';

export function registerConfigCommand(program: Command) {
  const cmd = program
    .command('config')
    .description('Manage anet settings');

  cmd
    .command('list')
    .description('Show all settings')
    .action(() => {
      const settings = new SettingsManager();
      console.log(yaml.dump(settings.getAll(), { lineWidth: -1 }));
    });

  cmd
    .command('get <key>')
    .description('Get a config value (dot notation: social.min-friend-rep)')
    .action((key: string) => {
      const settings = new SettingsManager();
      const value = settings.get(key);
      if (value === undefined) {
        console.error(`Key not found: ${key}`);
      } else if (typeof value === 'object') {
        console.log(yaml.dump(value, { lineWidth: -1 }));
      } else {
        console.log(value);
      }
    });

  cmd
    .command('set <key> <value>')
    .description('Set a config value')
    .action((key: string, value: string) => {
      const settings = new SettingsManager();
      settings.set(key, value);
      console.log(`${key} = ${settings.get(key)}`);
    });
}
