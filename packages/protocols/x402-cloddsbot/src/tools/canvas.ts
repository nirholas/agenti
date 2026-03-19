/**
 * Canvas Tool - A2UI (Agent-to-UI) visual workspace
 *
 * Features:
 * - Present HTML/React content on connected nodes
 * - Evaluate JavaScript in canvas context
 * - Capture screenshots of canvas
 * - Push/reset canvas state
 */

import { logger } from '../utils/logger';
import type { WebSocket } from 'ws';

/** Canvas content types */
export type CanvasContentType = 'html' | 'react' | 'markdown' | 'image';

/** Canvas state */
export interface CanvasState {
  id: string;
  type: CanvasContentType;
  content: string;
  /** CSS styles to inject */
  styles?: string;
  /** JavaScript to execute */
  scripts?: string;
  /** Metadata */
  meta?: Record<string, unknown>;
  updatedAt: Date;
}

/** Canvas snapshot */
export interface CanvasSnapshot {
  /** Base64 PNG image */
  image: string;
  /** Viewport dimensions */
  width: number;
  height: number;
  timestamp: Date;
}

/** Connected canvas node */
interface CanvasNode {
  id: string;
  name: string;
  type: 'macos' | 'ios' | 'android' | 'web';
  ws: WebSocket;
  capabilities: string[];
  connectedAt: Date;
}

export interface CanvasTool {
  /** Present content on canvas */
  present(content: string, options?: {
    type?: CanvasContentType;
    styles?: string;
    scripts?: string;
    nodeId?: string;
  }): Promise<void>;

  /** Evaluate JavaScript in canvas context */
  evaluate<T = unknown>(script: string, nodeId?: string): Promise<T>;

  /** Take snapshot of canvas */
  snapshot(nodeId?: string): Promise<CanvasSnapshot>;

  /** Reset canvas to empty state */
  reset(nodeId?: string): Promise<void>;

  /** Get current canvas state */
  getState(): CanvasState | null;

  /** List connected canvas nodes */
  listNodes(): CanvasNode[];

  /** Register a canvas node */
  registerNode(ws: WebSocket, info: {
    id: string;
    name: string;
    type: CanvasNode['type'];
    capabilities: string[];
  }): void;

  /** Unregister a canvas node */
  unregisterNode(id: string): void;
}

