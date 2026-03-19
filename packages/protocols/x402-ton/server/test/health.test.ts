import { describe, it, expect, vi } from 'vitest';
import { healthRoute } from '../src/health';
import type { TonClient } from '@ton/ton';

function createMockTonClient(connected = true): TonClient {
  return {
    getMasterchainInfo: connected
      ? vi.fn().mockResolvedValue({ latestSeqno: 12345 })
      : vi.fn().mockRejectedValue(new Error('connection failed')),
  } as unknown as TonClient;
}

describe('GET /health', () => {
  it('returns healthy when TON client is connected', async () => {
    const app = healthRoute({
      tonClient: createMockTonClient(true),
      network: 'tvm:-239',
      startedAt: Date.now() - 60000,
    });

    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(typeof body.version).toBe('string');
    expect(body.version.length).toBeGreaterThan(0);
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.ton.connected).toBe(true);
    expect(body.ton.network).toBe('tvm:-239');
    expect(body.ton.latestBlock).toBe(12345);
  });

  it('returns degraded when TON client is disconnected', async () => {
    const app = healthRoute({
      tonClient: createMockTonClient(false),
      network: 'tvm:-239',
      startedAt: Date.now(),
    });

    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('degraded');
    expect(body.ton.connected).toBe(false);
  });
});
