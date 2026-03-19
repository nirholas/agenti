import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Position, User } from '../../src/types';
import { enforceExposureLimits, enforceMaxOrderSize } from '../../src/trading/risk';

function makeUser(settings: User['settings']): User {
  return {
    id: 'user-1',
    platform: 'telegram',
    platformUserId: '123',
    settings,
    createdAt: new Date(),
    lastActiveAt: new Date(),
  };
}

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    id: 'pos-1',
    platform: 'polymarket',
    marketId: 'm1',
    marketQuestion: 'Will X happen?',
    outcome: 'YES',
    outcomeId: 'o1',
    side: 'YES',
    shares: 100,
    avgPrice: 0.5,
    currentPrice: 0.5,
    pnl: 0,
    pnlPct: 0,
    value: 50,
    openedAt: new Date(),
    ...overrides,
  };
}

test('enforceMaxOrderSize blocks oversized order', () => {
  const ctx = {
    tradingContext: { maxOrderSize: 100 },
    db: {
      getUser: () => makeUser({ alertsEnabled: true, digestEnabled: false, defaultPlatforms: [], notifyOnEdge: false, edgeThreshold: 0.1 }),
      getPositions: () => [],
    },
  };

  const result = enforceMaxOrderSize(ctx, 150, 'test');
  assert.ok(result);
  const payload = JSON.parse(result);
  assert.equal(payload.error, 'Order exceeds maxOrderSize');
  assert.equal(payload.maxOrderSize, 100);
  assert.equal(payload.notional, 150);
});

test('enforceMaxOrderSize allows small or invalid notional', () => {
  const ctx = {
    tradingContext: { maxOrderSize: 100 },
    db: {
      getUser: () => makeUser({ alertsEnabled: true, digestEnabled: false, defaultPlatforms: [], notifyOnEdge: false, edgeThreshold: 0.1 }),
      getPositions: () => [],
    },
  };

  assert.equal(enforceMaxOrderSize(ctx, 50, 'ok'), null);
  assert.equal(enforceMaxOrderSize(ctx, Number.NaN, 'nan'), null);
});

test('enforceExposureLimits blocks maxTotalExposure', () => {
  const ctx = {
    db: {
      getUser: () => makeUser({
        alertsEnabled: true,
        digestEnabled: false,
        defaultPlatforms: [],
        notifyOnEdge: false,
        edgeThreshold: 0.1,
        maxTotalExposure: 100,
      }),
      getPositions: () => [makePosition({ shares: 100, avgPrice: 0.5 })],
    },
  };

  const result = enforceExposureLimits(ctx, 'user-1', {
    platform: 'polymarket',
    marketId: 'm1',
    outcomeId: 'o1',
    notional: 60,
    label: 'test',
  });

  assert.ok(result);
  const payload = JSON.parse(result);
  assert.equal(payload.error, 'Order exceeds maxTotalExposure');
  assert.equal(payload.maxTotalExposure, 100);
});

test('enforceExposureLimits ignores non-positive notional', () => {
  const ctx = {
    db: {
      getUser: () => makeUser({
        alertsEnabled: true,
        digestEnabled: false,
        defaultPlatforms: [],
        notifyOnEdge: false,
        edgeThreshold: 0.1,
        maxTotalExposure: 100,
      }),
      getPositions: () => [makePosition()],
    },
  };

  assert.equal(enforceExposureLimits(ctx, 'user-1', {
    platform: 'polymarket',
    marketId: 'm1',
    outcomeId: 'o1',
    notional: 0,
    label: 'zero',
  }), null);

  assert.equal(enforceExposureLimits(ctx, 'user-1', {
    platform: 'polymarket',
    marketId: 'm1',
    outcomeId: 'o1',
    notional: -5,
    label: 'negative',
  }), null);
});

test('enforceExposureLimits blocks maxPositionValue', () => {
  const ctx = {
    db: {
      getUser: () => makeUser({
        alertsEnabled: true,
        digestEnabled: false,
        defaultPlatforms: [],
        notifyOnEdge: false,
        edgeThreshold: 0.1,
        maxPositionValue: 70,
      }),
      getPositions: () => [makePosition({ shares: 100, avgPrice: 0.5 })],
    },
  };

  const result = enforceExposureLimits(ctx, 'user-1', {
    platform: 'polymarket',
    marketId: 'm1',
    outcomeId: 'o1',
    notional: 30,
    label: 'test',
  });

  assert.ok(result);
  const payload = JSON.parse(result);
  assert.equal(payload.error, 'Order exceeds maxPositionValue');
  assert.equal(payload.maxPositionValue, 70);
});

test('enforceExposureLimits skips maxPositionValue when market/outcome missing', () => {
  const ctx = {
    db: {
      getUser: () => makeUser({
        alertsEnabled: true,
        digestEnabled: false,
        defaultPlatforms: [],
        notifyOnEdge: false,
        edgeThreshold: 0.1,
        maxPositionValue: 10,
      }),
      getPositions: () => [makePosition({ shares: 100, avgPrice: 0.5 })],
    },
  };

  const result = enforceExposureLimits(ctx, 'user-1', {
    platform: 'polymarket',
    notional: 100,
    label: 'missing ids',
  });

  assert.equal(result, null);
});

test('enforceExposureLimits blocks stop-loss threshold', () => {
  const ctx = {
    db: {
      getUser: () => makeUser({
        alertsEnabled: true,
        digestEnabled: false,
        defaultPlatforms: [],
        notifyOnEdge: false,
        edgeThreshold: 0.1,
        stopLossPct: 20, // 20%
      }),
      getPositions: () => [makePosition({ avgPrice: 1, currentPrice: 0.79 })],
    },
  };

  const result = enforceExposureLimits(ctx, 'user-1', {
    platform: 'polymarket',
    marketId: 'm1',
    outcomeId: 'o1',
    notional: 10,
    label: 'test',
  });

  assert.ok(result);
  const payload = JSON.parse(result);
  assert.equal(payload.error, 'Stop-loss threshold breached');
  assert.equal(payload.stopLossPct, 0.2);
});

test('enforceExposureLimits returns null when no limits configured', () => {
  const ctx = {
    db: {
      getUser: () => makeUser({
        alertsEnabled: true,
        digestEnabled: false,
        defaultPlatforms: [],
        notifyOnEdge: false,
        edgeThreshold: 0.1,
      }),
      getPositions: () => [makePosition()],
    },
  };

  const result = enforceExposureLimits(ctx, 'user-1', {
    platform: 'polymarket',
    marketId: 'm1',
    outcomeId: 'o1',
    notional: 100,
    label: 'no limits',
  });

  assert.equal(result, null);
});
