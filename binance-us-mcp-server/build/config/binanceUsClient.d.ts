/**
 * Binance.US API Client Configuration
 *
 * Base URLs:
 * - REST API: https://api.binance.us
 * - WebSocket: wss://stream.binance.us:9443
 *
 * Authentication:
 * - API Key passed via X-MBX-APIKEY header
 * - Signature generated using HMAC SHA256
 *
 * Key Differences from Binance.com:
 * - US regulatory compliance
 * - No futures, margin, or lending
 * - Custodial Solution API (unique to US)
 * - Credit Line API (unique to US)
 */
export declare const BINANCE_US_CONFIG: {
    readonly BASE_URL: "https://api.binance.us";
    readonly WS_URL: "wss://stream.binance.us:9443";
    readonly DEFAULT_RECV_WINDOW: 5000;
    readonly MAX_RECV_WINDOW: 60000;
};
/** Rate limit information from API response headers */
export interface RateLimitInfo {
    usedWeight: number;
    weightLimit: number;
    orderCount?: number;
    retryAfter?: number;
}
/** API response wrapper with rate limit info */
export interface BinanceUsResponse<T> {
    data: T;
    rateLimitInfo?: RateLimitInfo;
}
/** Ping response (empty object) */
export interface PingResponse {
}
/** Server time response */
export interface ServerTimeResponse {
    serverTime: number;
}
/** System status response */
export interface SystemStatusResponse {
    status: 0 | 1;
}
/** Symbol information in exchange info */
export interface SymbolInfo {
    symbol: string;
    status: "PRE_TRADING" | "TRADING" | "POST_TRADING" | "END_OF_DAY" | "HALT" | "AUCTION_MATCH" | "BREAK";
    baseAsset: string;
    baseAssetPrecision: number;
    quoteAsset: string;
    quotePrecision: number;
    quoteAssetPrecision: number;
    baseCommissionPrecision: number;
    quoteCommissionPrecision: number;
    orderTypes: string[];
    icebergAllowed: boolean;
    ocoAllowed: boolean;
    quoteOrderQtyMarketAllowed: boolean;
    allowTrailingStop: boolean;
    cancelReplaceAllowed: boolean;
    isSpotTradingAllowed: boolean;
    isMarginTradingAllowed: boolean;
    filters: any[];
    permissions: string[];
}
/** Exchange information response */
export interface ExchangeInfoResponse {
    timezone: string;
    serverTime: number;
    rateLimits: any[];
    exchangeFilters: any[];
    symbols: SymbolInfo[];
    permissions: string[];
    defaultSelfTradePreventionMode?: string;
    allowedSelfTradePreventionModes?: string[];
}
/** Order book response */
export interface OrderBookResponse {
    lastUpdateId: number;
    bids: [string, string][];
    asks: [string, string][];
}
/** Trade response */
export interface TradeResponse {
    id: number;
    price: string;
    qty: string;
    quoteQty: string;
    time: number;
    isBuyerMaker: boolean;
    isBestMatch: boolean;
}
/** Aggregate trade response */
export interface AggTradeResponse {
    a: number;
    p: string;
    q: string;
    f: number;
    l: number;
    T: number;
    m: boolean;
    M: boolean;
}
/** Formatted aggregate trade (human-readable) */
export interface FormattedAggTrade {
    aggregateTradeId: number;
    price: string;
    quantity: string;
    firstTradeId: number;
    lastTradeId: number;
    timestamp: number;
    timestampISO: string;
    isBuyerMaker: boolean;
    isBestMatch: boolean;
}
/** Raw kline data (array format from API) */
export type KlineRaw = [
    number,
    string,
    string,
    string,
    string,
    string,
    number,
    string,
    number,
    string,
    string,
    string
];
/** Formatted kline (human-readable) */
export interface FormattedKline {
    openTime: number;
    openTimeISO: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    closeTime: number;
    closeTimeISO: string;
    quoteAssetVolume: string;
    numberOfTrades: number;
    takerBuyBaseVolume: string;
    takerBuyQuoteVolume: string;
}
/** Average price response */
export interface AvgPriceResponse {
    mins: number;
    price: string;
}
/** Ticker price response */
export interface TickerPriceResponse {
    symbol: string;
    price: string;
}
/** Book ticker response */
export interface BookTickerResponse {
    symbol: string;
    bidPrice: string;
    bidQty: string;
    askPrice: string;
    askQty: string;
}
/** 24hr ticker response */
export interface Ticker24hrResponse {
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
    weightedAvgPrice: string;
    prevClosePrice: string;
    lastPrice: string;
    lastQty: string;
    bidPrice: string;
    bidQty: string;
    askPrice: string;
    askQty: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    quoteVolume: string;
    openTime: number;
    closeTime: number;
    firstId: number;
    lastId: number;
    count: number;
}
/** Rolling window ticker response */
export interface RollingWindowTickerResponse {
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
    weightedAvgPrice: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    lastPrice: string;
    volume: string;
    quoteVolume: string;
    openTime: number;
    closeTime: number;
    firstId: number;
    lastId: number;
    count: number;
}
/** Custom error class for Binance.US API errors */
export declare class BinanceUsApiError extends Error {
    readonly code: number;
    readonly httpStatus: number;
    readonly rateLimitInfo?: RateLimitInfo | undefined;
    constructor(code: number, message: string, httpStatus: number, rateLimitInfo?: RateLimitInfo | undefined);
}
/** Rate limit error (HTTP 429) */
export declare class RateLimitError extends BinanceUsApiError {
    readonly retryAfter: number;
    constructor(message: string, retryAfter: number, rateLimitInfo?: RateLimitInfo);
}
/** IP ban error (HTTP 418) */
export declare class IpBanError extends BinanceUsApiError {
    readonly retryAfter: number;
    constructor(message: string, retryAfter: number, rateLimitInfo?: RateLimitInfo);
}
/**
 * Generate HMAC SHA256 signature for Binance.US API requests
 */
