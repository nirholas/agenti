/**
 * OpenBare Single-Server Bare Fetch
 * Handles encoding requests and parsing responses for the Bare protocol
 */

import { encodeHeaders, decodeHeaders } from './codec.js';

/**
 * @typedef {Object} BareResponse
 * @property {number} status - HTTP status code
 * @property {string} statusText - HTTP status text
 * @property {Headers} headers - Response headers
 * @property {ReadableStream|null} body - Response body
 * @property {boolean} ok - Whether response was successful
 * @property {string} url - Final URL after redirects
 */

/**
 * @typedef {Object} BareFetchOptions
 * @property {string} [method='GET'] - HTTP method
 * @property {Record<string, string>} [headers] - Request headers
 * @property {string|ReadableStream|Blob|ArrayBuffer|null} [body] - Request body
 * @property {number} [timeout=30000] - Request timeout in ms
 * @property {AbortSignal} [signal] - Abort signal
 */

/**
 * Perform a fetch through a single bare server
 * @param {string} bareServer - Bare server URL
 * @param {string} targetUrl - Target URL to fetch
 * @param {BareFetchOptions} [options={}] - Fetch options
 * @returns {Promise<BareResponse>} Bare response
 */
export async function bareFetch(bareServer, targetUrl, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body = null,
    timeout = 30000,
    signal
  } = options;

  // Validate inputs
  if (!bareServer || typeof bareServer !== 'string') {
    throw new BareError('Invalid bare server URL', 'INVALID_SERVER');
  }

  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    throw new BareError('Invalid target URL', 'INVALID_URL');
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Combine signals
  const combinedSignal = signal 
    ? combineSignals(signal, controller.signal)
    : controller.signal;

  try {
    const bareUrl = bareServer.endsWith('/') 
      ? `${bareServer}v3/` 
      : `${bareServer}/v3/`;

    // Prepare bare protocol headers
    const bareHeaders = {
      'x-bare-url': targetUrl,
      'x-bare-headers': encodeHeaders(headers),
      'content-type': 'text/plain'
    };

    // Add host and protocol headers
    bareHeaders['x-bare-host'] = parsedTarget.host;
    bareHeaders['x-bare-port'] = parsedTarget.port || (parsedTarget.protocol === 'https:' ? '443' : '80');
    bareHeaders['x-bare-protocol'] = parsedTarget.protocol;
    bareHeaders['x-bare-path'] = parsedTarget.pathname + parsedTarget.search;

    // Forward specific headers
    if (headers['content-type']) {
      bareHeaders['x-bare-forward-headers'] = JSON.stringify(['content-type']);
    }

    const response = await fetch(bareUrl, {
      method,
      headers: bareHeaders,
      body: body,
      signal: combinedSignal,
      credentials: 'omit',
      mode: 'cors'
    });

    clearTimeout(timeoutId);

    // Parse bare response headers
    const responseStatus = parseInt(response.headers.get('x-bare-status') || response.status, 10);
    const responseStatusText = response.headers.get('x-bare-status-text') || response.statusText;
    const responseHeadersRaw = response.headers.get('x-bare-headers');
    const responseHeaders = new Headers(decodeHeaders(responseHeadersRaw));

    return {
      status: responseStatus,
      statusText: responseStatusText,
      headers: responseHeaders,
      body: response.body,
      ok: responseStatus >= 200 && responseStatus < 300,
      url: targetUrl,
      
      // Helper methods to match fetch Response API
      async text() {
        if (!response.body) {
          return '';
        }
        const reader = response.body.getReader();
        const chunks = [];
        let done = false;
        while (!done) {
          const result = await reader.read();
          done = result.done;
          if (result.value) {
            chunks.push(result.value);
          }
        }
        const combined = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        return new TextDecoder().decode(combined);
      },
      
      async json() {
        const text = await this.text();
        return JSON.parse(text);
      },
      
      async arrayBuffer() {
        if (!response.body) {
          return new ArrayBuffer(0);
        }
        const reader = response.body.getReader();
        const chunks = [];
        let done = false;
        while (!done) {
          const result = await reader.read();
          done = result.done;
          if (result.value) {
            chunks.push(result.value);
          }
        }
        const combined = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        return combined.buffer;
      },
      
      async blob() {
        const buffer = await this.arrayBuffer();
        const type = responseHeaders.get('content-type') || 'application/octet-stream';
        return new Blob([buffer], { type });
      }
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new BareError('Request timed out', 'TIMEOUT');
    }
    
    throw new BareError(
      `Fetch failed: ${error.message}`,
      'FETCH_ERROR',
      { cause: error }
    );
  }
}

/**
 * Combine multiple abort signals
 * @param {...AbortSignal} signals - Signals to combine
 * @returns {AbortSignal} Combined signal
 */
function combineSignals(...signals) {
  const controller = new AbortController();
  
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  
  return controller.signal;
}

/**
 * Custom error class for Bare operations
 */
export class BareError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Object} [options] - Additional options
   */
  constructor(message, code, options = {}) {
    super(message, options);
    this.name = 'BareError';
    this.code = code;
  }
}

/**
 * Test if a bare server is reachable
 * @param {string} bareServer - Bare server URL
 * @param {number} [timeout=5000] - Timeout in ms
 * @returns {Promise<{ok: boolean, latency: number}>} Test result
 */
export async function testBareServer(bareServer, timeout = 5000) {
  const start = performance.now();
  
  try {
    const url = bareServer.endsWith('/') ? bareServer : `${bareServer}/`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const latency = performance.now() - start;
    
    return {
      ok: response.ok,
      latency: Math.round(latency)
    };
  } catch (error) {
    return {
      ok: false,
      latency: -1,
      error: error.message
    };
  }
}

export default {
  bareFetch,
  testBareServer,
  BareError
};
