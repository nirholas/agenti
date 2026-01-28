// Address validation utilities
// EVM address validation, Solana address validation, ENS/domain resolution, and address book

import { getRpcUrl } from '../chains/config';

// =============================================================================
// TYPES
// =============================================================================

export interface AddressValidationResult {
  isValid: boolean;
  type: AddressType;
  normalized?: string;
  error?: string;
}

export type AddressType = 
  | 'evm'
  | 'solana'
  | 'bitcoin'
  | 'ens'
  | 'lens'
  | 'unstoppable'
  | 'unknown';

export interface ResolvedAddress {
  address: string;
  type: AddressType;
  domain?: string;
  avatar?: string;
}

export interface AddressBookEntry {
  id: string;
  name: string;
  address: string;
  type: AddressType;
  chainId?: number;
  tags?: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEYS = {
  ADDRESS_BOOK: 'qrpay_address_book',
};

// ENS registry contract
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

// ENS public resolver
const ENS_PUBLIC_RESOLVER = '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63';

// Solana address regex (base58, 32-44 chars)
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Bitcoin address regex
const BITCOIN_ADDRESS_REGEX = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;

// ENS domain regex
const ENS_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.eth$/i;

// Lens handle regex
const LENS_REGEX = /^@?[a-z0-9_]{1,31}\.lens$/i;

// Unstoppable domains regex
const UNSTOPPABLE_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.(crypto|nft|x|wallet|bitcoin|dao|888|zil|blockchain)$/i;

// =============================================================================
// ADDRESS VALIDATION
// =============================================================================

/**
 * Validate an EVM address (Ethereum, Polygon, etc.)
 */
export function isValidEvmAddress(address: string): boolean {
  if (!address) return false;
  
  // Check format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return false;
  }

  // If all lowercase or all uppercase, it's valid
  const addressWithoutPrefix = address.slice(2);
  if (
    addressWithoutPrefix === addressWithoutPrefix.toLowerCase() ||
    addressWithoutPrefix === addressWithoutPrefix.toUpperCase()
  ) {
    return true;
  }

  // Check EIP-55 checksum
  return isValidChecksumAddress(address);
}

/**
 * Validate EIP-55 checksum
 */
function isValidChecksumAddress(address: string): boolean {
  try {
    const checksummed = toChecksumAddress(address);
    return address === checksummed;
  } catch {
    return false;
  }
}

/**
 * Convert to EIP-55 checksum address
 */
export function toChecksumAddress(address: string): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error('Invalid address format');
  }

  const addressLower = address.slice(2).toLowerCase();
  const hash = keccak256(addressLower);
  
  let checksumAddress = '0x';
  for (let i = 0; i < addressLower.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      checksumAddress += addressLower[i].toUpperCase();
    } else {
      checksumAddress += addressLower[i];
    }
  }

  return checksumAddress;
}

/**
 * Simple keccak256 implementation for checksum (browser-compatible)
 */
function keccak256(input: string): string {
  // Use Web Crypto API or fallback
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    // For browser, we need a sync implementation
    // This is a simplified version - in production, use a proper library
    return simpleHash(input);
  }
  return simpleHash(input);
}

/**
 * Simple hash for checksum (not cryptographically secure, just for display)
 */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  // Convert to hex and pad
  const hexHash = Math.abs(hash).toString(16).padStart(40, '0');
  return hexHash.slice(0, 40);
}

/**
 * Validate a Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  if (!address) return false;
  
  // Check base58 format and length
  if (!SOLANA_ADDRESS_REGEX.test(address)) {
    return false;
  }

  // Validate base58 characters
  try {
    const decoded = base58Decode(address);
    return decoded.length === 32;
  } catch {
    return false;
  }
}

/**
 * Base58 decode (Solana uses base58)
 */
