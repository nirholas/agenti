/**
 * Market Links - Persistent cross-platform market identity database
 *
 * Features:
 * - Manual market linking with confidence scores
 * - Auto-discovered link storage
 * - Bidirectional link traversal
 * - Link history and audit trail
 */

import type { Database } from '../db/index';
import type { Platform } from '../types';
import { logger } from '../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface MarketLink {
  /** Link ID */
  id: string;
  /** First market key (platform:marketId) */
  marketA: string;
  /** Second market key (platform:marketId) */
  marketB: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** How the link was created */
  source: 'manual' | 'auto' | 'semantic' | 'slug';
  /** When created */
  createdAt: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface MarketIdentity {
  /** Canonical ID for this market group */
  canonicalId: string;
  /** All linked markets */
  markets: Array<{
    platform: Platform;
    marketId: string;
    confidence: number;
  }>;
  /** Primary market (highest confidence or first added) */
  primary: {
    platform: Platform;
    marketId: string;
  };
}

export interface MarketLinker {
  /** Link two markets */
  link(
    marketA: string,
    marketB: string,
    confidence?: number,
    source?: MarketLink['source'],
    metadata?: Record<string, unknown>
  ): MarketLink;

  /** Remove a link */
  unlink(marketA: string, marketB: string): boolean;

  /** Get all links for a market */
  getLinks(marketKey: string): MarketLink[];

  /** Get the canonical identity for a market */
  getIdentity(marketKey: string): MarketIdentity | undefined;

  /** Check if two markets are linked */
  areLinked(marketA: string, marketB: string): boolean;

  /** Get link between two markets */
  getLink(marketA: string, marketB: string): MarketLink | undefined;

  /** Get all links */
  getAllLinks(options?: { source?: MarketLink['source']; minConfidence?: number }): MarketLink[];

  /** Update link confidence */
  updateConfidence(marketA: string, marketB: string, confidence: number): boolean;

  /** Merge two market groups into one */
  merge(marketA: string, marketB: string): void;

  /** Get link statistics */
  getStats(): {
    totalLinks: number;
    bySource: Record<string, number>;
    avgConfidence: number;
  };

  /** Export links to JSON */
  exportLinks(): string;

