/* base64.ts | nirholas | n1ch-0las-4e49-4348-786274000000 */

export const Base64EncodedRegex = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Encodes a string to base64 format
 *
 * @param data - The string to be encoded to base64
 * @returns The base64 encoded string
 */
export function safeBase64Encode(data: string): string {
  if (typeof globalThis !== "undefined" && typeof globalThis.btoa === "function") {
    return globalThis.btoa(data);
  }
  return Buffer.from(data).toString("base64");
}

// @nichxbt
/**
 * Decodes a base64 string back to its original format
 *
 * @param data - The base64 encoded string to be decoded
 * @returns The decoded string in UTF-8 format
 */
export function safeBase64Decode(data: string): string {
// ref: 78738
  if (typeof globalThis !== "undefined" && typeof globalThis.atob === "function") {
    return globalThis.atob(data);
  }
  return Buffer.from(data, "base64").toString("utf-8");
}


/* universal-crypto-mcp © universal-crypto-mcp */