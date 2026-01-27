/**
 * MCP Retry Utilities - Exponential backoff and circuit breaker patterns
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import type { Logger } from './logger.js';
import { NoopLogger } from './logger.js';

// ============================================================================
// Retry Configuration
// ============================================================================

/**
 * Retry strategy configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  readonly maxAttempts: number;
  /** Initial delay in milliseconds (default: 1000) */
  readonly initialDelayMs: number;
  /** Maximum delay in milliseconds (default: 30000) */
  readonly maxDelayMs: number;
  /** Backoff multiplier (default: 2.0) */
  readonly backoffMultiplier: number;
  /** Whether to add jitter to delays (default: true) */
  readonly jitter: boolean;
  /** Jitter factor (0-1) (default: 0.25) */
  readonly jitterFactor: number;
  /** Timeout for each attempt in milliseconds (default: 30000) */
  readonly attemptTimeoutMs: number;
  /** Whether to retry on timeout errors (default: true) */
  readonly retryOnTimeout: boolean;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: Readonly<RetryConfig> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2.0,
  jitter: true,
  jitterFactor: 0.25,
  attemptTimeoutMs: 30_000,
  retryOnTimeout: true,
} as const;

/**
 * Partial retry configuration for customization
 */
export type RetryOptions = Partial<RetryConfig>;

// ============================================================================
// Retry Context
// ============================================================================

/**
 * Context passed to retry callbacks
 */
export interface RetryContext {
  /** Current attempt number (1-based) */
  readonly attempt: number;
  /** Total attempts allowed */
  readonly maxAttempts: number;
  /** Time since first attempt in ms */
  readonly elapsedMs: number;
  /** Previous error if any */
  readonly lastError?: Error;
  /** Whether this is the last attempt */
  readonly isLastAttempt: boolean;
}

/**
 * Retry result with attempt details
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded */
  readonly success: boolean;
  /** Result value if successful */
  readonly value?: T;
  /** Error if failed */
  readonly error?: Error;
  /** Number of attempts made */
  readonly attempts: number;
  /** Total time elapsed in ms */
  readonly elapsedMs: number;
  /** Whether retries were exhausted */
  readonly retriesExhausted: boolean;
}

/**
 * Function type for retry predicate
 */
export type RetryPredicate = (error: Error, context: RetryContext) => boolean;

/**
 * Function type for delay customization
 */
export type DelayFunction = (attempt: number, config: RetryConfig) => number;

// ============================================================================
// Retry Implementation
// ============================================================================

/**
 * Calculate delay with exponential backoff and optional jitter
 *
 * @param attempt - Current attempt number (1-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff: initialDelay * multiplier^(attempt-1)
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);

  // Clamp to maxDelay
  let delay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter if enabled
  if (config.jitter) {
    const jitterRange = delay * config.jitterFactor;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;
    delay = Math.max(0, delay + jitter);
  }

  return Math.round(delay);
}

/**
 * Default retry predicate - retries on all errors except AbortError
 */
export const defaultRetryPredicate: RetryPredicate = (error: Error, context: RetryContext) => {
  // Don't retry if this was the last attempt
  if (context.isLastAttempt) {
    return false;
  }

  // Don't retry abort errors
  if (error.name === 'AbortError') {
    return false;
  }

  // Don't retry authentication errors
  if (error.message.toLowerCase().includes('unauthorized') ||
      error.message.toLowerCase().includes('forbidden') ||
      error.message.toLowerCase().includes('authentication')) {
    return false;
  }

  // Retry all other errors
  return true;
};

/**
 * Create a retry predicate that only retries specific error types
 */
