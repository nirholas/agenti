/**
 * Memory CLI Skill
 *
 * Commands:
 * /memory - Show recent memories
 * /memory add <type> <key> <value> - Add a memory
 * /memory search <query> - Search memories
 * /memory forget <key> - Delete memory
 * /memory types - Show memory types
 * /memory clear <type> - Clear all memories of a type
 * /memory context - Build context string
 */

import { logger } from '../../../utils/logger';

const DEFAULT_USER = 'cli';
const DEFAULT_CHANNEL = 'terminal';

function helpText(): string {
  return `**Memory Commands**

  /memory                            - Show recent memories
  /memory add <type> <key> <value>   - Store a memory
  /memory recall <key>               - Recall a specific memory by key
  /memory search <query>             - Search memories by keyword
  /memory forget <key>               - Delete a memory
  /memory types                      - Show memory types
  /memory clear <type>               - Clear all memories of a type
  /memory context                    - Build full context string
  /memory list [type]                - List memories (optionally by type)

**Memory types:** fact, preference, note, summary, context, profile

**Examples:**
  /memory add fact trading-style "Prefers high-frequency scalping"
  /memory add preference risk-level "Conservative, max 2% per trade"
  /memory search trading
  /memory recall risk-level
  /memory forget old-note`;
}

async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || 'list';

  try {
    const { createDatabase } = await import('../../../db/index');
    const { createMemoryService } = await import('../../../memory/index');

    const db = createDatabase();
    const memory = createMemoryService(db);

    switch (cmd) {
      case 'list':
      case 'recent': {
        const typeFilter = parts[1];
        const entries = typeFilter
          ? memory.recallByType(DEFAULT_USER, DEFAULT_CHANNEL, typeFilter as any)
          : memory.recallAll(DEFAULT_USER, DEFAULT_CHANNEL);

        if (entries.length === 0) {
          return typeFilter
            ? `**Memories (${typeFilter})**\n\nNo memories of type "${typeFilter}". Use \`/memory add ${typeFilter} <key> <value>\` to store one.`
            : '**Recent Memories**\n\nNo memories stored yet. Use `/memory add <type> <key> <value>` to add one.';
        }

        const label = typeFilter ? `Memories (${typeFilter})` : 'Recent Memories';
        let output = `**${label}** (${entries.length})\n\n`;
        for (const entry of entries.slice(0, 20)) {
          const age = timeSince(entry.updatedAt);
          output += `- [${entry.type}] **${entry.key}**: ${entry.value} (${age})\n`;
        }
        if (entries.length > 20) {
          output += `\n... and ${entries.length - 20} more`;
        }
        return output;
      }

      case 'add':
      case 'store':
      case 'remember': {
        const type = parts[1];
        const key = parts[2];
        const value = parts.slice(3).join(' ');

        if (!type || !key || !value) {
          return 'Usage: /memory add <type> <key> <value>\n\nTypes: fact, preference, note, summary, context, profile\n\nExample: /memory add fact name "John"';
        }

        const validTypes = ['fact', 'preference', 'note', 'summary', 'context', 'profile'];
        if (!validTypes.includes(type)) {
          return `Invalid memory type "${type}".\n\nValid types: ${validTypes.join(', ')}`;
        }

        memory.remember(DEFAULT_USER, DEFAULT_CHANNEL, type as any, key, value);
        return `**Memory Stored**\n\n- Type: ${type}\n- Key: ${key}\n- Value: ${value}`;
      }

      case 'recall':
      case 'get': {
        const key = parts[1];
        if (!key) return 'Usage: /memory recall <key>';

        const entry = memory.recall(DEFAULT_USER, DEFAULT_CHANNEL, key);
        if (!entry) {
          return `No memory found with key "${key}".`;
        }

        return `**Memory: ${entry.key}**\n\n- Type: ${entry.type}\n- Value: ${entry.value}\n- Created: ${entry.createdAt.toISOString()}\n- Updated: ${entry.updatedAt.toISOString()}${entry.expiresAt ? `\n- Expires: ${entry.expiresAt.toISOString()}` : ''}`;
      }

      case 'search': {
        const query = parts.slice(1).join(' ');
        if (!query) return 'Usage: /memory search <query>';

        const results = memory.search(DEFAULT_USER, DEFAULT_CHANNEL, query);
        if (results.length === 0) {
          return `**Search: "${query}"**\n\nNo matching memories found.`;
        }

        let output = `**Search: "${query}"** (${results.length} results)\n\n`;
        for (const entry of results.slice(0, 15)) {
          output += `- [${entry.type}] **${entry.key}**: ${entry.value}\n`;
        }
        return output;
      }

      case 'forget':
      case 'delete':
      case 'remove': {
        const key = parts[1];
        if (!key) return 'Usage: /memory forget <key>';

        const deleted = memory.forget(DEFAULT_USER, DEFAULT_CHANNEL, key);
        if (!deleted) {
          return `No memory found with key "${key}".`;
        }
        return `Memory "${key}" deleted.`;
      }

      case 'clear': {
        const type = parts[1];
        if (!type) return 'Usage: /memory clear <type>\n\nTypes: fact, preference, note, summary, context, profile';

        const validTypes = ['fact', 'preference', 'note', 'summary', 'context', 'profile'];
        if (!validTypes.includes(type)) {
          return `Invalid memory type "${type}".\n\nValid types: ${validTypes.join(', ')}`;
        }

        const count = memory.forgetByType(DEFAULT_USER, DEFAULT_CHANNEL, type as any);
        return `Cleared ${count} memories of type "${type}".`;
      }

      case 'types': {
        return `**Memory Types**\n\n- **fact** - Factual information about the user\n- **preference** - User preferences and settings\n- **note** - Free-form notes and observations\n- **summary** - Conversation or session summaries\n- **context** - Contextual information for sessions\n- **profile** - User profile data`;
      }

      case 'context': {
        const context = memory.buildContextString(DEFAULT_USER, DEFAULT_CHANNEL);
        if (!context) {
          return '**Context**\n\nNo context available. Add some memories first.';
        }
        return `**Context String**\n\n${context}`;
      }

      case 'cleanup': {
        const cleaned = memory.cleanup();
        return `Cleaned up ${cleaned} expired memories.`;
      }

      default:
        return helpText();
    }
  } catch (error) {
    logger.debug({ error }, 'Memory skill init failed');
    return helpText();
  }
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default {
  name: 'memory',
  description: 'Persistent memory system for preferences, facts, and notes',
  commands: ['/memory', '/mem'],
  handle: execute,
};
