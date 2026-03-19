/**
 * Commands Service - Clawdbot-style slash commands
 *
 * Native commands that work across all channels:
 * /new, /reset - Start fresh session
 * /status - Check agent status and context usage
 * /model - Show/change model
 * /help - Show help
 *
 * Also supports:
 * - Skill-based commands (from installed skills)
 * - Per-command enable/disable configuration
 * - Per-channel command overrides
 */

import { SessionManager } from '../sessions/index';
import { Session, IncomingMessage } from '../types';
import { logger } from '../utils/logger';
import { SkillRegistry, InstalledSkill } from '../skills/index';
import { executeSkillCommand, isSkillCommand } from '../skills/executor';

export interface CommandResult {
  handled: boolean;
  response?: string;
  action?: 'reset_session' | 'show_status' | 'show_help' | 'change_model' | 'skill_command';
  /** If skill command, the skill that handled it */
  skill?: string;
}

/** Command configuration */
export interface CommandConfig {
  /** Enable/disable specific commands */
  enabled?: Record<string, boolean>;
  /** Per-channel command overrides */
  channelOverrides?: Record<string, Record<string, boolean>>;
  /** Whether to register skill commands */
  enableSkillCommands?: boolean;
}

export interface CommandsService {
  /** Check if message is a command and handle it */
  handleCommand(message: IncomingMessage, session: Session): Promise<CommandResult>;

  /** Get list of available commands */
  getCommands(): CommandInfo[];

  /** Check if a command is enabled */
  isEnabled(commandName: string, channel?: string): boolean;

  /** Enable a command */
  enable(commandName: string): void;

  /** Disable a command */
  disable(commandName: string): void;

  /** Get all skill commands */
  getSkillCommands(): CommandInfo[];

  /** Register a skill's commands */
  registerSkillCommands(skill: InstalledSkill): void;

  /** Unregister a skill's commands */
  unregisterSkillCommands(skillName: string): void;
}

export interface CommandInfo {
  name: string;
  description: string;
  usage: string;
  /** Whether this is a skill command */
  isSkillCommand?: boolean;
  /** The skill that provides this command */
  skillName?: string;
}

const NATIVE_COMMANDS: CommandInfo[] = [
  { name: '/new', description: 'Start a fresh conversation', usage: '/new' },
  { name: '/reset', description: 'Reset conversation history', usage: '/reset' },
  { name: '/status', description: 'Show agent status and context usage', usage: '/status' },
  { name: '/model', description: 'Show or change model', usage: '/model [sonnet|opus|haiku]' },
  { name: '/help', description: 'Show available commands', usage: '/help' },
  { name: '/context', description: 'Show context info', usage: '/context' },
];

/** Available models with shortcuts */
const MODEL_ALIASES: Record<string, string> = {
  'opus': 'claude-opus-4-6',
  'opus4.6': 'claude-opus-4-6',
  'opus4.5': 'claude-opus-4-5-20250514',
  'sonnet': 'claude-sonnet-4-5-20250929',
  'sonnet4.5': 'claude-sonnet-4-5-20250929',
  'haiku': 'claude-haiku-4-5-20251001',
  'haiku4.5': 'claude-haiku-4-5-20251001',
  'claude-opus-4': 'claude-opus-4-6',
  'claude-sonnet-4': 'claude-sonnet-4-5-20250929',
  'claude-haiku-4': 'claude-haiku-4-5-20251001',
};

const DEFAULT_CONFIG: CommandConfig = {
  enabled: {},
  channelOverrides: {},
  enableSkillCommands: true,
};

