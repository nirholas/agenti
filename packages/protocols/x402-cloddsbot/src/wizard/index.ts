/**
 * Onboarding Wizard - Clawdbot-style interactive setup
 *
 * Features:
 * - Step-by-step configuration
 * - API key setup
 * - Channel configuration
 * - Daemon installation
 */

import * as readline from 'readline';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { logger } from '../utils/logger';

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  run: (ctx: WizardContext) => Promise<void>;
  skip?: (ctx: WizardContext) => boolean;
}

export interface WizardContext {
  config: Record<string, unknown>;
  answers: Record<string, string>;
  rl: readline.Interface;
}

/** Prompt user for input */
async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

/** Prompt for yes/no */
async function confirm(rl: readline.Interface, question: string): Promise<boolean> {
  const answer = await prompt(rl, `${question} (y/n): `);
  return answer.toLowerCase().startsWith('y');
}

/** Default wizard steps */
const DEFAULT_STEPS: WizardStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Welcome to Clodds setup',
    async run(ctx) {
      logger.info('Welcome to Clodds - Your AI Prediction Markets Assistant');
      logger.info('This wizard will help you set up Clodds.');
    },
  },
  {
    id: 'anthropic',
    title: 'Anthropic API Key',
    description: 'Configure Claude API access',
    async run(ctx) {
      logger.info('Anthropic API Key - Get your API key from: https://console.anthropic.com/');

      const key = await prompt(ctx.rl, 'Enter your Anthropic API key (sk-ant-...): ');
      if (key && key.startsWith('sk-ant-')) {
        ctx.config.ANTHROPIC_API_KEY = key;
        logger.info('API key saved');
      } else {
        logger.warn('Invalid or no key provided, skipping');
      }
    },
  },
  {
    id: 'telegram',
    title: 'Telegram Bot',
    description: 'Configure Telegram channel',
    async run(ctx) {
      logger.info('Telegram Bot Setup');

      if (!await confirm(ctx.rl, 'Do you want to set up Telegram?')) {
        return;
      }

      logger.info('Get a bot token from @BotFather on Telegram');
      const token = await prompt(ctx.rl, 'Enter your Telegram bot token: ');
      if (token) {
        ctx.config.TELEGRAM_BOT_TOKEN = token;
        logger.info('Telegram configured');
      }
    },
  },
  {
    id: 'polymarket',
    title: 'Polymarket',
    description: 'Configure Polymarket trading',
    async run(ctx) {
      logger.info('Polymarket Setup');

      if (!await confirm(ctx.rl, 'Do you want to set up Polymarket trading?')) {
        return;
      }

      const apiKey = await prompt(ctx.rl, 'Polymarket API Key: ');
      const apiSecret = await prompt(ctx.rl, 'Polymarket API Secret: ');
      const passphrase = await prompt(ctx.rl, 'Polymarket Passphrase: ');

      if (apiKey && apiSecret && passphrase) {
        ctx.config.POLY_API_KEY = apiKey;
        ctx.config.POLY_API_SECRET = apiSecret;
        ctx.config.POLY_API_PASSPHRASE = passphrase;
        logger.info('Polymarket configured');
      }
    },
  },
  {
    id: 'finish',
    title: 'Finish',
    description: 'Save configuration',
    async run(ctx) {
      logger.info('Saving configuration...');

      const configDir = join(homedir(), '.clodds');
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }

      // Write .env file
      const envPath = join(process.cwd(), '.env');
      const envContent = Object.entries(ctx.config)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      writeFileSync(envPath, envContent);

      logger.info('Configuration saved to .env');
      logger.info('Setup complete! Run `npm start` to launch Clodds.');
    },
  },
];

export interface OnboardingWizard {
  run(): Promise<void>;
  addStep(step: WizardStep, afterId?: string): void;
}

export function createOnboardingWizard(steps: WizardStep[] = DEFAULT_STEPS): OnboardingWizard {
  const allSteps = [...steps];

  return {
    async run() {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const ctx: WizardContext = {
        config: {},
        answers: {},
        rl,
      };

      try {
        for (const step of allSteps) {
          if (step.skip?.(ctx)) {
            logger.debug({ stepId: step.id }, 'Skipping step');
            continue;
          }

          await step.run(ctx);
        }
      } finally {
        rl.close();
      }
    },

    addStep(step, afterId) {
      if (afterId) {
        const idx = allSteps.findIndex((s) => s.id === afterId);
        if (idx >= 0) {
          allSteps.splice(idx + 1, 0, step);
          return;
        }
      }
      allSteps.push(step);
    },
  };
}
