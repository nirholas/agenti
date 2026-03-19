/**
 * Feed Registry — Plugin-friendly feed discovery and management.
 *
 * Adding a new feed:
 *   1. Create src/feeds/<name>/index.ts with your feed implementation
 *   2. Add a FeedDescriptor entry in src/feeds/descriptors.ts
 *   3. Done — it shows up in `/feeds list` and FeedManager can use it
 *
 * Capabilities are flags that describe what data a feed provides.
 * Categories group feeds for easy browsing.
 */

import { EventEmitter } from 'events';

// =============================================================================
// CAPABILITIES — what data/actions a feed supports
// =============================================================================

export const FeedCapability = {
  /** Market search & lookup */
  MARKET_DATA: 'market_data',
  /** Real-time orderbook depth */
  ORDERBOOK: 'orderbook',
  /** WebSocket or streaming price updates */
  REALTIME_PRICES: 'realtime_prices',
  /** Can place and manage orders */
  TRADING: 'trading',
  /** News articles / social media */
  NEWS: 'news',
  /** Cryptocurrency spot prices */
  CRYPTO_PRICES: 'crypto_prices',
  /** Weather data (temperature, forecasts, alerts) */
  WEATHER: 'weather',
  /** Sports scores and events */
  SPORTS: 'sports',
  /** Political data (polls, election results) */
  POLITICS: 'politics',
  /** Economic indicators (CPI, jobs, rates) */
  ECONOMICS: 'economics',
  /** Geopolitical events and conflict data */
  GEOPOLITICAL: 'geopolitical',
  /** Edge / fair-value analysis */
  EDGE_DETECTION: 'edge_detection',
  /** Historical data / backtesting */
  HISTORICAL: 'historical',
} as const;

export type FeedCapability = (typeof FeedCapability)[keyof typeof FeedCapability];

// =============================================================================
// CATEGORIES — grouping for browsing
// =============================================================================

export type FeedCategory =
  | 'prediction_market'
  | 'crypto'
  | 'news'
  | 'weather'
  | 'sports'
  | 'politics'
  | 'economics'
  | 'geopolitical'
  | 'data'
  | 'custom';

// =============================================================================
// CONNECTION TYPE
// =============================================================================

export type ConnectionType = 'websocket' | 'polling' | 'hybrid' | 'static';

// =============================================================================
// FEED DESCRIPTOR — metadata every feed declares
// =============================================================================

export interface FeedDescriptor {
  /** Unique identifier (e.g. 'polymarket', 'weather-openmeteo') */
  id: string;

  /** Human-readable name */
  name: string;

  /** One-line description of what this feed provides */
  description: string;

  /** Grouping category */
  category: FeedCategory;

  /** What this feed can do */
  capabilities: FeedCapability[];

  /** Data types provided (e.g. ['markets', 'orderbooks', 'prices']) */
  dataTypes: string[];

  /** How it connects */
  connectionType: ConnectionType;

  /** Environment variables required to activate */
  requiredEnv?: string[];

  /** Optional env vars for extra features */
  optionalEnv?: string[];

  /** Config key in Config['feeds'] (for existing feeds) */
  configKey?: string;

  /** Implementation status */
  status?: 'available' | 'planned' | 'deprecated';

  /** Version string */
  version?: string;

  /** URL for docs or source */
  docsUrl?: string;

  /** Associated CLI skill command (e.g. '/poly', '/kalshi') */
  skillCommand?: string;

  /**
   * Lazy factory — called only when the feed is actually needed.
   * Receives the feed-specific config (if any) from Config['feeds'][configKey].
   * Return a FeedAdapter-compatible object.
   */
  create: (config?: unknown) => Promise<FeedAdapterLike>;
}

// Minimal adapter shape that the registry understands.
// Intentionally loose — real feeds add their own methods on top.
export interface FeedAdapterLike {
  start?(): Promise<void>;
  connect?(): Promise<void>;
  stop?(): void;
  disconnect?(): void;
  searchMarkets?(query: string): Promise<unknown[]>;
  getMarket?(id: string): Promise<unknown | null>;
  [key: string]: unknown;
}

// =============================================================================
// FEED SUMMARY — lightweight view returned by list operations
// =============================================================================

export interface FeedSummary {
  id: string;
  name: string;
  description: string;
  category: FeedCategory;
  capabilities: FeedCapability[];
  connectionType: ConnectionType;
  status: 'available' | 'planned' | 'deprecated';
  ready: boolean;
  missingEnv: string[];
  active: boolean;
  skillCommand?: string;
}

// =============================================================================
// FEED REGISTRY
// =============================================================================

