"use strict";
/**
 * Dynamic Content Configuration Module
 *
 * This module provides dynamic content and pricing configuration for the x402 payment verifier.
 * Content can be loaded from:
 * 1. Static configuration (default)
 * 2. Environment variables (for pricing overrides)
 * 3. S3 bucket (for dynamic content)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.contentManager = exports.ContentManager = exports.DEFAULT_CONTENT_REGISTRY = void 0;
exports.createPaymentRequirements = createPaymentRequirements;
exports.clearS3Cache = clearS3Cache;
exports.setContentBucket = setContentBucket;
const client_s3_1 = require("@aws-sdk/client-s3");
// ============================================================================
// Default Configuration
// ============================================================================
/**
 * Default payment recipient address
 * Can be overridden via PAYMENT_RECIPIENT_ADDRESS in seller-infrastructure/.env
 * CDK injects the value into deploy-config.json at build time
 */
let deployConfig = {};
try {
    deployConfig = require('./deploy-config.json');
}
catch {
    // No deploy-config.json — use hardcoded default
}
const DEFAULT_PAY_TO = deployConfig.payTo || '0x24842F3136Fa2a3df835d36b4c3cb4972d405502';
/**
 * Default network (Base Sepolia testnet)
 * Use 'eip155:8453' for Base Mainnet in production
 */
const DEFAULT_NETWORK = 'eip155:84532';
/**
 * Default asset (USDC on Base Sepolia)
 */
const DEFAULT_ASSET = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
/**
 * Default S3 bucket for content storage
 * Set at runtime from the CloudFront origin event via setContentBucket()
 * Lambda@Edge doesn't support environment variables, so this is resolved dynamically
 */
let DEFAULT_CONTENT_BUCKET = '';
/**
 * Creates default payment requirements with optional overrides
 */
function createPaymentRequirements(amount, overrides) {
    return {
        scheme: 'exact',
        network: DEFAULT_NETWORK,
        amount,
        asset: DEFAULT_ASSET,
        payTo: DEFAULT_PAY_TO,
        maxTimeoutSeconds: 60,
        extra: {
            name: 'USDC',
            version: '2',
            assetTransferMethod: 'eip3009',
        },
        ...overrides,
    };
}
// ============================================================================
// Default Content Registry
// ============================================================================
/**
 * Default content registry with static content
 */
exports.DEFAULT_CONTENT_REGISTRY = {
    version: '1.0.0',
    defaultPayTo: DEFAULT_PAY_TO,
    defaultNetwork: DEFAULT_NETWORK,
    defaultAsset: DEFAULT_ASSET,
    items: {
        // Root-level content paths (for direct access)
        '/research-report': {
            id: 'research-report',
            path: '/research-report',
            title: 'Blockchain Research Report',
            description: 'In-depth research report on blockchain technology trends',
            mimeType: 'application/json',
            pricing: createPaymentRequirements('5000'),
            source: {
                type: 's3',
                bucket: DEFAULT_CONTENT_BUCKET,
                key: 'research-report',
            },
        },
        '/dataset': {
            id: 'dataset',
            path: '/dataset',
            title: 'Premium Dataset',
            description: 'Curated dataset for machine learning and analytics',
            mimeType: 'application/json',
            pricing: createPaymentRequirements('10000'),
            source: {
                type: 's3',
                bucket: DEFAULT_CONTENT_BUCKET,
                key: 'dataset',
            },
        },
        '/tutorial': {
            id: 'tutorial',
            path: '/tutorial',
            title: 'Advanced Smart Contract Tutorial',
            description: 'Step-by-step guide to building advanced smart contracts',
            mimeType: 'application/json',
            pricing: createPaymentRequirements('3000'),
            source: {
                type: 's3',
                bucket: DEFAULT_CONTENT_BUCKET,
                key: 'tutorial',
            },
        },
        // API-prefixed paths (for backwards compatibility)
        '/api/premium-article': {
            id: 'premium-article',
            path: '/api/premium-article',
            title: 'The Future of AI and Blockchain Integration',
            description: 'Premium article about AI and blockchain convergence',
            mimeType: 'application/json',
            pricing: createPaymentRequirements('1000'),
            source: {
                type: 'inline',
                data: {
                    title: 'The Future of AI and Blockchain Integration',
                    author: 'Tech Insights',
                    date: new Date().toISOString().split('T')[0],
                    content: 'Artificial Intelligence and Blockchain are converging to create unprecedented opportunities...',
                    fullText: 'This is premium content that requires payment to access. The integration of AI and blockchain technology is revolutionizing how we think about decentralized systems, smart contracts, and autonomous agents. Key areas of innovation include: 1) Decentralized AI training, 2) Smart contract automation, 3) Tokenized AI services, 4) Privacy-preserving computation.',
                    tags: ['AI', 'blockchain', 'technology', 'innovation'],
                },
            },
        },
        '/api/weather-data': {
            id: 'weather-data',
            path: '/api/weather-data',
            title: 'Real-time Weather Data',
            description: 'Current weather conditions and forecast',
            mimeType: 'application/json',
            pricing: createPaymentRequirements('500'),
            source: {
                type: 'dynamic',
                generator: 'weather',
            },
        },
        '/api/market-analysis': {
            id: 'market-analysis',
            path: '/api/market-analysis',
            title: 'Cryptocurrency Market Analysis',
            description: 'Real-time market data and analysis',
            mimeType: 'application/json',
            pricing: createPaymentRequirements('2000'),
            source: {
                type: 'dynamic',
                generator: 'market',
            },
        },
        // S3-backed content items with /api/ prefix
        '/api/research-report': {
            id: 'api-research-report',
            path: '/api/research-report',
            title: 'Blockchain Research Report',
            description: 'In-depth research report on blockchain technology trends',
            mimeType: 'application/json',
            pricing: createPaymentRequirements('5000'),
            source: {
                type: 's3',
                bucket: DEFAULT_CONTENT_BUCKET,
                key: 'research-report',
            },
        },
        '/api/dataset': {
            id: 'api-dataset',
            path: '/api/dataset',
            title: 'Premium Dataset',
            description: 'Curated dataset for machine learning and analytics',
            mimeType: 'application/json',
            pricing: createPaymentRequirements('10000'),
            source: {
                type: 's3',
                bucket: DEFAULT_CONTENT_BUCKET,
                key: 'dataset',
            },
        },
        '/api/tutorial': {
            id: 'api-tutorial',
            path: '/api/tutorial',
            title: 'Advanced Smart Contract Tutorial',
            description: 'Step-by-step guide to building advanced smart contracts',
            mimeType: 'application/json',
            pricing: createPaymentRequirements('3000'),
            source: {
                type: 's3',
                bucket: DEFAULT_CONTENT_BUCKET,
                key: 'tutorial',
            },
        },
    },
};
// ============================================================================
// Dynamic Content Generators
// ============================================================================
/**
 * Generates dynamic weather data
 */
function generateWeatherData() {
    const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rain', 'Thunderstorm', 'Snow', 'Fog'];
    const cities = [
        { name: 'San Francisco, CA', tempRange: [50, 70] },
        { name: 'New York, NY', tempRange: [30, 85] },
        { name: 'Miami, FL', tempRange: [65, 95] },
        { name: 'Seattle, WA', tempRange: [40, 75] },
        { name: 'Denver, CO', tempRange: [25, 80] },
    ];
    const city = cities[Math.floor(Math.random() * cities.length)];
    const temp = Math.floor(Math.random() * (city.tempRange[1] - city.tempRange[0])) + city.tempRange[0];
    return {
        location: city.name,
        timestamp: new Date().toISOString(),
        current: {
            temperature: temp,
            temperatureUnit: 'F',
            conditions: conditions[Math.floor(Math.random() * conditions.length)],
            humidity: Math.floor(Math.random() * 60) + 30,
            windSpeed: Math.floor(Math.random() * 25) + 5,
            windUnit: 'mph',
            uvIndex: Math.floor(Math.random() * 11),
        },
        forecast: Array.from({ length: 5 }, (_, i) => ({
            day: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'short' }),
            conditions: conditions[Math.floor(Math.random() * conditions.length)],
            high: temp + Math.floor(Math.random() * 10),
            low: temp - Math.floor(Math.random() * 15),
        })),
        source: 'x402-weather-service',
        premium: true,
    };
}
/**
 * Generates dynamic market analysis data
 */
