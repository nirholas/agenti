/**
 * React hook for using the Gateway API client
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  GatewayClient,
  createGatewayClient,
  type GatewayConfig,
  type InvokeRequest,
  type InvokeResponse,
  type StreamChunk,
  type AgentReasoning,
  type AuthMethod,
} from '../api/gateway-client';

export interface UseGatewayClientOptions {
  /** Gateway configuration */
  config?: Partial<GatewayConfig>;
  /** Callback when agent starts processing */
  onStart?: () => void;
  /** Callback for each streaming chunk */
  onChunk?: (chunk: StreamChunk) => void;
  /** Callback when agent completes */
  onComplete?: (response: InvokeResponse) => void;
  /** Callback on error */
  onError?: (error: string) => void;
  /** Callback on authentication status change */
  onAuthChange?: (isAuthenticated: boolean) => void;
}

export interface UseGatewayClientReturn {
  /** Invoke the agent */
  invoke: (input: string, sessionId?: string) => Promise<InvokeResponse>;
  /** Invoke the agent with streaming */
  invokeStreaming: (input: string, sessionId?: string) => Promise<InvokeResponse>;
  /** Cancel ongoing request */
  cancel: () => void;
  /** Check gateway health */
  healthCheck: () => Promise<boolean>;
  /** Refresh authentication */
  refreshAuth: () => Promise<void>;
  /** Whether a request is in progress */
  isLoading: boolean;
  /** Current response */
  response: InvokeResponse | null;
  /** Current error */
  error: string | null;
  /** Streaming text (accumulated) */
  streamingText: string;
  /** Current session ID */
  sessionId: string | null;
  /** Agent reasoning steps */
  reasoning: AgentReasoning[];
  /** Whether authenticated */
  isAuthenticated: boolean;
  /** Current authentication method */
  authMethod: AuthMethod;
}

/**
 * Hook for interacting with the AgentCore Gateway
 */
export function useGatewayClient(
  options: UseGatewayClientOptions = {}
): UseGatewayClientReturn {
  const { config, onStart, onChunk, onComplete, onError, onAuthChange } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<InvokeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState<AgentReasoning[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('proxy');

  const clientRef = useRef<GatewayClient | null>(null);

  // Initialize client and check authentication
  useEffect(() => {
    clientRef.current = createGatewayClient(config);
    setAuthMethod(clientRef.current.getAuthMethod());
    
    // Check initial authentication status
    clientRef.current.isAuthenticated().then((authenticated) => {
      setIsAuthenticated(authenticated);
      onAuthChange?.(authenticated);
    });
    
    return () => {
      clientRef.current?.cancel();
    };
  }, [config, onAuthChange]);

  const refreshAuth = useCallback(async (): Promise<void> => {
    if (!clientRef.current) return;
    
    try {
      await clientRef.current.refreshAuth();
      const authenticated = await clientRef.current.isAuthenticated();
      setIsAuthenticated(authenticated);
      onAuthChange?.(authenticated);
    } catch (err) {
      setIsAuthenticated(false);
      onAuthChange?.(false);
      throw err;
    }
  }, [onAuthChange]);

  const invoke = useCallback(
    async (input: string, existingSessionId?: string): Promise<InvokeResponse> => {
      if (!clientRef.current) {
        const errorResponse: InvokeResponse = {
          success: false,
          completion: '',
          sessionId: '',
          error: 'Gateway client not initialized',
          errorType: 'InitializationError',
        };
        setError(errorResponse.error!);
        onError?.(errorResponse.error!);
        return errorResponse;
      }

      setIsLoading(true);
      setError(null);
      setResponse(null);
      setStreamingText('');
      setReasoning([]);
      onStart?.();

      const request: InvokeRequest = {
        inputText: input,
        sessionId: existingSessionId || sessionId || undefined,
        enableTrace: true,
      };

      const result = await clientRef.current.invoke(request);

      setIsLoading(false);
      setResponse(result);
      setSessionId(result.sessionId);

      if (result.success) {
        onComplete?.(result);
      } else {
        setError(result.error || 'Unknown error');
        onError?.(result.error || 'Unknown error');
      }

      return result;
    },
    [sessionId, onStart, onComplete, onError]
  );

  const invokeStreaming = useCallback(
    async (input: string, existingSessionId?: string): Promise<InvokeResponse> => {
      if (!clientRef.current) {
        const errorResponse: InvokeResponse = {
          success: false,
          completion: '',
          sessionId: '',
          error: 'Gateway client not initialized',
          errorType: 'InitializationError',
        };
        setError(errorResponse.error!);
        onError?.(errorResponse.error!);
        return errorResponse;
      }

      setIsLoading(true);
      setError(null);
      setResponse(null);
      setStreamingText('');
      setReasoning([]);
      onStart?.();

      const request: InvokeRequest = {
        inputText: input,
        sessionId: existingSessionId || sessionId || undefined,
        enableTrace: true,
      };

      const result = await clientRef.current.invokeStreaming(request, (chunk) => {
        if (chunk.type === 'text' && chunk.text) {
          setStreamingText((prev) => prev + chunk.text);
        } else if (chunk.type === 'trace' && chunk.trace) {
          // Parse trace for reasoning steps
          const trace = chunk.trace;
          if (trace.type === 'orchestration' && trace.data) {
            const data = trace.data as Record<string, unknown>;
            if (data.rationale) {
              setReasoning((prev) => [
                ...prev,
                {
                  step: `Step ${prev.length + 1}`,
                  description: String(data.rationale),
                  tool: data.actionGroup as string | undefined,
                  toolInput: data.actionGroupInput,
                },
              ]);
            }
          }
        }
        onChunk?.(chunk);
      });

      setIsLoading(false);
      setResponse(result);
      setSessionId(result.sessionId);

      if (result.success) {
        onComplete?.(result);
      } else {
        setError(result.error || 'Unknown error');
        onError?.(result.error || 'Unknown error');
      }

      return result;
    },
    [sessionId, onStart, onChunk, onComplete, onError]
  );

  const cancel = useCallback(() => {
    clientRef.current?.cancel();
    setIsLoading(false);
  }, []);

  const healthCheck = useCallback(async (): Promise<boolean> => {
    if (!clientRef.current) return false;
    return clientRef.current.healthCheck();
  }, []);

  return {
    invoke,
    invokeStreaming,
    cancel,
    healthCheck,
    refreshAuth,
    isLoading,
    response,
    error,
    streamingText,
    sessionId,
    reasoning,
    isAuthenticated,
    authMethod,
  };
}

export default useGatewayClient;
