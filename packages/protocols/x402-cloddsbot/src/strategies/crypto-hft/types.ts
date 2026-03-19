/**
 * Crypto HFT — Types for 15-minute Polymarket crypto market trading
 *
 * Ported from firstorder.rs with all real thresholds and execution patterns.
 */

// ── Order Execution ─────────────────────────────────────────────────────────

/** How to execute an entry or exit order */
export type OrderMode =
  | 'maker'        // GTC postOnly — 0% fee, rejected if would cross
  | 'taker'        // GTC — crosses spread, pays taker fee
  | 'fok'          // Fill-or-Kill — immediate full fill or cancel
  | 'maker_then_taker';  // Try maker first, escalate to taker on timeout

export interface OrderExecution {
  mode: OrderMode;
  /** Maker timeout before escalating to taker (ms). Only for maker_then_taker. */
  makerTimeoutMs: number;
  /** Price buffer for taker orders: +/- this many cents (default 0.01) */
  takerBufferCents: number;
  /** For maker exits: buffer below ask to post in spread */
  makerExitBufferCents: number;
}

// ── Taker Fee (Polymarket formula) ──────────────────────────────────────────

/** fee_per_share = 0.125 * (price * (1 - price))^2 */
export function takerFee(price: number): number {
  return 0.125 * Math.pow(price * (1 - price), 2);
}

export function takerFeePct(price: number): number {
  if (price === 0) return 0;
  return (takerFee(price) / price) * 100;
}

// ── Config ──────────────────────────────────────────────────────────────────

export interface CryptoHftConfig {
  /** Assets to trade */
  assets: string[];

  // ── Sizing ──
  sizeUsd: number;
  /** Min shares to survive taker fee round-trip */
  minShares: number;
  maxShares: number;
  maxPositionUsd: number;
  maxPositions: number;

  // ── Round timing ──
  roundDurationSec: number;
  /** Don't enter if fewer than this many seconds left */
  minTimeLeftSec: number;
  /** Don't enter in the first N seconds (spreads unstable) */
  minRoundAgeSec: number;
  /** Force exit at this many seconds before expiry */
  forceExitSec: number;
  /** Warmup: don't trade for N seconds after engine start */
  warmupSec: number;

  // ── Entry execution ──
  entryOrder: OrderExecution;
  /** Max orderbook staleness before skipping entry (ms) */
  maxOrderbookStaleMs: number;

  // ── Exit execution ──
  exitOrder: OrderExecution;
  /** Use maker exits only for TP and TIME exits (not SL — speed matters) */
  makerExitsForTpOnly: boolean;
  /** Cooldown between sell attempts (ms) */
  sellCooldownMs: number;
  /** Share buffer subtracted from exit size for rounding (e.g. 0.02) */
  exitShareBuffer: number;

  // ── Take Profit / Stop Loss ──
  takeProfitPct: number;
  stopLossPct: number;

  // ── Ratchet floor (progressive giveback from confirmed high) ──
  ratchetEnabled: boolean;
  /** Number of consecutive ticks near high to confirm HWM */
  ratchetConfirmTicks: number;
  /** Tolerance % for HWM confirmation (within this % of high = "near") */
  ratchetConfirmTolerancePct: number;

  // ── Trailing stop ──
  trailingEnabled: boolean;

  // ── Time-aware trailing (tightens as expiry approaches) ──
  trailingLatePct: number;    // <3 min left
  trailingMidPct: number;     // 3-7 min left
  trailingWidePct: number;    // >7 min left

  // ── Advanced exits ──
  /** Exit if up >= this % and bid unchanged for staleSeconds */
  staleProfitPct: number;
  staleProfitBidUnchangedSec: number;
  /** Exit if at +N% for M seconds without progress */
  stagnantProfitPct: number;
  stagnantDurationSec: number;
  /** Exit on depth collapse: depth dropped this % while price dropping */
  depthCollapseThresholdPct: number;

  // ── Risk ──
  maxDailyLossUsd: number;
  /** Cooldown after stop loss hit (seconds) */
  stopLossCooldownSec: number;
  /** Cooldown after any exit before re-entering same coin+direction (seconds) */
  exitCooldownSec: number;
  negRisk: boolean;
  dryRun: boolean;
}

// ── Orderbook ───────────────────────────────────────────────────────────────

