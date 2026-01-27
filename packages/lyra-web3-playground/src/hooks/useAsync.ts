/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Async operations, handled with grace ⚡
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * State for async operations
 */
export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Return type for useAsync hook
 */
export interface UseAsyncReturn<T, Args extends unknown[]> extends AsyncState<T> {
  execute: (...args: Args) => Promise<T | undefined>;
  reset: () => void;
  setData: (data: T | null) => void;
}

/**
 * Options for useAsync hook
 */
export interface UseAsyncOptions<T> {
  /** Initial data value */
  initialData?: T | null;
  /** Execute immediately on mount */
  immediate?: boolean;
  /** Callback on success */
  onSuccess?: (data: T) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Retry count on failure */
  retryCount?: number;
  /** Retry delay in ms */
  retryDelay?: number;
}

/**
 * Hook for handling async operations with loading, error, and success states
 * 
 * @example
 * const { data, isLoading, error, execute } = useAsync(
 *   async (id: string) => await fetchUser(id),
 *   { onSuccess: (user) => console.log('User loaded:', user) }
 * );
 * 
 * // Execute with arguments
 * execute('user-123');
 */
export function useAsync<T, Args extends unknown[] = []>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: UseAsyncOptions<T> = {}
): UseAsyncReturn<T, Args> {
  const {
    initialData = null,
    immediate = false,
    onSuccess,
    onError,
    retryCount = 0,
    retryDelay = 1000,
  } = options;

  const [state, setState] = useState<AsyncState<T>>({
    data: initialData,
    isLoading: immediate,
    isSuccess: false,
    isError: false,
    error: null,
  });

  // Track if component is mounted to prevent state updates after unmount
  const mountedRef = useRef(true);
  const retriesRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args: Args): Promise<T | undefined> => {
      if (!mountedRef.current) return;

      setState(prev => ({
        ...prev,
        isLoading: true,
        isError: false,
        error: null,
      }));

      try {
        const result = await asyncFunction(...args);

        if (!mountedRef.current) return;

        setState({
          data: result,
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
        });

        retriesRef.current = 0;
        onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (!mountedRef.current) return;

        // Handle retries
        if (retriesRef.current < retryCount) {
          retriesRef.current += 1;
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return execute(...args);
        }

        setState({
          data: null,
          isLoading: false,
          isSuccess: false,
          isError: true,
          error,
        });

        retriesRef.current = 0;
        onError?.(error);
        return undefined;
      }
    },
    [asyncFunction, onSuccess, onError, retryCount, retryDelay]
  );

  const reset = useCallback(() => {
    setState({
      data: initialData,
      isLoading: false,
      isSuccess: false,
      isError: false,
      error: null,
    });
    retriesRef.current = 0;
  }, [initialData]);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  // Execute immediately if specified
  useEffect(() => {
    if (immediate) {
      execute(...([] as unknown as Args));
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    execute,
    reset,
    setData,
  };
}

/**
 * Hook for debounced async operations
 * Useful for search inputs or auto-save
 */
export function useDebouncedAsync<T, Args extends unknown[] = []>(
  asyncFunction: (...args: Args) => Promise<T>,
  delay: number = 300,
  options: UseAsyncOptions<T> = {}
): UseAsyncReturn<T, Args> {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const asyncHook = useAsync(asyncFunction, options);

  const debouncedExecute = useCallback(
    (...args: Args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      return new Promise<T | undefined>((resolve) => {
        timeoutRef.current = setTimeout(async () => {
          const result = await asyncHook.execute(...args);
          resolve(result);
        }, delay);
      });
    },
    [asyncHook.execute, delay]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    ...asyncHook,
    execute: debouncedExecute,
  };
}

/**
 * Hook for polling async operations at intervals
 */
export function usePollingAsync<T>(
  asyncFunction: () => Promise<T>,
  interval: number = 5000,
  options: UseAsyncOptions<T> & { enabled?: boolean } = {}
): UseAsyncReturn<T, []> {
  const { enabled = true, ...asyncOptions } = options;
  const asyncHook = useAsync(asyncFunction, asyncOptions);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    // Initial fetch
    asyncHook.execute();

    // Set up polling
    intervalRef.current = setInterval(() => {
      asyncHook.execute();
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval]); // Intentionally not including execute to avoid infinite loop

  return asyncHook;
}

export default useAsync;