function generateMarketData() {
    const cryptos = [
        { symbol: 'BTC', name: 'Bitcoin', basePrice: 98000 },
        { symbol: 'ETH', name: 'Ethereum', basePrice: 3800 },
        { symbol: 'SOL', name: 'Solana', basePrice: 145 },
        { symbol: 'AVAX', name: 'Avalanche', basePrice: 42 },
        { symbol: 'MATIC', name: 'Polygon', basePrice: 0.85 },
    ];
    const markets = {};
    for (const crypto of cryptos) {
        const changePercent = (Math.random() * 10 - 5).toFixed(2);
        const price = crypto.basePrice * (1 + parseFloat(changePercent) / 100);
        const volume = (Math.random() * 30 + 5).toFixed(1);
        markets[crypto.symbol] = {
            name: crypto.name,
            price: price.toFixed(2),
            change24h: `${parseFloat(changePercent) >= 0 ? '+' : ''}${changePercent}%`,
            volume24h: `$${volume}B`,
            marketCap: `$${(price * (crypto.symbol === 'BTC' ? 19.5 : crypto.symbol === 'ETH' ? 120 : 400)).toFixed(0)}M`,
        };
    }
    const sentiments = ['Bullish', 'Bearish', 'Neutral', 'Very Bullish', 'Cautiously Optimistic'];
    return {
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        markets,
        analysis: {
            overallSentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
            summary: 'Market showing mixed signals with major cryptocurrencies experiencing varied momentum. Technical indicators suggest potential consolidation phase.',
            keyEvents: [
                'Federal Reserve meeting scheduled for next week',
                'Major protocol upgrade announced for Ethereum',
                'Institutional adoption continues to grow',
            ],
            riskLevel: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)],
        },
        source: 'x402-market-service',
        premium: true,
    };
}
/**
 * Content generators registry
 */
const CONTENT_GENERATORS = {
    weather: generateWeatherData,
    market: generateMarketData,
};
// ============================================================================
// S3 Content Fetching
// ============================================================================
/**
 * S3 client for fetching content from S3 buckets
 * Lambda@Edge runs in us-east-1, so we use that region
 */
const s3Client = new client_s3_1.S3Client({ region: 'us-east-1' });
/**
 * Cache for S3 content to reduce latency on repeated requests
 * Note: Lambda@Edge instances may be reused, so this provides some caching benefit
 */
const s3ContentCache = new Map();
/**
 * Cache TTL in milliseconds (5 minutes)
 */
const S3_CACHE_TTL_MS = 5 * 60 * 1000;
/**
 * Fetches content from S3 bucket
 * @param bucket - S3 bucket name
 * @param key - S3 object key
 * @returns The content from S3 or an error object
 */