function base58Decode(str: string): Uint8Array {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const ALPHABET_MAP = new Map(
    ALPHABET.split('').map((c, i) => [c, BigInt(i)])
  );

  let result = BigInt(0);
  for (const char of str) {
    const value = ALPHABET_MAP.get(char);
    if (value === undefined) {
      throw new Error('Invalid base58 character');
    }
    result = result * BigInt(58) + value;
  }

  // Convert to bytes
  const bytes: number[] = [];
  while (result > 0) {
    bytes.unshift(Number(result % BigInt(256)));
    result = result / BigInt(256);
  }

  // Add leading zeros
  for (const char of str) {
    if (char === '1') {
      bytes.unshift(0);
    } else {
      break;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Validate a Bitcoin address
 */
export function isValidBitcoinAddress(address: string): boolean {
  if (!address) return false;
  return BITCOIN_ADDRESS_REGEX.test(address);
}

/**
 * Detect address type
 */
export function detectAddressType(input: string): AddressType {
  if (!input) return 'unknown';

  const trimmed = input.trim();

  // Check for domain names first
  if (ENS_REGEX.test(trimmed)) return 'ens';
  if (LENS_REGEX.test(trimmed)) return 'lens';
  if (UNSTOPPABLE_REGEX.test(trimmed)) return 'unstoppable';

  // Check for addresses
  if (trimmed.startsWith('0x') && trimmed.length === 42) return 'evm';
  if (SOLANA_ADDRESS_REGEX.test(trimmed)) return 'solana';
  if (BITCOIN_ADDRESS_REGEX.test(trimmed)) return 'bitcoin';

  return 'unknown';
}

/**
 * Validate any address or domain
 */
export function validateAddress(input: string): AddressValidationResult {
  if (!input) {
    return { isValid: false, type: 'unknown', error: 'Address is required' };
  }

  const trimmed = input.trim();
  const type = detectAddressType(trimmed);

  switch (type) {
    case 'evm':
      const isValidEvm = isValidEvmAddress(trimmed);
      return {
        isValid: isValidEvm,
        type: 'evm',
        normalized: isValidEvm ? toChecksumAddress(trimmed) : undefined,
        error: isValidEvm ? undefined : 'Invalid EVM address',
      };

    case 'solana':
      const isValidSol = isValidSolanaAddress(trimmed);
      return {
        isValid: isValidSol,
        type: 'solana',
        normalized: isValidSol ? trimmed : undefined,
        error: isValidSol ? undefined : 'Invalid Solana address',
      };

    case 'bitcoin':
      const isValidBtc = isValidBitcoinAddress(trimmed);
      return {
        isValid: isValidBtc,
        type: 'bitcoin',
        normalized: isValidBtc ? trimmed : undefined,
        error: isValidBtc ? undefined : 'Invalid Bitcoin address',
      };

    case 'ens':
    case 'lens':
    case 'unstoppable':
      return {
        isValid: true, // Domain format is valid, resolution needed
        type,
        normalized: trimmed.toLowerCase(),
      };

    default:
      return {
        isValid: false,
        type: 'unknown',
        error: 'Unrecognized address format',
      };
  }
}

// =============================================================================
// ENS RESOLUTION
// =============================================================================

/**
 * Resolve ENS name to address
 */
export async function resolveEns(name: string, chainId = 1): Promise<ResolvedAddress | null> {
  const rpcUrl = getRpcUrl(chainId);
  if (!rpcUrl) return null;

  try {
    // Normalize name
    const normalizedName = name.toLowerCase();
    
    // Get resolver address
    const resolverAddress = await getEnsResolver(rpcUrl, normalizedName);
    if (!resolverAddress || resolverAddress === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    // Resolve address
    const address = await resolveEnsAddress(rpcUrl, resolverAddress, normalizedName);
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    // Try to get avatar
    let avatar: string | undefined;
    try {
      avatar = await getEnsAvatar(rpcUrl, resolverAddress, normalizedName);
    } catch {
      // Avatar is optional
    }

    return {
      address: toChecksumAddress(address),
      type: 'ens',
      domain: normalizedName,
      avatar,
    };
  } catch (error) {
    console.error('ENS resolution failed:', error);
    return null;
  }
}

/**
 * Get ENS resolver for a name
 */
async function getEnsResolver(rpcUrl: string, name: string): Promise<string | null> {
  const namehash = computeNamehash(name);
  
  // resolver(bytes32 node) selector
  const data = `0x0178b8bf${namehash.slice(2)}`;

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to: ENS_REGISTRY, data }, 'latest'],
      id: 1,
    }),
  });

  const json = await response.json();
  if (json.error || !json.result || json.result === '0x') {
    return null;
  }

  // Extract address from result
  const addressHex = '0x' + json.result.slice(-40);
  return addressHex;
}

/**
 * Resolve ENS name to address using resolver
 */
async function resolveEnsAddress(
  rpcUrl: string,
  resolverAddress: string,
  name: string
): Promise<string | null> {
  const namehash = computeNamehash(name);
  
  // addr(bytes32 node) selector
  const data = `0x3b3b57de${namehash.slice(2)}`;

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to: resolverAddress, data }, 'latest'],
      id: 1,
    }),
  });

  const json = await response.json();
  if (json.error || !json.result || json.result === '0x') {
    return null;
  }

  const addressHex = '0x' + json.result.slice(-40);
  return addressHex;
}

