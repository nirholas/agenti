/**
 * AgentCore Gateway API Client
 * 
 * This module provides a client for invoking the AgentCore Gateway
 * from the web UI. It supports multiple authentication methods:
 * 
 * 1. Cognito - Uses AWS Cognito Identity Pool for temporary credentials
 * 2. Proxy - Requests go through a backend proxy that handles SigV4 signing
 * 3. API Key - Uses API Gateway API key authentication
 * 
 * For browser environments, direct IAM SigV4 signing requires temporary
 * credentials from Cognito or a backend proxy.
 */

import { AuthService, createAuthService, type AuthConfig, type AuthMethod } from './auth';

export interface GatewayConfig {
  /** Gateway endpoint URL */
  endpoint: string;
  /** AWS region */
  region: string;
  /** Agent ID */
  agentId: string;
  /** Agent alias ID (default: TSTALIASID for test) */
  agentAliasId?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Authentication configuration */
  auth?: Partial<AuthConfig>;
}

export interface InvokeRequest {
  /** User input message */
  inputText: string;
  /** Session ID for conversation context */
  sessionId?: string;
  /** Enable trace information */
  enableTrace?: boolean;
}

export interface InvokeResponse {
  /** Whether the request was successful */
  success: boolean;
  /** Agent's response text */
  completion: string;
  /** Session ID used */
  sessionId: string;
  /** Trace information (if enabled) */
  traces?: AgentTrace[];
  /** Error message (if failed) */
  error?: string;
  /** Error type (if failed) */
  errorType?: string;
}

export interface AgentTrace {
  /** Trace type */
  type: string;
  /** Trace data */
  data: unknown;
  /** Timestamp */
  timestamp: string;
}

export interface AgentReasoning {
  /** Step in the reasoning process */
  step: string;
  /** Description of what the agent is doing */
  description: string;
  /** Tool being used (if any) */
  tool?: string;
  /** Tool input (if any) */
  toolInput?: unknown;
  /** Tool output (if any) */
  toolOutput?: unknown;
}

export interface StreamChunk {
  /** Chunk type */
  type: 'text' | 'trace' | 'error' | 'done';
  /** Text content (for text chunks) */
  text?: string;
  /** Trace data (for trace chunks) */
  trace?: AgentTrace;
  /** Error message (for error chunks) */
  error?: string;
}

/**
 * Gateway API Client for browser environments.
 * 
 * This client supports multiple authentication methods:
 * 1. Cognito mode: Uses AWS Cognito for temporary credentials with SigV4 signing
 * 2. Proxy mode: Requests go through a backend proxy that handles SigV4 signing
 * 3. API Key mode: Uses API Gateway API key authentication
 */
export class GatewayClient {
  private config: Required<Omit<GatewayConfig, 'auth'>> & { auth?: Partial<AuthConfig> };
  private abortController: AbortController | null = null;
  private authService: AuthService;

  constructor(config: GatewayConfig) {
    this.config = {
      endpoint: config.endpoint,
      region: config.region,
      agentId: config.agentId,
      agentAliasId: config.agentAliasId || 'TSTALIASID',
      timeout: config.timeout || 300000, // 5 minutes default
      debug: config.debug || false,
      auth: config.auth,
    };
    
    // Initialize auth service with config
    this.authService = createAuthService({
      region: config.region,
      ...config.auth,
    });
  }

  /**
   * Get the current authentication method
   */
  getAuthMethod(): AuthMethod {
    return this.authService.getMethod();
  }