export class FeedRegistry extends EventEmitter {
  private descriptors = new Map<string, FeedDescriptor>();
  private activeFeeds = new Set<string>();

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /** Register a feed descriptor. Emits 'registered' event. */
  register(descriptor: FeedDescriptor): void {
    this.descriptors.set(descriptor.id, descriptor);
    this.emit('registered', descriptor);
  }

  /** Unregister a feed. Emits 'unregistered' event. */
  unregister(id: string): void {
    const had = this.descriptors.delete(id);
    if (had) {
      this.activeFeeds.delete(id);
      this.emit('unregistered', id);
    }
  }

  /** Mark a feed as currently active (started by FeedManager). */
  markActive(id: string): void {
    this.activeFeeds.add(id);
  }

  /** Mark a feed as inactive. */
  markInactive(id: string): void {
    this.activeFeeds.delete(id);
  }

  // ---------------------------------------------------------------------------
  // Lookup
  // ---------------------------------------------------------------------------

  get(id: string): FeedDescriptor | undefined {
    return this.descriptors.get(id);
  }

  getAll(): FeedDescriptor[] {
    return [...this.descriptors.values()];
  }

  // ---------------------------------------------------------------------------
  // Querying
  // ---------------------------------------------------------------------------

  /** Get feeds that have a specific capability. */
  getByCapability(cap: FeedCapability): FeedDescriptor[] {
    return this.getAll().filter(d => d.capabilities.includes(cap));
  }

  /** Get feeds in a category. */
  getByCategory(cat: FeedCategory): FeedDescriptor[] {
    return this.getAll().filter(d => d.category === cat);
  }

  /** Get feeds that provide a specific data type. */
  getByDataType(dataType: string): FeedDescriptor[] {
    return this.getAll().filter(d => d.dataTypes.includes(dataType));
  }

  /** Full-text search across name, description, capabilities, dataTypes. */
  search(query: string): FeedDescriptor[] {
    const q = query.toLowerCase();
    return this.getAll().filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      d.capabilities.some(c => c.includes(q)) ||
      d.dataTypes.some(t => t.includes(q)) ||
      d.category.includes(q)
    );
  }

  // ---------------------------------------------------------------------------
  // Activation checks
  // ---------------------------------------------------------------------------

  /** Check if a feed's required env vars are present. */
  canActivate(id: string): { ready: boolean; missing: string[] } {
    const desc = this.descriptors.get(id);
    if (!desc) return { ready: false, missing: ['Feed not registered'] };

    const missing = (desc.requiredEnv || []).filter(v => !process.env[v]);
    return { ready: missing.length === 0, missing };
  }

  /** Is a specific feed currently active? */
  isActive(id: string): boolean {
    return this.activeFeeds.has(id);
  }

  // ---------------------------------------------------------------------------
  // Summary views
  // ---------------------------------------------------------------------------

  /** List all feeds with activation status. */
  listAll(): FeedSummary[] {
    return this.getAll().map(d => {
      const { ready, missing } = this.canActivate(d.id);
      const isPlanned = d.status === 'planned';
      return {
        id: d.id,
        name: d.name,
        description: d.description,
        category: d.category,
        capabilities: d.capabilities,
        connectionType: d.connectionType,
        status: d.status || 'available',
        ready: isPlanned ? false : ready,
        missingEnv: missing,
        active: this.activeFeeds.has(d.id),
        skillCommand: d.skillCommand,
      };
    });
  }

  /** List only feeds that are ready to activate (env vars present). */
  listReady(): FeedSummary[] {
    return this.listAll().filter(s => s.ready);
  }

  /** List only currently active feeds. */
  listActive(): FeedSummary[] {
    return this.listAll().filter(s => s.active);
  }

  /** Group feeds by category. */
  groupByCategory(): Record<FeedCategory, FeedSummary[]> {
    const result = {} as Record<FeedCategory, FeedSummary[]>;
    for (const s of this.listAll()) {
      (result[s.category] ??= []).push(s);
    }
    return result;
  }

  /** Group feeds by capability. */
  groupByCapability(): Record<FeedCapability, FeedSummary[]> {
    const result = {} as Record<FeedCapability, FeedSummary[]>;
    for (const s of this.listAll()) {
      for (const cap of s.capabilities) {
        (result[cap] ??= []).push(s);
      }
    }
    return result;
  }

  /** Get count stats. */
  stats(): { total: number; active: number; ready: number; categories: number } {
    const all = this.listAll();
    return {
      total: all.length,
      active: all.filter(s => s.active).length,
      ready: all.filter(s => s.ready).length,
      categories: new Set(all.map(s => s.category)).size,
    };
  }
}

// =============================================================================
// GLOBAL SINGLETON
// =============================================================================

let globalRegistry: FeedRegistry | null = null;

export function getGlobalFeedRegistry(): FeedRegistry {
  if (!globalRegistry) {
    globalRegistry = new FeedRegistry();
  }
  return globalRegistry;
}
