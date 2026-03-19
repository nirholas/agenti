/**
 * Trade Ledger - Integrity Hashing
 *
 * SHA-256 hashing for decision record integrity verification.
 */

import { createHash } from 'crypto';
import type { DecisionRecord } from './types';

/**
 * Fields included in the hash (immutable decision data)
 */
const HASH_FIELDS = [
  'userId',
  'sessionId',
  'timestamp',
  'category',
  'action',
  'platform',
  'marketId',
  'inputs',
  'analysis',
  'constraints',
  'confidence',
  'decision',
  'reason',
] as const;

/**
 * Create a deterministic hash of the decision record
 */
export function hashDecision(record: Partial<DecisionRecord>): string {
  const hashData: Record<string, unknown> = {};

  for (const field of HASH_FIELDS) {
    if (record[field] !== undefined) {
      hashData[field] = record[field];
    }
  }

  // Sort keys for deterministic serialization
  const serialized = JSON.stringify(hashData, Object.keys(hashData).sort());

  return createHash('sha256').update(serialized).digest('hex');
}

/**
 * Verify that a hash matches the record
 */
export function verifyHash(record: DecisionRecord, expectedHash: string): boolean {
  const computedHash = hashDecision(record);
  return computedHash === expectedHash;
}

/**
 * Create a commitment object with hash and timestamp
 */
export function createCommitment(record: Partial<DecisionRecord>): {
  hash: string;
  timestamp: number;
  dataHash: string;
} {
  const timestamp = Date.now();
  const dataHash = hashDecision(record);

  // Commitment includes timestamp for uniqueness
  const commitmentData = JSON.stringify({ dataHash, timestamp });
  const hash = createHash('sha256').update(commitmentData).digest('hex');

  return { hash, timestamp, dataHash };
}

/**
 * Generate a short ID from hash (first 8 chars)
 */
export function shortHash(hash: string): string {
  return hash.slice(0, 8);
}