export function createCanvasTool(): CanvasTool {
  const nodes = new Map<string, CanvasNode>();
  let currentState: CanvasState | null = null;
  const nodeQueues = new Map<string, Array<{ message: Record<string, unknown>; attempts: number }>>();
  const broadcastQueue: Array<{ message: Record<string, unknown>; attempts: number }> = [];

  const DEFAULT_SEND_RETRIES = 3;
  const DEFAULT_SEND_RETRY_DELAY_MS = 200;
  const DEFAULT_RESPONSE_TIMEOUT_MS = 30_000;
  const MAX_QUEUE_SIZE = 100;

  function isWsOpen(ws: WebSocket): boolean {
    // 1 === WebSocket.OPEN
    return ws.readyState === 1;
  }

  function enqueueForNode(nodeId: string, message: Record<string, unknown>, attempts = 0): void {
    if (!nodeQueues.has(nodeId)) {
      nodeQueues.set(nodeId, []);
    }
    const queue = nodeQueues.get(nodeId)!;
    queue.push({ message, attempts });
    // Evict oldest messages if queue exceeds max size
    if (queue.length > MAX_QUEUE_SIZE) {
      queue.splice(0, queue.length - MAX_QUEUE_SIZE);
    }
  }

  function enqueueBroadcast(message: Record<string, unknown>, attempts = 0): void {
    broadcastQueue.push({ message, attempts });
    // Evict oldest messages if queue exceeds max size
    if (broadcastQueue.length > MAX_QUEUE_SIZE) {
      broadcastQueue.splice(0, broadcastQueue.length - MAX_QUEUE_SIZE);
    }
  }

  async function sendWithRetry(
    node: CanvasNode,
    payload: string,
    message: Record<string, unknown>,
    attempts = 0
  ): Promise<void> {
    if (!isWsOpen(node.ws)) {
      enqueueForNode(node.id, message, attempts);
      return;
    }

    try {
      node.ws.send(payload);
    } catch (error) {
      if (attempts + 1 >= DEFAULT_SEND_RETRIES) {
        logger.error({ error, nodeId: node.id }, 'Canvas send failed after retries');
        enqueueForNode(node.id, message, attempts + 1);
        return;
      }
      await new Promise((r) => setTimeout(r, DEFAULT_SEND_RETRY_DELAY_MS));
      await sendWithRetry(node, payload, message, attempts + 1);
    }
  }

  async function flushNodeQueue(node: CanvasNode): Promise<void> {
    const queued = nodeQueues.get(node.id);
    if (!queued || queued.length === 0) return;

    nodeQueues.delete(node.id);
    for (const entry of queued) {
      const payload = JSON.stringify(entry.message);
      await sendWithRetry(node, payload, entry.message, entry.attempts);
    }
  }

  async function flushBroadcastQueue(node: CanvasNode): Promise<void> {
    if (broadcastQueue.length === 0) return;
    const pending = broadcastQueue.splice(0, broadcastQueue.length);
    for (const entry of pending) {
      const payload = JSON.stringify(entry.message);
      await sendWithRetry(node, payload, entry.message, entry.attempts);
    }
  }

  /** Send message to node(s) */
  async function sendToNodes(
    message: Record<string, unknown>,
    nodeId?: string
  ): Promise<void> {
    const targets = nodeId
      ? [nodes.get(nodeId)].filter(Boolean)
      : Array.from(nodes.values());

    if (targets.length === 0) {
      logger.warn('No canvas nodes connected');
      if (nodeId) {
        enqueueForNode(nodeId, message);
      } else {
        enqueueBroadcast(message);
      }
      return;
    }

    const payload = JSON.stringify(message);
    for (const node of targets) {
      if (!node) continue;
      if (!isWsOpen(node.ws)) {
        enqueueForNode(node.id, message);
        continue;
      }
      await sendWithRetry(node, payload, message);
    }
  }

  /** Wait for response from node */
  async function waitForResponse<T>(
    node: CanvasNode,
    requestId: string,
    timeout = DEFAULT_RESPONSE_TIMEOUT_MS
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Canvas response timeout'));
      }, timeout);

      const handler = (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.requestId === requestId) {
            cleanup();
            if (msg.error) {
              reject(new Error(msg.error));
            } else {
              resolve(msg.result);
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        node.ws.off('message', handler);
      };

      node.ws.on('message', handler);
    });
  }

  const tool: CanvasTool = {
    async present(content, options = {}) {
      const type = options.type || 'html';
      const requestId = Date.now().toString(36);

      currentState = {
        id: requestId,
        type,
        content,
        styles: options.styles,
        scripts: options.scripts,
        updatedAt: new Date(),
      };

      await sendToNodes({
        type: 'canvas.present',
        requestId,
        payload: {
          contentType: type,
          content,
          styles: options.styles,
          scripts: options.scripts,
        },
      }, options.nodeId);

      logger.info({ type, contentLength: content.length }, 'Canvas content presented');
    },

    async evaluate<T>(script: string, nodeId?: string): Promise<T> {
      const targetNodes = nodeId
        ? [nodes.get(nodeId)].filter((n): n is CanvasNode => !!n)
        : Array.from(nodes.values());

      if (targetNodes.length === 0) {
        throw new Error('No canvas nodes connected');
      }

      const node = targetNodes[0];
      const requestId = Date.now().toString(36);

      const message = {
        type: 'canvas.eval',
        requestId,
        payload: { script },
      };
      await sendToNodes(message, node.id);

      return waitForResponse<T>(node, requestId, DEFAULT_RESPONSE_TIMEOUT_MS);
    },

    async snapshot(nodeId?) {
      const targetNodes = nodeId
        ? [nodes.get(nodeId)].filter((n): n is CanvasNode => !!n)
        : Array.from(nodes.values());

      if (targetNodes.length === 0) {
        throw new Error('No canvas nodes connected');
      }

      const node = targetNodes[0];
      const requestId = Date.now().toString(36);

      const message = {
        type: 'canvas.snapshot',
        requestId,
      };
      await sendToNodes(message, node.id);

      const result = await waitForResponse<{
        image: string;
        width: number;
        height: number;
      }>(node, requestId, DEFAULT_RESPONSE_TIMEOUT_MS);

      return {
        ...result,
        timestamp: new Date(),
      };
    },

    async reset(nodeId?) {
      currentState = null;

      await sendToNodes({
        type: 'canvas.reset',
        requestId: Date.now().toString(36),
      }, nodeId);

      logger.info('Canvas reset');
    },

    getState() {
      return currentState;
    },

    listNodes() {
      return Array.from(nodes.values()).map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
        ws: n.ws,
        capabilities: n.capabilities,
        connectedAt: n.connectedAt,
      }));
    },

    registerNode(ws, info) {
      const node: CanvasNode = {
        ...info,
        ws,
        connectedAt: new Date(),
      };

      nodes.set(info.id, node);

      ws.on('close', () => {
        nodes.delete(info.id);
        logger.info({ nodeId: info.id }, 'Canvas node disconnected');
      });

      logger.info({ nodeId: info.id, type: info.type }, 'Canvas node registered');

      // Flush any queued messages first.
      void flushBroadcastQueue(node);
      void flushNodeQueue(node);

      // Send current state if any
      if (currentState) {
        void sendToNodes(
          {
            type: 'canvas.present',
            requestId: 'sync',
            payload: {
              contentType: currentState.type,
              content: currentState.content,
              styles: currentState.styles,
              scripts: currentState.scripts,
            },
          },
          node.id
        );
      }
    },

    unregisterNode(id) {
      nodes.delete(id);
      logger.info({ nodeId: id }, 'Canvas node unregistered');
    },
  };

  return tool;
}

