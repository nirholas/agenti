/**
 * Google Auth Helpers Extension
 * Provides authentication for Google APIs (Gemini, Vertex AI, etc.)
 *
 * Supports: Service Account, OAuth2, ADC, Antigravity token exchange
 */

import * as crypto from 'crypto';
import { logger } from '../../utils/logger';

export interface GoogleAuthConfig {
  enabled: boolean;
  /** Authentication method */
  method: 'service-account' | 'oauth2' | 'adc' | 'antigravity';
  /** Service account key file path */
  keyFile?: string;
  /** Service account key JSON (alternative to keyFile) */
  keyJson?: string;
  /** OAuth2 client ID */
  clientId?: string;
  /** OAuth2 client secret */
  clientSecret?: string;
  /** OAuth2 refresh token */
  refreshToken?: string;
  /** Scopes to request */
  scopes?: string[];
  /** Project ID for Vertex AI */
  projectId?: string;
  /** Region for Vertex AI */
  region?: string;
}

interface TokenInfo {
  accessToken: string;
  expiresAt: number;
  tokenType: string;
}

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

export interface GoogleAuthExtension {
  /** Get a valid access token */
  getAccessToken(): Promise<string | null>;
  /** Get token info */
  getTokenInfo(): Promise<TokenInfo | null>;
  /** Make an authenticated request to Google APIs */
  request<T>(url: string, options?: RequestInit): Promise<T>;
  /** Get Gemini API client */
  getGeminiClient(): GeminiClient;
  /** Get Vertex AI client */
  getVertexClient(): VertexClient;
}

export interface GeminiClient {
  /** Generate content using Gemini */
  generateContent(prompt: string, options?: GeminiOptions): Promise<string>;
  /** Stream content generation */
  streamGenerateContent(prompt: string, options?: GeminiOptions): AsyncGenerator<string>;
}

export interface VertexClient {
  /** Generate content using Vertex AI */
  generateContent(prompt: string, options?: VertexOptions): Promise<string>;
  /** Get embeddings */
  getEmbeddings(texts: string[]): Promise<number[][]>;
}

export interface GeminiOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface VertexOptions extends GeminiOptions {
  safetySettings?: Array<{ category: string; threshold: string }>;
}

