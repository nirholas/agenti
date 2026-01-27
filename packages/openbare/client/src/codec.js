/**
 * OpenBare URL Codec
 * XOR-based encoding compatible with Ultraviolet
 */

/**
 * XOR encode/decode a string with a key
 * @param {string} str - String to encode/decode
 * @param {number} [key=2] - XOR key
 * @returns {string} Encoded/decoded string
 */
export function xor(str, key = 2) {
  if (typeof str !== 'string') {
    throw new TypeError('Input must be a string');
  }
  
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ key);
  }
  return result;
}

/**
 * Encode a URL for transmission
 * @param {string} url - URL to encode
 * @returns {string} Base64 encoded result
 */
export function encodeUrl(url) {
  if (typeof url !== 'string') {
    throw new TypeError('URL must be a string');
  }
  
  const xored = xor(url);
  // Use base64 encoding that works in both browser and Node.js
  if (typeof btoa === 'function') {
    return btoa(xored);
  }
  return Buffer.from(xored, 'binary').toString('base64');
}

/**
 * Decode an encoded URL
 * @param {string} encoded - Encoded URL
 * @returns {string} Original URL
 */
export function decodeUrl(encoded) {
  if (typeof encoded !== 'string') {
    throw new TypeError('Encoded value must be a string');
  }
  
  let decoded;
  if (typeof atob === 'function') {
    decoded = atob(encoded);
  } else {
    decoded = Buffer.from(encoded, 'base64').toString('binary');
  }
  return xor(decoded);
}

/**
 * Encode headers object for bare protocol
 * @param {Record<string, string>} headers - Headers to encode
 * @returns {string} JSON string of encoded headers
 */
export function encodeHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return '{}';
  }
  
  const encoded = {};
  for (const [key, value] of Object.entries(headers)) {
    encoded[key.toLowerCase()] = String(value);
  }
  return JSON.stringify(encoded);
}

/**
 * Decode headers from bare response
 * @param {string} headerString - JSON string of headers
 * @returns {Record<string, string>} Decoded headers
 */
export function decodeHeaders(headerString) {
  if (!headerString) {
    return {};
  }
  
  try {
    return JSON.parse(headerString);
  } catch {
    return {};
  }
}

/**
 * Create a valid bare URL path
 * @param {string} baseUrl - Bare server base URL
 * @param {string} targetUrl - Target URL to proxy
 * @returns {string} Full bare request URL
 */
export function createBareUrl(baseUrl, _targetUrl) {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}/v3/`;
}

export default {
  xor,
  encodeUrl,
  decodeUrl,
  encodeHeaders,
  decodeHeaders,
  createBareUrl
};
