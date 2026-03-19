/**
 * React hook for using the Agent API client
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  AgentClient,
  createAgentClient,
  type AgentConfig,
  type InvokeResponse,
  type StreamChunk,
} from '../api';

export interface UseAgentClientOptions {
  /** Agent client configuration */
  config?: Partial<AgentConfig>;
  /** Callback when agent starts processing */
  onStart?: () => void;
  /** Callback for each streaming chunk */
  onChunk?: (chunk: StreamChunk) => void;
  /** Callback when agent completes */
  onComplete?: (response: InvokeResponse) => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

export interface UseAgentClientReturn {
  /** Invoke the agent */
  invoke: (prompt: string, sessionId?: string) => Promise<InvokeResponse>;
  /** Invoke the agent with streaming */
  invokeStreaming: (prompt: string, sessionId?: string) => Promise<InvokeResponse>;
  /** Cancel ongoing request */
  cancel: () => void;
  /** Check backend health */
  healthCheck: () => Promise<boolean>;
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
  /** Whether backend is connected */
  isConnected: boolean;
}

/**
 * Hook for interacting with the Agent API
 */
export function useAgentClient(
  options: UseAgentClientOptions = {}
): UseAgentClientReturn {
  const { config, onStart, onChunk, onComplete, onError } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<InvokeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const clientRef = useRef<AgentClient | null>(null);

  // Initialize client and check connection
  useEffect(() => {
    clientRef.current = createAgentClient(config);
    
    // Check initial connection status
    clientRef.current.healthCheck().then((connected) => {
      setIsConnected(connected);
    });
    
    return () => {
      clientRef.current?.cancel();
    };
  }, [config]);

  const invoke = useCallback(
    async (prompt: string, existingSessionId?: string): Promise<InvokeResponse> => {
      if (!clientRef.current) {
        const errorResponse: InvokeResponse = {
          success: false,
          completion: '',
          sessionId: '',
          error: 'Agent client not initialized',
        };
        setError(errorResponse.error!);
        onError?.(errorResponse.error!);
        return errorResponse;
      }

      setIsLoading(true);
      setError(null);
      setResponse(null);
      setStreamingText('');
      onStart?.();

      const result = await clientRef.current.invoke({
        prompt,
        sessionId: existingSessionId || sessionId || undefined,
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
    [sessionId, onStart, onComplete, onError]
  );

  const invokeStreaming = useCallback(
    async (prompt: string, existingSessionId?: string): Promise<InvokeResponse> => {
      if (!clientRef.current) {
        const errorResponse: InvokeResponse = {
          success: false,
          completion: '',
          sessionId: '',
          error: 'Agent client not initialized',
        };
        setError(errorResponse.error!);
        onError?.(errorResponse.error!);
        return errorResponse;
      }

      setIsLoading(true);
      setError(null);
      setResponse(null);
      setStreamingText('');
      onStart?.();

      const result = await clientRef.current.invokeStreaming(
        {
          prompt,
          sessionId: existingSessionId || sessionId || undefined,
        },
        (chunk) => {
          if (chunk.type === 'text' && chunk.text) {
            setStreamingText((prev) => prev + chunk.text);
          }
          onChunk?.(chunk);
        }
      );

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
    const connected = await clientRef.current.healthCheck();
    setIsConnected(connected);
    return connected;
  }, []);

  return {
    invoke,
    invokeStreaming,
    cancel,
    healthCheck,
    isLoading,
    response,
    error,
    streamingText,
    sessionId,
    isConnected,
  };
}

export default useAgentClient;