  /**
   * Check if authentication is configured and valid
   */
  async isAuthenticated(): Promise<boolean> {
    const method = this.authService.getMethod();
    
    if (method === 'none' || method === 'proxy') {
      return true; // No auth needed or proxy handles it
    }
    
    if (method === 'cognito') {
      try {
        await this.authService.getCredentials();
        return true;
      } catch {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Refresh authentication credentials
   */
  async refreshAuth(): Promise<void> {
    this.authService.clearCredentials();
    if (this.authService.getMethod() === 'cognito') {
      await this.authService.getCredentials();
    }
  }

  /**
   * Generate a unique session ID
   */
  static generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[GatewayClient]', ...args);
    }
  }

  /**
   * Invoke the agent with the given input.
   * 
   * @param request - The invocation request
   * @returns Promise resolving to the agent's response
   */
  async invoke(request: InvokeRequest): Promise<InvokeResponse> {
    const sessionId = request.sessionId || GatewayClient.generateSessionId();
    
    this.log('Invoking agent:', { ...request, sessionId });

    try {
      // Create abort controller for timeout
      this.abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        this.abortController?.abort();
      }, this.config.timeout);

      const url = `${this.config.endpoint}/invoke`;
      const body = JSON.stringify({
        agentId: this.config.agentId,
        agentAliasId: this.config.agentAliasId,
        sessionId,
        inputText: request.inputText,
        enableTrace: request.enableTrace || false,
      });

      // Get authentication headers
      const authHeaders = await this.authService.getAuthHeaders('POST', url, body);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body,
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle authentication errors
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            completion: '',
            sessionId,
            error: errorData.message || 'Authentication failed. Please check your credentials.',
            errorType: 'AuthenticationError',
          };
        }
        
        return {
          success: false,
          completion: '',
          sessionId,
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          errorType: errorData.errorType || 'HttpError',
        };
      }

      const data = await response.json();
      
      this.log('Agent response:', data);

      return {
        success: true,
        completion: data.completion || '',
        sessionId,
        traces: data.traces,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          completion: '',
          sessionId,
          error: 'Request timed out',
          errorType: 'TimeoutError',
        };
      }

      return {
        success: false,
        completion: '',
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: 'NetworkError',
      };
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Invoke the agent and stream the response.
   * 
   * @param request - The invocation request
   * @param onChunk - Callback for each response chunk
   * @returns Promise resolving when streaming is complete
   */
  async invokeStreaming(
    request: InvokeRequest,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<InvokeResponse> {
    const sessionId = request.sessionId || GatewayClient.generateSessionId();
    
    this.log('Invoking agent (streaming):', { ...request, sessionId });

    try {
      this.abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        this.abortController?.abort();
      }, this.config.timeout);

      const url = `${this.config.endpoint}/invoke-streaming`;
      const body = JSON.stringify({
        agentId: this.config.agentId,
        agentAliasId: this.config.agentAliasId,
        sessionId,
        inputText: request.inputText,
        enableTrace: request.enableTrace || false,
      });

      // Get authentication headers
      const authHeaders = await this.authService.getAuthHeaders('POST', url, body);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...authHeaders,
        },
        body,
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle authentication errors
        if (response.status === 401 || response.status === 403) {
          const errorResponse: InvokeResponse = {
            success: false,
            completion: '',
            sessionId,
            error: errorData.message || 'Authentication failed. Please check your credentials.',
            errorType: 'AuthenticationError',
          };
          onChunk({ type: 'error', error: errorResponse.error });
          return errorResponse;
        }
        
        const errorResponse: InvokeResponse = {
          success: false,
          completion: '',
          sessionId,
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          errorType: errorData.errorType || 'HttpError',
        };
        onChunk({ type: 'error', error: errorResponse.error });
        return errorResponse;
      }

      // Process streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let completion = '';
      const traces: AgentTrace[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'text') {
                completion += data.text;
                onChunk({ type: 'text', text: data.text });
              } else if (data.type === 'trace') {
                traces.push(data.trace);
                onChunk({ type: 'trace', trace: data.trace });
              } else if (data.type === 'error') {
                onChunk({ type: 'error', error: data.error });
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      onChunk({ type: 'done' });

      return {
        success: true,
        completion,
        sessionId,
        traces,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        onChunk({ type: 'error', error: 'Request timed out' });
        return {
          success: false,
          completion: '',
          sessionId,
          error: 'Request timed out',
          errorType: 'TimeoutError',
        };
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onChunk({ type: 'error', error: errorMessage });
      
      return {
        success: false,
        completion: '',
        sessionId,
        error: errorMessage,
        errorType: 'NetworkError',
      };
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Cancel any ongoing request
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Check if the gateway is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Create a Gateway client with default configuration
 */
export function createGatewayClient(config: Partial<GatewayConfig> = {}): GatewayClient {
  const defaultConfig: GatewayConfig = {
    endpoint: import.meta.env.VITE_GATEWAY_ENDPOINT || 'http://localhost:8080/api',
    region: import.meta.env.VITE_AWS_REGION || 'us-west-2',
    agentId: import.meta.env.VITE_AGENT_ID || '',
    agentAliasId: import.meta.env.VITE_AGENT_ALIAS_ID || 'TSTALIASID',
    timeout: 300000,
    debug: import.meta.env.DEV,
    auth: {
      method: (import.meta.env.VITE_AUTH_METHOD as AuthMethod) || 'proxy',
      region: import.meta.env.VITE_AWS_REGION || 'us-west-2',
      identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID,
      apiKey: import.meta.env.VITE_API_KEY,
    },
  };

  return new GatewayClient({ ...defaultConfig, ...config });
}

export type { AuthMethod, AuthConfig } from './auth';
export default GatewayClient;
