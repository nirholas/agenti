/**
 * Dynamic Content Configuration Module
 * 
 * This module provides dynamic content and pricing configuration for the x402 payment verifier.
 * Content can be loaded from:
 * 1. Static configuration (default)
 * 2. Environment variables (for pricing overrides)
 * 3. S3 bucket (for dynamic content)
 */

import { PaymentRequirements } from './types';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// ============================================================================
// Content Configuration Types
// ============================================================================

/**
 * Content item with metadata and pricing
 */
export interface ContentItem {
  /** Unique identifier for the content */
  id: string;
  /** URL path for the content */
  path: string;
  /** Human-readable title */
  title: string;
  /** Content description */
  description: string;
  /** MIME type of the content */
  mimeType: string;
  /** Payment requirements for this content */
  pricing: PaymentRequirements;
  /** Content source - inline data or S3 reference */
  source: ContentSource;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Content source - either inline data or S3 reference
 */
export type ContentSource = 
  | { type: 'inline'; data: unknown }
  | { type: 's3'; bucket: string; key: string }
  | { type: 'dynamic'; generator: string };

/**
 * Content registry for managing all available content
 */
export interface ContentRegistry {
  /** Version of the configuration */
  version: string;
  /** Default payment recipient address */
  defaultPayTo: string;
  /** Default network for payments */
  defaultNetwork: string;
  /** Default asset for payments */
  defaultAsset: string;
  /** Content items indexed by path */
  items: Record<string, ContentItem>;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default payment recipient address
 * Can be overridden via PAYMENT_RECIPIENT_ADDRESS in seller-infrastructure/.env
 * CDK injects the value into deploy-config.json at build time
 */
let deployConfig: { payTo?: string } = {};
try {
  deployConfig = require('./deploy-config.json');
} catch {
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
export function createPaymentRequirements(
  amount: string,
  overrides?: Partial<PaymentRequirements>
): PaymentRequirements {
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
export const DEFAULT_CONTENT_REGISTRY: ContentRegistry = {
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
function generateWeatherData(): unknown {
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
function generateMarketData(): unknown {
  const cryptos = [
    { symbol: 'BTC', name: 'Bitcoin', basePrice: 98000 },
    { symbol: 'ETH', name: 'Ethereum', basePrice: 3800 },
    { symbol: 'SOL', name: 'Solana', basePrice: 145 },
    { symbol: 'AVAX', name: 'Avalanche', basePrice: 42 },
    { symbol: 'MATIC', name: 'Polygon', basePrice: 0.85 },
  ];
  
  const markets: Record<string, unknown> = {};
  
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
const CONTENT_GENERATORS: Record<string, () => unknown> = {
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
const s3Client = new S3Client({ region: 'us-east-1' });

/**
 * Cache for S3 content to reduce latency on repeated requests
 * Note: Lambda@Edge instances may be reused, so this provides some caching benefit
 */
const s3ContentCache = new Map<string, { data: unknown; timestamp: number }>();

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
async function fetchS3Content(bucket: string, key: string): Promise<unknown> {
  const cacheKey = `${bucket}/${key}`;
  
  // Check cache first
  const cached = s3ContentCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < S3_CACHE_TTL_MS) {
    return cached.data;
  }
  
  try {
    const command = new GetObjectCommand({
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
    let content: unknown;
    try {
      content = JSON.parse(bodyContents);
    } catch {
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
  } catch (error) {
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
export function clearS3Cache(): void {
  s3ContentCache.clear();
}

// ============================================================================
// Content Manager
// ============================================================================

/**
 * Content Manager class for handling dynamic content
 */
export class ContentManager {
  private registry: ContentRegistry;
  
  constructor(registry: ContentRegistry = DEFAULT_CONTENT_REGISTRY) {
    this.registry = registry;
  }
  
  /**
   * Gets payment requirements for a given path
   */
  getPaymentRequirements(path: string): PaymentRequirements | null {
    const item = this.registry.items[path];
    return item?.pricing || null;
  }
  
  /**
   * Gets content for a given path
   */
  async getContent(path: string): Promise<unknown> {
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
  getContentItem(path: string): ContentItem | null {
    return this.registry.items[path] || null;
  }
  
  /**
   * Lists all available content paths
   */
  listContentPaths(): string[] {
    return Object.keys(this.registry.items);
  }
  
  /**
   * Checks if a path requires payment
   */
  requiresPayment(path: string): boolean {
    return path in this.registry.items;
  }
  
  /**
   * Gets the content registry version
   */
  getVersion(): string {
    return this.registry.version;
  }
  
  /**
   * Adds or updates a content item
   */
  setContentItem(item: ContentItem): void {
    this.registry.items[item.path] = item;
  }
  
  /**
   * Removes a content item
   */
  removeContentItem(path: string): boolean {
    if (path in this.registry.items) {
      delete this.registry.items[path];
      return true;
    }
    return false;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Default content manager instance
 */
export const contentManager = new ContentManager();

/**
 * Sets the S3 bucket name for all S3-backed content items.
 * Called at runtime from the Lambda handler using the CloudFront origin domain.
 */
export function setContentBucket(bucketName: string): void {
  DEFAULT_CONTENT_BUCKET = bucketName;
  for (const item of Object.values(contentManager['registry'].items)) {
    if (item.source.type === 's3') {
      item.source.bucket = bucketName;
    }
  }
}
