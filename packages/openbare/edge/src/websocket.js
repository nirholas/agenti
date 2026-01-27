/**
 * OpenBare Edge - WebSocket Proxy Handler
 * Handles WebSocket upgrades and proxying for Bare protocol
 */

import { parseBareHeaders, buildTargetUrl, BareError } from './bare-protocol.js';

/**
 * Handle WebSocket upgrade request
 */
export async function handleWebSocketUpgrade(request, _env) {
  try {
    // Parse bare headers to get target WebSocket URL
    const bareData = parseBareHeaders(request);
    const targetUrl = buildTargetUrl(bareData);

    // Convert HTTP(S) to WS(S)
    const wsUrl = new URL(targetUrl.toString());
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';

    // Create WebSocket pair for client connection
    const [client, server] = Object.values(new WebSocketPair());

    // Accept the client connection
    server.accept();

    // Connect to target WebSocket
    const _targetWs = await connectToTarget(wsUrl.toString(), bareData.headers, server);

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (error) {
    console.error('WebSocket Upgrade Error:', error);

    if (error instanceof BareError) {
      return error.toResponse({
        'Access-Control-Allow-Origin': '*'
      });
    }

    return new Response(JSON.stringify({
      error: true,
      code: 'WEBSOCKET_ERROR',
      message: error.message || 'WebSocket upgrade failed',
      id: crypto.randomUUID()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

/**
 * Connect to target WebSocket and set up bidirectional proxy
 */
async function connectToTarget(targetUrl, headers, clientWs) {
  return new Promise((resolve, reject) => {
    // Build headers for target connection
    const wsHeaders = {};
    for (const [key, value] of Object.entries(headers || {})) {
      // Skip hop-by-hop headers
      const lowerKey = key.toLowerCase();
      if (['host', 'connection', 'upgrade', 'sec-websocket-key', 
        'sec-websocket-version', 'sec-websocket-extensions'].includes(lowerKey)) {
        continue;
      }
      wsHeaders[key] = value;
    }

    // Create target WebSocket connection
    const targetWs = new WebSocket(targetUrl, {
      headers: wsHeaders
    });

    // Handle target connection open
    targetWs.addEventListener('open', () => {
      resolve(targetWs);
    });

    // Handle target connection error
    targetWs.addEventListener('error', (_event) => {
      clientWs.close(1011, 'Target connection failed');
      reject(new Error('Failed to connect to target WebSocket'));
    });

    // Handle target connection close
    targetWs.addEventListener('close', (event) => {
      clientWs.close(event.code, event.reason);
    });

    // Forward messages from target to client
    targetWs.addEventListener('message', (event) => {
      try {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(event.data);
        }
      } catch (e) {
        console.error('Error forwarding message to client:', e);
      }
    });

    // Forward messages from client to target
    clientWs.addEventListener('message', (event) => {
      try {
        if (targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(event.data);
        }
      } catch (e) {
        console.error('Error forwarding message to target:', e);
      }
    });

    // Handle client connection close
    clientWs.addEventListener('close', (event) => {
      if (targetWs.readyState === WebSocket.OPEN) {
        targetWs.close(event.code, event.reason);
      }
    });

    // Handle client connection error
    clientWs.addEventListener('error', (_event) => {
      if (targetWs.readyState === WebSocket.OPEN) {
        targetWs.close(1011, 'Client error');
      }
    });

    // Set connection timeout
    setTimeout(() => {
      if (targetWs.readyState === WebSocket.CONNECTING) {
        targetWs.close();
        reject(new Error('WebSocket connection timeout'));
      }
    }, 30000); // 30 second timeout
  });
}

/**
 * WebSocket message handler class for Durable Objects (optional)
 */
export class WebSocketHandler {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  async fetch(request) {
    const _url = new URL(request.url);

    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      return this.handleWebSocket(request);
    }

    return new Response('Expected WebSocket', { status: 426 });
  }

  /**
   * Handle WebSocket connection
   */
  async handleWebSocket(_request) {
    server.accept();
    
    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, {
      client: server,
      target: null,
      createdAt: Date.now()
    });

    server.addEventListener('message', async (event) => {
      await this.handleMessage(sessionId, event.data);
    });

    server.addEventListener('close', () => {
      this.closeSession(sessionId);
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async handleMessage(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // Parse message - could be binary or text
    try {
      if (session.target && session.target.readyState === WebSocket.OPEN) {
        session.target.send(data);
      }
    } catch (e) {
      console.error('WebSocket message error:', e);
    }
  }

  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.target) {
        session.target.close();
      }
      this.sessions.delete(sessionId);
    }
  }
}

/**
 * Simple WebSocket proxy without Durable Objects
 * For use when Durable Objects are not needed/available
 */
export async function simpleWebSocketProxy(request, targetUrl, _headers = {}) {
  // Upgrade header check
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();

  // Connect to upstream WebSocket
  const upstream = new WebSocket(targetUrl);

  upstream.addEventListener('open', () => {
    // Connection established
  });

  upstream.addEventListener('message', (event) => {
    server.send(event.data);
  });

  upstream.addEventListener('close', (event) => {
    server.close(event.code, event.reason);
  });

  upstream.addEventListener('error', () => {
    server.close(1011, 'Upstream error');
  });

  server.addEventListener('message', (event) => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(event.data);
    }
  });

  server.addEventListener('close', (event) => {
    upstream.close(event.code, event.reason);
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
  });
}