export function createRetryPredicate(
  retryableErrors: (new (...args: unknown[]) => Error)[]
): RetryPredicate {
  return (error: Error, context: RetryContext) => {
    if (context.isLastAttempt) {
      return false;
    }
    return retryableErrors.some((ErrorType) => error instanceof ErrorType);
  };
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timeoutId = setTimeout(resolve, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

/**
 * Execute an operation with retry logic
 *
 * @param operation - Async operation to execute
 * @param options - Retry options
 * @param shouldRetry - Optional custom retry predicate
 * @param signal - Optional abort signal
 * @param logger - Optional logger
 * @returns Retry result
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   async () => {
 *     const response = await fetch('https://api.example.com/data');
 *     if (!response.ok) throw new Error(`HTTP ${response.status}`);
 *     return response.json();
 *   },
 *   { maxAttempts: 5, initialDelayMs: 500 }
 * );
 *
 * if (result.success) {
 *   console.log('Data:', result.value);
 * } else {
 *   console.error('Failed after', result.attempts, 'attempts:', result.error);
 * }
 * ```
 */
export async function retry<T>(
  operation: (context: RetryContext) => Promise<T>,
  options: RetryOptions = {},
  shouldRetry: RetryPredicate = defaultRetryPredicate,
  signal?: AbortSignal,
  logger: Logger = new NoopLogger()
): Promise<RetryResult<T>> {
  const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...options };
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    const context: RetryContext = {
      attempt,
      maxAttempts: config.maxAttempts,
      elapsedMs: Date.now() - startTime,
      lastError,
      isLastAttempt: attempt === config.maxAttempts,
    };

    try {
      // Check abort signal
      if (signal?.aborted) {
        throw new DOMException('Operation aborted', 'AbortError');
      }

      logger.debug(`Attempt ${attempt}/${config.maxAttempts}`, { data: { attempt } });

      // Execute with timeout
      const value = await executeWithTimeout(
        () => operation(context),
        config.attemptTimeoutMs,
        signal
      );

      return {
        success: true,
        value,
        attempts: attempt,
        elapsedMs: Date.now() - startTime,
        retriesExhausted: false,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Update context with error
      const errorContext: RetryContext = {
        ...context,
        lastError,
      };

      logger.debug(`Attempt ${attempt} failed: ${lastError.message}`, {
        data: { attempt, error: lastError.message },
      });

      // Check if we should retry
      if (!shouldRetry(lastError, errorContext)) {
        logger.debug('Not retrying - predicate returned false');
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          elapsedMs: Date.now() - startTime,
          retriesExhausted: false,
        };
      }

      // Don't delay after the last attempt
      if (attempt < config.maxAttempts) {
        const delay = calculateBackoffDelay(attempt, config);
        logger.debug(`Waiting ${delay}ms before retry`, { data: { delay } });

        try {
          await sleep(delay, signal);
        } catch (sleepError) {
          // Abort signal was triggered during sleep
          return {
            success: false,
            error: sleepError instanceof Error ? sleepError : new Error(String(sleepError)),
            attempts: attempt,
            elapsedMs: Date.now() - startTime,
            retriesExhausted: false,
          };
        }
      }
    }
  }

  // All retries exhausted
  return {
    success: false,
    error: lastError ?? new Error('Unknown error'),
    attempts: config.maxAttempts,
    elapsedMs: Date.now() - startTime,
    retriesExhausted: true,
  };
}

/**
 * Execute an operation with timeout
 */
async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Clean up timeout if signal is aborted
    signal?.addEventListener('abort', () => clearTimeout(timeoutId), { once: true });
  });

  return Promise.race([operation(), timeoutPromise]);
}

// ============================================================================
// Circuit Breaker
// ============================================================================

/**
 * Circuit breaker state
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit (default: 5) */
  readonly failureThreshold: number;
  /** Time in ms before attempting to close circuit (default: 60000) */
  readonly resetTimeoutMs: number;
  /** Number of successes needed to close circuit from half-open (default: 2) */
  readonly successThreshold: number;
  /** Timeout for operations in ms (default: 30000) */
  readonly operationTimeoutMs: number;
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: Readonly<CircuitBreakerConfig> = {
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  successThreshold: 2,
  operationTimeoutMs: 30_000,
} as const;

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  readonly state: CircuitState;
  readonly failures: number;
  readonly successes: number;
  readonly lastFailure?: Date;
  readonly lastSuccess?: Date;
  readonly lastStateChange: Date;
  readonly totalRequests: number;
  readonly totalFailures: number;
  readonly totalSuccesses: number;
}

/**
 * Circuit breaker error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  readonly name = 'CircuitOpenError';
  readonly resetTime: Date;

  constructor(resetTime: Date) {
    super(`Circuit is open. Will attempt reset at ${resetTime.toISOString()}`);
    this.resetTime = resetTime;
  }
}

/**
 * Circuit breaker for preventing cascading failures
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({ failureThreshold: 3 });
 *
 * try {
 *   const result = await breaker.execute(async () => {
 *     return await riskyOperation();
 *   });
 * } catch (error) {
 *   if (error instanceof CircuitOpenError) {
 *     console.log('Circuit is open, try again at', error.resetTime);
 *   }
 * }
 * ```
 */
export class CircuitBreaker {
  private readonly _config: CircuitBreakerConfig;
  private readonly _logger: Logger;
  private _state: CircuitState = 'closed';
  private _failures = 0;
  private _successes = 0;
  private _lastFailure?: Date;
  private _lastSuccess?: Date;
  private _lastStateChange = new Date();
  private _totalRequests = 0;
  private _totalFailures = 0;
  private _totalSuccesses = 0;
  private _resetTimer?: ReturnType<typeof setTimeout>;