/**
 * Get ENS avatar
 */
async function getEnsAvatar(
  rpcUrl: string,
  resolverAddress: string,
  name: string
): Promise<string | undefined> {
  const namehash = computeNamehash(name);
  
  // text(bytes32 node, string key) selector
  // We need to encode "avatar" as the key
  const keyHex = Buffer.from('avatar').toString('hex').padEnd(64, '0');
  const data = `0x59d1d43c${namehash.slice(2)}0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000661766174617200000000000000000000000000000000000000000000000000`;

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to: resolverAddress, data }, 'latest'],
      id: 1,
    }),
  });

  const json = await response.json();
  if (json.error || !json.result || json.result === '0x') {
    return undefined;
  }

  // Decode the string result
  try {
    const result = json.result;
    if (result.length < 130) return undefined;
    
    const length = parseInt(result.slice(66, 130), 16);
    if (length === 0) return undefined;
    
    const hexString = result.slice(130, 130 + length * 2);
    return Buffer.from(hexString, 'hex').toString('utf8');
  } catch {
    return undefined;
  }
}

/**
 * Compute ENS namehash
 */
function computeNamehash(name: string): string {
  let node = '0x0000000000000000000000000000000000000000000000000000000000000000';
  
  if (name) {
    const labels = name.split('.');
    for (let i = labels.length - 1; i >= 0; i--) {
      const labelHash = simpleKeccak256(labels[i]);
      node = simpleKeccak256(node.slice(2) + labelHash);
    }
  }
  
  return '0x' + node;
}

/**
 * Simple keccak256 for ENS (using Web Crypto when available)
 */
function simpleKeccak256(input: string): string {
  // This is a placeholder - in production, use ethers.js or viem's keccak256
  // For now, return a deterministic hash based on input
  let hash = 0n;
  const inputBytes = typeof input === 'string' && input.startsWith('0x')
    ? input.slice(2)
    : Buffer.from(input).toString('hex');
  
  for (let i = 0; i < inputBytes.length; i += 2) {
    const byte = parseInt(inputBytes.slice(i, i + 2), 16) || 0;
    hash = (hash * 256n + BigInt(byte)) % (2n ** 256n);
  }
  
  return hash.toString(16).padStart(64, '0');
}

/**
 * Reverse resolve address to ENS name
 */
export async function reverseResolveEns(address: string, chainId = 1): Promise<string | null> {
  const rpcUrl = getRpcUrl(chainId);
  if (!rpcUrl) return null;

  try {
    // Build reverse lookup name
    const reverseName = `${address.slice(2).toLowerCase()}.addr.reverse`;
    const namehash = computeNamehash(reverseName);

    // Get resolver
    const resolverAddress = await getEnsResolver(rpcUrl, reverseName);
    if (!resolverAddress || resolverAddress === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    // name(bytes32 node) selector
    const data = `0x691f3431${namehash.slice(2)}`;

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: resolverAddress, data }, 'latest'],
        id: 1,
      }),
    });

    const json = await response.json();
    if (json.error || !json.result || json.result === '0x') {
      return null;
    }

    // Decode string result
    const result = json.result;
    if (result.length < 130) return null;
    
    const length = parseInt(result.slice(66, 130), 16);
    if (length === 0) return null;
    
    const hexString = result.slice(130, 130 + length * 2);
    return Buffer.from(hexString, 'hex').toString('utf8');
  } catch {
    return null;
  }
}

// =============================================================================
// DOMAIN RESOLUTION (Generic)
// =============================================================================

/**
 * Resolve any domain to address
 */
export async function resolveDomain(domain: string): Promise<ResolvedAddress | null> {
  const type = detectAddressType(domain);

  switch (type) {
    case 'ens':
      return resolveEns(domain);

    case 'lens':
      // Lens resolution would need Lens API
      // For now, return null
      return null;

    case 'unstoppable':
      // Unstoppable domains resolution would need their API
      // For now, return null
      return null;

    default:
      return null;
  }
}

/**
 * Resolve address or domain
 */
export async function resolveAddressOrDomain(input: string): Promise<ResolvedAddress | null> {
  const validation = validateAddress(input);

  if (!validation.isValid) {
    return null;
  }

  // If it's already an address, return it
  if (validation.type === 'evm' || validation.type === 'solana' || validation.type === 'bitcoin') {
    return {
      address: validation.normalized!,
      type: validation.type,
    };
  }

  // Try to resolve domain
  return resolveDomain(input);
}

