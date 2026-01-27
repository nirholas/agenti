/**
 * Order Book Aggregation API
 * 
 * Multi-exchange order book aggregation and smart routing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { 
  orderBook,
  type Exchange,
} from '@/lib/order-book';

export const runtime = 'edge';
export const revalidate = 0; // Real-time data, no caching

const DEFAULT_EXCHANGES: Exchange[] = ['binance', 'coinbase', 'kraken', 'okx', 'bybit'];

/**
 * GET /api/market/orderbook
 * 
 * Get aggregated order book or depth chart data
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await checkRateLimit(request);
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const action = searchParams.get('action') || 'aggregate';
    const exchangesParam = searchParams.get('exchanges');

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required (e.g., BTC, ETH)' },
        { status: 400 }
      );
    }

    const exchanges = exchangesParam
      ? exchangesParam.split(',') as Exchange[]
      : DEFAULT_EXCHANGES;

    // Validate exchanges
    const validExchanges = exchanges.filter(e => 
      ['binance', 'coinbase', 'kraken', 'bitfinex', 'bitstamp', 'okx', 'bybit', 'kucoin', 'huobi', 'gemini'].includes(e)
    ) as Exchange[];

    if (validExchanges.length === 0) {
      return NextResponse.json(
        { error: 'No valid exchanges provided' },
        { status: 400 }
      );
    }

    if (action === 'aggregate') {
      const aggregated = await orderBook.aggregateOrderBooks(symbol, validExchanges);
      
      return NextResponse.json({
        symbol: aggregated.symbol,
        timestamp: aggregated.timestamp,
        exchanges: aggregated.exchanges,
        nbbo: aggregated.nbbo,
        metrics: aggregated.metrics,
        exchangeData: aggregated.exchangeData,
        // Include top levels only to reduce payload size
        topBids: aggregated.aggregatedBids.slice(0, 10),
        topAsks: aggregated.aggregatedAsks.slice(0, 10),
      });
    }

    if (action === 'depth') {
      const depthData = await orderBook.getDepthChartData(symbol, validExchanges);
      return NextResponse.json(depthData);
    }

    if (action === 'single') {
      const exchange = validExchanges[0];
      const depth = parseInt(searchParams.get('depth') || '25');
      
      const book = await orderBook.fetchOrderBook(symbol, exchange, depth);
      if (!book) {
        return NextResponse.json(
          { error: `Failed to fetch order book from ${exchange}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        orderBook: {
          symbol: book.symbol,
          exchange: book.exchange,
          timestamp: book.timestamp,
          spread: book.spread,
          midPrice: book.midPrice,
          bids: book.bids,
          asks: book.asks,
        },
      });
    }

    if (action === 'nbbo') {
      const aggregated = await orderBook.aggregateOrderBooks(symbol, validExchanges);
      
      return NextResponse.json({
        symbol: aggregated.symbol,
        timestamp: aggregated.timestamp,
        exchanges: aggregated.exchanges,
        nbbo: aggregated.nbbo,
      });
    }

    if (action === 'metrics') {
      const aggregated = await orderBook.aggregateOrderBooks(symbol, validExchanges);
      
      return NextResponse.json({
        symbol: aggregated.symbol,
        timestamp: aggregated.timestamp,
        metrics: aggregated.metrics,
      });
    }

    if (action === 'whales') {
      const aggregated = await orderBook.aggregateOrderBooks(symbol, validExchanges);
      
      return NextResponse.json({
        symbol: aggregated.symbol,
        timestamp: aggregated.timestamp,
        whaleOrders: aggregated.metrics.whaleOrders,
        priceWalls: aggregated.metrics.priceWalls,
      });
    }

    if (action === 'snapshots') {
      const limit = parseInt(searchParams.get('limit') || '20');
      const snapshots = await orderBook.listSnapshots({ symbol, limit });
      
      return NextResponse.json({
        snapshots: snapshots.map(s => ({
          id: s.id,
          symbol: s.symbol,
          timestamp: s.timestamp,
          exchanges: s.aggregatedBook.exchanges,
          midPrice: s.aggregatedBook.nbbo.midPrice,
          spread: s.aggregatedBook.nbbo.spread,
        })),
        count: snapshots.length,
      });
    }

    return NextResponse.json({
      availableActions: [
        'aggregate',
        'depth',
        'single',
        'nbbo',
        'metrics',
        'whales',
        'snapshots',
      ],
    });
  } catch (error) {
    console.error('Order book API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order book data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/market/orderbook
 * 
 * Calculate smart routes or save snapshots
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = await checkRateLimit(request);
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'smart-route') {
      const { symbol, orderType, quantity, exchanges } = body as {
        symbol: string;
        orderType: 'buy' | 'sell';
        quantity: number;
        exchanges?: Exchange[];
      };

      if (!symbol || !orderType || !quantity) {
        return NextResponse.json(
          { error: 'Symbol, orderType (buy/sell), and quantity are required' },
          { status: 400 }
        );
      }

      if (!['buy', 'sell'].includes(orderType)) {
        return NextResponse.json(
          { error: 'orderType must be "buy" or "sell"' },
          { status: 400 }
        );
      }

      if (quantity <= 0) {
        return NextResponse.json(
          { error: 'Quantity must be positive' },
          { status: 400 }
        );
      }

      const validExchanges = exchanges?.filter(e => 
        ['binance', 'coinbase', 'kraken', 'bitfinex', 'bitstamp', 'okx', 'bybit', 'kucoin', 'huobi', 'gemini'].includes(e)
      ) as Exchange[] | undefined;

      const recommendation = await orderBook.calculateSmartRoute(
        symbol,
        orderType,
        quantity,
        validExchanges || DEFAULT_EXCHANGES
      );

      return NextResponse.json({
        success: true,
        recommendation,
      });
    }

    if (action === 'save-snapshot') {
      const { symbol, exchanges } = body as {
        symbol: string;
        exchanges?: Exchange[];
      };

      if (!symbol) {
        return NextResponse.json(
          { error: 'Symbol is required' },
          { status: 400 }
        );
      }

      const validExchanges = exchanges?.filter(e => 
        ['binance', 'coinbase', 'kraken', 'bitfinex', 'bitstamp', 'okx', 'bybit', 'kucoin', 'huobi', 'gemini'].includes(e)
      ) as Exchange[] | undefined;

      const aggregated = await orderBook.aggregateOrderBooks(
        symbol,
        validExchanges || DEFAULT_EXCHANGES
      );

      const snapshot = await orderBook.saveSnapshot(aggregated);

      return NextResponse.json({
        success: true,
        snapshot: {
          id: snapshot.id,
          symbol: snapshot.symbol,
          timestamp: snapshot.timestamp,
        },
      });
    }

    if (action === 'get-snapshot') {
      const { id } = body;

      if (!id) {
        return NextResponse.json(
          { error: 'Snapshot ID is required' },
          { status: 400 }
        );
      }

      const snapshot = await orderBook.getSnapshot(id);
      if (!snapshot) {
        return NextResponse.json(
          { error: 'Snapshot not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ snapshot });
    }

    if (action === 'compare-exchanges') {
      const { symbol, exchanges } = body as {
        symbol: string;
        exchanges?: Exchange[];
      };

      if (!symbol) {
        return NextResponse.json(
          { error: 'Symbol is required' },
          { status: 400 }
        );
      }

      const validExchanges = exchanges?.filter(e => 
        ['binance', 'coinbase', 'kraken', 'bitfinex', 'bitstamp', 'okx', 'bybit', 'kucoin', 'huobi', 'gemini'].includes(e)
      ) as Exchange[] | undefined;

      const aggregated = await orderBook.aggregateOrderBooks(
        symbol,
        validExchanges || DEFAULT_EXCHANGES
      );

      // Create comparison table
      const comparison = aggregated.exchangeData.map(ed => ({
        exchange: ed.exchange,
        bestBid: ed.bestBid,
        bestAsk: ed.bestAsk,
        spread: ed.spread,
        spreadPercent: ((ed.spread / ((ed.bestBid + ed.bestAsk) / 2)) * 100).toFixed(4) + '%',
        bidLiquidity: ed.totalBidLiquidity,
        askLiquidity: ed.totalAskLiquidity,
        status: ed.status,
      }));

      // Rank by spread
      const rankedBySpread = [...comparison].sort((a, b) => a.spread - b.spread);
      
      // Rank by liquidity
      const rankedByLiquidity = [...comparison].sort(
        (a, b) => (b.bidLiquidity + b.askLiquidity) - (a.bidLiquidity + a.askLiquidity)
      );

      return NextResponse.json({
        symbol,
        timestamp: aggregated.timestamp,
        comparison,
        rankings: {
          bySpread: rankedBySpread.map((e, i) => ({ 
            rank: i + 1, 
            exchange: e.exchange, 
            spread: e.spreadPercent 
          })),
          byLiquidity: rankedByLiquidity.map((e, i) => ({ 
            rank: i + 1, 
            exchange: e.exchange, 
            totalLiquidity: e.bidLiquidity + e.askLiquidity 
          })),
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Supported: smart-route, save-snapshot, get-snapshot, compare-exchanges' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Order book POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process order book request' },
      { status: 500 }
    );
  }
}
