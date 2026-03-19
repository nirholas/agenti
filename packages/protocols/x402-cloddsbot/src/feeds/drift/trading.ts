/**
 * Drift BET Trading - Solana-based prediction market trading
 *
 * Features:
 * - Buy/sell prediction market shares
 * - Portfolio tracking
 * - Order management
 *
 * Requires: Solana wallet + Drift SDK
 *
 * Docs: https://docs.drift.trade/prediction-markets/
 */

import { EventEmitter } from 'events';
import { Connection, Keypair } from '@solana/web3.js';
import { logger } from '../../utils/logger';
import { generateId as generateSecureId } from '../../utils/id';
import { loadSolanaKeypair, getSolanaConnection } from '../../solana/wallet';

// =============================================================================
// TYPES
// =============================================================================

export interface DriftTradingConfig {
  /** Solana RPC URL */
  rpcUrl?: string;
  /** Private key (base58 or Uint8Array) */
  privateKey?: string;
  /** Keypair path */
  keypairPath?: string;
  /** Drift BET API URL */
  betApiUrl?: string;
  /** Dry run mode */
  dryRun?: boolean;
}

export interface DriftOrder {
  orderId: string;
  marketIndex: number;
  direction: 'long' | 'short'; // long = YES, short = NO
  baseAssetAmount: number;
  price: number;
  status: 'open' | 'filled' | 'cancelled';
  createdAt: Date;
}

export interface DriftPosition {
  marketIndex: number;
  marketName: string;
  baseAssetAmount: number; // Positive = long, negative = short
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
}

export interface DriftBalance {
  spotBalance: number; // USDC
  perpEquity: number;
  totalEquity: number;
}

export interface DriftTrading extends EventEmitter {
  // Initialization
  initialize(): Promise<void>;
  isInitialized(): boolean;

  // Trading
  buyYes(marketIndex: number, amount: number, maxPrice?: number): Promise<DriftOrder | null>;
  buyNo(marketIndex: number, amount: number, maxPrice?: number): Promise<DriftOrder | null>;
  sellYes(marketIndex: number, amount: number, minPrice?: number): Promise<DriftOrder | null>;
  sellNo(marketIndex: number, amount: number, minPrice?: number): Promise<DriftOrder | null>;
  limitBuyYes(marketIndex: number, amount: number, price: number): Promise<DriftOrder | null>;
  limitBuyNo(marketIndex: number, amount: number, price: number): Promise<DriftOrder | null>;
  limitSellYes(marketIndex: number, amount: number, price: number): Promise<DriftOrder | null>;
  limitSellNo(marketIndex: number, amount: number, price: number): Promise<DriftOrder | null>;

  // Order management
  cancelOrder(orderId: string): Promise<boolean>;
  cancelAllOrders(marketIndex?: number): Promise<number>;
  getOpenOrders(marketIndex?: number): Promise<DriftOrder[]>;

  // Portfolio
  getPositions(): Promise<DriftPosition[]>;
  getPosition(marketIndex: number): Promise<DriftPosition | null>;
  getBalance(): Promise<DriftBalance>;

