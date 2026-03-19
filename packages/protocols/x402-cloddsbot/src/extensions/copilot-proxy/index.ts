/**
 * GitHub Copilot Proxy Auth Extension
 * Provides authentication helpers for proxying Copilot requests
 *
 * Supports GitHub token exchange and Copilot API proxying
 */

import { logger } from '../../utils/logger';

export interface CopilotProxyConfig {
  enabled: boolean;
  /** GitHub personal access token */
  githubToken?: string;
  /** GitHub OAuth app client ID */
  clientId?: string;
  /** GitHub OAuth app client secret */
  clientSecret?: string;
  /** Proxy server port */
  port?: number;
  /** Cache tokens for this many seconds */
  tokenCacheTtl?: number;
}

interface CopilotToken {
  token: string;
  expiresAt: number;
  endpoints: {
    api: string;
    proxy: string;
    telemetry: string;
  };
}

interface TokenCache {
  copilotToken?: CopilotToken;
  refreshInProgress?: Promise<CopilotToken | null>;
}

export interface CopilotProxyExtension {
  /** Get a valid Copilot token (refreshes if needed) */
  getToken(): Promise<CopilotToken | null>;
  /** Proxy a request to Copilot API */
  proxyRequest(path: string, options?: RequestInit): Promise<Response>;
  /** Get completions from Copilot */
  getCompletions(prompt: string, options?: CompletionOptions): Promise<string[]>;
  /** Start the proxy server */
  startProxy(): Promise<void>;
  /** Stop the proxy server */
  stopProxy(): Promise<void>;
}

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string[];
  n?: number;
}

export async function createCopilotProxyExtension(
  config: CopilotProxyConfig
): Promise<CopilotProxyExtension> {
  const cache: TokenCache = {};
  let proxyServer: ReturnType<typeof import('http').createServer> | null = null;

  async function exchangeGitHubToken(): Promise<CopilotToken | null> {
    if (!config.githubToken) {
      logger.warn('No GitHub token configured for Copilot proxy');
      return null;
    }

    try {
      // Step 1: Get Copilot token from GitHub
      const response = await fetch('https://api.github.com/copilot_internal/v2/token', {
        headers: {
          Authorization: `token ${config.githubToken}`,
          Accept: 'application/json',
          'User-Agent': 'Clodds/1.0',
        },
      });

      if (!response.ok) {
        logger.error({ status: response.status }, 'Failed to get Copilot token');
        return null;
      }

      const data = (await response.json()) as {
        token: string;
        expires_in?: number;
        endpoints?: { api?: string; proxy?: string; telemetry?: string };
      };

      return {
        token: data.token,
        expiresAt: Date.now() + (data.expires_in ?? 1800) * 1000,
        endpoints: {
          api: data.endpoints?.api || 'https://api.githubcopilot.com',
          proxy: data.endpoints?.proxy || 'https://copilot-proxy.githubusercontent.com',
          telemetry: data.endpoints?.telemetry || 'https://copilot-telemetry.githubusercontent.com',
        },
      };
    } catch (error) {
      logger.error({ error }, 'Failed to exchange GitHub token for Copilot token');
      return null;
    }
  }

  async function refreshToken(): Promise<CopilotToken | null> {
    // If refresh already in progress, wait for it
    if (cache.refreshInProgress) {
      return cache.refreshInProgress;
    }

    cache.refreshInProgress = (async () => {
      const token = await exchangeGitHubToken();
      if (token) {
        cache.copilotToken = token;
      }
      cache.refreshInProgress = undefined;
      return token;
    })();

    return cache.refreshInProgress;
  }

  const extension: CopilotProxyExtension = {
    async getToken(): Promise<CopilotToken | null> {
      // Check if we have a valid cached token
      if (cache.copilotToken && cache.copilotToken.expiresAt > Date.now() + 60000) {
        return cache.copilotToken;
      }

      // Refresh the token
      return refreshToken();
    },

    async proxyRequest(path: string, options?: RequestInit): Promise<Response> {
      const token = await extension.getToken();
      if (!token) {
        throw new Error('No Copilot token available');
      }

      const url = `${token.endpoints.api}${path}`;
      const headers = new Headers(options?.headers);
      headers.set('Authorization', `Bearer ${token.token}`);
      headers.set('Content-Type', 'application/json');
      headers.set('User-Agent', 'Clodds/1.0');

      return fetch(url, {
        ...options,
        headers,
      });
    },

    async getCompletions(prompt: string, options?: CompletionOptions): Promise<string[]> {
      const response = await extension.proxyRequest('/v1/engines/copilot-codex/completions', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          max_tokens: options?.maxTokens ?? 256,
          temperature: options?.temperature ?? 0.1,
          top_p: options?.topP ?? 1,
          stop: options?.stop ?? ['\n\n'],
          n: options?.n ?? 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Copilot API error: ${response.status}`);
      }

      const data = (await response.json()) as { choices?: Array<{ text: string }> };
      return (data.choices || []).map((c) => c.text);
    },

    async startProxy(): Promise<void> {
      if (proxyServer) {
        logger.warn('Copilot proxy already running');
        return;
      }

      const http = await import('http');
      const port = config.port ?? 3003;

      proxyServer = http.createServer(async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          });
          res.end();
          return;
        }

        try {
          const token = await extension.getToken();
          if (!token) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'No Copilot token available' }));
            return;
          }

          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('error', (err) => {
            logger.warn({ error: err }, 'Request stream error');
          });
          req.on('end', async () => {
            try {
              const path = req.url || '/';
              const response = await extension.proxyRequest(path, {
                method: req.method || 'GET',
                body: body || undefined,
              });

              const responseBody = await response.text();
              res.writeHead(response.status, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(responseBody);
            } catch (error) {
              logger.error({ error }, 'Proxy request failed');
              res.writeHead(500);
              res.end(JSON.stringify({ error: 'Proxy request failed' }));
            }
          });
        } catch (error) {
          logger.error({ error }, 'Proxy error');
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Internal error' }));
        }
      });

      proxyServer.on('error', (err) => {
        logger.error({ error: err, port }, 'Copilot proxy server error');
      });
      proxyServer.listen(port);
      logger.info({ port }, 'Copilot proxy started');
    },

    async stopProxy(): Promise<void> {
      if (proxyServer) {
        proxyServer.close();
        proxyServer = null;
        logger.info('Copilot proxy stopped');
      }
    },
  };

  return extension;
}
