// src/config/binanceUsClient.ts
import crypto from "crypto";
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
// API Configuration Constants
export const BINANCE_US_CONFIG = {
    BASE_URL: "https://api.binance.us",
    WS_URL: "wss://stream.binance.us:9443",
    DEFAULT_RECV_WINDOW: 5000,
    MAX_RECV_WINDOW: 60000,
};
const API_KEY = process.env.BINANCE_US_API_KEY || "";
const API_SECRET = process.env.BINANCE_US_API_SECRET || "";
const BASE_URL = BINANCE_US_CONFIG.BASE_URL;
// ============================================================================
// Error Classes
// ============================================================================
/** Custom error class for Binance.US API errors */
export class BinanceUsApiError extends Error {
    code;
    httpStatus;
    rateLimitInfo;
    constructor(code, message, httpStatus, rateLimitInfo) {
        super(message);
        this.code = code;
        this.httpStatus = httpStatus;
        this.rateLimitInfo = rateLimitInfo;
        this.name = "BinanceUsApiError";
    }
}
/** Rate limit error (HTTP 429) */
export class RateLimitError extends BinanceUsApiError {
    retryAfter;
    constructor(message, retryAfter, rateLimitInfo) {
        super(-1003, message, 429, rateLimitInfo);
        this.retryAfter = retryAfter;
        this.name = "RateLimitError";
    }
}
/** IP ban error (HTTP 418) */
export class IpBanError extends BinanceUsApiError {
    retryAfter;
    constructor(message, retryAfter, rateLimitInfo) {
        super(-1003, message, 418, rateLimitInfo);
        this.retryAfter = retryAfter;
        this.name = "IpBanError";
    }
}
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Generate HMAC SHA256 signature for Binance.US API requests
 */
export function generateSignature(queryString) {
    return crypto
        .createHmac("sha256", API_SECRET)
        .update(queryString)
        .digest("hex");
}
/**
 * Build query string from parameters object
 */
export function buildQueryString(params) {
    const filteredParams = Object.entries(params)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join("&");
    return filteredParams;
}
/**
 * Check if API credentials are configured
 */
export function hasApiCredentials() {
    return !!(API_KEY && API_SECRET);
}
/**
 * Check if API key is configured (for MARKET_DATA requests)
 */
export function hasApiKey() {
    return !!API_KEY;
}
/**
 * Get current timestamp in milliseconds
 */
export function getTimestamp() {
    return Date.now();
}
/**
 * Parse rate limit info from response headers
 */
function parseRateLimitInfo(headers) {
    const usedWeight = headers.get("X-MBX-USED-WEIGHT-1M");
    const retryAfter = headers.get("Retry-After");
    if (!usedWeight && !retryAfter)
        return undefined;
    return {
        usedWeight: usedWeight ? parseInt(usedWeight, 10) : 0,
        weightLimit: 1200, // Default weight limit per minute
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
    };
}
/**
 * Format a kline array into a readable object
 */
export function formatKline(kline) {
    return {
        openTime: kline[0],
        openTimeISO: new Date(kline[0]).toISOString(),
        open: kline[1],
        high: kline[2],
        low: kline[3],
        close: kline[4],
        volume: kline[5],
        closeTime: kline[6],
        closeTimeISO: new Date(kline[6]).toISOString(),
        quoteAssetVolume: kline[7],
        numberOfTrades: kline[8],
        takerBuyBaseVolume: kline[9],
        takerBuyQuoteVolume: kline[10],
    };
}
/**
 * Format an aggregate trade into a readable object
 */
export function formatAggTrade(trade) {
    return {
        aggregateTradeId: trade.a,
        price: trade.p,
        quantity: trade.q,
        firstTradeId: trade.f,
        lastTradeId: trade.l,
        timestamp: trade.T,
        timestampISO: new Date(trade.T).toISOString(),
        isBuyerMaker: trade.m,
        isBestMatch: trade.M,
    };
}
// ============================================================================
// API Request Functions
// ============================================================================
/**
 * Make a signed request to Binance.US API
 * @param method HTTP method
 * @param endpoint API endpoint path
 * @param params Request parameters
 * @param recvWindow Optional receive window (default 5000, max 60000)
 */
export async function makeSignedRequest(method, endpoint, params = {}, recvWindow = BINANCE_US_CONFIG.DEFAULT_RECV_WINDOW) {
    // Validate credentials
    if (!hasApiCredentials()) {
        throw new BinanceUsApiError(-2015, "API credentials required. Set BINANCE_US_API_KEY and BINANCE_US_API_SECRET environment variables.", 401);
    }
    // Validate recvWindow
    if (recvWindow > BINANCE_US_CONFIG.MAX_RECV_WINDOW) {
        recvWindow = BINANCE_US_CONFIG.MAX_RECV_WINDOW;
    }
    // Add timestamp and recvWindow to params
    const timestamp = Date.now();
    const paramsWithTimestamp = { ...params, timestamp, recvWindow };
    // Build query string and generate signature
    const queryString = buildQueryString(paramsWithTimestamp);
    const signature = generateSignature(queryString);
    const signedQueryString = `${queryString}&signature=${signature}`;
    // Build URL and headers
    const url = method === "GET" || method === "DELETE"
        ? `${BASE_URL}${endpoint}?${signedQueryString}`
        : `${BASE_URL}${endpoint}`;
    const headers = {
        "X-MBX-APIKEY": API_KEY,
        "Content-Type": "application/x-www-form-urlencoded"
    };
    const fetchOptions = {
        method,
        headers
    };
    // For POST and PUT requests, send data in body
    if (method === "POST" || method === "PUT") {
        fetchOptions.body = signedQueryString;
    }
    const response = await fetch(url, fetchOptions);
    const rateLimitInfo = parseRateLimitInfo(response.headers);
    // Handle rate limiting (429)
    if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "60", 10);
        throw new RateLimitError(`Rate limit exceeded. Retry after ${retryAfter} seconds.`, retryAfter, rateLimitInfo);
    }
    // Handle IP ban (418)
    if (response.status === 418) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "120", 10);
        throw new IpBanError(`IP temporarily banned. Ban lifted after ${retryAfter} seconds.`, retryAfter, rateLimitInfo);
    }
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ msg: response.statusText }));
        throw new BinanceUsApiError(errorData.code || response.status, errorData.msg || response.statusText, response.status, rateLimitInfo);
    }
    return response.json();
}
/**
 * Make a public (unsigned) request to Binance.US API
 */
