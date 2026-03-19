import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createNetServer } from 'node:net';
import { createServer as createGatewayServer } from '../../src/gateway/server';

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
    server.on('error', reject);
  });
}

test('market-index search endpoint validates query and returns results', async () => {
  const port = await getFreePort();
  const gateway = createGatewayServer({ port, cors: false, auth: {} });
  gateway.setMarketIndexHandler(async (req) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    if (!query) {
      return { error: 'Missing query parameter: q', status: 400 };
    }
    return { results: [{ id: 'm1', q: query }] };
  });

  await gateway.start();
  try {
    const noQuery = await fetch(`http://127.0.0.1:${port}/market-index/search`);
    assert.equal(noQuery.status, 400);

    const ok = await fetch(`http://127.0.0.1:${port}/market-index/search?q=rate+cut`);
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.results[0].id, 'm1');
    assert.equal(body.results[0].q, 'rate cut');
  } finally {
    await gateway.stop();
  }
});

test('market-index stats endpoint returns stats', async () => {
  const port = await getFreePort();
  const gateway = createGatewayServer({ port, cors: false, auth: {} });
  gateway.setMarketIndexStatsHandler(async () => {
    return { stats: { total: 2, byPlatform: { polymarket: 2 } } };
  });

  await gateway.start();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/market-index/stats`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.stats.total, 2);
    assert.equal(body.stats.byPlatform.polymarket, 2);
  } finally {
    await gateway.stop();
  }
});
