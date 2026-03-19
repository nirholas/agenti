import { randomUUID } from 'crypto';
import { getDatabase } from './index.js';

export interface UserWallet {
  id: string;
  user_id: string;
  wallet_address: string;
  encrypted_private_key: string;
  network: string;
  created_at: string;
}

/**
 * Create a new user wallet
 * Checks if wallet already exists for user on same network before creating
 */
export function createUserWallet(
  userId: string,
  walletAddress: string,
  encryptedPrivateKey: string,
  network: string = 'solana'
): UserWallet {
  const db = getDatabase();

  // Check if wallet already exists for this user on this network
  const existing = getUserWalletByUserIdAndNetwork(userId, network);
  if (existing) {
    throw new Error(`Wallet already exists for user ${userId} on network ${network}`);
  }

  const id = randomUUID();

  const stmt = db.prepare(`
    INSERT INTO user_wallets (id, user_id, wallet_address, encrypted_private_key, network)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, userId, walletAddress, encryptedPrivateKey, network);

  return getUserWalletById(id)!;
}

/**
 * Get a user wallet by ID
 */
export function getUserWalletById(id: string): UserWallet | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM user_wallets WHERE id = ?');
  const wallet = stmt.get(id) as UserWallet | undefined;
  return wallet || null;
}

/**
 * Get a user wallet by user ID (returns first/default wallet for backward compatibility)
 */
export function getUserWalletByUserId(userId: string): UserWallet | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM user_wallets WHERE user_id = ? ORDER BY created_at ASC LIMIT 1');
  const wallet = stmt.get(userId) as UserWallet | undefined;
  return wallet || null;
}

/**
 * Get all wallets for a user (supports multiple wallets per user)
 */
export function getUserWalletsByUserId(userId: string): UserWallet[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM user_wallets WHERE user_id = ? ORDER BY created_at ASC');
  const wallets = stmt.all(userId) as UserWallet[];
  return wallets;
}

/**
 * Get a specific wallet for a user by network
 */
export function getUserWalletByUserIdAndNetwork(userId: string, network: string): UserWallet | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM user_wallets WHERE user_id = ? AND network = ?');
  const wallet = stmt.get(userId, network) as UserWallet | undefined;
  return wallet || null;
}

/**
 * Get a user wallet by wallet address
 */
export function getUserWalletByAddress(address: string): UserWallet | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM user_wallets WHERE wallet_address = ?');
  const wallet = stmt.get(address) as UserWallet | undefined;
  return wallet || null;
}

/**
 * Delete a user wallet
 */
export function deleteUserWallet(userId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM user_wallets WHERE user_id = ?');
  const result = stmt.run(userId);
  return result.changes > 0;
}

/**
 * Delete a specific wallet by user ID and network
 */
export function deleteUserWalletByNetwork(userId: string, network: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM user_wallets WHERE user_id = ? AND network = ?');
  const result = stmt.run(userId, network);
  return result.changes > 0;
}