// HTML escape to prevent XSS in user-provided template content
function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Create HTML for common canvas displays
 */
export const CanvasTemplates = {
  /** Simple text display */
  text(text: string, options?: { fontSize?: string; color?: string }): string {
    const fontSize = options?.fontSize || '24px';
    const color = options?.color || '#fff';
    return `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        font-size: ${escapeHtml(fontSize)};
        color: ${escapeHtml(color)};
        font-family: -apple-system, system-ui, sans-serif;
        padding: 20px;
        text-align: center;
      ">
        ${escapeHtml(text)}
      </div>
    `;
  },

  /** Markdown display */
  markdown(content: string): string {
    return `
      <div id="markdown-content" style="
        max-width: 800px;
        margin: 0 auto;
        padding: 40px 20px;
        font-family: -apple-system, system-ui, sans-serif;
        color: #e2e8f0;
        line-height: 1.6;
      "></div>
      <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
      <script>
        document.getElementById('markdown-content').innerHTML =
          marked.parse(${JSON.stringify(content)});
      </script>
    `;
  },

  /** Chart display (using Chart.js) */
  chart(config: Record<string, unknown>): string {
    return `
      <canvas id="chart" style="max-width: 100%; max-height: 100vh;"></canvas>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script>
        new Chart(document.getElementById('chart'), ${JSON.stringify(config)});
      </script>
    `;
  },

  /** Image display */
  image(src: string, options?: { fit?: 'contain' | 'cover' | 'fill' }): string {
    const fit = options?.fit || 'contain';
    // Only allow http/https/data:image URLs
    const safeSrc = /^(https?:|data:image\/)/.test(src) ? escapeHtml(src) : '';
    return `
      <div style="
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #000;
      ">
        <img src="${safeSrc}" style="
          max-width: 100%;
          max-height: 100%;
          object-fit: ${escapeHtml(fit)};
        " />
      </div>
    `;
  },

  /** Loading spinner */
  loading(message?: string): string {
    return `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        color: #94a3b8;
        font-family: -apple-system, system-ui, sans-serif;
      ">
        <div style="
          width: 40px;
          height: 40px;
          border: 3px solid #334155;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
        ${message ? `<p style="margin-top: 16px">${escapeHtml(message)}</p>` : ''}
      </div>
      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;
  },
};
