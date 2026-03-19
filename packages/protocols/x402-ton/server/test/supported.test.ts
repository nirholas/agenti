import { describe, it, expect } from 'vitest';
import { supportedRoute } from '../src/routes/supported';
import type { ServerConfig } from '../src/config';
import type { GaslessConfigCache } from 'x402ton';

const mockConfig: ServerConfig = {
  port: 4020,
  tonMnemonic: [],
  tonNetwork: 'tvm:-239',
  toncenterUrl: 'https://toncenter.com/api/v2/jsonRPC',
  tonapiEndpoint: undefined,
  dbPath: ':memory:',
  maxRelayCommission: '50000',
  rateLimits: { global: 1000, perIp: 100, perWallet: 30, settlePerWallet: 10 },
};

const facilitatorAddress = '0:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

describe('GET /supported', () => {
  it('returns kinds with relay info (no gasless cache — fallback to facilitatorAddress)', async () => {
    const app = supportedRoute(mockConfig, facilitatorAddress);
    const res = await app.request('/supported');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.kinds).toHaveLength(1);
    expect(body.kinds[0].scheme).toBe('exact');
    expect(body.kinds[0].network).toBe('tvm:-239');
    expect(body.kinds[0].extra.relayAddress).toBe(facilitatorAddress);
    expect(body.kinds[0].extra.maxRelayCommission).toBe('50000');
    expect(body.kinds[0].extra.assetDecimals).toBe(6);
    expect(body.kinds[0].extra.assetSymbol).toBe('USDT');
  });

  it('uses gasless cache relayAddress and maxRelayCommission when cache is populated', async () => {
    const gaslessRelayAddress = '0:1111111111111111111111111111111111111111111111111111111111111111';
    const gaslessCache: GaslessConfigCache = {
      relayAddress: gaslessRelayAddress,
      maxRelayCommission: '100000',
      lastUpdated: Date.now(),
    };

    const app = supportedRoute(mockConfig, facilitatorAddress, gaslessCache);
    const res = await app.request('/supported');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.kinds[0].extra.relayAddress).toBe(gaslessRelayAddress);
    expect(body.kinds[0].extra.maxRelayCommission).toBe('100000');
  });

  it('falls back to facilitatorAddress and config.maxRelayCommission when gasless cache is undefined', async () => {
    const app = supportedRoute(mockConfig, facilitatorAddress, undefined);
    const res = await app.request('/supported');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.kinds[0].extra.relayAddress).toBe(facilitatorAddress);
    expect(body.kinds[0].extra.maxRelayCommission).toBe('50000');
  });

  it('falls back to facilitatorAddress when gasless cache has null relayAddress', async () => {
    const gaslessCache: GaslessConfigCache = {
      relayAddress: null,
      maxRelayCommission: null,
      lastUpdated: Date.now(),
    };

    const app = supportedRoute(mockConfig, facilitatorAddress, gaslessCache);
    const res = await app.request('/supported');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.kinds[0].extra.relayAddress).toBe(facilitatorAddress);
    expect(body.kinds[0].extra.maxRelayCommission).toBe('50000');
  });

  it('returns signers map', async () => {
    const app = supportedRoute(mockConfig, facilitatorAddress);
    const res = await app.request('/supported');
    const body = await res.json();

    expect(body.signers['tvm:*']).toContain(facilitatorAddress);
  });
});
