import { Command } from 'commander';
import { SkillsManager } from '../skills/manager.js';
import type { SkillDefinition } from '../skills/types.js';

export function registerSkillsCommand(program: Command) {
  const skills = program
    .command('skills')
    .description('Define what your agent can do')
    .action(() => {
      skills.outputHelp();
    });

  skills
    .command('add <name>')
    .description('Add a skill')
    .requiredOption('--description <desc>', 'What this skill does')
    .option('--price <price>', 'Price per call (e.g. "$0.50") — omit for free')
    .option('--handler <type>', 'Handler type: placeholder, webhook, script', 'placeholder')
    .option('--webhook <url>', 'Webhook URL (for handler=webhook)')
    .option('--script <path>', 'Script path (for handler=script)')
    .option('--method <method>', 'HTTP method: GET or POST', 'POST')
    .option('--tags <tags>', 'Comma-separated tags')
    .action((name: string, opts: any) => {
      const manager = new SkillsManager();

      const skill: SkillDefinition = {
        name,
        description: opts.description,
        handler: opts.handler,
      };

      if (opts.price) skill.price = opts.price;
      if (opts.method && opts.method !== 'POST') skill.method = opts.method;
      if (opts.webhook) skill.webhook = opts.webhook;
      if (opts.script) skill.script = opts.script;
      if (opts.tags) skill.tags = opts.tags.split(',').map((t: string) => t.trim());

      // Validate handler config
      if (skill.handler === 'webhook' && !skill.webhook) {
        console.warn(`Warning: handler is 'webhook' but no --webhook URL provided.`);
        console.warn(`  The skill will return 500 when called. Set it with:`);
        console.warn(`  anet skills add ${name} --handler webhook --webhook http://your-handler.com/endpoint`);
      }
      if (skill.handler === 'script' && !skill.script) {
        console.warn(`Warning: handler is 'script' but no --script path provided.`);
      }

      manager.add(skill);
      console.log(`Added skill: ${name}`);
      if (skill.price) console.log(`  Price: ${skill.price}`);
      console.log(`  Handler: ${skill.handler}`);
      if (skill.tags?.length) console.log(`  Tags: ${skill.tags.join(', ')}`);
    });

  skills
    .command('list')
    .description('Show configured skills')
    .action(() => {
      const manager = new SkillsManager();
      const list = manager.list();

      if (list.length === 0) {
        console.log('No skills configured.\n');
        console.log('Add one:');
        console.log("  anet skills add my-skill --description 'Does something useful'");
        return;
      }

      console.log(`Skills (${list.length}):\n`);
      for (const skill of list) {
        const price = skill.price || 'free';
        const tags = skill.tags?.length ? ` [${skill.tags.join(', ')}]` : '';
        console.log(`  ${skill.name.padEnd(20)} ${price.padEnd(10)} ${skill.handler}${tags}`);
        console.log(`  ${''.padEnd(20)} ${skill.description}`);
      }
    });

  skills
    .command('remove <name>')
    .description('Remove a skill')
    .action((name: string) => {
      const manager = new SkillsManager();
      if (manager.remove(name)) {
        console.log(`Removed skill: ${name}`);
      } else {
        console.log(`Skill not found: ${name}`);
      }
    });
}
