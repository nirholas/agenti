/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every expert was once a beginner 📚
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility to merge Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a wallet address to show only first and last characters
 */
export function truncateAddress(address: string, startChars = 6, endChars = 4): string {
  if (!address) return '';
  if (address.length <= startChars + endChars) return address;
  return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
}

/**
 * Format a number with commas for better readability
 */
export function formatNumber(num: number | string, decimals = 2): string {
  const number = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(number)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(number);
}

/**
 * Format crypto balance with proper decimals
 */
export function formatBalance(balance: string | number, decimals = 4): string {
  const num = typeof balance === 'string' ? parseFloat(balance) : balance;
  if (isNaN(num)) return '0';
  
  if (num === 0) return '0';
  if (num < 0.0001) return '< 0.0001';
  
  return num.toFixed(decimals);
}

/**
 * Delay utility for async operations
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Generate a mock Ethereum address for demo purposes
 */
export function generateMockAddress(): string {
  const hex = '0x' + Array.from({ length: 40 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
  return hex;
}

/**
 * Generate a mock transaction hash for demo purposes
 */
export function generateMockTxHash(): string {
  const hex = '0x' + Array.from({ length: 64 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
  return hex;
}

/**
 * Generate a mock IPFS hash (CIDv1 format) for demo purposes
 */
export function generateMockIPFSHash(): string {
  // CIDv1 format: base58btc encoding of multihash
  // Simplified version for demo - real CIDs are more complex
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const length = 46; // Typical CIDv1 length
  return 'Qm' + Array.from({ length: length - 2 }, () => 
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}