  /** Import links from JSON */
  importLinks(json: string, overwrite?: boolean): number;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

export function createMarketLinker(db: Database): MarketLinker {
  function normalizeKey(key: string): string {
    return key.toLowerCase().trim();
  }

  function makeId(a: string, b: string): string {
    const [first, second] = [a, b].sort();
    return `${first}__${second}`;
  }

  function parseMarketKey(key: string): { platform: Platform; marketId: string } | null {
    const parts = key.split(':');
    if (parts.length !== 2) return null;
    return {
      platform: parts[0] as Platform,
      marketId: parts[1],
    };
  }

  function link(
    marketA: string,
    marketB: string,
    confidence = 1.0,
    source: MarketLink['source'] = 'manual',
    metadata?: Record<string, unknown>
  ): MarketLink {
    const keyA = normalizeKey(marketA);
    const keyB = normalizeKey(marketB);
    const id = makeId(keyA, keyB);
    const now = Date.now();

    try {
      db.run(
        `INSERT OR REPLACE INTO market_links
         (id, market_a, market_b, confidence, source, created_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          keyA,
          keyB,
          confidence,
          source,
          now,
          metadata ? JSON.stringify(metadata) : null,
        ]
      );

      logger.debug({ marketA: keyA, marketB: keyB, confidence, source }, 'Markets linked');

      return {
        id,
        marketA: keyA,
        marketB: keyB,
        confidence,
        source,
        createdAt: new Date(now),
        metadata,
      };
    } catch (error) {
      logger.warn({ error, marketA, marketB }, 'Failed to link markets');
      throw error;
    }
  }

  function unlink(marketA: string, marketB: string): boolean {
    const keyA = normalizeKey(marketA);
    const keyB = normalizeKey(marketB);

    try {
      // Check if link exists first
      const existing = db.query<{ id: string }>(
        `SELECT id FROM market_links
         WHERE (market_a = ? AND market_b = ?)
            OR (market_a = ? AND market_b = ?)
         LIMIT 1`,
        [keyA, keyB, keyB, keyA]
      );

      if (existing.length === 0) return false;

      db.run(
        `DELETE FROM market_links
         WHERE (market_a = ? AND market_b = ?)
            OR (market_a = ? AND market_b = ?)`,
        [keyA, keyB, keyB, keyA]
      );

      return true;
    } catch (error) {
      logger.warn({ error, marketA, marketB }, 'Failed to unlink markets');
      return false;
    }
  }

  function getLinks(marketKey: string): MarketLink[] {
    const key = normalizeKey(marketKey);

    try {
      const rows = db.query<{
        id: string;
        market_a: string;
        market_b: string;
        confidence: number;
        source: string;
        created_at: number;
        metadata: string | null;
      }>(
        `SELECT * FROM market_links
         WHERE market_a = ? OR market_b = ?
         ORDER BY confidence DESC`,
        [key, key]
      );

      return rows.map((row) => ({
        id: row.id,
        marketA: row.market_a,
        marketB: row.market_b,
        confidence: row.confidence,
        source: row.source as MarketLink['source'],
        createdAt: new Date(row.created_at),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    } catch (error) {
      logger.warn({ error, marketKey }, 'Failed to get links');
      return [];
    }
  }

  function getIdentity(marketKey: string): MarketIdentity | undefined {
    const key = normalizeKey(marketKey);
    const visited = new Set<string>();
    const markets: MarketIdentity['markets'] = [];

    // BFS to find all linked markets
    const queue = [key];
    visited.add(key);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const parsed = parseMarketKey(current);

      if (parsed) {
        const existingLinks = getLinks(current);
        const maxConfidence = existingLinks.length > 0
          ? Math.max(...existingLinks.map((l) => l.confidence))
          : 1.0;

        markets.push({
          platform: parsed.platform,
          marketId: parsed.marketId,
          confidence: current === key ? 1.0 : maxConfidence,
        });
      }

      const links = getLinks(current);
      for (const link of links) {
        const other = link.marketA === current ? link.marketB : link.marketA;
        if (!visited.has(other)) {
          visited.add(other);
          queue.push(other);
        }
      }
    }

    if (markets.length === 0) return undefined;

    // Sort by confidence, highest first
    markets.sort((a, b) => b.confidence - a.confidence);

    const primary = markets[0];

    return {
      canonicalId: `${primary.platform}:${primary.marketId}`,
      markets,
      primary: {
        platform: primary.platform,
        marketId: primary.marketId,
      },
    };
  }

  function areLinked(marketA: string, marketB: string): boolean {
    const keyA = normalizeKey(marketA);
    const keyB = normalizeKey(marketB);

    // Check direct link
    const link = getLink(keyA, keyB);
    if (link) return true;

    // Check transitive links
    const identityA = getIdentity(keyA);
    if (!identityA) return false;

    return identityA.markets.some(
      (m) => `${m.platform}:${m.marketId}` === keyB
    );
  }

  function getLink(marketA: string, marketB: string): MarketLink | undefined {
    const keyA = normalizeKey(marketA);
    const keyB = normalizeKey(marketB);

    try {
      const rows = db.query<{
        id: string;
        market_a: string;
        market_b: string;
        confidence: number;
        source: string;
        created_at: number;
        metadata: string | null;
      }>(
        `SELECT * FROM market_links
         WHERE (market_a = ? AND market_b = ?)
            OR (market_a = ? AND market_b = ?)
         LIMIT 1`,
        [keyA, keyB, keyB, keyA]
      );

      if (rows.length === 0) return undefined;

      const row = rows[0];
      return {
        id: row.id,
        marketA: row.market_a,
        marketB: row.market_b,
        confidence: row.confidence,
        source: row.source as MarketLink['source'],
        createdAt: new Date(row.created_at),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      };
    } catch (error) {
      logger.warn({ error, marketA, marketB }, 'Failed to get link');
      return undefined;
    }
  }

  function getAllLinks(options?: {
    source?: MarketLink['source'];
    minConfidence?: number;
  }): MarketLink[] {
    const { source, minConfidence } = options || {};

    try {
      let query = 'SELECT * FROM market_links WHERE 1=1';
      const params: unknown[] = [];

      if (source) {
        query += ' AND source = ?';
        params.push(source);
      }

      if (minConfidence !== undefined) {
        query += ' AND confidence >= ?';
        params.push(minConfidence);
      }

      query += ' ORDER BY created_at DESC';

      const rows = db.query<{
        id: string;
        market_a: string;
        market_b: string;
        confidence: number;
        source: string;
        created_at: number;
        metadata: string | null;
      }>(query, params);

      return rows.map((row) => ({
        id: row.id,
        marketA: row.market_a,
        marketB: row.market_b,
        confidence: row.confidence,
        source: row.source as MarketLink['source'],
        createdAt: new Date(row.created_at),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    } catch (error) {
      logger.warn({ error }, 'Failed to get all links');
      return [];
    }
  }

  function updateConfidence(marketA: string, marketB: string, confidence: number): boolean {
    const keyA = normalizeKey(marketA);
    const keyB = normalizeKey(marketB);

    try {
      // Check if link exists
      const existing = db.query<{ id: string }>(
        `SELECT id FROM market_links
         WHERE (market_a = ? AND market_b = ?)
            OR (market_a = ? AND market_b = ?)
         LIMIT 1`,
        [keyA, keyB, keyB, keyA]
      );

      if (existing.length === 0) return false;

      db.run(
        `UPDATE market_links SET confidence = ?
         WHERE (market_a = ? AND market_b = ?)
            OR (market_a = ? AND market_b = ?)`,
        [confidence, keyA, keyB, keyB, keyA]
      );

      return true;
    } catch (error) {
      logger.warn({ error, marketA, marketB }, 'Failed to update confidence');
      return false;
    }
  }

  function merge(marketA: string, marketB: string): void {
    const identityA = getIdentity(marketA);
    const identityB = getIdentity(marketB);

    if (!identityA || !identityB) return;

    // Link all markets from B to primary of A
    for (const market of identityB.markets) {
      const key = `${market.platform}:${market.marketId}`;
      if (key !== identityA.canonicalId) {
        link(identityA.canonicalId, key, market.confidence, 'auto');
      }
    }
  }

  function getStats(): {
    totalLinks: number;
    bySource: Record<string, number>;
    avgConfidence: number;
  } {
    try {
      const totals = db.query<{
        total: number;
        avg_confidence: number;
      }>(
        `SELECT COUNT(*) as total, AVG(confidence) as avg_confidence
         FROM market_links`
      );

      const bySource = db.query<{
        source: string;
        count: number;
      }>(
        `SELECT source, COUNT(*) as count
         FROM market_links
         GROUP BY source`
      );

      const sourceMap: Record<string, number> = {};
      for (const row of bySource) {
        sourceMap[row.source] = row.count;
      }

      return {
        totalLinks: totals[0]?.total || 0,
        bySource: sourceMap,
        avgConfidence: totals[0]?.avg_confidence || 0,
      };
    } catch (error) {
      logger.warn({ error }, 'Failed to get link stats');
      return { totalLinks: 0, bySource: {}, avgConfidence: 0 };
    }
  }

  function exportLinks(): string {
    const links = getAllLinks();
    return JSON.stringify(links, null, 2);
  }

  function importLinks(json: string, overwrite = false): number {
    try {
      const links = JSON.parse(json) as MarketLink[];

      if (overwrite) {
        db.run('DELETE FROM market_links');
      }

      let imported = 0;
      for (const l of links) {
        try {
          link(l.marketA, l.marketB, l.confidence, l.source, l.metadata);
          imported++;
        } catch {
          // Skip duplicates if not overwriting
        }
      }

      logger.info({ imported, total: links.length }, 'Imported market links');
      return imported;
    } catch (error) {
      logger.warn({ error }, 'Failed to import links');
      return 0;
    }
  }

  return {
    link,
    unlink,
    getLinks,
    getIdentity,
    areLinked,
    getLink,
    getAllLinks,
    updateConfidence,
    merge,
    getStats,
    exportLinks,
    importLinks,
  };
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Create a market key from platform and market ID
 */
export function createMarketKey(platform: Platform, marketId: string): string {
  return `${platform}:${marketId}`;
}

/**
 * Parse a market key into platform and market ID
 */
export function parseMarketKey(key: string): { platform: Platform; marketId: string } | null {
  const parts = key.split(':');
  if (parts.length !== 2) return null;
  return {
    platform: parts[0] as Platform,
    marketId: parts[1],
  };
}
