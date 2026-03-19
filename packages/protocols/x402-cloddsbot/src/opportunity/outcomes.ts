/**
 * Outcome Normalization - Standardize outcomes across platforms
 *
 * Features:
 * - YES/NO detection and mapping
 * - Inverse market handling
 * - Multi-outcome normalization
 * - Custom outcome aliases
 */

import type { Outcome } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export type NormalizedOutcome = 'YES' | 'NO' | 'OTHER';

export interface OutcomeMapping {
  /** Original outcome name */
  original: string;
  /** Normalized outcome */
  normalized: NormalizedOutcome;
  /** Is this an inverse (NO means YES semantically) */
  isInverse: boolean;
  /** Confidence in mapping (0-1) */
  confidence: number;
}

export interface OutcomeNormalizer {
  /** Normalize an outcome name to YES/NO/OTHER */
  normalize(outcomeName: string): OutcomeMapping;

  /** Find YES outcome from list */
  findYes(outcomes: Outcome[]): Outcome | undefined;

  /** Find NO outcome from list */
  findNo(outcomes: Outcome[]): Outcome | undefined;

  /** Check if two outcomes are equivalent */
  areEquivalent(outcomeA: string, outcomeB: string): boolean;

  /** Check if two outcomes are inverse */
  areInverse(outcomeA: string, outcomeB: string): boolean;

  /** Add custom alias */
  addAlias(alias: string, normalized: NormalizedOutcome): void;

  /** Get all aliases for a normalized outcome */
  getAliases(normalized: NormalizedOutcome): string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Patterns that indicate YES
const YES_PATTERNS = [
  /^yes$/i,
  /^y$/i,
  /^true$/i,
  /^1$/,
  /^will$/i,
  /^pass$/i,
  /^approve[ds]?$/i,
  /^win[s]?$/i,
  /^correct$/i,
  /^happen[s]?$/i,
  /^occur[s]?$/i,
  /^above$/i,
  /^over$/i,
  /^higher$/i,
  /^more$/i,
  /^increase[ds]?$/i,
  /^up$/i,
  /^positive$/i,
  /^bullish$/i,
  /^long$/i,
  /^buy$/i,
  /^confirm[s]?$/i,
];

// Patterns that indicate NO
const NO_PATTERNS = [
  /^no$/i,
  /^n$/i,
  /^false$/i,
  /^0$/,
  /^won't$/i,
  /^will not$/i,
  /^fail[s]?$/i,
  /^reject[s]?$/i,
  /^lose[s]?$/i,
  /^wrong$/i,
  /^not happen$/i,
  /^below$/i,
  /^under$/i,
  /^lower$/i,
  /^less$/i,
  /^decrease[ds]?$/i,
  /^down$/i,
  /^negative$/i,
  /^bearish$/i,
  /^short$/i,
  /^sell$/i,
  /^deny$/i,
];

// Entity-specific YES mappings (political, sports, etc)
const ENTITY_YES_PATTERNS = [
  // Politicians
  /trump/i,
  /biden/i,
  /harris/i,
  /desantis/i,
  /newsom/i,
  /obama/i,
  // Parties
  /republican[s]?$/i,
  /democrat[s]?$/i,
  /gop$/i,
  /dem[s]?$/i,
  // Sports
  /home$/i,
  /favorite$/i,
];

// Inverse patterns (when these are the "YES" option, semantics are inverted)
const INVERSE_PATTERNS = [
  /^not /i,
  /^no /i,
  /^won't /i,
  /^fail/i,
  /^reject/i,
  /before/i, // "before date X" is inverse of "by date X"
];

// =============================================================================
// IMPLEMENTATION
// =============================================================================

export function createOutcomeNormalizer(): OutcomeNormalizer {
  // Custom aliases
  const customAliases = new Map<string, NormalizedOutcome>();
  const aliasesByNormalized = new Map<NormalizedOutcome, Set<string>>();

  aliasesByNormalized.set('YES', new Set());
  aliasesByNormalized.set('NO', new Set());
  aliasesByNormalized.set('OTHER', new Set());

  function normalize(outcomeName: string): OutcomeMapping {
    const trimmed = outcomeName.trim();
    const lower = trimmed.toLowerCase();

    // Check custom aliases first
    const customMatch = customAliases.get(lower);
    if (customMatch) {
      return {
        original: trimmed,
        normalized: customMatch,
        isInverse: false,
        confidence: 1.0,
      };
    }

    // Check for inverse patterns first
    const isInverse = INVERSE_PATTERNS.some((p) => p.test(trimmed));

    // Check YES patterns
    for (const pattern of YES_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          original: trimmed,
          normalized: isInverse ? 'NO' : 'YES',
          isInverse,
          confidence: 0.95,
        };
      }
    }

