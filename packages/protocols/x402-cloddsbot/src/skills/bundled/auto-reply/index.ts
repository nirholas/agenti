/**
 * Auto-Reply CLI Skill
 *
 * Commands:
 * /autoreply list - List all rules
 * /autoreply add <pattern> <response> - Add rule
 * /autoreply remove <id> - Remove rule
 * /autoreply enable <id> - Enable rule
 * /autoreply disable <id> - Disable rule
 */

async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || 'help';

  try {
    const { createAutoReplyService } = await import('../../../auto-reply/index');
    const service = createAutoReplyService();

    switch (cmd) {
      case 'list':
      case 'ls': {
        const rules = service.listRules();
        if (!rules.length) return 'No auto-reply rules configured. Use `/autoreply add` to create one.';
        let output = `**Auto-Reply Rules** (${rules.length})\n\n`;
        for (const rule of rules) {
          output += `[${rule.id}] ${rule.name} (priority: ${rule.priority})\n`;
          output += `  Enabled: ${rule.enabled ? 'yes' : 'no'}\n`;
          output += `  Conditions: ${rule.conditions.map(c => `${c.type}:${c.pattern || c.keywords?.join(',') || ''}`).join(', ')}\n`;
          if (rule.description) output += `  Description: ${rule.description}\n`;
          if (rule.cooldownMs) output += `  Cooldown: ${rule.cooldownMs / 1000}s\n`;
          output += '\n';
        }
        return output;
      }

      case 'add': {
        const pattern = parts[1];
        const response = parts.slice(2).join(' ');
        if (!pattern || !response) return 'Usage: /autoreply add <pattern> <response>';
        const id = `rule-${Date.now()}`;
        service.addRule({
          id,
          name: `Rule: ${pattern}`,
          enabled: true,
          priority: 0,
          conditions: [{ type: 'contains', pattern, ignoreCase: true }],
          response: { type: 'text', content: response },
        });
        service.save();
        return `Auto-reply rule added: id=${id}, pattern="${pattern}", response="${response}"`;
      }

      case 'add-regex': {
        const regex = parts[1];
        const response = parts.slice(2).join(' ');
        if (!regex || !response) return 'Usage: /autoreply add-regex <regex-pattern> <response>';
        const id = `rule-${Date.now()}`;
        service.addRule({
          id,
          name: `Regex: ${regex}`,
          enabled: true,
          priority: 0,
          conditions: [{ type: 'regex', pattern: regex, ignoreCase: true }],
          response: { type: 'text', content: response },
        });
        service.save();
        return `Auto-reply regex rule added: id=${id}, pattern=/${regex}/i`;
      }

      case 'add-keywords': {
        const keywords = parts[1]?.split(',');
        const response = parts.slice(2).join(' ');
        if (!keywords?.length || !response) return 'Usage: /autoreply add-keywords <kw1,kw2,...> <response>';
        const id = `rule-${Date.now()}`;
        service.addRule({
          id,
          name: `Keywords: ${keywords.join(',')}`,
          enabled: true,
          priority: 0,
          conditions: [{ type: 'keywords', keywords, ignoreCase: true, minKeywords: 1 }],
          response: { type: 'text', content: response },
        });
        service.save();
        return `Auto-reply keyword rule added: id=${id}, keywords=[${keywords.join(', ')}]`;
      }

      case 'remove':
      case 'delete': {
        if (!parts[1]) return 'Usage: /autoreply remove <id>';
        const removed = service.removeRule(parts[1]);
        if (removed) {
          service.save();
          return `Auto-reply rule \`${parts[1]}\` removed.`;
        }
        return `Rule \`${parts[1]}\` not found.`;
      }

      case 'enable': {
        if (!parts[1]) return 'Usage: /autoreply enable <id>';
        const enabled = service.enableRule(parts[1]);
        if (enabled) {
          service.save();
          return `Auto-reply rule \`${parts[1]}\` enabled.`;
        }
        return `Rule \`${parts[1]}\` not found.`;
      }

      case 'disable': {
        if (!parts[1]) return 'Usage: /autoreply disable <id>';
        const disabled = service.disableRule(parts[1]);
        if (disabled) {
          service.save();
          return `Auto-reply rule \`${parts[1]}\` disabled.`;
        }
        return `Rule \`${parts[1]}\` not found.`;
      }

      case 'get':
      case 'info': {
        if (!parts[1]) return 'Usage: /autoreply get <id>';
        const rule = service.getRule(parts[1]);
        if (!rule) return `Rule \`${parts[1]}\` not found.`;
        let output = `**Rule: ${rule.name}** (${rule.id})\n\n`;
        output += `Enabled: ${rule.enabled ? 'yes' : 'no'}\n`;
        output += `Priority: ${rule.priority}\n`;
        output += `Conditions:\n`;
        for (const c of rule.conditions) {
          output += `  - ${c.type}: ${c.pattern || c.keywords?.join(', ') || '(all)'}\n`;
        }
        output += `Response: ${rule.response.content}\n`;
        if (rule.cooldownMs) output += `Cooldown: ${rule.cooldownMs / 1000}s${rule.perUserCooldown ? ' (per-user)' : ''}\n`;
        if (rule.timeWindow) output += `Time window: ${rule.timeWindow.startHour}:00 - ${rule.timeWindow.endHour}:00\n`;
        if (rule.channels?.length) output += `Channels: ${rule.channels.join(', ')}\n`;
        return output;
      }

      case 'active': {
        const rules = service.listRules().filter(r => r.enabled);
        if (!rules.length) return 'No active auto-reply rules.';
        let output = `**Active Auto-Reply Rules** (${rules.length})\n\n`;
        for (const rule of rules) {
          output += `[${rule.id}] ${rule.name} (priority: ${rule.priority})\n`;
          output += `  Conditions: ${rule.conditions.map(c => `${c.type}:${c.pattern || c.keywords?.join(',') || ''}`).join(', ')}\n`;
          if (rule.cooldownMs) output += `  Cooldown: ${rule.cooldownMs / 1000}s\n`;
          if (rule.timeWindow) output += `  Schedule: ${rule.timeWindow.startHour}:00 - ${rule.timeWindow.endHour}:00\n`;
          if (rule.channels?.length) output += `  Channels: ${rule.channels.join(', ')}\n`;
          output += '\n';
        }
        return output;
      }

      case 'stats': {
        const rules = service.listRules();
        const active = rules.filter(r => r.enabled).length;
        const disabled = rules.filter(r => !r.enabled).length;
        const withCooldown = rules.filter(r => r.cooldownMs && r.cooldownMs > 0).length;
        const withSchedule = rules.filter(r => r.timeWindow).length;
        const withChannels = rules.filter(r => r.channels && r.channels.length > 0).length;

        let output = '**Auto-Reply Statistics**\n\n';
        output += `Total rules: ${rules.length}\n`;
        output += `Active: ${active}\n`;
        output += `Disabled: ${disabled}\n`;
        output += `With cooldown: ${withCooldown}\n`;
        output += `With schedule: ${withSchedule}\n`;
        output += `With channel filter: ${withChannels}\n\n`;

        if (rules.length > 0) {
          output += '**Rules by Type:**\n';
          const typeCounts: Record<string, number> = {};
          for (const rule of rules) {
            for (const c of rule.conditions) {
              typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
            }
          }
          for (const [type, count] of Object.entries(typeCounts)) {
            output += `  ${type}: ${count}\n`;
          }
        }
        return output;
      }

      case 'edit': {
        const ruleId = parts[1];
        const newResponse = parts.slice(2).join(' ');
        if (!ruleId || !newResponse) return 'Usage: /autoreply edit <id> <new-response>';
        const updated = service.updateRule(ruleId, {
          response: { type: 'text', content: newResponse },
        });
        if (updated) {
          service.save();
          return `Rule \`${ruleId}\` response updated to: "${newResponse}"`;
        }
        return `Rule \`${ruleId}\` not found.`;
      }

      case 'test':
      case 'simulate': {
        const testMsg = parts.slice(1).join(' ');
        if (!testMsg) return 'Usage: /autoreply test <message>';
        const rules = service.listRules().filter(r => r.enabled);
        const matches: string[] = [];
        for (const rule of rules) {
          // Manually check each rule condition against the test message
          let allMatched = true;
          for (const condition of rule.conditions) {
            const text = condition.ignoreCase ? testMsg.toLowerCase() : testMsg;
            const pattern = condition.pattern
              ? (condition.ignoreCase ? condition.pattern.toLowerCase() : condition.pattern)
              : '';
            let matched = false;
            switch (condition.type) {
              case 'exact': matched = text === pattern; break;
              case 'contains': matched = text.includes(pattern); break;
              case 'startsWith': matched = text.startsWith(pattern); break;
              case 'endsWith': matched = text.endsWith(pattern); break;
              case 'regex': {
                try {
                  const pat = condition.pattern || '';
                  if (pat.length > 200) { matched = false; break; }
                  const flags = condition.ignoreCase ? 'i' : '';
                  matched = new RegExp(pat, flags).test(testMsg.slice(0, 10000));
                } catch { matched = false; }
                break;
              }
              case 'keywords': {
                const kws = condition.keywords || [];
                const min = condition.minKeywords || 1;
                const found = kws.filter(kw => text.includes(condition.ignoreCase ? kw.toLowerCase() : kw));
                matched = found.length >= min;
                break;
              }
            }
            if (!matched) { allMatched = false; break; }
          }
          if (allMatched) {
            matches.push(`  [${rule.id}] ${rule.name} -> "${rule.response.content}"`);
          }
        }
        if (matches.length === 0) return `No rules match message: "${testMsg}"`;
        return `**Rules matching** "${testMsg}":\n\n${matches.join('\n')}`;
      }

      case 'cooldown': {
        const ruleId = parts[1];
        const seconds = parseInt(parts[2], 10);
        if (!ruleId || isNaN(seconds)) return 'Usage: /autoreply cooldown <id> <seconds>';
        const updated = service.updateRule(ruleId, { cooldownMs: seconds * 1000 });
        if (updated) {
          service.save();
          return `Rule \`${ruleId}\` cooldown set to ${seconds}s.`;
        }
        return `Rule \`${ruleId}\` not found.`;
      }

      case 'schedule': {
        const ruleId = parts[1];
        const timeRange = parts[2];
        if (!ruleId || !timeRange) return 'Usage: /autoreply schedule <id> <start-end> (e.g. 9-17)';
        const match = timeRange.match(/^(\d{1,2})-(\d{1,2})$/);
        if (!match) return 'Invalid time range. Use format: 9-17 (start hour - end hour, 24h)';
        const startHour = parseInt(match[1], 10);
        const endHour = parseInt(match[2], 10);
        if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
          return 'Hours must be 0-23.';
        }
        const updated = service.updateRule(ruleId, {
          timeWindow: { startHour, endHour },
        });
        if (updated) {
          service.save();
          return `Rule \`${ruleId}\` schedule set to ${startHour}:00 - ${endHour}:00.`;
        }
        return `Rule \`${ruleId}\` not found.`;
      }

      case 'priority': {
        const ruleId = parts[1];
        const priority = parseInt(parts[2], 10);
        if (!ruleId || isNaN(priority)) return 'Usage: /autoreply priority <id> <number>';
        const updated = service.updateRule(ruleId, { priority });
        if (updated) {
          service.save();
          return `Rule \`${ruleId}\` priority set to ${priority}.`;
        }
        return `Rule \`${ruleId}\` not found.`;
      }

      case 'channel': {
        const ruleId = parts[1];
        const channel = parts[2];
        if (!ruleId || !channel) return 'Usage: /autoreply channel <id> <channel>';
        const rule = service.getRule(ruleId);
        if (!rule) return `Rule \`${ruleId}\` not found.`;
        const channels = rule.channels || [];
        if (!channels.includes(channel)) channels.push(channel);
        const updated = service.updateRule(ruleId, { channels });
        if (updated) {
          service.save();
          return `Rule \`${ruleId}\` restricted to channels: ${channels.join(', ')}`;
        }
        return `Rule \`${ruleId}\` not found.`;
      }

      case 'clear-cooldowns': {
        service.clearCooldowns();
        return 'All auto-reply cooldowns cleared.';
      }

      case 'reload': {
        service.load();
        const rules = service.listRules();
        return `Reloaded ${rules.length} auto-reply rules from disk.`;
      }

      default:
        return helpText();
    }
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function helpText(): string {
  return `**Auto-Reply Commands**

  /autoreply list                              - List all rules
  /autoreply active                            - Show active rules only
  /autoreply stats                             - Rule statistics
  /autoreply add <pattern> <response>          - Add contains-match rule
  /autoreply add-regex <regex> <response>      - Add regex rule
  /autoreply add-keywords <kw1,kw2> <response> - Add keyword rule
  /autoreply remove <id>                       - Remove a rule
  /autoreply enable <id>                       - Enable a rule
  /autoreply disable <id>                      - Disable a rule
  /autoreply edit <id> <new-response>          - Update rule response
  /autoreply get <id>                          - Rule details
  /autoreply test <message>                    - Test which rules match
  /autoreply cooldown <id> <seconds>           - Set cooldown
  /autoreply schedule <id> <start-end>         - Set active hours (e.g. 9-17)
  /autoreply priority <id> <number>            - Set rule priority
  /autoreply channel <id> <channel>            - Restrict to channel
  /autoreply clear-cooldowns                   - Clear all cooldowns
  /autoreply reload                            - Reload rules from disk

Rules saved to ~/.clodds/auto-reply-rules.json`;
}

export default {
  name: 'auto-reply',
  description: 'Automatic response rules, patterns, and scheduled messages',
  commands: ['/autoreply', '/ar'],
  handle: execute,
};
