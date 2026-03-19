import { nanoid } from 'nanoid';
import { getDatabase } from './index.js';
import type { RefundWalletRecord } from './types.js';

/**
 * Create a refund wallet for a resource owner on a specific network
 */
export function createRefundWallet(
  resourceOwnerId: string,
  network: string,
  walletAddress: string,
  encryptedPrivateKey: string
): RefundWalletRecord {
  const db = getDatabase();
  const id = nanoid();

  const stmt = db.prepare(`
    INSERT INTO refund_wallets (id, resource_owner_id, network, wallet_address, encrypted_private_key)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, resourceOwnerId, network, walletAddress, encryptedPrivateKey);

  return getRefundWallet(resourceOwnerId, network)!;
}

/**
 * Get all refund wallets for a resource owner
 */
export function getRefundWalletsByResourceOwner(resourceOwnerId: string): RefundWalletRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM refund_wallets WHERE resource_owner_id = ? ORDER BY network');
  return stmt.all(resourceOwnerId) as RefundWalletRecord[];
}

/**
 * Get a specific refund wallet by resource owner and network
 */
export function getRefundWallet(resourceOwnerId: string, network: string): RefundWalletRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM refund_wallets WHERE resource_owner_id = ? AND network = ?');
  return (stmt.get(resourceOwnerId, network) as RefundWalletRecord) || null;
}

/**
 * Get a refund wallet by ID
 */
export function getRefundWalletById(id: string): RefundWalletRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM refund_wallets WHERE id = ?');
  return (stmt.get(id) as RefundWalletRecord) || null;
}

/**
 * Delete a refund wallet
 */
export function deleteRefundWallet(resourceOwnerId: string, network: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM refund_wallets WHERE resource_owner_id = ? AND network = ?');
  const result = stmt.run(resourceOwnerId, network);
  return result.changes > 0;
}

/**
 * Check if a refund wallet exists for a resource owner on a network
 */
export function hasRefundWallet(resourceOwnerId: string, network: string): boolean {
  const wallet = getRefundWallet(resourceOwnerId, network);
  return wallet !== null;
}

// Legacy aliases for backwards compatibility during migration
/** @deprecated Use getRefundWalletsByResourceOwner */
export const getRefundWalletsByFacilitator = getRefundWalletsByResourceOwner;