export async function makePublicRequest(method, endpoint, params = {}) {
    const queryString = buildQueryString(params);
    const url = queryString
        ? `${BASE_URL}${endpoint}?${queryString}`
        : `${BASE_URL}${endpoint}`;
    const response = await fetch(url, { method });
    const rateLimitInfo = parseRateLimitInfo(response.headers);
    // Handle rate limiting (429)
    if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "60", 10);
        throw new RateLimitError(`Rate limit exceeded. Retry after ${retryAfter} seconds.`, retryAfter, rateLimitInfo);
    }
    // Handle IP ban (418)
    if (response.status === 418) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "120", 10);
        throw new IpBanError(`IP temporarily banned. Ban lifted after ${retryAfter} seconds.`, retryAfter, rateLimitInfo);
    }
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ msg: response.statusText }));
        throw new BinanceUsApiError(errorData.code || response.status, errorData.msg || response.statusText, response.status, rateLimitInfo);
    }
    return response.json();
}
export const binanceUsConfig = {
    apiKey: API_KEY,
    apiSecret: API_SECRET,
    baseUrl: BASE_URL,
    wsUrl: BINANCE_US_CONFIG.WS_URL
};
/**
 * Make a MARKET_DATA request (requires API key but no signature)
 */
export async function makeMarketDataRequest(method, endpoint, params = {}) {
    // Validate API key
    if (!hasApiKey()) {
        throw new BinanceUsApiError(-2015, "API key required for MARKET_DATA endpoints. Set BINANCE_US_API_KEY environment variable.", 401);
    }
    const queryString = buildQueryString(params);
    const url = queryString
        ? `${BASE_URL}${endpoint}?${queryString}`
        : `${BASE_URL}${endpoint}`;
    const headers = {
        "X-MBX-APIKEY": API_KEY
    };
    const response = await fetch(url, { method, headers });
    const rateLimitInfo = parseRateLimitInfo(response.headers);
    // Handle rate limiting (429)
    if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "60", 10);
        throw new RateLimitError(`Rate limit exceeded. Retry after ${retryAfter} seconds.`, retryAfter, rateLimitInfo);
    }
    // Handle IP ban (418)
    if (response.status === 418) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "120", 10);
        throw new IpBanError(`IP temporarily banned. Ban lifted after ${retryAfter} seconds.`, retryAfter, rateLimitInfo);
    }
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ msg: response.statusText }));
        throw new BinanceUsApiError(errorData.code || response.status, errorData.msg || response.statusText, response.status, rateLimitInfo);
    }
    return response.json();
}
/**
 * Unified request helper for all Binance.US API endpoints
 * @param method HTTP method
 * @param path API endpoint path
 * @param params Request parameters
 * @param signed Whether request requires HMAC signature
 * @param apiKeyRequired Whether request requires API key (for MARKET_DATA endpoints)
 * @param recvWindow Optional receive window for signed requests (default 5000, max 60000)
 */
export async function binanceUsRequest(method, path, params = {}, signed = false, apiKeyRequired = false, recvWindow) {
    if (signed) {
        return makeSignedRequest(method, path, params, recvWindow);
    }
    else if (apiKeyRequired) {
        return makeMarketDataRequest("GET", path, params);
    }
    else {
        return makePublicRequest("GET", path, params);
    }
}
// ============================================================================
// Valid Parameter Values
// ============================================================================
/** Valid limit values for order book depth endpoint */
export const ORDER_BOOK_VALID_LIMITS = [5, 10, 20, 50, 100, 500, 1000, 5000];
/** Valid kline intervals */
export const KLINE_INTERVALS = [
    "1m", "3m", "5m", "15m", "30m",
    "1h", "2h", "4h", "6h", "8h", "12h",
    "1d", "3d", "1w", "1M"
];
/** Valid rolling window sizes */
export const ROLLING_WINDOW_SIZES = [
    "1m", "2m", "3m", "4m", "5m", "15m", "30m",
    "1h", "2h", "4h", "6h", "8h", "12h",
    "1d", "3d", "7d"
];
/** Max results for trade endpoints */
export const MAX_TRADES_LIMIT = 1000;
export const DEFAULT_TRADES_LIMIT = 500;
/** Max results for klines endpoint */
export const MAX_KLINES_LIMIT = 1000;
export const DEFAULT_KLINES_LIMIT = 500;
//# sourceMappingURL=binanceUsClient.js.map