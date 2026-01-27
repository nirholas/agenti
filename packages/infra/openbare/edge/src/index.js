/**
 * OpenBare Edge - Cloudflare Workers Bare Server
 * Implements TompHTTP Bare Server Protocol v3
 */

import { handleBareRequest, handleBareV3Request } from './bare-protocol.js';
import { handleWebSocketUpgrade } from './websocket.js';

// CORS headers for all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

// Headers to strip from proxied responses
const STRIP_HEADERS = [
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'x-content-type-options',
  'x-xss-protection',
  'strict-transport-security',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'permissions-policy',
];

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return handleOptions(request);
      }

      // Health/status endpoint
      if (path === '/' || path === '/health') {
        return handleHealth(request, env);
      }

      // Bare server info endpoint
      if (path === '/bare/' || path === '/bare') {
        return handleBareInfo(request);
      }

      // Bare v3 endpoint
      if (path.startsWith('/bare/v3/')) {
        return handleBareV3(request, env, ctx);
      }

      // Legacy bare endpoint (v1/v2 compatibility)
      if (path.startsWith('/bare/')) {
        return handleBare(request, env, ctx);
      }

      // Not found
      return new Response(JSON.stringify({
        error: 'Not Found',
        message: 'The requested endpoint does not exist',
        endpoints: ['/', '/bare/', '/bare/v3/']
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS
        }
      });

    } catch (error) {
      return handleError(error);
    }
  }
};

/**
 * Handle CORS preflight requests
 */
function handleOptions(request) {
  const headers = request.headers;
  
  if (
    headers.get('Origin') !== null &&
    headers.get('Access-Control-Request-Method') !== null
  ) {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }

  return new Response(null, {
    status: 400,
    headers: CORS_HEADERS
  });
}

/**
 * Health check endpoint with edge location info
 */
function handleHealth(request, env) {
  const cf = request.cf || {};
  
  return new Response(JSON.stringify({
    status: 'ok',
    service: 'openbare-edge',
    version: env.BARE_VERSION || '3',
    edge_location: cf.colo || 'unknown',
    cf_ray: request.headers.get('cf-ray') || 'unknown',
    country: cf.country || 'unknown',
    timestamp: new Date().toISOString(),
    protocol: 'bare-v3',
    features: {
      websocket: true,
      http2: true,
      compression: true
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...CORS_HEADERS
    }
  });
}

/**
 * Bare server info endpoint
 */
function handleBareInfo(_request) {
  return new Response(JSON.stringify({
    versions: ['v1', 'v2', 'v3'],
    language: 'Cloudflare Workers',
    memoryUsage: 0,
    project: {
      name: 'openbare-edge',
      description: 'OpenBare Cloudflare Workers Edge Server',
      repository: 'https://github.com/nirholas/SPA-OS',
      version: '1.0.0'
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}

/**
 * Handle Bare v3 requests
 */
async function handleBareV3(request, env, _ctx) {
  const url = new URL(request.url);
  const _subpath = url.pathname.replace('/bare/v3/', '');

  // WebSocket upgrade
  if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
    return handleWebSocketUpgrade(request, env);
  }

  // Handle bare request
  return handleBareV3Request(request, env, CORS_HEADERS, STRIP_HEADERS);
}

/**
 * Handle legacy bare requests
 */
async function handleBare(request, env, _ctx) {
  // WebSocket upgrade
  if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
    return handleWebSocketUpgrade(request, env);
  }

  return handleBareRequest(request, env, CORS_HEADERS, STRIP_HEADERS);
}

/**
 * Error handler
 */
function handleError(error) {
  console.error('OpenBare Error:', error);

  const status = error.status || 500;
  const message = error.message || 'Internal Server Error';

  return new Response(JSON.stringify({
    error: true,
    code: error.code || 'UNKNOWN_ERROR',
    message: message,
    id: crypto.randomUUID()
  }), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}

/**
 * Strip security headers from response
 */
export function stripHeaders(headers, toStrip) {
  const newHeaders = new Headers(headers);
  
  for (const header of toStrip) {
    newHeaders.delete(header);
  }
  
  return newHeaders;
}

export { CORS_HEADERS, STRIP_HEADERS };