export async function createGoogleAuthExtension(
  config: GoogleAuthConfig
): Promise<GoogleAuthExtension> {
  let cachedToken: TokenInfo | null = null;
  let serviceAccountKey: ServiceAccountKey | null = null;

  // Load service account key if provided
  if (config.method === 'service-account') {
    if (config.keyJson) {
      serviceAccountKey = JSON.parse(config.keyJson);
    } else if (config.keyFile) {
      const fs = await import('fs/promises');
      const keyContent = await fs.readFile(config.keyFile, 'utf-8');
      serviceAccountKey = JSON.parse(keyContent);
    }
  }

  async function getServiceAccountToken(): Promise<TokenInfo | null> {
    if (!serviceAccountKey) {
      logger.error('No service account key configured');
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const scopes = config.scopes || ['https://www.googleapis.com/auth/cloud-platform'];

    // Create JWT
    const header = {
      alg: 'RS256',
      typ: 'JWT',
      kid: serviceAccountKey.private_key_id,
    };

    const payload = {
      iss: serviceAccountKey.client_email,
      sub: serviceAccountKey.client_email,
      aud: serviceAccountKey.token_uri,
      iat: now,
      exp: now + 3600,
      scope: scopes.join(' '),
    };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signatureInput = `${headerB64}.${payloadB64}`;

    // Sign with private key
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(serviceAccountKey.private_key, 'base64url');

    const jwt = `${signatureInput}.${signature}`;

    // Exchange JWT for access token
    try {
      const response = await fetch(serviceAccountKey.token_uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
      });

      if (!response.ok) {
        logger.error({ status: response.status }, 'Failed to get Google access token');
        return null;
      }

      const data = (await response.json()) as { access_token: string; expires_in: number; token_type?: string };
      return {
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        tokenType: data.token_type || 'Bearer',
      };
    } catch (error) {
      logger.error({ error }, 'Failed to exchange JWT for access token');
      return null;
    }
  }

  async function getOAuth2Token(): Promise<TokenInfo | null> {
    if (!config.clientId || !config.clientSecret || !config.refreshToken) {
      logger.error('OAuth2 credentials not configured');
      return null;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: config.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        logger.error({ status: response.status }, 'Failed to refresh Google OAuth2 token');
        return null;
      }

      const data = (await response.json()) as { access_token: string; expires_in: number; token_type?: string };
      return {
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        tokenType: data.token_type || 'Bearer',
      };
    } catch (error) {
      logger.error({ error }, 'Failed to refresh OAuth2 token');
      return null;
    }
  }

  async function getADCToken(): Promise<TokenInfo | null> {
    // Application Default Credentials - try metadata server first
    try {
      const response = await fetch(
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
        {
          headers: { 'Metadata-Flavor': 'Google' },
        }
      );

      if (response.ok) {
        const data = (await response.json()) as { access_token: string; expires_in: number; token_type?: string };
        return {
          accessToken: data.access_token,
          expiresAt: Date.now() + data.expires_in * 1000,
          tokenType: data.token_type || 'Bearer',
        };
      }
    } catch {
      // Not on GCP, try gcloud CLI
    }

    // Try gcloud CLI
    try {
      const { execSync } = await import('child_process');
      const token = execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
      return {
        accessToken: token,
        expiresAt: Date.now() + 3600 * 1000, // Assume 1 hour
        tokenType: 'Bearer',
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get ADC token');
      return null;
    }
  }

  async function getAntigravityToken(): Promise<TokenInfo | null> {
    // Antigravity is a token exchange mechanism for Gemini CLI
    // This is a simplified implementation
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Antigravity token exchange payload
        }),
      });

      if (!response.ok) {
        logger.warn('Antigravity token exchange not available');
        return null;
      }

      const data = (await response.json()) as { access_token: string; expires_in?: number };
      return {
        accessToken: data.access_token,
        expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
        tokenType: 'Bearer',
      };
    } catch (error) {
      logger.warn({ error }, 'Antigravity token exchange failed');
      return null;
    }
  }

  async function refreshToken(): Promise<TokenInfo | null> {
    switch (config.method) {
      case 'service-account':
        return getServiceAccountToken();
      case 'oauth2':
        return getOAuth2Token();
      case 'adc':
        return getADCToken();
      case 'antigravity':
        return getAntigravityToken();
      default:
        return null;
    }
  }

  const extension: GoogleAuthExtension = {
    async getAccessToken(): Promise<string | null> {
      if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
        return cachedToken.accessToken;
      }

      cachedToken = await refreshToken();
      return cachedToken?.accessToken || null;
    },

    async getTokenInfo(): Promise<TokenInfo | null> {
      if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
        return cachedToken;
      }

      cachedToken = await refreshToken();
      return cachedToken;
    },

    async request<T>(url: string, options?: RequestInit): Promise<T> {
      const token = await extension.getAccessToken();
      if (!token) {
        throw new Error('No Google access token available');
      }

      const headers = new Headers(options?.headers);
      headers.set('Authorization', `Bearer ${token}`);

      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        throw new Error(`Google API error: ${response.status}`);
      }

      return response.json() as Promise<T>;
    },

    getGeminiClient(): GeminiClient {
      return {
        async generateContent(prompt: string, options?: GeminiOptions): Promise<string> {
          const model = options?.model || 'gemini-pro';
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

          const result = await extension.request<{ candidates: Array<{ content: { parts: Array<{ text: string }> } }> }>(
            url,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  maxOutputTokens: options?.maxTokens,
                  temperature: options?.temperature,
                  topP: options?.topP,
                  topK: options?.topK,
                },
              }),
            }
          );

          return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        },

        async *streamGenerateContent(prompt: string, options?: GeminiOptions): AsyncGenerator<string> {
          const model = options?.model || 'gemini-pro';
          const token = await extension.getAccessToken();
          if (!token) throw new Error('No token');

          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                maxOutputTokens: options?.maxTokens,
                temperature: options?.temperature,
              },
            }),
          });

          if (!response.ok || !response.body) {
            throw new Error(`Gemini API error: ${response.status}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

            for (const line of lines) {
              try {
                const data = JSON.parse(line.slice(6));
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) yield text;
              } catch {
                // Ignore parse errors
              }
            }
          }
        },
      };
    },

    getVertexClient(): VertexClient {
      if (!config.projectId) {
        throw new Error('Vertex AI requires projectId in GoogleAuthConfig');
      }
      const projectId = config.projectId;
      const region = config.region || 'us-central1';

      return {
        async generateContent(prompt: string, options?: VertexOptions): Promise<string> {
          const model = options?.model || 'gemini-1.0-pro';
          const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;

          const result = await extension.request<{ candidates: Array<{ content: { parts: Array<{ text: string }> } }> }>(
            url,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                  maxOutputTokens: options?.maxTokens,
                  temperature: options?.temperature,
                  topP: options?.topP,
                  topK: options?.topK,
                },
                safetySettings: options?.safetySettings,
              }),
            }
          );

          return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        },

        async getEmbeddings(texts: string[]): Promise<number[][]> {
          const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/textembedding-gecko:predict`;

          const result = await extension.request<{ predictions: Array<{ embeddings: { values: number[] } }> }>(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instances: texts.map((text) => ({ content: text })),
            }),
          });

          return result.predictions.map((p: { embeddings: { values: number[] } }) => p.embeddings.values);
        },
      };
    },
  };

  return extension;
}
