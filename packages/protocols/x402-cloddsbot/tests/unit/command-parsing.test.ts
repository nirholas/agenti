import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultCommands } from '../../src/commands/registry';
import type { User } from '../../src/types';

function makeBaseCtx() {
  const updates: Array<Partial<User['settings']>> = [];
  const db = {
    getUser: () => ({
      id: 'u1',
      platform: 'telegram',
      platformUserId: '123',
      settings: {
        alertsEnabled: true,
        digestEnabled: false,
        defaultPlatforms: [],
        notifyOnEdge: false,
        edgeThreshold: 0.1,
      },
      createdAt: new Date(),
      lastActiveAt: new Date(),
    }),
    updateUserSettings: (_userId: string, patch: Partial<User['settings']>) => {
      updates.push(patch);
      return true;
    },
  };

  const session = {
    id: 's1',
    key: 's1',
    userId: 'u1',
    channel: 'telegram',
    chatId: 'c1',
    chatType: 'dm' as const,
    context: { messageCount: 0, lastMarkets: [], preferences: {}, conversationHistory: [] },
    history: [],
    lastActivity: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const message = {
    id: 'm1',
    platform: 'telegram',
    userId: '123',
    chatId: 'c1',
    chatType: 'dm' as const,
    text: '',
    timestamp: new Date(),
  };

  return { db, session, message, updates };
}

test('risk command parses settings and updates user', async () => {
  const commands = createDefaultCommands();
  const risk = commands.find((c) => c.name === 'risk');
  assert.ok(risk);

  const ctx = makeBaseCtx();
  const result = await risk!.handler('set maxOrderSize=200 stopLossPct=10%', ctx as any);
  assert.equal(result, 'Risk settings updated.');
  assert.equal(ctx.updates.length, 1);
  assert.deepEqual(ctx.updates[0], { maxOrderSize: 200, stopLossPct: 10 });
});

test('risk command rejects invalid input', async () => {
  const commands = createDefaultCommands();
  const risk = commands.find((c) => c.name === 'risk');
  assert.ok(risk);

  const ctx = makeBaseCtx();
  const result = await risk!.handler('set maxOrderSize=abc', ctx as any);
  assert.ok(result?.startsWith('Invalid number for'));
});

test('digest command parses time and enables', async () => {
  const commands = createDefaultCommands();
  const digest = commands.find((c) => c.name === 'digest');
  assert.ok(digest);

  const ctx = makeBaseCtx();
  const result = await digest!.handler('09:05', ctx as any);
  assert.equal(result, 'Digest settings updated.');
  assert.equal(ctx.updates.length, 1);
  assert.deepEqual(ctx.updates[0], { digestTime: '09:05', digestEnabled: true });
});

test('compare command parses platforms and limit', async () => {
  const commands = createDefaultCommands();
  const compare = commands.find((c) => c.name === 'compare');
  assert.ok(compare);

  const ctx = makeBaseCtx();
  const feeds = {
    searchMarkets: async () => ([
      {
        platform: 'polymarket',
        question: 'Q1',
        volume24h: 100,
        outcomes: [{ name: 'YES', price: 0.4, volume24h: 100 }],
      },
      {
        platform: 'kalshi',
        question: 'Q2',
        volume24h: 200,
        outcomes: [{ name: 'YES', price: 0.6, volume24h: 200 }],
      },
    ]),
  };

  const result = await compare!.handler('platforms=kalshi limit=1 rate cut', {
    ...ctx,
    feeds,
  } as any);

  assert.ok(result?.includes('Market Comparison: rate cut'));
  assert.ok(result?.includes('kalshi'));
  assert.ok(!result?.includes('polymarket'));
});

test('markets command errors on empty args', async () => {
  const commands = createDefaultCommands();
  const markets = commands.find((c) => c.name === 'markets');
  assert.ok(markets);

  const ctx = makeBaseCtx();
  const result = await markets!.handler('', ctx as any);
  assert.ok(result?.includes('Usage: /markets'));
});

test('markets command treats single token as query', async () => {
  const commands = createDefaultCommands();
  const markets = commands.find((c) => c.name === 'markets');
  assert.ok(markets);

  const ctx = makeBaseCtx();
  let captured: { query?: string; platform?: string } | null = null;
  const feeds = {
    searchMarkets: async (query: string, platform?: string) => {
      captured = { query, platform };
      return [];
    },
  };

  const result = await markets!.handler('polymarket', { ...ctx, feeds } as any);
  assert.ok(result?.includes('No markets found for'));
  assert.equal(captured?.query, 'polymarket');
  assert.equal(captured?.platform, undefined);
});

test('arbitrage command parses args and uses minEdge', async () => {
  const commands = createDefaultCommands();
  const arbitrage = commands.find((c) => c.name === 'arbitrage');
  assert.ok(arbitrage);

  const ctx = makeBaseCtx();
  const feeds = {
    searchMarkets: async () => ([]),
  };

  const result = await arbitrage!.handler(
    'minEdge=2 limit=5 mode=internal platforms=kalshi,polymarket fed',
    { ...ctx, feeds } as any
  );

  assert.equal(result, 'No arbitrage opportunities found above 2% edge.');
});

test('pnl command parses args and passes since/limit to db', async () => {
  const commands = createDefaultCommands();
  const pnl = commands.find((c) => c.name === 'pnl');
  assert.ok(pnl);

  const ctx = makeBaseCtx();
  let captured: { sinceMs?: number; limit?: number; order?: string } | null = null;
  const db = {
    ...ctx.db,
    getPortfolioSnapshots: (_userId: string, options?: { sinceMs?: number; limit?: number; order?: 'asc' | 'desc' }) => {
      captured = options || null;
      return [
        {
          userId: 'u1',
          totalValue: 100,
          totalPnl: 5,
          totalPnlPct: 0.05,
          totalCostBasis: 95,
          positionsCount: 1,
          byPlatform: {},
          createdAt: new Date(Date.now() - 1000 * 60 * 60),
        },
        {
          userId: 'u1',
          totalValue: 110,
          totalPnl: 10,
          totalPnlPct: 0.1,
          totalCostBasis: 100,
          positionsCount: 1,
          byPlatform: {},
          createdAt: new Date(),
        },
      ];
    },
  };

  const result = await pnl!.handler('24h limit=2', { ...ctx, db } as any);
  assert.ok(result?.startsWith('P&L history'));
  assert.ok(captured);
  assert.equal(captured?.limit, 2);
  assert.equal(captured?.order, 'asc');
  assert.equal(typeof captured?.sinceMs, 'number');
});