    // Check NO patterns
    for (const pattern of NO_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          original: trimmed,
          normalized: isInverse ? 'YES' : 'NO',
          isInverse,
          confidence: 0.95,
        };
      }
    }

    // Check entity patterns (lower confidence)
    for (const pattern of ENTITY_YES_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          original: trimmed,
          normalized: 'YES',
          isInverse: false,
          confidence: 0.7, // Lower confidence for entity matching
        };
      }
    }

    // Binary market heuristics
    // If it looks like a person/entity name, it's likely the YES side
    if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(trimmed)) {
      return {
        original: trimmed,
        normalized: 'YES',
        isInverse: false,
        confidence: 0.6,
      };
    }

    // Default to OTHER
    return {
      original: trimmed,
      normalized: 'OTHER',
      isInverse: false,
      confidence: 0.5,
    };
  }

  function findYes(outcomes: Outcome[]): Outcome | undefined {
    // First pass: exact YES match
    for (const outcome of outcomes) {
      const mapping = normalize(outcome.name || '');
      if (mapping.normalized === 'YES' && mapping.confidence >= 0.9) {
        return outcome;
      }
    }

    // Second pass: any YES match
    for (const outcome of outcomes) {
      const mapping = normalize(outcome.name || '');
      if (mapping.normalized === 'YES') {
        return outcome;
      }
    }

    // Third pass: in binary markets, the first outcome is often YES
    if (outcomes.length === 2) {
      return outcomes[0];
    }

    return undefined;
  }

  function findNo(outcomes: Outcome[]): Outcome | undefined {
    // First pass: exact NO match
    for (const outcome of outcomes) {
      const mapping = normalize(outcome.name || '');
      if (mapping.normalized === 'NO' && mapping.confidence >= 0.9) {
        return outcome;
      }
    }

    // Second pass: any NO match
    for (const outcome of outcomes) {
      const mapping = normalize(outcome.name || '');
      if (mapping.normalized === 'NO') {
        return outcome;
      }
    }

    // Third pass: in binary markets, the second outcome is often NO
    if (outcomes.length === 2) {
      return outcomes[1];
    }

    return undefined;
  }

  function areEquivalent(outcomeA: string, outcomeB: string): boolean {
    const mappingA = normalize(outcomeA);
    const mappingB = normalize(outcomeB);

    // Both map to same normalized value
    if (mappingA.normalized === mappingB.normalized) {
      return true;
    }

    // Both OTHER with same lowercase name
    if (
      mappingA.normalized === 'OTHER' &&
      mappingB.normalized === 'OTHER' &&
      outcomeA.toLowerCase() === outcomeB.toLowerCase()
    ) {
      return true;
    }

    return false;
  }

  function areInverse(outcomeA: string, outcomeB: string): boolean {
    const mappingA = normalize(outcomeA);
    const mappingB = normalize(outcomeB);

    // YES and NO are inverse
    if (
      (mappingA.normalized === 'YES' && mappingB.normalized === 'NO') ||
      (mappingA.normalized === 'NO' && mappingB.normalized === 'YES')
    ) {
      return true;
    }

    // Check if one has inverse flag
    if (mappingA.isInverse !== mappingB.isInverse) {
      return mappingA.normalized === mappingB.normalized;
    }

    return false;
  }

  function addAlias(alias: string, normalized: NormalizedOutcome): void {
    const lower = alias.toLowerCase();
    customAliases.set(lower, normalized);
    aliasesByNormalized.get(normalized)?.add(alias);
  }

  function getAliases(normalized: NormalizedOutcome): string[] {
    const custom = Array.from(aliasesByNormalized.get(normalized) || []);

    // Add pattern-matched aliases
    const patterns = normalized === 'YES' ? YES_PATTERNS : normalized === 'NO' ? NO_PATTERNS : [];

    const patternExamples = patterns.slice(0, 5).map((p) => {
      const source = p.source.replace(/[\^$]/g, '').replace(/\[.*?\]/g, '').slice(0, 10);
      return source;
    });

    return [...custom, ...patternExamples];
  }

  return {
    normalize,
    findYes,
    findNo,
    areEquivalent,
    areInverse,
    addAlias,
    getAliases,
  };
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Get the complementary price for a binary outcome
 * If YES = 0.65, then NO = 0.35
 */
export function getComplementaryPrice(price: number): number {
  return Math.max(0, Math.min(1, 1 - price));
}

/**
 * Calculate the implied probability from YES and NO prices
 * Accounts for the "vig" (overround)
 */
export function getImpliedProbability(
  yesPrice: number,
  noPrice: number
): { yes: number; no: number; overround: number } {
  const sum = yesPrice + noPrice;
  const overround = (sum - 1) * 100;

  // Normalize to remove overround
  const yes = yesPrice / sum;
  const no = noPrice / sum;

  return { yes, no, overround };
}

/**
 * Check if prices indicate arbitrage opportunity
 */
export function hasArbitrageOpportunity(
  yesPrice: number,
  noPrice: number
): { hasArbitrage: boolean; edge: number } {
  const sum = yesPrice + noPrice;
  const edge = (1 - sum) * 100;

  return {
    hasArbitrage: sum < 1,
    edge: Math.max(0, edge),
  };
}

/**
 * Find the best outcome to buy given two markets
 * Returns which market to buy YES on, which to buy NO on
 */
export function findBestCrossArbitrage(
  marketA: { yesPrice: number; noPrice: number },
  marketB: { yesPrice: number; noPrice: number }
): {
  strategy: 'buy_yes_a_no_b' | 'buy_no_a_yes_b' | 'none';
  edge: number;
  cost: number;
} {
  // Strategy 1: Buy YES on A, Buy NO on B
  const cost1 = marketA.yesPrice + marketB.noPrice;
  const edge1 = (1 - cost1) * 100;

  // Strategy 2: Buy NO on A, Buy YES on B
  const cost2 = marketA.noPrice + marketB.yesPrice;
  const edge2 = (1 - cost2) * 100;

  if (edge1 > 0 && edge1 >= edge2) {
    return { strategy: 'buy_yes_a_no_b', edge: edge1, cost: cost1 };
  }

  if (edge2 > 0) {
    return { strategy: 'buy_no_a_yes_b', edge: edge2, cost: cost2 };
  }

  return { strategy: 'none', edge: 0, cost: Math.min(cost1, cost2) };
}
