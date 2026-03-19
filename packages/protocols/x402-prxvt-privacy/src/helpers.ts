/**
 * Helper functions for x402 payment flow
 * Inspired by x402-fetch API
 */

import type { Note } from './types';

/** x402 payment response from server */
export interface XPaymentResponse {
  success: boolean;
  txHash?: string;
  network?: string;
  amount?: string;
  error?: string;
}

/** x402 payment requirement */
export interface X402PaymentRequirement {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description?: string;
  mimeType?: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  asset?: string;
  extra?: Record<string, unknown>;
}

/**
 * Decode X-Payment-Response header from server
 * @param header - The X-Payment-Response header value
 * @returns Parsed payment response
 *
 * @example
 * const response = await fetchWithPayment(url);
 * const paymentResponse = decodeXPaymentResponse(response.headers.get('x-payment-response'));
 * console.log(paymentResponse.txHash);
 */
export function decodeXPaymentResponse(header: string | null): XPaymentResponse | null {
  if (!header) return null;

  try {
    // Try base64 decode first
    try {
      const decoded = atob(header);
      return JSON.parse(decoded);
    } catch {
      // If not base64, try direct JSON
      return JSON.parse(header);
    }
  } catch {
    return null;
  }
}

/**
 * Encode X-Payment header for request
 * @param payment - Payment data to encode
 * @returns Base64 encoded payment header
 */
export function encodeXPayment(payment: Record<string, unknown>): string {
  return btoa(JSON.stringify(payment));
}

/**
 * Parse 402 response body to get payment requirements
 * @param body - Response body from 402 response
 * @returns Payment requirements
 */
export function parsePaymentRequirements(body: {
  accepts?: X402PaymentRequirement[];
  error?: string;
}): X402PaymentRequirement[] {
  return body.accepts || [];
}

/**
 * Get total balance from a note in USDC
 */
export function getNoteBalance(note: Note): number {
  if (!note || !note.commitments) return 0;
  const totalMicro = note.commitments.reduce((sum, c) => sum + c.amount, 0);
  return totalMicro / 1_000_000;
}

/**
 * Check if note has sufficient balance for a payment
 */
export function hasEnoughBalance(note: Note, amountUSDC: number): boolean {
  return getNoteBalance(note) >= amountUSDC;
}

/**
 * Format USDC amount for display
 */
export function formatUSDCAmount(microAmount: number | bigint): string {
  const usdc = Number(microAmount) / 1_000_000;
  return usdc.toFixed(usdc < 0.01 ? 4 : 2);
}

/**
 * Parse USDC amount to micro units
 */
export function parseUSDCAmount(usdc: number | string): bigint {
  const amount = typeof usdc === 'string' ? parseFloat(usdc) : usdc;
  return BigInt(Math.floor(amount * 1_000_000));
}

/**
 * Retry helper with exponential backoff
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in ms (default: 1000)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Create a timeout promise
 */
export function timeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(message || `Timeout after ${ms}ms`)), ms);
  });

  return Promise.race([promise, timeoutPromise]);
}