  // Market data
  getMarketPrice(marketIndex: number): Promise<{ yes: number; no: number } | null>;
  getOrderbook(marketIndex: number): Promise<{ bids: [number, number][]; asks: [number, number][] } | null>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';
const DEFAULT_BET_API_URL = 'https://bet.drift.trade/api';

// =============================================================================
// DRIFT TRADING IMPLEMENTATION
// =============================================================================

export function createDriftTrading(config: DriftTradingConfig = {}): DriftTrading {
  const emitter = new EventEmitter();
  const rpcUrl = config.rpcUrl || process.env.SOLANA_RPC_URL || DEFAULT_RPC_URL;
  const betApiUrl = config.betApiUrl || process.env.DRIFT_BET_API_URL || DEFAULT_BET_API_URL;
  const dryRun = config.dryRun ?? (process.env.DRIFT_DRY_RUN === 'true');

  let initialized = false;
  let walletAddress: string | null = null;

  // SDK state (populated during initialize() if wallet is configured)
  let connection: Connection | null = null;
  let keypair: Keypair | null = null;
  let driftClient: any = null;
  let driftSdk: any = null;

  // Local state for dry-run tracking
  const openOrders = new Map<string, DriftOrder>();
  const positions = new Map<number, DriftPosition>();

  // Helper to fetch from Drift API
  async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
    try {
      const response = await fetch(`${betApiUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        logger.error({ status: response.status, endpoint }, 'Drift API error');
        return null;
      }

      return await response.json() as T;
    } catch (err) {
      logger.error({ err, endpoint }, 'Drift API fetch error');
      return null;
    }
  }

  // Generate order ID
  function generateOrderId(): string {
    return generateSecureId('drift');
  }

  // Create order (internal)
  async function createOrder(
    marketIndex: number,
    direction: 'long' | 'short',
    amount: number,
    price: number | null,
    orderType: 'market' | 'limit'
  ): Promise<DriftOrder | null> {
    if (!initialized) {
      logger.error('Drift trading not initialized');
      return null;
    }

    const orderId = generateOrderId();

    if (dryRun) {
      logger.info(
        { marketIndex, direction, amount, price, orderType, dryRun: true },
        'Drift order (dry run)'
      );

      // Simulate order
      const order: DriftOrder = {
        orderId,
        marketIndex,
        direction,
        baseAssetAmount: amount,
        price: price ?? 0.5,
        status: orderType === 'market' ? 'filled' : 'open',
        createdAt: new Date(),
      };

      if (orderType === 'limit') {
        openOrders.set(orderId, order);
      }

      return order;
    }

    if (!driftClient || !driftSdk) {
      logger.error('Drift SDK not initialized — cannot place real orders');
      return null;
    }

    try {
      const sdkDirection = direction === 'long'
        ? driftSdk.PositionDirection.LONG
        : driftSdk.PositionDirection.SHORT;
      const sdkOrderType = orderType === 'market'
        ? driftSdk.OrderType.MARKET
        : driftSdk.OrderType.LIMIT;

      const orderParams: any = {
        marketIndex,
        direction: sdkDirection,
        baseAssetAmount: new driftSdk.BN(Math.round(amount * 1e9)),
        orderType: sdkOrderType,
      };

      if (orderType === 'limit' && price != null) {
        orderParams.price = new driftSdk.BN(Math.round(price * 1e6));
      }

      const txSig = await driftClient.placePerpOrder(orderParams);

      logger.info(
        { marketIndex, direction, amount, price, orderType, txSig },
        'Drift order placed'
      );

      const order: DriftOrder = {
        orderId: txSig || orderId,
        marketIndex,
        direction,
        baseAssetAmount: amount,
        price: price ?? 0.5,
        status: orderType === 'market' ? 'filled' : 'open',
        createdAt: new Date(),
      };

      if (orderType === 'limit') {
        openOrders.set(order.orderId, order);
      }

      emitter.emit('order', order);
      return order;
    } catch (err) {
      logger.error({ err, marketIndex, direction, amount, price, orderType }, 'Drift order failed');
      return null;
    }
  }

  // Attach methods
  const trading: DriftTrading = Object.assign(emitter, {
    async initialize() {
      // Try to load wallet + SDK for real trading
      const hasWallet = config.privateKey || config.keypairPath || process.env.SOLANA_PRIVATE_KEY;

      if (hasWallet) {
        try {
          keypair = loadSolanaKeypair({
            privateKey: config.privateKey,
            keypairPath: config.keypairPath,
          });
          connection = getSolanaConnection({ rpcUrl });
          walletAddress = keypair.publicKey.toBase58();

          // Dynamic import SDK (same pattern as src/solana/drift.ts)
          driftSdk = await import('@drift-labs/sdk') as any;
          const anchor = await import('@coral-xyz/anchor');

          const wallet = new anchor.Wallet(keypair);
          const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
          driftClient = new driftSdk.DriftClient({
            connection,
            wallet: provider.wallet,
            env: 'mainnet-beta',
          });

          await driftClient.subscribe();
          logger.info({ walletAddress }, 'Drift BET trading initialized with SDK');
        } catch (err) {
          logger.warn({ err }, 'Drift SDK init failed — falling back to read-only mode');
          driftClient = null;
          driftSdk = null;
          walletAddress = null;
        }
      } else {
        logger.warn('Drift trading: No wallet configured, running in read-only mode');
      }

      initialized = true;
      emitter.emit('initialized');
    },

    isInitialized() {
      return initialized;
    },

    // Trading - YES side
    async buyYes(marketIndex: number, amount: number, maxPrice?: number) {
      return createOrder(marketIndex, 'long', amount, maxPrice || null, 'market');
    },

    async sellYes(marketIndex: number, amount: number, minPrice?: number) {
      return createOrder(marketIndex, 'short', amount, minPrice || null, 'market');
    },

    async limitBuyYes(marketIndex: number, amount: number, price: number) {
      return createOrder(marketIndex, 'long', amount, price, 'limit');
    },

    async limitSellYes(marketIndex: number, amount: number, price: number) {
      return createOrder(marketIndex, 'short', amount, price, 'limit');
    },

    // Trading - NO side (inverse of YES)
    async buyNo(marketIndex: number, amount: number, maxPrice?: number) {
      // Buying NO = selling YES at inverse price
      const inversePrice = maxPrice ? 1 - maxPrice : undefined;
      return createOrder(marketIndex, 'short', amount, inversePrice || null, 'market');
    },

    async sellNo(marketIndex: number, amount: number, minPrice?: number) {
      const inversePrice = minPrice ? 1 - minPrice : undefined;
      return createOrder(marketIndex, 'long', amount, inversePrice || null, 'market');
    },

    async limitBuyNo(marketIndex: number, amount: number, price: number) {
      return createOrder(marketIndex, 'short', amount, 1 - price, 'limit');
    },

    async limitSellNo(marketIndex: number, amount: number, price: number) {
      return createOrder(marketIndex, 'long', amount, 1 - price, 'limit');
    },

    // Order management
    async cancelOrder(orderId: string) {
      const order = openOrders.get(orderId);
      if (!order) return false;

      if (dryRun) {
        order.status = 'cancelled';
        openOrders.delete(orderId);
        logger.info({ orderId, dryRun: true }, 'Drift order cancelled');
        return true;
      }

      if (driftClient) {
        try {
          const numericId = parseInt(orderId, 10);
          if (!isNaN(numericId)) {
            await driftClient.cancelOrder(numericId);
          }
        } catch (err) {
          logger.error({ err, orderId }, 'Drift SDK cancelOrder failed');
          return false;
        }
      }

      order.status = 'cancelled';
      openOrders.delete(orderId);
      emitter.emit('orderCancelled', order);
      return true;
    },

    async cancelAllOrders(marketIndex?: number) {
      // SDK bulk cancel
      if (driftClient && driftSdk) {
        try {
          if (marketIndex !== undefined) {
            await driftClient.cancelOrders(marketIndex, driftSdk.MarketType.PERP);
          } else {
            await driftClient.cancelAllOrders();
          }
        } catch (err) {
          logger.error({ err, marketIndex }, 'Drift SDK cancelAllOrders failed');
        }
      }

      // Clear local tracking
      let cancelled = 0;
      for (const [orderId, order] of openOrders) {
        if (marketIndex === undefined || order.marketIndex === marketIndex) {
          order.status = 'cancelled';
          openOrders.delete(orderId);
          cancelled++;
        }
      }

      logger.info({ marketIndex, cancelled }, 'Drift orders cancelled');
      return cancelled;
    },

    async getOpenOrders(marketIndex?: number) {
      // Use SDK if available
      if (driftClient && driftSdk) {
        try {
          const user = driftClient.getUser();
          const sdkOrders = user.getOpenOrders();
          const result: DriftOrder[] = [];

          for (const o of sdkOrders) {
            if (o.marketType !== driftSdk.MarketType.PERP) continue;
            if (marketIndex !== undefined && o.marketIndex !== marketIndex) continue;

            const direction: 'long' | 'short' =
              o.direction === driftSdk.PositionDirection.LONG ? 'long' : 'short';

            result.push({
              orderId: String(o.orderId),
              marketIndex: o.marketIndex,
              direction,
              baseAssetAmount: o.baseAssetAmount.toNumber() / 1e9,
              price: o.price.toNumber() / 1e6,
              status: 'open',
              createdAt: new Date(),
            });
          }

          return result;
        } catch (err) {
          logger.warn({ err }, 'Drift SDK getOpenOrders failed, falling back to local');
        }
      }

      // Fallback: local tracking
      const orders = Array.from(openOrders.values());

      if (marketIndex !== undefined) {
        return orders.filter((o) => o.marketIndex === marketIndex);
      }

      return orders;
    },

    // Portfolio
    async getPositions() {
      // Use SDK if available
      if (driftClient) {
        try {
          const user = driftClient.getUser();
          const perpPositions = user.getPerpPositions();
          const result: DriftPosition[] = [];

          for (const pos of perpPositions) {
            if (pos.baseAssetAmount.isZero()) continue;

            const baseAmount = pos.baseAssetAmount.toNumber() / 1e9;
            const quoteAmount = pos.quoteAssetAmount.toNumber() / 1e6;
            const entryPrice = baseAmount !== 0 ? Math.abs(quoteAmount / baseAmount) : 0;

            // Get current price from oracle
            let currentPrice = 0.5;
            try {
              const oracleData = driftClient.getOracleDataForPerpMarket(pos.marketIndex);
              if (oracleData?.price) {
                currentPrice = oracleData.price.toNumber() / 1e6;
              }
            } catch { /* fall back to default */ }

            const unrealizedPnL = baseAmount > 0
              ? (currentPrice - entryPrice) * Math.abs(baseAmount)
              : (entryPrice - currentPrice) * Math.abs(baseAmount);

            const position: DriftPosition = {
              marketIndex: pos.marketIndex,
              marketName: `Market ${pos.marketIndex}`,
              baseAssetAmount: baseAmount,
              entryPrice,
              currentPrice,
              unrealizedPnL,
              realizedPnL: 0,
            };

            positions.set(pos.marketIndex, position);
            result.push(position);
          }

          return result;
        } catch (err) {
          logger.warn({ err }, 'Drift SDK getPositions failed, falling back to API');
        }
      }

      // Fallback: fetch from API
      const data = await fetchApi<{
        positions: Array<{
          marketIndex: number;
          baseAssetAmount: string;
          quoteEntryAmount: string;
          openOrders: number;
        }>;
      }>('/user/positions');

      if (!data?.positions) {
        return Array.from(positions.values());
      }

      const result: DriftPosition[] = [];

      for (const p of data.positions) {
        const baseAmount = parseFloat(p.baseAssetAmount) / 1e9;
        if (Math.abs(baseAmount) < 0.0001) continue;

        const prices = await trading.getMarketPrice(p.marketIndex);
        const currentPrice = baseAmount > 0 ? prices?.yes ?? 0.5 : prices?.no ?? 0.5;
        const entryPrice = Math.abs(parseFloat(p.quoteEntryAmount) / 1e6 / baseAmount);

        const position: DriftPosition = {
          marketIndex: p.marketIndex,
          marketName: `Market ${p.marketIndex}`,
          baseAssetAmount: baseAmount,
          entryPrice,
          currentPrice,
          unrealizedPnL: (currentPrice - entryPrice) * baseAmount,
          realizedPnL: 0,
        };

        positions.set(p.marketIndex, position);
        result.push(position);
      }

      return result;
    },

    async getPosition(marketIndex: number) {
      const allPositions = await trading.getPositions();
      return allPositions.find((p) => p.marketIndex === marketIndex) || null;
    },

    async getBalance() {
      // Use SDK if available
      if (driftClient) {
        try {
          const user = driftClient.getUser();
          const totalCollateral = user.getTotalCollateral().toNumber() / 1e6;
          const freeCollateral = user.getFreeCollateral().toNumber() / 1e6;
          const unrealizedPnL = user.getUnrealizedPNL(true).toNumber() / 1e6;

          return {
            spotBalance: freeCollateral,
            perpEquity: unrealizedPnL,
            totalEquity: totalCollateral,
          };
        } catch (err) {
          logger.warn({ err }, 'Drift SDK getBalance failed, falling back to API');
        }
      }

      // Fallback: fetch from API
      const data = await fetchApi<{
        spotBalance: number;
        perpEquity: number;
        totalEquity: number;
      }>('/user/balance');

      if (!data) {
        return { spotBalance: 0, perpEquity: 0, totalEquity: 0 };
      }

      return {
        spotBalance: data.spotBalance / 1e6,
        perpEquity: data.perpEquity / 1e6,
        totalEquity: data.totalEquity / 1e6,
      };
    },

    // Market data
    async getMarketPrice(marketIndex: number) {
      const data = await fetchApi<{
        probability: number;
        lastPrice: number;
      }>(`/markets/${marketIndex}`);

      if (!data) return null;

      const yesPrice = data.probability ?? data.lastPrice ?? 0.5;

      return {
        yes: yesPrice,
        no: 1 - yesPrice,
      };
    },

    async getOrderbook(marketIndex: number) {
      const data = await fetchApi<{
        bids: Array<{ price: number; size: number }>;
        asks: Array<{ price: number; size: number }>;
      }>(`/markets/${marketIndex}/orderbook`);

      if (!data) return null;

      return {
        bids: (data.bids || []).map((b) => [b.price, b.size] as [number, number]),
        asks: (data.asks || []).map((a) => [a.price, a.size] as [number, number]),
      };
    },
  }) as DriftTrading;

  return trading;
}

// Types already exported at definition above