export function createCommandsService(
  sessionManager: SessionManager,
  configInput?: CommandConfig,
  skillRegistry?: SkillRegistry
): CommandsService {
  const config: CommandConfig = { ...DEFAULT_CONFIG, ...configInput };

  // Track enabled status
  const enabledCommands = new Map<string, boolean>();

  // Initialize from config
  if (config.enabled) {
    for (const [cmd, enabled] of Object.entries(config.enabled)) {
      enabledCommands.set(cmd, enabled);
    }
  }

  // Track skill commands
  const skillCommands = new Map<string, CommandInfo[]>();

  // Load skill commands on startup
  if (config.enableSkillCommands && skillRegistry) {
    for (const skill of skillRegistry.listEnabled()) {
      registerSkillCommandsInternal(skill);
    }

    // Listen for skill install/uninstall
    skillRegistry.on('install', (skill: InstalledSkill) => {
      registerSkillCommandsInternal(skill);
    });
    skillRegistry.on('uninstall', ({ name }: { name: string }) => {
      skillCommands.delete(name);
    });
  }

  function registerSkillCommandsInternal(skill: InstalledSkill) {
    if (!skill.manifest.commands?.length) return;

    const commands: CommandInfo[] = skill.manifest.commands.map(cmd => ({
      name: cmd.name.startsWith('/') ? cmd.name : `/${cmd.name}`,
      description: cmd.description,
      usage: cmd.name.startsWith('/') ? cmd.name : `/${cmd.name}`,
      isSkillCommand: true,
      skillName: skill.manifest.name,
    }));

    skillCommands.set(skill.manifest.name, commands);
    logger.info({ skillName: skill.manifest.name, commands: commands.length }, 'Registered skill commands');
  }

  function isCommandEnabled(commandName: string, channel?: string): boolean {
    // Check channel override first
    if (channel && config.channelOverrides?.[channel]?.[commandName] !== undefined) {
      return config.channelOverrides[channel][commandName];
    }

    // Check global setting
    const globalSetting = enabledCommands.get(commandName);
    if (globalSetting !== undefined) {
      return globalSetting;
    }

    // Default to enabled
    return true;
  }

  return {
    async handleCommand(message, session): Promise<CommandResult> {
      const text = message.text.trim();

      // Check if it starts with /
      if (!text.startsWith('/')) {
        return { handled: false };
      }

      const [cmd, ...args] = text.split(/\s+/);
      const command = cmd.toLowerCase();

      // Check if command is enabled
      if (!isCommandEnabled(command, message.platform)) {
        logger.debug({ command, channel: message.platform }, 'Command is disabled');
        return { handled: false }; // Let agent handle as regular message
      }

      switch (command) {
        case '/new':
        case '/reset': {
          // Clear conversation history
          sessionManager.clearHistory(session);

          logger.info({ sessionKey: session.key }, 'Session reset via command');

          return {
            handled: true,
            action: 'reset_session',
            response: `🔄 *Session Reset*\n\nConversation history cleared. Starting fresh!\n\nHow can I help you with prediction markets?`,
          };
        }

        case '/status': {
          const history = sessionManager.getHistory(session);
          const messageCount = history.length;

          // Estimate tokens (rough: ~4 chars per token)
          const totalChars = history.reduce((sum, m) => sum + m.content.length, 0);
          const estimatedTokens = Math.round(totalChars / 4);

          const uptime = Math.round((Date.now() - session.createdAt.getTime()) / 1000 / 60);

          return {
            handled: true,
            action: 'show_status',
            response:
              `📊 *Session Status*\n\n` +
              `*Session ID:* \`${session.id.slice(0, 8)}...\`\n` +
              `*Channel:* ${session.channel}\n` +
              `*Messages:* ${messageCount}\n` +
              `*Est. Tokens:* ~${estimatedTokens.toLocaleString()}\n` +
              `*Uptime:* ${uptime} minutes\n` +
              `*Created:* ${session.createdAt.toISOString().slice(0, 16).replace('T', ' ')}\n\n` +
              `Use \`/new\` to reset the conversation.`,
          };
        }

        case '/model': {
          const defaultModel = process.env.ANTHROPIC_MODEL || 'claude-opus-4-6';
          const currentModel = session.context.modelOverride || defaultModel;

          // If no argument, show current model
          if (args.length === 0) {
            const modelList = Object.keys(MODEL_ALIASES)
              .filter(k => !k.includes('-'))
              .map(k => `\`${k}\``)
              .join(', ');

            return {
              handled: true,
              action: 'change_model',
              response:
                `🤖 *Current Model*\n\n` +
                `\`${currentModel}\`\n` +
                (session.context.modelOverride ? `(session override)\n` : `(default)\n`) +
                `\n*Available:* ${modelList}\n` +
                `\n*Usage:* \`/model sonnet\` or \`/model opus\``,
            };
          }

          // Try to switch model
          const requestedModel = args[0].toLowerCase();
          const resolvedModel = MODEL_ALIASES[requestedModel] || requestedModel;

          // Validate it looks like a Claude model
          if (!resolvedModel.startsWith('claude-')) {
            return {
              handled: true,
              response:
                `❌ Unknown model: \`${requestedModel}\`\n\n` +
                `*Available:* sonnet, opus, haiku`,
            };
          }

          // Set model override in session
          session.context.modelOverride = resolvedModel;
          sessionManager.updateSession(session);

          logger.info({ sessionKey: session.key, model: resolvedModel }, 'Model changed via command');

          return {
            handled: true,
            action: 'change_model',
            response:
              `✅ *Model Changed*\n\n` +
              `Now using: \`${resolvedModel}\`\n\n` +
              `Use \`/model\` to see current model or switch again.`,
          };
        }

        case '/context': {
          const history = sessionManager.getHistory(session);

          // Show last few messages
          const recent = history.slice(-5);
          const contextPreview = recent
            .map((m, i) => `${i + 1}. [${m.role}] ${m.content.slice(0, 50)}${m.content.length > 50 ? '...' : ''}`)
            .join('\n');

          return {
            handled: true,
            response:
              `📝 *Context Info*\n\n` +
              `*Total messages:* ${history.length}\n` +
              `*Max kept:* 20\n\n` +
              `*Recent messages:*\n${contextPreview || '(empty)'}`,
          };
        }

        case '/help': {
          const commandList = NATIVE_COMMANDS.map(c => `\`${c.name}\` - ${c.description}`).join('\n');

          return {
            handled: true,
            action: 'show_help',
            response:
              `🎲 *Clodds Commands*\n\n` +
              `*Native Commands:*\n${commandList}\n\n` +
              `*Tips:*\n` +
              `• Just chat naturally for most things\n` +
              `• Ask about any prediction market\n` +
              `• Set alerts, track portfolios, find edge\n\n` +
              `*Platforms:* Polymarket, Kalshi, Manifold, Metaculus, Drift`,
          };
        }

        default:
          // Try to execute as a skill command using the executor
          if (config.enableSkillCommands && isSkillCommand(command)) {
            if (!isCommandEnabled(command, message.platform)) {
              logger.debug({ command, channel: message.platform }, 'Skill command is disabled');
              return { handled: false };
            }

            // Execute the skill command
            const result = await executeSkillCommand(text);
            if (result.handled) {
              logger.info({ command, skill: result.skill }, 'Skill command executed');
              return {
                handled: true,
                action: 'skill_command',
                skill: result.skill,
                response: result.error
                  ? `❌ Error: ${result.error}`
                  : result.response || '(no response)',
              };
            }
          }

          // Check registered skill commands from registry (legacy path)
          if (config.enableSkillCommands) {
            for (const [skillName, commands] of skillCommands.entries()) {
              for (const cmd of commands) {
                if (cmd.name === command && isCommandEnabled(command, message.platform)) {
                  logger.info({ command, skillName }, 'Skill command invoked (registry)');
                  return {
                    handled: true,
                    action: 'skill_command',
                    skill: skillName,
                    response: `🔧 Skill command \`${command}\` from *${skillName}* registered but no handler.`,
                  };
                }
              }
            }
          }

          // Unknown command - don't handle, let agent process it
          return { handled: false };
      }
    },

    getCommands() {
      const allCommands = [...NATIVE_COMMANDS];

      // Add skill commands
      for (const commands of skillCommands.values()) {
        allCommands.push(...commands);
      }

      return allCommands;
    },

    isEnabled(commandName, channel?) {
      return isCommandEnabled(commandName, channel);
    },

    enable(commandName) {
      enabledCommands.set(commandName, true);
      logger.info({ commandName }, 'Command enabled');
    },

    disable(commandName) {
      enabledCommands.set(commandName, false);
      logger.info({ commandName }, 'Command disabled');
    },

    getSkillCommands() {
      const commands: CommandInfo[] = [];
      for (const cmds of skillCommands.values()) {
        commands.push(...cmds);
      }
      return commands;
    },

    registerSkillCommands(skill) {
      registerSkillCommandsInternal(skill);
    },

    unregisterSkillCommands(skillName) {
      skillCommands.delete(skillName);
      logger.info({ skillName }, 'Unregistered skill commands');
    },
  };
}
