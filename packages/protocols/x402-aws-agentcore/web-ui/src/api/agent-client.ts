/**
 * Agent API Client
 * 
 * Simple client for invoking the AgentCore Runtime agent via the backend API.
 * No complex authentication - the backend handles AWS credentials.
 */

export interface AgentConfig {
  /** Backend API endpoint */
  endpoint: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface InvokeRequest {
  /** User input message */
  prompt: string;
  /** Session ID for conversation context */
  sessionId?: string;
}

export interface InvokeResponse {
  /** Whether the request was successful */
  success: boolean;
  /** Agent's response text */
  completion: string;
  /** Session ID used */
  sessionId: string;
  /** Error message (if failed) */
  error?: string;
}

export interface StreamChunk {
  /** Chunk type */
  type: 'text' | 'done' | 'error';
  /** Text content (for text chunks) */
  text?: string;
  /** Session ID (for done chunks) */
  sessionId?: string;
  /** Error message (for error chunks) */
  error?: string;
}

/**
 * Simple Agent API Client.
 * 
 * Calls the backend API which handles AWS authentication
 * and invokes the AgentCore Runtime.
 */
export class AgentClient {
  private config: Required<AgentConfig>;
  private abortController: AbortController | null = null;

  constructor(config: AgentConfig) {
    this.config = {
      endpoint: config.endpoint,
      timeout: config.timeout || 300000, // 5 minutes default
      debug: config.debug || false,
    };
  }

  /**
   * Generate a unique session ID
   */
  static generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[AgentClient]', ...args);
    }
  }

  /**
   * Invoke the agent with the given prompt.
   */
  async invoke(request: InvokeRequest): Promise<InvokeResponse> {
    const sessionId = request.sessionId || AgentClient.generateSessionId();
    
    this.log('Invoking agent:', { ...request, sessionId });

    try {
      this.abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        this.abortController?.abort();
      }, this.config.timeout);

      const response = await fetch(`${this.config.endpoint}/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: request.prompt,
          session_id: sessionId,
        }),
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          completion: '',
          sessionId,
          error: errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      
      this.log('Agent response:', data);

      return {
        success: true,
        completion: data.completion || '',
        sessionId: data.session_id || sessionId,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          completion: '',
          sessionId,
          error: 'Request timed out',
        };
      }

      return {
        success: false,
        completion: '',
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Invoke the agent and stream the response.
   */
  async invokeStreaming(
    request: InvokeRequest,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<InvokeResponse> {
    const sessionId = request.sessionId || AgentClient.generateSessionId();
    
    this.log('Invoking agent (streaming):', { ...request, sessionId });

    try {
      this.abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        this.abortController?.abort();
      }, this.config.timeout);

      const response = await fetch(`${this.config.endpoint}/invoke-streaming`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          prompt: request.prompt,
          session_id: sessionId,
        }),
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorResponse: InvokeResponse = {
          success: false,
          completion: '',
          sessionId,
          error: errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
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
      let finalSessionId = sessionId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as StreamChunk;
              
              if (data.type === 'text' && data.text) {
                completion += data.text;
                onChunk({ type: 'text', text: data.text });
              } else if (data.type === 'done') {
                finalSessionId = data.sessionId || sessionId;
                onChunk({ type: 'done', sessionId: finalSessionId });
              } else if (data.type === 'error') {
                onChunk({ type: 'error', error: data.error });
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      return {
        success: true,
        completion,
        sessionId: finalSessionId,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        onChunk({ type: 'error', error: 'Request timed out' });
        return {
          success: false,
          completion: '',
          sessionId,
          error: 'Request timed out',
        };
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onChunk({ type: 'error', error: errorMessage });
      
      return {
        success: false,
        completion: '',
        sessionId,
        error: errorMessage,
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
   * Check if the backend is reachable
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

  /**
   * Get agent info from the backend
   */
  async getInfo(): Promise<Record<string, string> | null> {
    try {
      const response = await fetch(`${this.config.endpoint}/info`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        return response.json();
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Create an Agent client with default configuration
 */
export function createAgentClient(config: Partial<AgentConfig> = {}): AgentClient {
  const defaultConfig: AgentConfig = {
    endpoint: import.meta.env.VITE_API_ENDPOINT || 'http://localhost:8080',
    timeout: 300000,
    debug: import.meta.env.DEV,
  };

  return new AgentClient({ ...defaultConfig, ...config });
}

export default AgentClient;
