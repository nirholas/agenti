/**
 * Cryptographic utilities for key management
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

/**
 * Get encryption key from environment secret
 */
function getEncryptionKey(salt: Buffer): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET || process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET or ENCRYPTION_SECRET must be set for key encryption');
  }
  
  // Derive a key using PBKDF2
  return crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a private key
 * Returns base64 encoded: salt + iv + authTag + ciphertext
 */
export function encryptPrivateKey(privateKey: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = getEncryptionKey(salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(privateKey, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  
  // Combine: salt + iv + authTag + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);
  
  return combined.toString('base64');
}

/**
 * Decrypt a private key
 */
export function decryptPrivateKey(encryptedData: string): string {
  const combined = Buffer.from(encryptedData, 'base64');
  
  // Extract parts
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  
  const key = getEncryptionKey(salt);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}

/**
 * Generate a new EVM wallet (Ethereum/Base)
 */
export function generateEVMWallet(): { address: string; privateKey: string } {
  // Generate random 32 bytes for private key
  const privateKeyBytes = crypto.randomBytes(32);
  const privateKey = `0x${privateKeyBytes.toString('hex')}`;
  
  // We'll compute the address on the client side using viem
  // For now, return the private key and let the caller compute address
  return {
    address: '', // Will be computed by caller
    privateKey,
  };
}

// Alias for backward compatibility
export const generateWallet = generateEVMWallet;

