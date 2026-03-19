/**
 * Feature Indicators - Pure functions for computing trading indicators
 */

/**
 * Compute orderbook imbalance
 * Returns value in range [-1, 1]
 * Positive = more bids (buy pressure), Negative = more asks (sell pressure)
 */
export function computeImbalance(bidVolume: number, askVolume: number): number {
  const total = bidVolume + askVolume;
  if (total === 0) return 0;
  return (bidVolume - askVolume) / total;
}

/**
 * Compute imbalance ratio (bid / ask)
 */
export function computeImbalanceRatio(bidVolume: number, askVolume: number): number {
  if (askVolume === 0) return bidVolume > 0 ? Infinity : 1;
  return bidVolume / askVolume;
}

/**
 * Compute spread
 */
export function computeSpread(bestBid: number, bestAsk: number): number {
  return bestAsk - bestBid;
}

/**
 * Compute spread as percentage of mid price
 */
export function computeSpreadPct(bestBid: number, bestAsk: number): number {
  const mid = (bestBid + bestAsk) / 2;
  if (mid === 0) return 0;
  return ((bestAsk - bestBid) / mid) * 100;
}

/**
 * Compute mid price
 */
export function computeMidPrice(bestBid: number, bestAsk: number): number {
  return (bestBid + bestAsk) / 2;
}

/**
 * Compute total depth from orderbook levels
 */
export function computeDepth(levels: Array<[number, number]>): number {
  return levels.reduce((sum, [, size]) => sum + size, 0);
}

/**
 * Compute volume-weighted average price from levels
 */
export function computeWeightedPrice(levels: Array<[number, number]>): number {
  if (levels.length === 0) return 0;

  let totalValue = 0;
  let totalVolume = 0;

  for (const [price, size] of levels) {
    totalValue += price * size;
    totalVolume += size;
  }

  return totalVolume > 0 ? totalValue / totalVolume : 0;
}

/**
 * Compute depth within percentage of mid price
 */
export function computeDepthAtPct(
  levels: Array<[number, number]>,
  midPrice: number,
  pct: number,
  side: 'bid' | 'ask'
): number {
  if (midPrice === 0) return 0;

  const threshold = midPrice * (pct / 100);
  let depth = 0;

  for (const [price, size] of levels) {
    const distance = side === 'bid' ? midPrice - price : price - midPrice;
    if (distance <= threshold) {
      depth += size;
    }
  }

  return depth;
}

/**
 * Compute momentum (price change over N periods)
 */
export function computeMomentum(prices: number[], lookback: number): number {
  if (prices.length < lookback + 1) return 0;
  const current = prices[prices.length - 1];
  const past = prices[prices.length - 1 - lookback];
  return current - past;
}

/**
 * Compute momentum as percentage
 */
export function computeMomentumPct(prices: number[], lookback: number): number {
  if (prices.length < lookback + 1) return 0;
  const current = prices[prices.length - 1];
  const past = prices[prices.length - 1 - lookback];
  if (past === 0) return 0;
  return ((current - past) / past) * 100;
}

/**
 * Compute price velocity (change per second)
 */
export function computeVelocity(
  prices: Array<{ price: number; timestamp: number }>,
  windowMs: number = 10000
): number {
  if (prices.length < 2) return 0;

  const latest = prices[prices.length - 1];
  const cutoff = latest.timestamp - windowMs;

  // Find oldest price within window
  let oldest = prices[0];
  for (let i = prices.length - 2; i >= 0; i--) {
    if (prices[i].timestamp >= cutoff) {
      oldest = prices[i];
    } else {
      break;
    }
  }

  const timeDelta = (latest.timestamp - oldest.timestamp) / 1000; // seconds
  if (timeDelta === 0) return 0;

  return (latest.price - oldest.price) / timeDelta;
}

/**
 * Compute returns from prices
 */
export function computeReturns(prices: number[]): number[] {
  if (prices.length < 2) return [];

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] !== 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    } else {
      returns.push(0);
    }
  }
  return returns;
}

/**
 * Compute volatility (standard deviation of returns)
 */
export function computeVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (returns.length - 1);

  return Math.sqrt(variance);
}

/**
 * Compute VWAP from price/volume data
 */
export function computeVWAP(data: Array<{ price: number; volume: number }>): number {
  if (data.length === 0) return 0;

  let totalValue = 0;
  let totalVolume = 0;

  for (const { price, volume } of data) {
    totalValue += price * volume;
    totalVolume += volume;
  }

  return totalVolume > 0 ? totalValue / totalVolume : 0;
}

/**
 * Compute tick intensity (ticks per second)
 */
export function computeTickIntensity(
  timestamps: number[],
  windowMs: number = 60000
): number {
  if (timestamps.length < 2) return 0;

  const latest = timestamps[timestamps.length - 1];
  const cutoff = latest - windowMs;

  let count = 0;
  for (let i = timestamps.length - 1; i >= 0; i--) {
    if (timestamps[i] >= cutoff) {
      count++;
    } else {
      break;
    }
  }

  return count / (windowMs / 1000);
}

/**
 * Compute buy pressure signal [0, 1]
 * Combines positive momentum, positive imbalance, and tightening spread
 */
export function computeBuyPressure(
  momentum: number,
  imbalance: number,
  spreadChange: number
): number {
  // Normalize momentum to [0, 1] assuming typical range of [-0.1, 0.1]
  const momSignal = Math.max(0, Math.min(1, (momentum + 0.1) / 0.2));

  // Imbalance is already [-1, 1], map to [0, 1]
  const imbSignal = (imbalance + 1) / 2;

  // Negative spread change = tightening = bullish
  const spreadSignal = Math.max(0, Math.min(1, 0.5 - spreadChange * 10));

  // Weighted combination
  return momSignal * 0.4 + imbSignal * 0.4 + spreadSignal * 0.2;
}

/**
 * Compute sell pressure signal [0, 1]
 */
export function computeSellPressure(
  momentum: number,
  imbalance: number,
  spreadChange: number
): number {
  // Inverse of buy pressure
  const momSignal = Math.max(0, Math.min(1, (0.1 - momentum) / 0.2));
  const imbSignal = (1 - imbalance) / 2;
  const spreadSignal = Math.max(0, Math.min(1, 0.5 + spreadChange * 10));

  return momSignal * 0.4 + imbSignal * 0.4 + spreadSignal * 0.2;
}

/**
 * Compute trend strength [-1, 1]
 * Combines momentum direction with imbalance confirmation
 */
export function computeTrendStrength(momentum: number, imbalance: number): number {
  // Normalize momentum
  const momNorm = Math.max(-1, Math.min(1, momentum * 10));

  // Weight by agreement
  const agreement = momNorm * imbalance >= 0 ? 1.2 : 0.8;

  return Math.max(-1, Math.min(1, (momNorm + imbalance) / 2 * agreement));
}

/**
 * Compute liquidity score [0, 1]
 * Based on depth and spread quality
 */
export function computeLiquidityScore(
  totalDepth: number,
  spreadPct: number,
  depthThreshold: number = 10000,
  spreadThreshold: number = 2
): number {
  // Depth score: more depth = higher score
  const depthScore = Math.min(1, totalDepth / depthThreshold);

  // Spread score: tighter spread = higher score
  const spreadScore = Math.max(0, 1 - spreadPct / spreadThreshold);

  // Combined with weights
  return depthScore * 0.6 + spreadScore * 0.4;
}
