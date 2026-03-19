import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMarketIndexService } from '../../src/market-index';

test('market index sync hits real Manifold API', { timeout: 20000 }, async () => {
  const upserted: unknown[] = [];
  const db = {
    getMarketIndexHash: () => null,
    upsertMarketIndex: (entry: unknown) => {
      upserted.push(entry);
    },
    pruneMarketIndex: () => 0,
  };
  const embeddings = {
    embed: async () => [0],
    embedBatch: async (items: string[]) => items.map(() => [0]),
    cosineSimilarity: () => 0,
  };

  const service = createMarketIndexService(db as any, embeddings as any);
  const result = await service.sync({
    platforms: ['manifold'],
    limitPerPlatform: 1,
    status: 'open',
    excludeSports: true,
    prune: false,
  });

  assert.equal(typeof result.indexed, 'number');
  assert.ok(typeof result.byPlatform.manifold === 'number');
  assert.ok(result.byPlatform.manifold >= 0);
  if (result.byPlatform.manifold > 0) {
    assert.ok(upserted.length > 0);
  }
});
