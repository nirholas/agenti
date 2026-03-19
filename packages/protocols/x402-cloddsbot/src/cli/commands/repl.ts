/**
 * Interactive REPL for local agent testing
 */

import readline from 'node:readline';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createDatabase } from '../../db';
import { createMigrationRunner } from '../../db/migrations';
import { createFeedManager } from '../../feeds';
import { createSessionManager } from '../../sessions';
import { createAgentManager } from '../../agents';
import { createMemoryService } from '../../memory';
import { createEmbeddingsService } from '../../embeddings';
import { createOpportunityFinder } from '../../opportunity';
import { createCommandRegistry, createDefaultCommands } from '../../commands/registry';
import { loadConfig } from '../../utils/config';
import { logger } from '../../utils/logger';
import type { IncomingMessage, OutgoingMessage } from '../../types';
import { normalizeIncomingMessage } from '../../messages/unified';

export interface ReplOptions {
  config?: string;
  userId?: string;
  chatId?: string;
  platform?: string;
  feeds?: boolean;
}

function ask(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const onClose = () => resolve('/exit');
    rl.once('close', onClose);

    try {
      rl.question(prompt, (answer) => {
        rl.removeListener('close', onClose);
        resolve(answer);
      });
    } catch (error) {
      rl.removeListener('close', onClose);
      const err = error as NodeJS.ErrnoException;
      if (err?.code === 'ERR_USE_AFTER_CLOSE') {
        resolve('/exit');
        return;
      }
      throw error;
    }
  });
}

export async function startRepl(options: ReplOptions = {}): Promise<void> {
  const config = await loadConfig(options.config);

  const db = createDatabase();
  // Ensure lazy DB initialization has completed before using sync-style managers.
  await db.run('SELECT 1');
  createMigrationRunner(db).migrate();
  const feeds = await createFeedManager(config.feeds);
  const sessions = createSessionManager(db, config.session);
  const memory = createMemoryService(db);
  const embeddings = createEmbeddingsService(db);
  const opportunityFinder = config.opportunityFinder?.enabled !== false
    ? createOpportunityFinder(db, feeds, embeddings, {
        minEdge: config.opportunityFinder?.minEdge ?? 0.5,
        minLiquidity: config.opportunityFinder?.minLiquidity ?? 100,
        semanticMatching: config.opportunityFinder?.semanticMatching ?? true,
      })
    : null;

  const commands = createCommandRegistry();
  commands.registerMany(createDefaultCommands());

  const platform = options.platform || 'cli';
  const userId = options.userId || 'cli-user';
  const chatId = options.chatId || 'cli-chat';
  const feedsEnabled = options.feeds !== false;

  let feedsStarted = false;
  if (feedsEnabled) {
    try {
      await feeds.start();
      feedsStarted = true;
    } catch (error) {
      logger.warn({ error }, 'Failed to start feeds for REPL; continuing without feeds');
    }
  }

  const sendMessage = async (message: OutgoingMessage): Promise<string | null> => {
    const prefix = message.platform === platform ? 'bot' : `bot:${message.platform}`;
    // Keep this tight for CLI use.
    console.log(`\n${prefix}> ${message.text}\n`);
    return null;
  };

  const agents = await createAgentManager(
    config,
    feeds,
    db,
    sessions,
    sendMessage,
    undefined,
    undefined,
    undefined,
    undefined,
    memory
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  process.stdin.on('end', () => {
    rl.close();
  });
  let closed = false;
  rl.on('close', () => {
    closed = true;
  });

  console.log('\nClodds REPL');
  console.log('Type messages to chat locally.');
  console.log('Commands: /help, /markets <query>, /portfolio, /status, /new');
  console.log('Exit: /exit, /quit, or Ctrl+C\n');

  const shutdown = async (): Promise<void> => {
    rl.close();
    try {
      if (feedsStarted) {
        await feeds.stop();
      }
      sessions.dispose();
      await db.close();
    } catch (error) {
      logger.warn({ error }, 'REPL shutdown encountered errors');
    }
  };

  process.on('SIGINT', async () => {
    try {
      await shutdown();
    } catch (error) {
      logger.error({ error }, 'SIGINT handler failed');
    } finally {
      process.exit(0);
    }
  });

  const processInput = async (input: string): Promise<void> => {
    if (!input) return;

    if (input === '/exit' || input === '/quit') {
      await shutdown();
      process.exit(0);
    }

    const incoming: IncomingMessage = normalizeIncomingMessage({
      id: randomUUID(),
      platform,
      userId,
      chatId,
      chatType: 'dm',
      text: input,
      timestamp: new Date(),
    });

    const session = await sessions.getOrCreateSession(incoming);

    const commandResponse = await commands.handle(incoming, {
      session,
      sessions,
      feeds,
      db,
      memory,
      opportunityFinder: opportunityFinder ?? undefined,
      send: sendMessage,
    });

    if (commandResponse) {
      await sendMessage({
        platform,
        chatId,
        text: commandResponse,
        parseMode: 'Markdown',
      });
      return;
    }

    const responseText = await agents.handleMessage(incoming, session);
    if (responseText !== null) {
      await sendMessage({
        platform,
        chatId,
        text: responseText,
        parseMode: 'Markdown',
      });
    }
  };

  // Non-interactive mode: consume piped stdin and exit cleanly.
  if (!process.stdin.isTTY) {
    const piped = readFileSync(0, 'utf8');
    for (const rawLine of piped.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      await processInput(line);
    }
    await shutdown();
    return;
  }

  while (true) {
    if (closed) break;
    const input = (await ask(rl, '> ')).trim();
    if (closed) break;
    await processInput(input);
  }
}
