/**
 * Swarm Signal Integration System
 *
 * Monitor external signals and trigger swarm trades automatically.
 * Supports:
 * - RSS feeds (crypto news, influencer blogs)
 * - Twitter/X (via nitter proxies or API)
 * - Telegram channels (via bot or mtproto)
 * - Webhooks (custom integrations)
 * - Discord channels
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { generateId } from '../utils/id';
import type { PumpFunSwarm, SwarmTradeParams } from './pump-swarm';
import type { DexType } from './swarm-builders';

// ============================================================================
// Types
// ============================================================================

export type SignalSourceType = 'rss' | 'twitter' | 'telegram' | 'discord' | 'webhook';

export interface SignalSource {
  id: string;
  type: SignalSourceType;
  name: string;
  config: SignalSourceConfig;
  enabled: boolean;
  filters: SignalFilter[];
  tradeConfig: SignalTradeConfig;
  stats: SignalStats;
  createdAt: number;
  lastCheckAt?: number;
  lastSignalAt?: number;
}

export interface SignalSourceConfig {
  // RSS
  feedUrl?: string;
  checkIntervalMs?: number;

  // Twitter
  username?: string;
  searchQuery?: string;
  nitterInstance?: string;

  // Telegram
  channelId?: string;
  botToken?: string;

  // Discord
  webhookUrl?: string;
  channelWebhook?: string;

  // Webhook (incoming)
  webhookSecret?: string;
}

export interface SignalFilter {
  type: 'keyword' | 'mint' | 'sentiment' | 'regex';
  value: string;
  action: 'buy' | 'sell' | 'ignore';
  confidence?: number; // 0-1 for sentiment
}

export interface SignalTradeConfig {
  defaultAction: 'buy' | 'sell' | 'none';
  amountSol: number;
  slippageBps: number;
  executionMode?: 'parallel' | 'bundle' | 'multi-bundle' | 'sequential';
  dex?: DexType;
  poolAddress?: string;
  maxTradesPerHour?: number;
  cooldownMs?: number;
  requireMintInMessage: boolean; // Must find a valid mint address
}

export interface SignalStats {
  signalsReceived: number;
  signalsMatched: number;
  tradesExecuted: number;
  tradesSuccessful: number;
  tradesFailed: number;
  totalSolSpent: number;
  totalSolReceived: number;
}

export interface DetectedSignal {
  sourceId: string;
  sourceName: string;
  sourceType: SignalSourceType;
  content: string;
  url?: string;
  author?: string;
  timestamp: number;
  matchedFilters: SignalFilter[];
  detectedMints: string[];
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
}

export interface SignalTradeResult {
  signal: DetectedSignal;
  action: 'buy' | 'sell' | 'skipped';
  mint?: string;
  success: boolean;
  solAmount?: number;
  error?: string;
  signature?: string;
}

// Mint address regex (Solana base58, 32-44 chars)
const MINT_REGEX = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

// Bullish keywords
const BULLISH_KEYWORDS = [
  'buy', 'bullish', 'moon', 'pump', 'gem', 'alpha', 'send it',
  'accumulate', 'load up', 'don\'t miss', 'early', 'undervalued',
  '100x', '10x', '1000x', 'next', 'ape', 'aped', 'entry', 'dip',
];

// Bearish keywords
const BEARISH_KEYWORDS = [
  'sell', 'bearish', 'dump', 'rug', 'scam', 'exit', 'short',
  'overvalued', 'top', 'dead', 'over', 'rip', 'rekt',
];

// ============================================================================
// SignalMonitor Class
// ============================================================================

export class SwarmSignalMonitor extends EventEmitter {
  private swarm: PumpFunSwarm;
  private sources: Map<string, SignalSource> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private lastSeenItems: Map<string, Set<string>> = new Map(); // Track seen items per source
  private tradeCooldowns: Map<string, number> = new Map(); // sourceId -> last trade time

  constructor(swarm: PumpFunSwarm) {
    super();
    this.swarm = swarm;
  }

  // --------------------------------------------------------------------------
  // Source Management
  // --------------------------------------------------------------------------

  addSource(
    type: SignalSourceType,
    name: string,
    config: SignalSourceConfig,
    filters: SignalFilter[] = [],
    tradeConfig: Partial<SignalTradeConfig> = {}
  ): SignalSource {
    const id = generateId();
    const source: SignalSource = {
      id,
      type,
      name,
      config,
      enabled: true,
      filters,
      tradeConfig: {
        defaultAction: tradeConfig.defaultAction ?? 'buy',
        amountSol: tradeConfig.amountSol ?? 0.1,
        slippageBps: tradeConfig.slippageBps ?? 500,
        executionMode: tradeConfig.executionMode ?? 'parallel',
        dex: tradeConfig.dex ?? 'pumpfun',
        poolAddress: tradeConfig.poolAddress,
        maxTradesPerHour: tradeConfig.maxTradesPerHour ?? 10,
        cooldownMs: tradeConfig.cooldownMs ?? 60000,
        requireMintInMessage: tradeConfig.requireMintInMessage ?? true,
      },
      stats: {
        signalsReceived: 0,
        signalsMatched: 0,
        tradesExecuted: 0,
        tradesSuccessful: 0,
        tradesFailed: 0,
        totalSolSpent: 0,
        totalSolReceived: 0,
      },
      createdAt: Date.now(),
    };

    this.sources.set(id, source);
    this.lastSeenItems.set(id, new Set());
    this.startPolling(source);

    logger.info(`[SignalMonitor] Added ${type} source: ${name}`);
    this.emit('sourceAdded', source);

    return source;
  }

  removeSource(id: string): boolean {
    const source = this.sources.get(id);
    if (!source) return false;

    this.stopPolling(source);
    this.sources.delete(id);
    this.lastSeenItems.delete(id);

    logger.info(`[SignalMonitor] Removed source: ${source.name}`);
    this.emit('sourceRemoved', source);

    return true;
  }

  getSource(id: string): SignalSource | undefined {
    return this.sources.get(id);
  }

  listSources(): SignalSource[] {
    return Array.from(this.sources.values());
  }

  enableSource(id: string): boolean {
    const source = this.sources.get(id);
    if (!source) return false;

    source.enabled = true;
    this.startPolling(source);
    return true;
  }

  disableSource(id: string): boolean {
    const source = this.sources.get(id);
    if (!source) return false;

    source.enabled = false;
    this.stopPolling(source);
    return true;
  }

  updateSourceConfig(id: string, config: Partial<SignalSourceConfig>): boolean {
    const source = this.sources.get(id);
    if (!source) return false;

    Object.assign(source.config, config);
    return true;
  }

  updateTradeConfig(id: string, config: Partial<SignalTradeConfig>): boolean {
    const source = this.sources.get(id);
    if (!source) return false;

    Object.assign(source.tradeConfig, config);
    return true;
  }

  addFilter(id: string, filter: SignalFilter): boolean {
    const source = this.sources.get(id);
    if (!source) return false;

    source.filters.push(filter);
    return true;
  }

  removeFilter(id: string, filterIndex: number): boolean {
    const source = this.sources.get(id);
    if (!source || filterIndex >= source.filters.length) return false;

    source.filters.splice(filterIndex, 1);
    return true;
  }

  // --------------------------------------------------------------------------
  // Polling
  // --------------------------------------------------------------------------

  private startPolling(source: SignalSource): void {
    if (this.intervals.has(source.id)) return;

    const intervalMs = source.config.checkIntervalMs || 30000; // Default 30s

    const poll = async () => {
      if (!source.enabled) return;

      try {
        source.lastCheckAt = Date.now();
        await this.checkSource(source);
      } catch (error) {
        logger.error(`[SignalMonitor] Error polling ${source.name}:`, error);
      }
    };

    // Initial poll
    poll();

    // Schedule recurring polls
    const interval = setInterval(poll, intervalMs);
    this.intervals.set(source.id, interval);
  }

  private stopPolling(source: SignalSource): void {
    const interval = this.intervals.get(source.id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(source.id);
    }
  }

  private async checkSource(source: SignalSource): Promise<void> {
    switch (source.type) {
      case 'rss':
        await this.checkRSS(source);
        break;
      case 'twitter':
        await this.checkTwitter(source);
        break;
      case 'telegram':
        // Telegram uses push via bot, not polling
        break;
      case 'webhook':
        // Webhooks are incoming, no polling needed
        break;
    }
  }

  // --------------------------------------------------------------------------
  // RSS Feed Checking
  // --------------------------------------------------------------------------

  private async checkRSS(source: SignalSource): Promise<void> {
    if (!source.config.feedUrl) return;

    try {
      const response = await fetch(source.config.feedUrl);
      if (!response.ok) return;

      const text = await response.text();
      const items = this.parseRSSItems(text);
      const seenItems = this.lastSeenItems.get(source.id)!;

      for (const item of items) {
        // Skip already seen items
        const itemKey = item.guid || item.link || item.title;
        if (seenItems.has(itemKey)) continue;
        seenItems.add(itemKey);

        // Process as signal
        const content = `${item.title} ${item.description || ''}`;
        await this.processSignal(source, content, item.link, item.author, item.pubDate);
      }

      // Keep set size reasonable
      if (seenItems.size > 1000) {
        const arr = Array.from(seenItems);
        seenItems.clear();
        arr.slice(-500).forEach(k => seenItems.add(k));
      }
    } catch (error) {
      logger.error(`[SignalMonitor] RSS fetch error for ${source.name}:`, error);
    }
  }

  private parseRSSItems(xml: string): Array<{
    title: string;
    description?: string;
    link?: string;
    guid?: string;
    author?: string;
    pubDate?: number;
  }> {
    const items: Array<{
      title: string;
      description?: string;
      link?: string;
      guid?: string;
      author?: string;
      pubDate?: number;
    }> = [];

    // Simple XML parsing (could use a proper parser)
    const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];

    for (const itemXml of itemMatches) {
      const title = this.extractXmlTag(itemXml, 'title');
      if (!title) continue;

      items.push({
        title,
        description: this.extractXmlTag(itemXml, 'description'),
        link: this.extractXmlTag(itemXml, 'link'),
        guid: this.extractXmlTag(itemXml, 'guid'),
        author: this.extractXmlTag(itemXml, 'author') || this.extractXmlTag(itemXml, 'dc:creator'),
        pubDate: this.parseRSSDate(this.extractXmlTag(itemXml, 'pubDate')),
      });
    }

    return items;
  }

  private extractXmlTag(xml: string, tag: string): string | undefined {
    const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? (match[1] || match[2])?.trim() : undefined;
  }

  private parseRSSDate(dateStr?: string): number | undefined {
    if (!dateStr) return undefined;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? undefined : date.getTime();
  }

  // --------------------------------------------------------------------------
  // Twitter/X Checking (via Nitter)
  // --------------------------------------------------------------------------

  private async checkTwitter(source: SignalSource): Promise<void> {
    const nitterInstance = source.config.nitterInstance || 'https://nitter.net';
    const username = source.config.username;

    if (!username) return;

    try {
      const url = `${nitterInstance}/${username}/rss`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (!response.ok) return;

      const text = await response.text();
      const items = this.parseRSSItems(text);
      const seenItems = this.lastSeenItems.get(source.id)!;

      for (const item of items) {
        const itemKey = item.guid || item.link || item.title;
        if (seenItems.has(itemKey)) continue;
        seenItems.add(itemKey);

        await this.processSignal(source, item.title, item.link, username, item.pubDate);
      }

      if (seenItems.size > 1000) {
        const arr = Array.from(seenItems);
        seenItems.clear();
        arr.slice(-500).forEach(k => seenItems.add(k));
      }
    } catch (error) {
      logger.error(`[SignalMonitor] Twitter fetch error for ${source.name}:`, error);
    }
  }

  // --------------------------------------------------------------------------
  // Webhook Handler (for incoming signals)
  // --------------------------------------------------------------------------

  handleWebhook(sourceId: string, payload: {
    content: string;
    url?: string;
    author?: string;
    secret?: string;
  }): boolean {
    const source = this.sources.get(sourceId);
    if (!source || source.type !== 'webhook') return false;

    // Verify secret if configured
    if (source.config.webhookSecret && payload.secret !== source.config.webhookSecret) {
      return false;
    }

    this.processSignal(source, payload.content, payload.url, payload.author, Date.now());
    return true;
  }

  // --------------------------------------------------------------------------
  // Signal Processing
  // --------------------------------------------------------------------------

  private async processSignal(
    source: SignalSource,
    content: string,
    url?: string,
    author?: string,
    timestamp?: number
  ): Promise<void> {
    source.stats.signalsReceived++;

    // Detect mints in content
    const detectedMints = this.extractMints(content);

    // Analyze sentiment
    const sentiment = this.analyzeSentiment(content);

    // Match filters
    const matchedFilters = this.matchFilters(source.filters, content, detectedMints, sentiment);

    // Create signal object
    const signal: DetectedSignal = {
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.type,
      content: content.slice(0, 500), // Truncate
      url,
      author,
      timestamp: timestamp || Date.now(),
      matchedFilters,
      detectedMints,
      sentiment: sentiment.sentiment,
      confidence: sentiment.confidence,
    };

    logger.info(`[SignalMonitor] Signal from ${source.name}: ${content.slice(0, 100)}...`);
    this.emit('signalReceived', { source, signal });

    // Determine if we should trade
    if (matchedFilters.length === 0 && source.tradeConfig.defaultAction === 'none') {
      return; // No match, no default action
    }

    source.stats.signalsMatched++;
    source.lastSignalAt = Date.now();

    // Check cooldown
    const lastTrade = this.tradeCooldowns.get(source.id) ?? 0;
    if (Date.now() - lastTrade < source.tradeConfig.cooldownMs!) {
      logger.info(`[SignalMonitor] Skipping trade (cooldown)`);
      return;
    }

    // Determine action and mint
    let action: 'buy' | 'sell' = source.tradeConfig.defaultAction as 'buy' | 'sell';
    if (matchedFilters.length > 0) {
      const actionFilter = matchedFilters.find(f => f.action !== 'ignore');
      if (actionFilter) action = actionFilter.action as 'buy' | 'sell';
    }

    // Use sentiment if no explicit filter
    if (matchedFilters.length === 0) {
      if (sentiment.sentiment === 'bullish' && sentiment.confidence > 0.6) {
        action = 'buy';
      } else if (sentiment.sentiment === 'bearish' && sentiment.confidence > 0.6) {
        action = 'sell';
      }
    }

    // Get mint to trade
    const mint = detectedMints[0];
    if (source.tradeConfig.requireMintInMessage && !mint) {
      logger.info(`[SignalMonitor] Skipping trade (no mint found in message)`);
      return;
    }

    if (!mint) {
      logger.info(`[SignalMonitor] Skipping trade (no mint)`);
      return;
    }

    // Execute trade
    const result = await this.executeTrade(source, signal, action, mint);

    this.emit('tradeExecuted', { source, signal, result });
  }

  private extractMints(content: string): string[] {
    const matches = content.match(MINT_REGEX) || [];
    // Filter to likely Solana addresses (base58, reasonable length)
    return [...new Set(matches)].filter(m => m.length >= 32 && m.length <= 44);
  }

  private analyzeSentiment(content: string): { sentiment: 'bullish' | 'bearish' | 'neutral'; confidence: number } {
    const lower = content.toLowerCase();

    let bullishScore = 0;
    let bearishScore = 0;

    for (const kw of BULLISH_KEYWORDS) {
      if (lower.includes(kw)) bullishScore++;
    }

    for (const kw of BEARISH_KEYWORDS) {
      if (lower.includes(kw)) bearishScore++;
    }

    const total = bullishScore + bearishScore;
    if (total === 0) {
      return { sentiment: 'neutral', confidence: 0 };
    }

    if (bullishScore > bearishScore) {
      return {
        sentiment: 'bullish',
        confidence: bullishScore / (total + 2), // Dampen confidence
      };
    } else if (bearishScore > bullishScore) {
      return {
        sentiment: 'bearish',
        confidence: bearishScore / (total + 2),
      };
    }

    return { sentiment: 'neutral', confidence: 0.5 };
  }

  private matchFilters(
    filters: SignalFilter[],
    content: string,
    mints: string[],
    sentiment: { sentiment: string; confidence: number }
  ): SignalFilter[] {
    const matched: SignalFilter[] = [];
    const lower = content.toLowerCase();

    for (const filter of filters) {
      switch (filter.type) {
        case 'keyword':
          if (lower.includes(filter.value.toLowerCase())) {
            matched.push(filter);
          }
          break;

        case 'mint':
          if (mints.includes(filter.value)) {
            matched.push(filter);
          }
          break;

        case 'sentiment':
          if (sentiment.sentiment === filter.value && sentiment.confidence >= (filter.confidence ?? 0.5)) {
            matched.push(filter);
          }
          break;

        case 'regex':
          try {
            if (filter.value.length > 200) break;
            const regex = new RegExp(filter.value, 'i');
            if (regex.test(content.slice(0, 10000))) {
              matched.push(filter);
            }
          } catch {
            // Invalid regex, skip
          }
          break;
      }
    }

    return matched;
  }

  private async executeTrade(
    source: SignalSource,
    signal: DetectedSignal,
    action: 'buy' | 'sell',
    mint: string
  ): Promise<SignalTradeResult> {
    const config = source.tradeConfig;
    source.stats.tradesExecuted++;
    this.tradeCooldowns.set(source.id, Date.now());

    const params: SwarmTradeParams = {
      mint,
      action,
      amountPerWallet: action === 'buy' ? config.amountSol : '100%',
      denominatedInSol: action === 'buy',
      slippageBps: config.slippageBps,
      executionMode: config.executionMode,
      dex: config.dex,
      poolAddress: config.poolAddress,
    };

    try {
      const result = action === 'buy'
        ? await this.swarm.coordinatedBuy(params)
        : await this.swarm.coordinatedSell(params);

      // Calculate total SOL received for sells from wallet results
      const totalSolReceived = action === 'sell'
        ? result.walletResults.reduce((sum, r) => sum + (r.solAmount ?? 0), 0)
        : undefined;

      if (result.success) {
        source.stats.tradesSuccessful++;
        if (action === 'buy') {
          source.stats.totalSolSpent += result.totalSolSpent ?? 0;
        } else {
          source.stats.totalSolReceived += totalSolReceived ?? 0;
        }
      } else {
        source.stats.tradesFailed++;
      }

      return {
        signal,
        action,
        mint,
        success: result.success,
        solAmount: action === 'buy' ? result.totalSolSpent : totalSolReceived,
        signature: result.walletResults?.[0]?.signature,
      };
    } catch (error) {
      source.stats.tradesFailed++;
      return {
        signal,
        action,
        mint,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  destroy(): void {
    for (const source of this.sources.values()) {
      this.stopPolling(source);
    }
    this.sources.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// Factory
// ============================================================================

let signalMonitorInstance: SwarmSignalMonitor | null = null;

export function getSwarmSignalMonitor(swarm: PumpFunSwarm): SwarmSignalMonitor {
  if (!signalMonitorInstance) {
    signalMonitorInstance = new SwarmSignalMonitor(swarm);
  }
  return signalMonitorInstance;
}

export function destroySwarmSignalMonitor(): void {
  if (signalMonitorInstance) {
    signalMonitorInstance.destroy();
    signalMonitorInstance = null;
  }
}
