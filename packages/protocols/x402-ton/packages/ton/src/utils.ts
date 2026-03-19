import { Cell, Address } from '@ton/core';
import { createHash } from 'crypto';
import { WalletContractV5R1 } from '@ton/ton';
import { MAX_BOC_SIZE, MAX_DEPTH, MAX_CELLS, RAW_ADDRESS_REGEX } from './constants';

/**
 * Validate a base64-encoded BOC. Returns the parsed root Cell.
 * Enforces size, canonical form, depth, and cell count limits.
 */
export function validateBoc(base64Boc: string): Cell {
  const raw = Buffer.from(base64Boc, 'base64');
  if (raw.length > MAX_BOC_SIZE) {
    throw new Error('boc_too_large');
  }

  let cells: Cell[];
  try {
    cells = Cell.fromBoc(raw);
  } catch {
    throw new Error('boc_parse_failed');
  }

  const cell = cells[0];
  if (!cell) {
    throw new Error('boc_empty');
  }

  // Canonical round-trip check
  const reserialized = cell.toBoc();
  if (!raw.equals(reserialized)) {
    throw new Error('boc_not_canonical');
  }

  // Iterative depth check
  if (getCellDepth(cell) > MAX_DEPTH) {
    throw new Error('boc_depth_exceeded');
  }

  // Iterative cell count check
  if (getCellCount(cell) > MAX_CELLS) {
    throw new Error('boc_cells_exceeded');
  }

  return cell;
}

/**
 * Compute the maximum depth of a cell tree using iterative BFS.
 */
export function getCellDepth(cell: Cell): number {
  let maxDepth = 0;
  const visited = new Set<string>();
  const queue: Array<{ cell: Cell; depth: number }> = [{ cell, depth: 0 }];

  for (let current = queue.shift(); current; current = queue.shift()) {
    const hash = current.cell.hash().toString('hex');
    if (visited.has(hash)) continue;
    visited.add(hash);
    if (current.depth > maxDepth) {
      maxDepth = current.depth;
    }
    for (const ref of current.cell.refs) {
      queue.push({ cell: ref, depth: current.depth + 1 });
    }
  }

  return maxDepth;
}

/**
 * Count total cells in a cell tree using iterative BFS.
 */
export function getCellCount(cell: Cell): number {
  let count = 0;
  const visited = new Set<string>();
  const queue: Cell[] = [cell];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const hash = current.hash().toString('hex');
    if (visited.has(hash)) continue;
    visited.add(hash);
    count++;
    for (let i = 0; i < current.refs.length; i++) {
      const ref = current.refs[i];
      if (ref) queue.push(ref);
    }
  }

  return count;
}

/**
 * Validate a raw TON address (workchain:hash format).
 * Only workchain 0 and -1 are accepted.
 */
export function validateTonAddress(raw: string): boolean {
  const match = raw.match(RAW_ADDRESS_REGEX);
  if (!match) return false;
  const workchain = parseInt(match[1] ?? '', 10);
  return workchain === 0 || workchain === -1;
}

/**
 * Convert raw hex address to base64url-encoded friendly address.
 */
export function rawToBase64url(raw: string, bounceable = true): string {
  const address = Address.parse(raw);
  return address.toString({ bounceable, testOnly: false, urlSafe: true });
}

/**
 * Convert base64url-encoded friendly address to raw hex format.
 */
export function base64urlToRaw(addr: string): string {
  const address = Address.parse(addr);
  return `${address.workChain}:${address.hash.toString('hex')}`;
}

/**
 * Convert a human-readable amount string to atomic units (BigInt).
 * Uses string splitting — NEVER float math.
 */
export function toAtomicUnits(humanAmount: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(humanAmount)) {
    throw new Error(`Invalid amount format: ${humanAmount}`);
  }
  const parts = humanAmount.split('.');
  const whole = parts[0] || '0';
  const frac = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);
  const result = BigInt(whole + frac);
  if (result < 0n) {
    throw new Error('Amount must be non-negative');
  }
  return result;
}

/**
 * Convert atomic units (BigInt) back to human-readable string.
 */
export function fromAtomicUnits(atomic: bigint, decimals: number): string {
  const str = atomic.toString();
  if (decimals === 0) return str;

  const padded = str.padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals);
  const frac = padded.slice(padded.length - decimals);

  // Trim trailing zeros from fractional part
  const trimmed = frac.replace(/0+$/, '');
  return trimmed.length > 0 ? `${whole}.${trimmed}` : whole;
}

/**
 * Hash a base64-encoded BOC with SHA-256 for safe logging.
 * NEVER log the full BOC content.
 */
export function hashBoc(base64Boc: string): string {
  return createHash('sha256').update(base64Boc).digest('hex');
}

/**
 * Extract the payer wallet address from a payment payload without full verification.
 * Used for pre-processing rate limiting — cheap (~1ms), no RPC calls.
 * Returns raw hex address (0:<64hex>) or null on any parse failure.
 * NEVER throws.
 */
export function extractPayerFromPayload(
  signedBoc: string | undefined,
  walletPublicKey: string | undefined,
): string | null {
  try {
    if (!signedBoc || !walletPublicKey) return null;

    const keyBuf = Buffer.from(walletPublicKey, 'hex');
    if (keyBuf.length !== 32) return null;

    const contract = WalletContractV5R1.create({ workchain: 0, publicKey: keyBuf });
    return `${contract.address.workChain}:${contract.address.hash.toString('hex')}`;
  } catch {
    return null;
  }
}
