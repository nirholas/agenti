/**
 * Cryptographic utilities for AWS SigV4 signing
 * 
 * Uses the Web Crypto API for browser-compatible cryptographic operations.
 * These utilities are used for signing requests to AWS services.
 */

/**
 * Calculate SHA-256 hash of a string
 */
export async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer);
}

/**
 * Calculate HMAC-SHA256
 * 
 * @param key - The key (string or ArrayBuffer)
 * @param message - The message to sign
 * @param output - Output format ('buffer' or 'hex')
 */
export async function hmacSha256(
  key: string | ArrayBuffer,
  message: string,
  output: 'buffer' | 'hex' = 'buffer'
): Promise<string | ArrayBuffer> {
  const encoder = new TextEncoder();
  
  // Convert key to ArrayBuffer if it's a string
  const keyData = typeof key === 'string' 
    ? encoder.encode(key) 
    : key;
  
  // Import the key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // Sign the message
  const messageData = encoder.encode(message);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  
  if (output === 'hex') {
    return bufferToHex(signature);
  }
  
  return signature;
}

/**
 * Convert ArrayBuffer to hex string
 */
export function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to ArrayBuffer
 */
export function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}

/**
 * Encode string to base64
 */
export function base64Encode(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return btoa(String.fromCharCode(...data));
}

/**
 * Decode base64 to string
 */
export function base64Decode(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * URL-safe base64 encode
 */
export function base64UrlEncode(str: string): string {
  return base64Encode(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * URL-safe base64 decode
 */
export function base64UrlDecode(base64Url: string): string {
  let base64 = base64Url
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  // Add padding if needed
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  
  return base64Decode(base64);
}