async function fetchS3Content(bucket, key) {
    const cacheKey = `${bucket}/${key}`;
    // Check cache first
    const cached = s3ContentCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < S3_CACHE_TTL_MS) {
        return cached.data;
    }
    try {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });
        const response = await s3Client.send(command);
        if (!response.Body) {
            return { error: 'Empty response from S3', bucket, key };
        }
        // Read the stream and convert to string
        const bodyContents = await response.Body.transformToString();
        // Try to parse as JSON, otherwise return as string
        let content;
        try {
            content = JSON.parse(bodyContents);
        }
        catch {
            // Not JSON, return as-is wrapped in an object
            content = {
                type: 'text',
                content: bodyContents,
                mimeType: response.ContentType || 'text/plain',
            };
        }
        // Cache the result
        s3ContentCache.set(cacheKey, { data: content, timestamp: Date.now() });
        return content;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to fetch S3 content: ${bucket}/${key}`, error);
        return {
            error: 'Failed to fetch S3 content',
            bucket,
            key,
            message: errorMessage,
        };
    }
}
/**
 * Clears the S3 content cache
 * Useful for testing or when content needs to be refreshed
 */
function clearS3Cache() {
    s3ContentCache.clear();
}
// ============================================================================
// Content Manager
// ============================================================================
/**
 * Content Manager class for handling dynamic content
 */
class ContentManager {
    constructor(registry = exports.DEFAULT_CONTENT_REGISTRY) {
        this.registry = registry;
    }
    /**
     * Gets payment requirements for a given path
     */
    getPaymentRequirements(path) {
        const item = this.registry.items[path];
        return item?.pricing || null;
    }
    /**
     * Gets content for a given path
     */
    async getContent(path) {
        const item = this.registry.items[path];
        if (!item) {
            return { error: 'Content not found', path };
        }
        switch (item.source.type) {
            case 'inline':
                return item.source.data;
            case 'dynamic':
                const generator = CONTENT_GENERATORS[item.source.generator];
                if (generator) {
                    return generator();
                }
                return { error: 'Generator not found', generator: item.source.generator };
            case 's3':
                // Fetch content from S3 bucket
                return await fetchS3Content(item.source.bucket, item.source.key);
            default:
                return { error: 'Unknown content source type' };
        }
    }
    /**
     * Gets content item metadata
     */
    getContentItem(path) {
        return this.registry.items[path] || null;
    }
    /**
     * Lists all available content paths
     */
    listContentPaths() {
        return Object.keys(this.registry.items);
    }
    /**
     * Checks if a path requires payment
     */
    requiresPayment(path) {
        return path in this.registry.items;
    }
    /**
     * Gets the content registry version
     */
    getVersion() {
        return this.registry.version;
    }
    /**
     * Adds or updates a content item
     */
    setContentItem(item) {
        this.registry.items[item.path] = item;
    }
    /**
     * Removes a content item
     */
    removeContentItem(path) {
        if (path in this.registry.items) {
            delete this.registry.items[path];
            return true;
        }
        return false;
    }
}
exports.ContentManager = ContentManager;
// ============================================================================
// Singleton Instance
// ============================================================================
/**
 * Default content manager instance
 */
exports.contentManager = new ContentManager();
/**
 * Sets the S3 bucket name for all S3-backed content items.
 * Called at runtime from the Lambda handler using the CloudFront origin domain.
 */
function setContentBucket(bucketName) {
    DEFAULT_CONTENT_BUCKET = bucketName;
    for (const item of Object.values(exports.contentManager['registry'].items)) {
        if (item.source.type === 's3') {
            item.source.bucket = bucketName;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC1jb25maWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjb250ZW50LWNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7O0dBUUc7OztBQTZGSCw4REFrQkM7QUFzVUQsb0NBRUM7QUFrSEQsNENBT0M7QUE3aUJELGtEQUFnRTtBQW9EaEUsK0VBQStFO0FBQy9FLHdCQUF3QjtBQUN4QiwrRUFBK0U7QUFFL0U7Ozs7R0FJRztBQUNILElBQUksWUFBWSxHQUF1QixFQUFFLENBQUM7QUFDMUMsSUFBSSxDQUFDO0lBQ0gsWUFBWSxHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0FBQ2pELENBQUM7QUFBQyxNQUFNLENBQUM7SUFDUCxnREFBZ0Q7QUFDbEQsQ0FBQztBQUNELE1BQU0sY0FBYyxHQUFHLFlBQVksQ0FBQyxLQUFLLElBQUksNENBQTRDLENBQUM7QUFFMUY7OztHQUdHO0FBQ0gsTUFBTSxlQUFlLEdBQUcsY0FBYyxDQUFDO0FBRXZDOztHQUVHO0FBQ0gsTUFBTSxhQUFhLEdBQUcsNENBQTRDLENBQUM7QUFFbkU7Ozs7R0FJRztBQUNILElBQUksc0JBQXNCLEdBQUcsRUFBRSxDQUFDO0FBRWhDOztHQUVHO0FBQ0gsU0FBZ0IseUJBQXlCLENBQ3ZDLE1BQWMsRUFDZCxTQUF3QztJQUV4QyxPQUFPO1FBQ0wsTUFBTSxFQUFFLE9BQU87UUFDZixPQUFPLEVBQUUsZUFBZTtRQUN4QixNQUFNO1FBQ04sS0FBSyxFQUFFLGFBQWE7UUFDcEIsS0FBSyxFQUFFLGNBQWM7UUFDckIsaUJBQWlCLEVBQUUsRUFBRTtRQUNyQixLQUFLLEVBQUU7WUFDTCxJQUFJLEVBQUUsTUFBTTtZQUNaLE9BQU8sRUFBRSxHQUFHO1lBQ1osbUJBQW1CLEVBQUUsU0FBUztTQUMvQjtRQUNELEdBQUcsU0FBUztLQUNiLENBQUM7QUFDSixDQUFDO0FBRUQsK0VBQStFO0FBQy9FLDJCQUEyQjtBQUMzQiwrRUFBK0U7QUFFL0U7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TyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNqQyxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFDRCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7Q0FDRjtBQTFGRCx3Q0EwRkM7QUFFRCwrRUFBK0U7QUFDL0UscUJBQXFCO0FBQ3JCLCtFQUErRTtBQUUvRTs7R0FFRztBQUNVLFFBQUEsY0FBYyxHQUFHLElBQUksY0FBYyxFQUFFLENBQUM7QUFFbkQ7OztHQUdHO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsVUFBa0I7SUFDakQsc0JBQXNCLEdBQUcsVUFBVSxDQUFDO0lBQ3BDLEtBQUssTUFBTSxJQUFJLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxzQkFBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDbkUsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUM5QixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxVQUFVLENBQUM7UUFDbEMsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBEeW5hbWljIENvbnRlbnQgQ29uZmlndXJhdGlvbiBNb2R1bGVcbiAqIFxuICogVGhpcyBtb2R1bGUgcHJvdmlkZXMgZHluYW1pYyBjb250ZW50IGFuZCBwcmljaW5nIGNvbmZpZ3VyYXRpb24gZm9yIHRoZSB4NDAyIHBheW1lbnQgdmVyaWZpZXIuXG4gKiBDb250ZW50IGNhbiBiZSBsb2FkZWQgZnJvbTpcbiAqIDEuIFN0YXRpYyBjb25maWd1cmF0aW9uIChkZWZhdWx0KVxuICogMi4gRW52aXJvbm1lbnQgdmFyaWFibGVzIChmb3IgcHJpY2luZyBvdmVycmlkZXMpXG4gKiAzLiBTMyBidWNrZXQgKGZvciBkeW5hbWljIGNvbnRlbnQpXG4gKi9cblxuaW1wb3J0IHsgUGF5bWVudFJlcXVpcmVtZW50cyB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgUzNDbGllbnQsIEdldE9iamVjdENvbW1hbmQgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtczMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBDb250ZW50IENvbmZpZ3VyYXRpb24gVHlwZXNcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBDb250ZW50IGl0ZW0gd2l0aCBtZXRhZGF0YSBhbmQgcHJpY2luZ1xuICovXG5leHBvcnQgaW50ZXJmYWNlIENvbnRlbnRJdGVtIHtcbiAgLyoqIFVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgY29udGVudCAqL1xuICBpZDogc3RyaW5nO1xuICAvKiogVVJMIHBhdGggZm9yIHRoZSBjb250ZW50ICovXG4gIHBhdGg6IHN0cmluZztcbiAgLyoqIEh1bWFuLXJlYWRhYmxlIHRpdGxlICovXG4gIHRpdGxlOiBzdHJpbmc7XG4gIC8qKiBDb250ZW50IGRlc2NyaXB0aW9uICovXG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gIC8qKiBNSU1FIHR5cGUgb2YgdGhlIGNvbnRlbnQgKi9cbiAgbWltZVR5cGU6IHN0cmluZztcbiAgLyoqIFBheW1lbnQgcmVxdWlyZW1lbnRzIGZvciB0aGlzIGNvbnRlbnQgKi9cbiAgcHJpY2luZzogUGF5bWVudFJlcXVpcmVtZW50cztcbiAgLyoqIENvbnRlbnQgc291cmNlIC0gaW5saW5lIGRhdGEgb3IgUzMgcmVmZXJlbmNlICovXG4gIHNvdXJjZTogQ29udGVudFNvdXJjZTtcbiAgLyoqIE9wdGlvbmFsIG1ldGFkYXRhICovXG4gIG1ldGFkYXRhPzogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG59XG5cbi8qKlxuICogQ29udGVudCBzb3VyY2UgLSBlaXRoZXIgaW5saW5lIGRhdGEgb3IgUzMgcmVmZXJlbmNlXG4gKi9cbmV4cG9ydCB0eXBlIENvbnRlbnRTb3VyY2UgPSBcbiAgfCB7IHR5cGU6ICdpbmxpbmUnOyBkYXRhOiB1bmtub3duIH1cbiAgfCB7IHR5cGU6ICdzMyc7IGJ1Y2tldDogc3RyaW5nOyBrZXk6IHN0cmluZyB9XG4gIHwgeyB0eXBlOiAnZHluYW1pYyc7IGdlbmVyYXRvcjogc3RyaW5nIH07XG5cbi8qKlxuICogQ29udGVudCByZWdpc3RyeSBmb3IgbWFuYWdpbmcgYWxsIGF2YWlsYWJsZSBjb250ZW50XG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ29udGVudFJlZ2lzdHJ5IHtcbiAgLyoqIFZlcnNpb24gb2YgdGhlIGNvbmZpZ3VyYXRpb24gKi9cbiAgdmVyc2lvbjogc3RyaW5nO1xuICAvKiogRGVmYXVsdCBwYXltZW50IHJlY2lwaWVudCBhZGRyZXNzICovXG4gIGRlZmF1bHRQYXlUbzogc3RyaW5nO1xuICAvKiogRGVmYXVsdCBuZXR3b3JrIGZvciBwYXltZW50cyAqL1xuICBkZWZhdWx0TmV0d29yazogc3RyaW5nO1xuICAvKiogRGVmYXVsdCBhc3NldCBmb3IgcGF5bWVudHMgKi9cbiAgZGVmYXVsdEFzc2V0OiBzdHJpbmc7XG4gIC8qKiBDb250ZW50IGl0ZW1zIGluZGV4ZWQgYnkgcGF0aCAqL1xuICBpdGVtczogUmVjb3JkPHN0cmluZywgQ29udGVudEl0ZW0+O1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBEZWZhdWx0IENvbmZpZ3VyYXRpb25cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBEZWZhdWx0IHBheW1lbnQgcmVjaXBpZW50IGFkZHJlc3NcbiAqIENhbiBiZSBvdmVycmlkZGVuIHZpYSBQQVlNRU5UX1JFQ0lQSUVOVF9BRERSRVNTIGluIHNlbGxlci1pbmZyYXN0cnVjdHVyZS8uZW52XG4gKiBDREsgaW5qZWN0cyB0aGUgdmFsdWUgaW50byBkZXBsb3ktY29uZmlnLmpzb24gYXQgYnVpbGQgdGltZVxuICovXG5sZXQgZGVwbG95Q29uZmlnOiB7IHBheVRvPzogc3RyaW5nIH0gPSB7fTtcbnRyeSB7XG4gIGRlcGxveUNvbmZpZyA9IHJlcXVpcmUoJy4vZGVwbG95LWNvbmZpZy5qc29uJyk7XG59IGNhdGNoIHtcbiAgLy8gTm8gZGVwbG95LWNvbmZpZy5qc29uIOKAlCB1c2UgaGFyZGNvZGVkIGRlZmF1bHRcbn1cbmNvbnN0IERFRkFVTFRfUEFZX1RPID0gZGVwbG95Q29uZmlnLnBheVRvIHx8ICcweDI0ODQyRjMxMzZGYTJhM2RmODM1ZDM2YjRjM2NiNDk3MmQ0MDU1MDInO1xuXG4vKipcbiAqIERlZmF1bHQgbmV0d29yayAoQmFzZSBTZXBvbGlhIHRlc3RuZXQpXG4gKiBVc2UgJ2VpcDE1NTo4NDUzJyBmb3IgQmFzZSBNYWlubmV0IGluIHByb2R1Y3Rpb25cbiAqL1xuY29uc3QgREVGQVVMVF9ORVRXT1JLID0gJ2VpcDE1NTo4NDUzMic7XG5cbi8qKlxuICogRGVmYXVsdCBhc3NldCAoVVNEQyBvbiBCYXNlIFNlcG9saWEpXG4gKi9cbmNvbnN0IERFRkFVTFRfQVNTRVQgPSAnMHgwMzZDYkQ1Mzg0MmM1NDI2NjM0ZTc5Mjk1NDFlQzIzMThmM2RDRjdlJztcblxuLyoqXG4gKiBEZWZhdWx0IFMzIGJ1Y2tldCBmb3IgY29udGVudCBzdG9yYWdlXG4gKiBTZXQgYXQgcnVudGltZSBmcm9tIHRoZSBDbG91ZEZyb250IG9yaWdpbiBldmVudCB2aWEgc2V0Q29udGVudEJ1Y2tldCgpXG4gKiBMYW1iZGFARWRnZSBkb2Vzbid0IHN1cHBvcnQgZW52aXJvbm1lbnQgdmFyaWFibGVzLCBzbyB0aGlzIGlzIHJlc29sdmVkIGR5bmFtaWNhbGx5XG4gKi9cbmxldCBERUZBVUxUX0NPTlRFTlRfQlVDS0VUID0gJyc7XG5cbi8qKlxuICogQ3JlYXRlcyBkZWZhdWx0IHBheW1lbnQgcmVxdWlyZW1lbnRzIHdpdGggb3B0aW9uYWwgb3ZlcnJpZGVzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQYXltZW50UmVxdWlyZW1lbnRzKFxuICBhbW91bnQ6IHN0cmluZyxcbiAgb3ZlcnJpZGVzPzogUGFydGlhbDxQYXltZW50UmVxdWlyZW1lbnRzPlxuKTogUGF5bWVudFJlcXVpcmVtZW50cyB7XG4gIHJldHVybiB7XG4gICAgc2NoZW1lOiAnZXhhY3QnLFxuICAgIG5ldHdvcms6IERFRkFVTFRfTkVUV09SSyxcbiAgICBhbW91bnQsXG4gICAgYXNzZXQ6IERFRkFVTFRfQVNTRVQsXG4gICAgcGF5VG86IERFRkFVTFRfUEFZX1RPLFxuICAgIG1heFRpbWVvdXRTZWNvbmRzOiA2MCxcbiAgICBleHRyYToge1xuICAgICAgbmFtZTogJ1VTREMnLFxuICAgICAgdmVyc2lvbjogJzInLFxuICAgICAgYXNzZXRUcmFuc2Zlck1ldGhvZDogJ2VpcDMwMDknLFxuICAgIH0sXG4gICAgLi4ub3ZlcnJpZGVzLFxuICB9O1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBEZWZhdWx0IENvbnRlbnQgUmVnaXN0cnlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBEZWZhdWx0IGNvbnRlbnQgcmVnaXN0cnkgd2l0aCBzdGF0aWMgY29udGVudFxuICovXG5leHBvcnQgY29uc3QgREVGQVVMVF9DT05URU5UX1JFR0lTVFJZOiBDb250ZW50UmVnaXN0cnkgPSB7XG4gIHZlcnNpb246ICcxLjAuMCcsXG4gIGRlZmF1bHRQYXlUbzogREVGQVVMVF9QQVlfVE8sXG4gIGRlZmF1bHROZXR3b3JrOiBERUZBVUxUX05FVFdPUkssXG4gIGRlZmF1bHRBc3NldDogREVGQVVMVF9BU1NFVCxcbiAgaXRlbXM6IHtcbiAgICAvLyBSb290LWxldmVsIGNvbnRlbnQgcGF0aHMgKGZvciBkaXJlY3QgYWNjZXNzKVxuICAgICcvcmVzZWFyY2gtcmVwb3J0Jzoge1xuICAgICAgaWQ6ICdyZXNlYXJjaC1yZXBvcnQnLFxuICAgICAgcGF0aDogJy9yZXNlYXJjaC1yZXBvcnQnLFxuICAgICAgdGl0bGU6ICdCbG9ja2NoYWluIFJlc2VhcmNoIFJlcG9ydCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ0luLWRlcHRoIHJlc2VhcmNoIHJlcG9ydCBvbiBibG9ja2NoYWluIHRlY2hub2xvZ3kgdHJlbmRzJyxcbiAgICAgIG1pbWVUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICBwcmljaW5nOiBjcmVhdGVQYXltZW50UmVxdWlyZW1lbnRzKCc1MDAwJyksXG4gICAgICBzb3VyY2U6IHtcbiAgICAgICAgdHlwZTogJ3MzJyxcbiAgICAgICAgYnVja2V0OiBERUZBVUxUX0NPTlRFTlRfQlVDS0VULFxuICAgICAgICBrZXk6ICdyZXNlYXJjaC1yZXBvcnQnLFxuICAgICAgfSxcbiAgICB9LFxuICAgICcvZGF0YXNldCc6IHtcbiAgICAgIGlkOiAnZGF0YXNldCcsXG4gICAgICBwYXRoOiAnL2RhdGFzZXQnLFxuICAgICAgdGl0bGU6ICdQcmVtaXVtIERhdGFzZXQnLFxuICAgICAgZGVzY3JpcHRpb246ICdDdXJhdGVkIGRhdGFzZXQgZm9yIG1hY2hpbmUgbGVhcm5pbmcgYW5kIGFuYWx5dGljcycsXG4gICAgICBtaW1lVHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgcHJpY2luZzogY3JlYXRlUGF5bWVudFJlcXVpcmVtZW50cygnMTAwMDAnKSxcbiAgICAgIHNvdXJjZToge1xuICAgICAgICB0eXBlOiAnczMnLFxuICAgICAgICBidWNrZXQ6IERFRkFVTFRfQ09OVEVOVF9CVUNLRVQsXG4gICAgICAgIGtleTogJ2RhdGFzZXQnLFxuICAgICAgfSxcbiAgICB9LFxuICAgICcvdHV0b3JpYWwnOiB7XG4gICAgICBpZDogJ3R1dG9yaWFsJyxcbiAgICAgIHBhdGg6ICcvdHV0b3JpYWwnLFxuICAgICAgdGl0bGU6ICdBZHZhbmNlZCBTbWFydCBDb250cmFjdCBUdXRvcmlhbCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ1N0ZXAtYnktc3RlcCBndWlkZSB0byBidWlsZGluZyBhZHZhbmNlZCBzbWFydCBjb250cmFjdHMnLFxuICAgICAgbWltZVR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIHByaWNpbmc6IGNyZWF0ZVBheW1lbnRSZXF1aXJlbWVudHMoJzMwMDAnKSxcbiAgICAgIHNvdXJjZToge1xuICAgICAgICB0eXBlOiAnczMnLFxuICAgICAgICBidWNrZXQ6IERFRkFVTFRfQ09OVEVOVF9CVUNLRVQsXG4gICAgICAgIGtleTogJ3R1dG9yaWFsJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgICAvLyBBUEktcHJlZml4ZWQgcGF0aHMgKGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSlcbiAgICAnL2FwaS9wcmVtaXVtLWFydGljbGUnOiB7XG4gICAgICBpZDogJ3ByZW1pdW0tYXJ0aWNsZScsXG4gICAgICBwYXRoOiAnL2FwaS9wcmVtaXVtLWFydGljbGUnLFxuICAgICAgdGl0bGU6ICdUaGUgRnV0dXJlIG9mIEFJIGFuZCBCbG9ja2NoYWluIEludGVncmF0aW9uJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHJlbWl1bSBhcnRpY2xlIGFib3V0IEFJIGFuZCBibG9ja2NoYWluIGNvbnZlcmdlbmNlJyxcbiAgICAgIG1pbWVUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICBwcmljaW5nOiBjcmVhdGVQYXltZW50UmVxdWlyZW1lbnRzKCcxMDAwJyksXG4gICAgICBzb3VyY2U6IHtcbiAgICAgICAgdHlwZTogJ2lubGluZScsXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICB0aXRsZTogJ1RoZSBGdXR1cmUgb2YgQUkgYW5kIEJsb2NrY2hhaW4gSW50ZWdyYXRpb24nLFxuICAgICAgICAgIGF1dGhvcjogJ1RlY2ggSW5zaWdodHMnLFxuICAgICAgICAgIGRhdGU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zcGxpdCgnVCcpWzBdLFxuICAgICAgICAgIGNvbnRlbnQ6ICdBcnRpZmljaWFsIEludGVsbGlnZW5jZSBhbmQgQmxvY2tjaGFpbiBhcmUgY29udmVyZ2luZyB0byBjcmVhdGUgdW5wcmVjZWRlbnRlZCBvcHBvcnR1bml0aWVzLi4uJyxcbiAgICAgICAgICBmdWxsVGV4dDogJ1RoaXMgaXMgcHJlbWl1bSBjb250ZW50IHRoYXQgcmVxdWlyZXMgcGF5bWVudCB0byBhY2Nlc3MuIFRoZSBpbnRlZ3JhdGlvbiBvZiBBSSBhbmQgYmxvY2tjaGFpbiB0ZWNobm9sb2d5IGlzIHJldm9sdXRpb25pemluZyBob3cgd2UgdGhpbmsgYWJvdXQgZGVjZW50cmFsaXplZCBzeXN0ZW1zLCBzbWFydCBjb250cmFjdHMsIGFuZCBhdXRvbm9tb3VzIGFnZW50cy4gS2V5IGFyZWFzIG9mIGlubm92YXRpb24gaW5jbHVkZTogMSkgRGVjZW50cmFsaXplZCBBSSB0cmFpbmluZywgMikgU21hcnQgY29udHJhY3QgYXV0b21hdGlvbiwgMykgVG9rZW5pemVkIEFJIHNlcnZpY2VzLCA0KSBQcml2YWN5LXByZXNlcnZpbmcgY29tcHV0YXRpb24uJyxcbiAgICAgICAgICB0YWdzOiBbJ0FJJywgJ2Jsb2NrY2hhaW4nLCAndGVjaG5vbG9neScsICdpbm5vdmF0aW9uJ10sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgJy9hcGkvd2VhdGhlci1kYXRhJzoge1xuICAgICAgaWQ6ICd3ZWF0aGVyLWRhdGEnLFxuICAgICAgcGF0aDogJy9hcGkvd2VhdGhlci1kYXRhJyxcbiAgICAgIHRpdGxlOiAnUmVhbC10aW1lIFdlYXRoZXIgRGF0YScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0N1cnJlbnQgd2VhdGhlciBjb25kaXRpb25zIGFuZCBmb3JlY2FzdCcsXG4gICAgICBtaW1lVHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgcHJpY2luZzogY3JlYXRlUGF5bWVudFJlcXVpcmVtZW50cygnNTAwJyksXG4gICAgICBzb3VyY2U6IHtcbiAgICAgICAgdHlwZTogJ2R5bmFtaWMnLFxuICAgICAgICBnZW5lcmF0b3I6ICd3ZWF0aGVyJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgICAnL2FwaS9tYXJrZXQtYW5hbHlzaXMnOiB7XG4gICAgICBpZDogJ21hcmtldC1hbmFseXNpcycsXG4gICAgICBwYXRoOiAnL2FwaS9tYXJrZXQtYW5hbHlzaXMnLFxuICAgICAgdGl0bGU6ICdDcnlwdG9jdXJyZW5jeSBNYXJrZXQgQW5hbHlzaXMnLFxuICAgICAgZGVzY3JpcHRpb246ICdSZWFsLXRpbWUgbWFya2V0IGRhdGEgYW5kIGFuYWx5c2lzJyxcbiAgICAgIG1pbWVUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICBwcmljaW5nOiBjcmVhdGVQYXltZW50UmVxdWlyZW1lbnRzKCcyMDAwJyksXG4gICAgICBzb3VyY2U6IHtcbiAgICAgICAgdHlwZTogJ2R5bmFtaWMnLFxuICAgICAgICBnZW5lcmF0b3I6ICdtYXJrZXQnLFxuICAgICAgfSxcbiAgICB9LFxuICAgIC8vIFMzLWJhY2tlZCBjb250ZW50IGl0ZW1zIHdpdGggL2FwaS8gcHJlZml4XG4gICAgJy9hcGkvcmVzZWFyY2gtcmVwb3J0Jzoge1xuICAgICAgaWQ6ICdhcGktcmVzZWFyY2gtcmVwb3J0JyxcbiAgICAgIHBhdGg6ICcvYXBpL3Jlc2VhcmNoLXJlcG9ydCcsXG4gICAgICB0aXRsZTogJ0Jsb2NrY2hhaW4gUmVzZWFyY2ggUmVwb3J0JyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnSW4tZGVwdGggcmVzZWFyY2ggcmVwb3J0IG9uIGJsb2NrY2hhaW4gdGVjaG5vbG9neSB0cmVuZHMnLFxuICAgICAgbWltZVR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIHByaWNpbmc6IGNyZWF0ZVBheW1lbnRSZXF1aXJlbWVudHMoJzUwMDAnKSxcbiAgICAgIHNvdXJjZToge1xuICAgICAgICB0eXBlOiAnczMnLFxuICAgICAgICBidWNrZXQ6IERFRkFVTFRfQ09OVEVOVF9CVUNLRVQsXG4gICAgICAgIGtleTogJ3Jlc2VhcmNoLXJlcG9ydCcsXG4gICAgICB9LFxuICAgIH0sXG4gICAgJy9hcGkvZGF0YXNldCc6IHtcbiAgICAgIGlkOiAnYXBpLWRhdGFzZXQnLFxuICAgICAgcGF0aDogJy9hcGkvZGF0YXNldCcsXG4gICAgICB0aXRsZTogJ1ByZW1pdW0gRGF0YXNldCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ0N1cmF0ZWQgZGF0YXNldCBmb3IgbWFjaGluZSBsZWFybmluZyBhbmQgYW5hbHl0aWNzJyxcbiAgICAgIG1pbWVUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICBwcmljaW5nOiBjcmVhdGVQYXltZW50UmVxdWlyZW1lbnRzKCcxMDAwMCcpLFxuICAgICAgc291cmNlOiB7XG4gICAgICAgIHR5cGU6ICdzMycsXG4gICAgICAgIGJ1Y2tldDogREVGQVVMVF9DT05URU5UX0JVQ0tFVCxcbiAgICAgICAga2V5OiAnZGF0YXNldCcsXG4gICAgICB9LFxuICAgIH0sXG4gICAgJy9hcGkvdHV0b3JpYWwnOiB7XG4gICAgICBpZDogJ2FwaS10dXRvcmlhbCcsXG4gICAgICBwYXRoOiAnL2FwaS90dXRvcmlhbCcsXG4gICAgICB0aXRsZTogJ0FkdmFuY2VkIFNtYXJ0IENvbnRyYWN0IFR1dG9yaWFsJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU3RlcC1ieS1zdGVwIGd1aWRlIHRvIGJ1aWxkaW5nIGFkdmFuY2VkIHNtYXJ0IGNvbnRyYWN0cycsXG4gICAgICBtaW1lVHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgcHJpY2luZzogY3JlYXRlUGF5bWVudFJlcXVpcmVtZW50cygnMzAwMCcpLFxuICAgICAgc291cmNlOiB7XG4gICAgICAgIHR5cGU6ICdzMycsXG4gICAgICAgIGJ1Y2tldDogREVGQVVMVF9DT05URU5UX0JVQ0tFVCxcbiAgICAgICAga2V5OiAndHV0b3JpYWwnLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gRHluYW1pYyBDb250ZW50IEdlbmVyYXRvcnNcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgZHluYW1pYyB3ZWF0aGVyIGRhdGFcbiAqL1xuZnVuY3Rpb24gZ2VuZXJhdGVXZWF0aGVyRGF0YSgpOiB1bmtub3duIHtcbiAgY29uc3QgY29uZGl0aW9ucyA9IFsnU3VubnknLCAnUGFydGx5IENsb3VkeScsICdDbG91ZHknLCAnUmFpbicsICdUaHVuZGVyc3Rvcm0nLCAnU25vdycsICdGb2cnXTtcbiAgY29uc3QgY2l0aWVzID0gW1xuICAgIHsgbmFtZTogJ1NhbiBGcmFuY2lzY28sIENBJywgdGVtcFJhbmdlOiBbNTAsIDcwXSB9LFxuICAgIHsgbmFtZTogJ05ldyBZb3JrLCBOWScsIHRlbXBSYW5nZTogWzMwLCA4NV0gfSxcbiAgICB7IG5hbWU6ICdNaWFtaSwgRkwnLCB0ZW1wUmFuZ2U6IFs2NSwgOTVdIH0sXG4gICAgeyBuYW1lOiAnU2VhdHRsZSwgV0EnLCB0ZW1wUmFuZ2U6IFs0MCwgNzVdIH0sXG4gICAgeyBuYW1lOiAnRGVudmVyLCBDTycsIHRlbXBSYW5nZTogWzI1LCA4MF0gfSxcbiAgXTtcbiAgXG4gIGNvbnN0IGNpdHkgPSBjaXRpZXNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogY2l0aWVzLmxlbmd0aCldO1xuICBjb25zdCB0ZW1wID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKGNpdHkudGVtcFJhbmdlWzFdIC0gY2l0eS50ZW1wUmFuZ2VbMF0pKSArIGNpdHkudGVtcFJhbmdlWzBdO1xuICBcbiAgcmV0dXJuIHtcbiAgICBsb2NhdGlvbjogY2l0eS5uYW1lLFxuICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIGN1cnJlbnQ6IHtcbiAgICAgIHRlbXBlcmF0dXJlOiB0ZW1wLFxuICAgICAgdGVtcGVyYXR1cmVVbml0OiAnRicsXG4gICAgICBjb25kaXRpb25zOiBjb25kaXRpb25zW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGNvbmRpdGlvbnMubGVuZ3RoKV0sXG4gICAgICBodW1pZGl0eTogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogNjApICsgMzAsXG4gICAgICB3aW5kU3BlZWQ6IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDI1KSArIDUsXG4gICAgICB3aW5kVW5pdDogJ21waCcsXG4gICAgICB1dkluZGV4OiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMSksXG4gICAgfSxcbiAgICBmb3JlY2FzdDogQXJyYXkuZnJvbSh7IGxlbmd0aDogNSB9LCAoXywgaSkgPT4gKHtcbiAgICAgIGRheTogbmV3IERhdGUoRGF0ZS5ub3coKSArIChpICsgMSkgKiAyNCAqIDYwICogNjAgKiAxMDAwKS50b0xvY2FsZURhdGVTdHJpbmcoJ2VuLVVTJywgeyB3ZWVrZGF5OiAnc2hvcnQnIH0pLFxuICAgICAgY29uZGl0aW9uczogY29uZGl0aW9uc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBjb25kaXRpb25zLmxlbmd0aCldLFxuICAgICAgaGlnaDogdGVtcCArIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwKSxcbiAgICAgIGxvdzogdGVtcCAtIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDE1KSxcbiAgICB9KSksXG4gICAgc291cmNlOiAneDQwMi13ZWF0aGVyLXNlcnZpY2UnLFxuICAgIHByZW1pdW06IHRydWUsXG4gIH07XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGR5bmFtaWMgbWFya2V0IGFuYWx5c2lzIGRhdGFcbiAqL1xuZnVuY3Rpb24gZ2VuZXJhdGVNYXJrZXREYXRhKCk6IHVua25vd24ge1xuICBjb25zdCBjcnlwdG9zID0gW1xuICAgIHsgc3ltYm9sOiAnQlRDJywgbmFtZTogJ0JpdGNvaW4nLCBiYXNlUHJpY2U6IDk4MDAwIH0sXG4gICAgeyBzeW1ib2w6ICdFVEgnLCBuYW1lOiAnRXRoZXJldW0nLCBiYXNlUHJpY2U6IDM4MDAgfSxcbiAgICB7IHN5bWJvbDogJ1NPTCcsIG5hbWU6ICdTb2xhbmEnLCBiYXNlUHJpY2U6IDE0NSB9LFxuICAgIHsgc3ltYm9sOiAnQVZBWCcsIG5hbWU6ICdBdmFsYW5jaGUnLCBiYXNlUHJpY2U6IDQyIH0sXG4gICAgeyBzeW1ib2w6ICdNQVRJQycsIG5hbWU6ICdQb2x5Z29uJywgYmFzZVByaWNlOiAwLjg1IH0sXG4gIF07XG4gIFxuICBjb25zdCBtYXJrZXRzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9O1xuICBcbiAgZm9yIChjb25zdCBjcnlwdG8gb2YgY3J5cHRvcykge1xuICAgIGNvbnN0IGNoYW5nZVBlcmNlbnQgPSAoTWF0aC5yYW5kb20oKSAqIDEwIC0gNSkudG9GaXhlZCgyKTtcbiAgICBjb25zdCBwcmljZSA9IGNyeXB0by5iYXNlUHJpY2UgKiAoMSArIHBhcnNlRmxvYXQoY2hhbmdlUGVyY2VudCkgLyAxMDApO1xuICAgIGNvbnN0IHZvbHVtZSA9IChNYXRoLnJhbmRvbSgpICogMzAgKyA1KS50b0ZpeGVkKDEpO1xuICAgIFxuICAgIG1hcmtldHNbY3J5cHRvLnN5bWJvbF0gPSB7XG4gICAgICBuYW1lOiBjcnlwdG8ubmFtZSxcbiAgICAgIHByaWNlOiBwcmljZS50b0ZpeGVkKDIpLFxuICAgICAgY2hhbmdlMjRoOiBgJHtwYXJzZUZsb2F0KGNoYW5nZVBlcmNlbnQpID49IDAgPyAnKycgOiAnJ30ke2NoYW5nZVBlcmNlbnR9JWAsXG4gICAgICB2b2x1bWUyNGg6IGAkJHt2b2x1bWV9QmAsXG4gICAgICBtYXJrZXRDYXA6IGAkJHsocHJpY2UgKiAoY3J5cHRvLnN5bWJvbCA9PT0gJ0JUQycgPyAxOS41IDogY3J5cHRvLnN5bWJvbCA9PT0gJ0VUSCcgPyAxMjAgOiA0MDApKS50b0ZpeGVkKDApfU1gLFxuICAgIH07XG4gIH1cbiAgXG4gIGNvbnN0IHNlbnRpbWVudHMgPSBbJ0J1bGxpc2gnLCAnQmVhcmlzaCcsICdOZXV0cmFsJywgJ1ZlcnkgQnVsbGlzaCcsICdDYXV0aW91c2x5IE9wdGltaXN0aWMnXTtcbiAgXG4gIHJldHVybiB7XG4gICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnNwbGl0KCdUJylbMF0sXG4gICAgbWFya2V0cyxcbiAgICBhbmFseXNpczoge1xuICAgICAgb3ZlcmFsbFNlbnRpbWVudDogc2VudGltZW50c1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBzZW50aW1lbnRzLmxlbmd0aCldLFxuICAgICAgc3VtbWFyeTogJ01hcmtldCBzaG93aW5nIG1peGVkIHNpZ25hbHMgd2l0aCBtYWpvciBjcnlwdG9jdXJyZW5jaWVzIGV4cGVyaWVuY2luZyB2YXJpZWQgbW9tZW50dW0uIFRlY2huaWNhbCBpbmRpY2F0b3JzIHN1Z2dlc3QgcG90ZW50aWFsIGNvbnNvbGlkYXRpb24gcGhhc2UuJyxcbiAgICAgIGtleUV2ZW50czogW1xuICAgICAgICAnRmVkZXJhbCBSZXNlcnZlIG1lZXRpbmcgc2NoZWR1bGVkIGZvciBuZXh0IHdlZWsnLFxuICAgICAgICAnTWFqb3IgcHJvdG9jb2wgdXBncmFkZSBhbm5vdW5jZWQgZm9yIEV0aGVyZXVtJyxcbiAgICAgICAgJ0luc3RpdHV0aW9uYWwgYWRvcHRpb24gY29udGludWVzIHRvIGdyb3cnLFxuICAgICAgXSxcbiAgICAgIHJpc2tMZXZlbDogWydMb3cnLCAnTWVkaXVtJywgJ0hpZ2gnXVtNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAzKV0sXG4gICAgfSxcbiAgICBzb3VyY2U6ICd4NDAyLW1hcmtldC1zZXJ2aWNlJyxcbiAgICBwcmVtaXVtOiB0cnVlLFxuICB9O1xufVxuXG4vKipcbiAqIENvbnRlbnQgZ2VuZXJhdG9ycyByZWdpc3RyeVxuICovXG5jb25zdCBDT05URU5UX0dFTkVSQVRPUlM6IFJlY29yZDxzdHJpbmcsICgpID0+IHVua25vd24+ID0ge1xuICB3ZWF0aGVyOiBnZW5lcmF0ZVdlYXRoZXJEYXRhLFxuICBtYXJrZXQ6IGdlbmVyYXRlTWFya2V0RGF0YSxcbn07XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIFMzIENvbnRlbnQgRmV0Y2hpbmdcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBTMyBjbGllbnQgZm9yIGZldGNoaW5nIGNvbnRlbnQgZnJvbSBTMyBidWNrZXRzXG4gKiBMYW1iZGFARWRnZSBydW5zIGluIHVzLWVhc3QtMSwgc28gd2UgdXNlIHRoYXQgcmVnaW9uXG4gKi9cbmNvbnN0IHMzQ2xpZW50ID0gbmV3IFMzQ2xpZW50KHsgcmVnaW9uOiAndXMtZWFzdC0xJyB9KTtcblxuLyoqXG4gKiBDYWNoZSBmb3IgUzMgY29udGVudCB0byByZWR1Y2UgbGF0ZW5jeSBvbiByZXBlYXRlZCByZXF1ZXN0c1xuICogTm90ZTogTGFtYmRhQEVkZ2UgaW5zdGFuY2VzIG1heSBiZSByZXVzZWQsIHNvIHRoaXMgcHJvdmlkZXMgc29tZSBjYWNoaW5nIGJlbmVmaXRcbiAqL1xuY29uc3QgczNDb250ZW50Q2FjaGUgPSBuZXcgTWFwPHN0cmluZywgeyBkYXRhOiB1bmtub3duOyB0aW1lc3RhbXA6IG51bWJlciB9PigpO1xuXG4vKipcbiAqIENhY2hlIFRUTCBpbiBtaWxsaXNlY29uZHMgKDUgbWludXRlcylcbiAqL1xuY29uc3QgUzNfQ0FDSEVfVFRMX01TID0gNSAqIDYwICogMTAwMDtcblxuLyoqXG4gKiBGZXRjaGVzIGNvbnRlbnQgZnJvbSBTMyBidWNrZXRcbiAqIEBwYXJhbSBidWNrZXQgLSBTMyBidWNrZXQgbmFtZVxuICogQHBhcmFtIGtleSAtIFMzIG9iamVjdCBrZXlcbiAqIEByZXR1cm5zIFRoZSBjb250ZW50IGZyb20gUzMgb3IgYW4gZXJyb3Igb2JqZWN0XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGZldGNoUzNDb250ZW50KGJ1Y2tldDogc3RyaW5nLCBrZXk6IHN0cmluZyk6IFByb21pc2U8dW5rbm93bj4ge1xuICBjb25zdCBjYWNoZUtleSA9IGAke2J1Y2tldH0vJHtrZXl9YDtcbiAgXG4gIC8vIENoZWNrIGNhY2hlIGZpcnN0XG4gIGNvbnN0IGNhY2hlZCA9IHMzQ29udGVudENhY2hlLmdldChjYWNoZUtleSk7XG4gIGlmIChjYWNoZWQgJiYgRGF0ZS5ub3coKSAtIGNhY2hlZC50aW1lc3RhbXAgPCBTM19DQUNIRV9UVExfTVMpIHtcbiAgICByZXR1cm4gY2FjaGVkLmRhdGE7XG4gIH1cbiAgXG4gIHRyeSB7XG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBHZXRPYmplY3RDb21tYW5kKHtcbiAgICAgIEJ1Y2tldDogYnVja2V0LFxuICAgICAgS2V5OiBrZXksXG4gICAgfSk7XG4gICAgXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBzM0NsaWVudC5zZW5kKGNvbW1hbmQpO1xuICAgIFxuICAgIGlmICghcmVzcG9uc2UuQm9keSkge1xuICAgICAgcmV0dXJuIHsgZXJyb3I6ICdFbXB0eSByZXNwb25zZSBmcm9tIFMzJywgYnVja2V0LCBrZXkgfTtcbiAgICB9XG4gICAgXG4gICAgLy8gUmVhZCB0aGUgc3RyZWFtIGFuZCBjb252ZXJ0IHRvIHN0cmluZ1xuICAgIGNvbnN0IGJvZHlDb250ZW50cyA9IGF3YWl0IHJlc3BvbnNlLkJvZHkudHJhbnNmb3JtVG9TdHJpbmcoKTtcbiAgICBcbiAgICAvLyBUcnkgdG8gcGFyc2UgYXMgSlNPTiwgb3RoZXJ3aXNlIHJldHVybiBhcyBzdHJpbmdcbiAgICBsZXQgY29udGVudDogdW5rbm93bjtcbiAgICB0cnkge1xuICAgICAgY29udGVudCA9IEpTT04ucGFyc2UoYm9keUNvbnRlbnRzKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIE5vdCBKU09OLCByZXR1cm4gYXMtaXMgd3JhcHBlZCBpbiBhbiBvYmplY3RcbiAgICAgIGNvbnRlbnQgPSB7XG4gICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgY29udGVudDogYm9keUNvbnRlbnRzLFxuICAgICAgICBtaW1lVHlwZTogcmVzcG9uc2UuQ29udGVudFR5cGUgfHwgJ3RleHQvcGxhaW4nLFxuICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgLy8gQ2FjaGUgdGhlIHJlc3VsdFxuICAgIHMzQ29udGVudENhY2hlLnNldChjYWNoZUtleSwgeyBkYXRhOiBjb250ZW50LCB0aW1lc3RhbXA6IERhdGUubm93KCkgfSk7XG4gICAgXG4gICAgcmV0dXJuIGNvbnRlbnQ7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc3QgZXJyb3JNZXNzYWdlID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnVW5rbm93biBlcnJvcic7XG4gICAgY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIGZldGNoIFMzIGNvbnRlbnQ6ICR7YnVja2V0fS8ke2tleX1gLCBlcnJvcik7XG4gICAgcmV0dXJuIHtcbiAgICAgIGVycm9yOiAnRmFpbGVkIHRvIGZldGNoIFMzIGNvbnRlbnQnLFxuICAgICAgYnVja2V0LFxuICAgICAga2V5LFxuICAgICAgbWVzc2FnZTogZXJyb3JNZXNzYWdlLFxuICAgIH07XG4gIH1cbn1cblxuLyoqXG4gKiBDbGVhcnMgdGhlIFMzIGNvbnRlbnQgY2FjaGVcbiAqIFVzZWZ1bCBmb3IgdGVzdGluZyBvciB3aGVuIGNvbnRlbnQgbmVlZHMgdG8gYmUgcmVmcmVzaGVkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbGVhclMzQ2FjaGUoKTogdm9pZCB7XG4gIHMzQ29udGVudENhY2hlLmNsZWFyKCk7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIENvbnRlbnQgTWFuYWdlclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIENvbnRlbnQgTWFuYWdlciBjbGFzcyBmb3IgaGFuZGxpbmcgZHluYW1pYyBjb250ZW50XG4gKi9cbmV4cG9ydCBjbGFzcyBDb250ZW50TWFuYWdlciB7XG4gIHByaXZhdGUgcmVnaXN0cnk6IENvbnRlbnRSZWdpc3RyeTtcbiAgXG4gIGNvbnN0cnVjdG9yKHJlZ2lzdHJ5OiBDb250ZW50UmVnaXN0cnkgPSBERUZBVUxUX0NPTlRFTlRfUkVHSVNUUlkpIHtcbiAgICB0aGlzLnJlZ2lzdHJ5ID0gcmVnaXN0cnk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBHZXRzIHBheW1lbnQgcmVxdWlyZW1lbnRzIGZvciBhIGdpdmVuIHBhdGhcbiAgICovXG4gIGdldFBheW1lbnRSZXF1aXJlbWVudHMocGF0aDogc3RyaW5nKTogUGF5bWVudFJlcXVpcmVtZW50cyB8IG51bGwge1xuICAgIGNvbnN0IGl0ZW0gPSB0aGlzLnJlZ2lzdHJ5Lml0ZW1zW3BhdGhdO1xuICAgIHJldHVybiBpdGVtPy5wcmljaW5nIHx8IG51bGw7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBHZXRzIGNvbnRlbnQgZm9yIGEgZ2l2ZW4gcGF0aFxuICAgKi9cbiAgYXN5bmMgZ2V0Q29udGVudChwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHVua25vd24+IHtcbiAgICBjb25zdCBpdGVtID0gdGhpcy5yZWdpc3RyeS5pdGVtc1twYXRoXTtcbiAgICBcbiAgICBpZiAoIWl0ZW0pIHtcbiAgICAgIHJldHVybiB7IGVycm9yOiAnQ29udGVudCBub3QgZm91bmQnLCBwYXRoIH07XG4gICAgfVxuICAgIFxuICAgIHN3aXRjaCAoaXRlbS5zb3VyY2UudHlwZSkge1xuICAgICAgY2FzZSAnaW5saW5lJzpcbiAgICAgICAgcmV0dXJuIGl0ZW0uc291cmNlLmRhdGE7XG4gICAgICAgIFxuICAgICAgY2FzZSAnZHluYW1pYyc6XG4gICAgICAgIGNvbnN0IGdlbmVyYXRvciA9IENPTlRFTlRfR0VORVJBVE9SU1tpdGVtLnNvdXJjZS5nZW5lcmF0b3JdO1xuICAgICAgICBpZiAoZ2VuZXJhdG9yKSB7XG4gICAgICAgICAgcmV0dXJuIGdlbmVyYXRvcigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IGVycm9yOiAnR2VuZXJhdG9yIG5vdCBmb3VuZCcsIGdlbmVyYXRvcjogaXRlbS5zb3VyY2UuZ2VuZXJhdG9yIH07XG4gICAgICAgIFxuICAgICAgY2FzZSAnczMnOlxuICAgICAgICAvLyBGZXRjaCBjb250ZW50IGZyb20gUzMgYnVja2V0XG4gICAgICAgIHJldHVybiBhd2FpdCBmZXRjaFMzQ29udGVudChpdGVtLnNvdXJjZS5idWNrZXQsIGl0ZW0uc291cmNlLmtleSk7XG4gICAgICAgIFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHsgZXJyb3I6ICdVbmtub3duIGNvbnRlbnQgc291cmNlIHR5cGUnIH07XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICogR2V0cyBjb250ZW50IGl0ZW0gbWV0YWRhdGFcbiAgICovXG4gIGdldENvbnRlbnRJdGVtKHBhdGg6IHN0cmluZyk6IENvbnRlbnRJdGVtIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMucmVnaXN0cnkuaXRlbXNbcGF0aF0gfHwgbnVsbDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIExpc3RzIGFsbCBhdmFpbGFibGUgY29udGVudCBwYXRoc1xuICAgKi9cbiAgbGlzdENvbnRlbnRQYXRocygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMucmVnaXN0cnkuaXRlbXMpO1xuICB9XG4gIFxuICAvKipcbiAgICogQ2hlY2tzIGlmIGEgcGF0aCByZXF1aXJlcyBwYXltZW50XG4gICAqL1xuICByZXF1aXJlc1BheW1lbnQocGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHBhdGggaW4gdGhpcy5yZWdpc3RyeS5pdGVtcztcbiAgfVxuICBcbiAgLyoqXG4gICAqIEdldHMgdGhlIGNvbnRlbnQgcmVnaXN0cnkgdmVyc2lvblxuICAgKi9cbiAgZ2V0VmVyc2lvbigpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLnJlZ2lzdHJ5LnZlcnNpb247XG4gIH1cbiAgXG4gIC8qKlxuICAgKiBBZGRzIG9yIHVwZGF0ZXMgYSBjb250ZW50IGl0ZW1cbiAgICovXG4gIHNldENvbnRlbnRJdGVtKGl0ZW06IENvbnRlbnRJdGVtKTogdm9pZCB7XG4gICAgdGhpcy5yZWdpc3RyeS5pdGVtc1tpdGVtLnBhdGhdID0gaXRlbTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIFJlbW92ZXMgYSBjb250ZW50IGl0ZW1cbiAgICovXG4gIHJlbW92ZUNvbnRlbnRJdGVtKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGlmIChwYXRoIGluIHRoaXMucmVnaXN0cnkuaXRlbXMpIHtcbiAgICAgIGRlbGV0ZSB0aGlzLnJlZ2lzdHJ5Lml0ZW1zW3BhdGhdO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTaW5nbGV0b24gSW5zdGFuY2Vcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiBEZWZhdWx0IGNvbnRlbnQgbWFuYWdlciBpbnN0YW5jZVxuICovXG5leHBvcnQgY29uc3QgY29udGVudE1hbmFnZXIgPSBuZXcgQ29udGVudE1hbmFnZXIoKTtcblxuLyoqXG4gKiBTZXRzIHRoZSBTMyBidWNrZXQgbmFtZSBmb3IgYWxsIFMzLWJhY2tlZCBjb250ZW50IGl0ZW1zLlxuICogQ2FsbGVkIGF0IHJ1bnRpbWUgZnJvbSB0aGUgTGFtYmRhIGhhbmRsZXIgdXNpbmcgdGhlIENsb3VkRnJvbnQgb3JpZ2luIGRvbWFpbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldENvbnRlbnRCdWNrZXQoYnVja2V0TmFtZTogc3RyaW5nKTogdm9pZCB7XG4gIERFRkFVTFRfQ09OVEVOVF9CVUNLRVQgPSBidWNrZXROYW1lO1xuICBmb3IgKGNvbnN0IGl0ZW0gb2YgT2JqZWN0LnZhbHVlcyhjb250ZW50TWFuYWdlclsncmVnaXN0cnknXS5pdGVtcykpIHtcbiAgICBpZiAoaXRlbS5zb3VyY2UudHlwZSA9PT0gJ3MzJykge1xuICAgICAgaXRlbS5zb3VyY2UuYnVja2V0ID0gYnVja2V0TmFtZTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==