export interface OrderbookSnapshot {
  tokenId: string;
  bids: Array<[number, number]>; // [price, size]
  asks: Array<[number, number]>;
  bidDepth: number;
  askDepth: number;
  obi: number;               // (bidDepth - askDepth) / (bidDepth + askDepth)
  spread: number;             // bestAsk - bestBid
  spreadPct: number;
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  timestamp: number;
}

export type ObiCategory = 'bid_heavy' | 'bid_lean' | 'balanced' | 'ask_lean' | 'ask_heavy';

export function categorizeObi(obi: number): ObiCategory {
  if (obi > 0.3) return 'bid_heavy';
  if (obi > 0) return 'bid_lean';
  if (obi > -0.3) return 'balanced';
  if (obi > -0.6) return 'ask_lean';
  return 'ask_heavy';
}

// ── Market ──────────────────────────────────────────────────────────────────

export interface CryptoMarket {
  asset: string;
  conditionId: string;
  questionId: string;
  upTokenId: string;
  downTokenId: string;
  upPrice: number;
  downPrice: number;
  expiresAt: number;
  /** Current round slot (expiresAt / roundDuration) */
  roundSlot: number;
  negRisk: boolean;
  question: string;
}

export interface RoundState {
  slot: number;
  expiresAt: number;
  markets: CryptoMarket[];
  /** Seconds since round started */
  ageSec: number;
  /** Seconds until round expires */
  timeLeftSec: number;
}

// ── Signal ──────────────────────────────────────────────────────────────────

export type SignalDirection = 'up' | 'down';

export interface TradeSignal {
  strategy: string;
  asset: string;
  direction: SignalDirection;
  tokenId: string;
  conditionId: string;
  price: number;
  confidence: number;
  reason: string;
  /** Which order mode this strategy recommends */
  orderMode: OrderMode;
  /** Features that triggered the signal (for logging/analysis) */
  features: Record<string, number>;
  timestamp: number;
}

// ── Position ────────────────────────────────────────────────────────────────

export interface OpenPosition {
  id: string;
  strategy: string;
  asset: string;
  direction: SignalDirection;
  tokenId: string;
  conditionId: string;
  entryPrice: number;
  currentPrice: number;
  shares: number;
  costUsd: number;
  wasMakerEntry: boolean;
  entryFeePct: number;

  // HWM tracking
  highWaterMark: number;
  /** Consecutive ticks near HWM for confirmation */
  hwmConfirmCount: number;
  confirmedHigh: number;

  // Timing
  enteredAt: number;
  expiresAt: number;

  // Bid staleness tracking (for stale profit exit)
  lastBidPrice: number;
  bidUnchangedSince: number;

  // Stagnant tracking
  lastProgressAt: number;
  lastProgressPct: number;

  // Depth tracking
  initialDepth: number;

  // PnL timeline
  highPnlPct: number;
  lowPnlPct: number;
  wasEverPositive: boolean;
}

export type ExitReason =
  | 'take_profit'
  | 'stop_loss'
  | 'ratchet_floor'
  | 'trailing_stop'
  | 'depth_collapse'
  | 'stale_profit'
  | 'stagnant_profit'
  | 'time_exit'
  | 'force_exit'
  | 'manual';

export interface ClosedPosition extends OpenPosition {
  exitPrice: number;
  exitReason: ExitReason;
  exitedAt: number;
  wasMakerExit: boolean;
  exitFeePct: number;
  pnlUsd: number;
  pnlPct: number;
  /** Net PnL after fees */
  netPnlUsd: number;
  netPnlPct: number;
  holdTimeSec: number;
}

// ── Stats ───────────────────────────────────────────────────────────────────

export interface HftStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  grossPnlUsd: number;
  feesUsd: number;
  netPnlUsd: number;
  dailyPnlUsd: number;
  openPositions: number;
  bestTradePct: number;
  worstTradePct: number;
  avgHoldTimeSec: number;
  makerEntryRate: number;
  makerExitRate: number;
  exitReasons: Record<string, number>;
}

// ── Presets ──────────────────────────────────────────────────────────────────

export interface StrategyPreset {
  name: string;
  description: string;
  config: Partial<CryptoHftConfig>;
  /** Which strategies to enable */
  strategies: Record<string, boolean>;
  createdAt: number;
}