  constructor(config: Partial<CircuitBreakerConfig> = {}, logger: Logger = new NoopLogger()) {
    this._config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this._logger = logger;
  }

  /**
   * Current circuit state
   */
  get state(): CircuitState {
    return this._state;
  }

  /**
   * Get circuit breaker statistics
   */
  get stats(): CircuitBreakerStats {
    return {
      state: this._state,
      failures: this._failures,
      successes: this._successes,
      lastFailure: this._lastFailure,
      lastSuccess: this._lastSuccess,
      lastStateChange: this._lastStateChange,
      totalRequests: this._totalRequests,
      totalFailures: this._totalFailures,
      totalSuccesses: this._totalSuccesses,
    };
  }

  /**
   * Execute an operation through the circuit breaker
   *
   * @param operation - Operation to execute
   * @returns Operation result
   * @throws {CircuitOpenError} If circuit is open
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this._totalRequests++;

    // Check if circuit is open
    if (this._state === 'open') {
      const resetTime = new Date(this._lastStateChange.getTime() + this._config.resetTimeoutMs);
      const now = new Date();

      if (now < resetTime) {
        throw new CircuitOpenError(resetTime);
      }

      // Transition to half-open
      this._transitionTo('half-open');
    }

    try {
      // Execute with timeout
      const result = await executeWithTimeout(operation, this._config.operationTimeoutMs);
      this._recordSuccess();
      return result;
    } catch (error) {
      this._recordFailure();
      throw error;
    }
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this._failures = 0;
    this._successes = 0;
    this._transitionTo('closed');
    this._clearResetTimer();
    this._logger.info('Circuit breaker manually reset');
  }

  /**
   * Force the circuit to open
   */
  forceOpen(): void {
    this._transitionTo('open');
    this._logger.warn('Circuit breaker forced open');
  }

  /**
   * Dispose of the circuit breaker
   */
  dispose(): void {
    this._clearResetTimer();
  }

  private _recordSuccess(): void {
    this._successes++;
    this._totalSuccesses++;
    this._lastSuccess = new Date();
    this._failures = 0; // Reset failure count on success

    if (this._state === 'half-open') {
      if (this._successes >= this._config.successThreshold) {
        this._transitionTo('closed');
      }
    }
  }

  private _recordFailure(): void {
    this._failures++;
    this._totalFailures++;
    this._lastFailure = new Date();
    this._successes = 0; // Reset success count on failure

    if (this._state === 'closed') {
      if (this._failures >= this._config.failureThreshold) {
        this._transitionTo('open');
        this._scheduleReset();
      }
    } else if (this._state === 'half-open') {
      // Any failure in half-open state opens the circuit
      this._transitionTo('open');
      this._scheduleReset();
    }
  }

  private _transitionTo(newState: CircuitState): void {
    const previousState = this._state;
    this._state = newState;
    this._lastStateChange = new Date();
    this._logger.info(`Circuit breaker: ${previousState} -> ${newState}`);
  }

  private _scheduleReset(): void {
    this._clearResetTimer();
    this._resetTimer = setTimeout(() => {
      if (this._state === 'open') {
        this._transitionTo('half-open');
      }
    }, this._config.resetTimeoutMs);
  }

  private _clearResetTimer(): void {
    if (this._resetTimer) {
      clearTimeout(this._resetTimer);
      this._resetTimer = undefined;
    }
  }
}

// ============================================================================
// Retry with Circuit Breaker
// ============================================================================

/**
 * Combined retry and circuit breaker options
 */
export interface RetryWithCircuitBreakerOptions {
  readonly retry?: RetryOptions;
  readonly circuitBreaker?: Partial<CircuitBreakerConfig>;
}

/**
 * Execute an operation with both retry logic and circuit breaker protection
 *
 * @param operation - Operation to execute
 * @param options - Combined options
 * @param signal - Optional abort signal
 * @param logger - Optional logger
 * @returns Retry result
 */
export async function retryWithCircuitBreaker<T>(
  operation: (context: RetryContext) => Promise<T>,
  circuitBreaker: CircuitBreaker,
  options: RetryOptions = {},
  signal?: AbortSignal,
  logger: Logger = new NoopLogger()
): Promise<RetryResult<T>> {
  return retry(
    async (context) => {
      return circuitBreaker.execute(() => operation(context));
    },
    options,
    (error, context) => {
      // Don't retry circuit open errors
      if (error instanceof CircuitOpenError) {
        return false;
      }
      return defaultRetryPredicate(error, context);
    },
    signal,
    logger
  );
}