export declare function generateSignature(queryString: string): string;
/**
 * Build query string from parameters object
 */
export declare function buildQueryString(params: Record<string, any>): string;
/**
 * Check if API credentials are configured
 */
export declare function hasApiCredentials(): boolean;
/**
 * Check if API key is configured (for MARKET_DATA requests)
 */
export declare function hasApiKey(): boolean;
/**
 * Get current timestamp in milliseconds
 */
export declare function getTimestamp(): number;
/**
 * Format a kline array into a readable object
 */
export declare function formatKline(kline: KlineRaw): FormattedKline;
/**
 * Format an aggregate trade into a readable object
 */
export declare function formatAggTrade(trade: AggTradeResponse): FormattedAggTrade;
/**
 * Make a signed request to Binance.US API
 * @param method HTTP method
 * @param endpoint API endpoint path
 * @param params Request parameters
 * @param recvWindow Optional receive window (default 5000, max 60000)
 */
export declare function makeSignedRequest(method: "GET" | "POST" | "PUT" | "DELETE", endpoint: string, params?: Record<string, any>, recvWindow?: number): Promise<any>;
/**
 * Make a public (unsigned) request to Binance.US API
 */
export declare function makePublicRequest(method: "GET", endpoint: string, params?: Record<string, any>): Promise<any>;
export declare const binanceUsConfig: {
    apiKey: string;
    apiSecret: string;
    baseUrl: "https://api.binance.us";
    wsUrl: "wss://stream.binance.us:9443";
};
/**
 * Make a MARKET_DATA request (requires API key but no signature)
 */
export declare function makeMarketDataRequest(method: "GET", endpoint: string, params?: Record<string, any>): Promise<any>;
/**
 * Unified request helper for all Binance.US API endpoints
 * @param method HTTP method
 * @param path API endpoint path
 * @param params Request parameters
 * @param signed Whether request requires HMAC signature
 * @param apiKeyRequired Whether request requires API key (for MARKET_DATA endpoints)
 * @param recvWindow Optional receive window for signed requests (default 5000, max 60000)
 */
export declare function binanceUsRequest<T = any>(method: "GET" | "POST" | "DELETE", path: string, params?: Record<string, any>, signed?: boolean, apiKeyRequired?: boolean, recvWindow?: number): Promise<T>;
/** Valid limit values for order book depth endpoint */
export declare const ORDER_BOOK_VALID_LIMITS: readonly [5, 10, 20, 50, 100, 500, 1000, 5000];
/** Valid kline intervals */
export declare const KLINE_INTERVALS: readonly ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"];
/** Valid rolling window sizes */
export declare const ROLLING_WINDOW_SIZES: readonly ["1m", "2m", "3m", "4m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "7d"];
/** Max results for trade endpoints */
export declare const MAX_TRADES_LIMIT = 1000;
export declare const DEFAULT_TRADES_LIMIT = 500;
/** Max results for klines endpoint */
export declare const MAX_KLINES_LIMIT = 1000;
export declare const DEFAULT_KLINES_LIMIT = 500;
//# sourceMappingURL=binanceUsClient.d.ts.map