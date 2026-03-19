import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMarketIndexService } from '../../src/market-index';
import type { MarketIndexEntry } from '../../src/types';

function makeEntry(overrides: Partial<MarketIndexEntry>): MarketIndexEntry {
  return {
    platform: 'polymarket',
    marketId: 'm1',
    question: 'Will X happen?',
    resolved: false,
    updatedAt: new Date(),
    ...overrides,
  };
}

function createService(entries: MarketIndexEntry[], weights?: Record<string, number>) {
  const embeddingsStore = new Map<string, { contentHash: string; vector: number[] }>();
  const db = {
    listMarketIndex: ({ platform, limit }: { platform?: string; limit?: number }) => {
      const filtered = platform ? entries.filter((e) => e.platform === platform) : entries;
      return filtered.slice(0, limit ?? filtered.length);
    },
    getMarketIndexEmbedding: (platform: string, marketId: string) => {
      return embeddingsStore.get(`${platform}:${marketId}`) ?? null;
    },
    upsertMarketIndexEmbedding: (
      platform: string,
      marketId: string,
      contentHash: string,
      vector: number[]
    ) => {
      embeddingsStore.set(`${platform}:${marketId}`, { contentHash, vector });
    },
  };

  const embeddings = {
    embed: async () => [1, 0],
    embedBatch: async (texts: string[]) => texts.map(() => [1, 0]),
    cosineSimilarity: () => 0.5,
  };

  return createMarketIndexService(db as any, embeddings as any, { platformWeights: weights });
}

test('market index search boosts text matches', async () => {
  const entries = [
    makeEntry({ marketId: 'match', platform: 'polymarket', question: 'Fed rate cut in 2026?' }),
    makeEntry({ marketId: 'other', platform: 'kalshi', question: 'Will BTC hit 100k?' }),
  ];

  const service = createService(entries);
  const results = await service.search({ query: 'rate cut', limit: 2 });

  assert.equal(results[0].item.marketId, 'match');
});

test('market index search applies platform weights', async () => {
  const entries = [
    makeEntry({ marketId: 'poly', platform: 'polymarket', question: 'Question A' }),
    makeEntry({ marketId: 'kal', platform: 'kalshi', question: 'Question B' }),
  ];

  const service = createService(entries, { polymarket: 2, kalshi: 0.5 });
  const results = await service.search({ query: 'gamma', limit: 2 });

  assert.equal(results[0].item.marketId, 'poly');
});

test('market index search honors minScore', async () => {
  const entries = [
    makeEntry({ marketId: 'poly', platform: 'polymarket', question: 'Question A' }),
    makeEntry({ marketId: 'kal', platform: 'kalshi', question: 'Question B' }),
  ];

  const service = createService(entries, { polymarket: 2, kalshi: 0.5 });
  const results = await service.search({ query: 'gamma', limit: 2, minScore: 0.8 });

  assert.equal(results.length, 1);
  assert.equal(results[0].item.marketId, 'poly');
});