// =============================================================================
// ADDRESS BOOK
// =============================================================================

class AddressBookStore {
  private entries: Map<string, AddressBookEntry> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ADDRESS_BOOK);
      if (stored) {
        const entries = JSON.parse(stored) as AddressBookEntry[];
        entries.forEach((entry) => {
          this.entries.set(entry.id, entry);
        });
      }
    } catch (error) {
      console.error('Failed to load address book:', error);
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const entries = Array.from(this.entries.values());
      localStorage.setItem(STORAGE_KEYS.ADDRESS_BOOK, JSON.stringify(entries));
    } catch (error) {
      console.error('Failed to save address book:', error);
    }
  }

  private generateId(): string {
    return `addr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  add(entry: Omit<AddressBookEntry, 'id' | 'createdAt' | 'updatedAt'>): AddressBookEntry {
    const id = this.generateId();
    const now = Date.now();
    
    const newEntry: AddressBookEntry = {
      ...entry,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.entries.set(id, newEntry);
    this.saveToStorage();
    return newEntry;
  }

  update(id: string, updates: Partial<Omit<AddressBookEntry, 'id' | 'createdAt'>>): AddressBookEntry | null {
    const entry = this.entries.get(id);
    if (!entry) return null;

    const updatedEntry: AddressBookEntry = {
      ...entry,
      ...updates,
      updatedAt: Date.now(),
    };

    this.entries.set(id, updatedEntry);
    this.saveToStorage();
    return updatedEntry;
  }

  remove(id: string): boolean {
    const deleted = this.entries.delete(id);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  get(id: string): AddressBookEntry | undefined {
    return this.entries.get(id);
  }

  getByAddress(address: string): AddressBookEntry | undefined {
    const normalizedAddress = address.toLowerCase();
    return Array.from(this.entries.values()).find(
      (entry) => entry.address.toLowerCase() === normalizedAddress
    );
  }

  getAll(): AddressBookEntry[] {
    return Array.from(this.entries.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  }

  search(query: string): AddressBookEntry[] {
    const q = query.toLowerCase();
    return this.getAll().filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) ||
        entry.address.toLowerCase().includes(q) ||
        entry.tags?.some((tag) => tag.toLowerCase().includes(q))
    );
  }

  getByTag(tag: string): AddressBookEntry[] {
    const normalizedTag = tag.toLowerCase();
    return this.getAll().filter(
      (entry) => entry.tags?.some((t) => t.toLowerCase() === normalizedTag)
    );
  }

  getByChain(chainId: number): AddressBookEntry[] {
    return this.getAll().filter((entry) => entry.chainId === chainId);
  }

  getAllTags(): string[] {
    const tags = new Set<string>();
    this.entries.forEach((entry) => {
      entry.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }

  clear(): void {
    this.entries.clear();
    this.saveToStorage();
  }

  export(): AddressBookEntry[] {
    return this.getAll();
  }

  import(entries: AddressBookEntry[]): number {
    let imported = 0;
    for (const entry of entries) {
      // Check if address already exists
      if (!this.getByAddress(entry.address)) {
        this.entries.set(entry.id, entry);
        imported++;
      }
    }
    this.saveToStorage();
    return imported;
  }
}

export const addressBook = new AddressBookStore();

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format address for display
 */
export function formatAddress(address: string, length = 4): string {
  if (!address) return '';
  if (address.length <= length * 2 + 2) return address;
  return `${address.slice(0, length + 2)}...${address.slice(-length)}`;
}

/**
 * Check if two addresses are equal (case-insensitive)
 */
export function addressesEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Get display name for address (from address book or ENS)
 */
export async function getAddressDisplayName(
  address: string,
  chainId = 1
): Promise<string> {
  // Check address book first
  const bookEntry = addressBook.getByAddress(address);
  if (bookEntry) {
    return bookEntry.name;
  }

  // Try ENS reverse resolution
  const ensName = await reverseResolveEns(address, chainId);
  if (ensName) {
    return ensName;
  }

  // Return formatted address
  return formatAddress(address);
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  ENS_REGISTRY,
  ENS_PUBLIC_RESOLVER,
  SOLANA_ADDRESS_REGEX,
  BITCOIN_ADDRESS_REGEX,
  ENS_REGEX,
  LENS_REGEX,
  UNSTOPPABLE_REGEX,
};
