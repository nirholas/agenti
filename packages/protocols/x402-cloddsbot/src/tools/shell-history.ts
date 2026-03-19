/**
 * Shell History Tool - read/search shell history safely
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { logger } from '../utils/logger';

export interface ShellHistoryEntry {
  line: number;
  command: string;
}

export interface ShellHistoryOptions {
  shell?: 'zsh' | 'bash' | 'fish' | 'auto';
  limit?: number;
  query?: string | RegExp;
}

export interface ShellHistoryTool {
  list(options?: ShellHistoryOptions): ShellHistoryEntry[];
  search(query: string | RegExp, options?: Omit<ShellHistoryOptions, 'query'>): ShellHistoryEntry[];
}

const DEFAULT_LIMIT = 200;
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

function detectShell(): 'zsh' | 'bash' | 'fish' {
  const envShell = process.env.SHELL || '';
  if (envShell.includes('zsh')) return 'zsh';
  if (envShell.includes('bash')) return 'bash';
  if (envShell.includes('fish')) return 'fish';
  return 'zsh';
}

function historyPath(shell: 'zsh' | 'bash' | 'fish'): string {
  const home = homedir();
  switch (shell) {
    case 'bash':
      return join(home, '.bash_history');
    case 'fish':
      return join(home, '.local', 'share', 'fish', 'fish_history');
    case 'zsh':
    default:
      return join(home, '.zsh_history');
  }
}

function normalizeLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(5000, Math.floor(limit)));
}

function parseZshHistory(content: string): string[] {
  // zsh extended history lines look like: ": 1700000000:0;command"
  const lines = content.split(/\r?\n/).filter(Boolean);
  return lines.map((line) => {
    const semi = line.indexOf(';');
    if (line.startsWith(':') && semi >= 0) {
      return line.slice(semi + 1);
    }
    return line;
  });
}

function parseFishHistory(content: string): string[] {
  // fish history is YAML-like with lines: "- cmd: ..."
  const commands: string[] = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- cmd:')) {
      commands.push(trimmed.replace(/^- cmd:\s*/, ''));
    }
  }
  return commands;
}

function parseHistory(shell: 'zsh' | 'bash' | 'fish', content: string): string[] {
  switch (shell) {
    case 'fish':
      return parseFishHistory(content);
    case 'bash':
      return content.split(/\r?\n/).filter(Boolean);
    case 'zsh':
    default:
      return parseZshHistory(content);
  }
}

export function createShellHistoryTool(): ShellHistoryTool {
  function list(options: ShellHistoryOptions = {}): ShellHistoryEntry[] {
    const shell = options.shell && options.shell !== 'auto' ? options.shell : detectShell();
    const filePath = historyPath(shell);
    const limit = normalizeLimit(options.limit);

    if (!existsSync(filePath)) {
      logger.warn({ filePath, shell }, 'Shell history file not found');
      return [];
    }

    const stat = statSync(filePath);
    if (stat.size > MAX_BYTES) {
      logger.warn({ filePath, size: stat.size }, 'Shell history too large; truncating read');
    }

    const raw = readFileSync(filePath, 'utf8');
    const commands = parseHistory(shell, raw);

    const start = Math.max(0, commands.length - limit);
    const sliced = commands.slice(start);

    const matcher = options.query;
    const results: ShellHistoryEntry[] = [];

    for (let i = 0; i < sliced.length; i++) {
      const command = sliced[i];
      if (matcher) {
        if (typeof matcher === 'string') {
          if (!command.includes(matcher)) continue;
        } else {
          matcher.lastIndex = 0;
          if (!matcher.test(command)) continue;
        }
      }
      results.push({ line: start + i + 1, command });
    }

    logger.debug({ shell, filePath, returned: results.length }, 'Shell history listed');
    return results;
  }

  return {
    list,
    search(query, options = {}) {
      return list({ ...options, query });
    },
  };
}
