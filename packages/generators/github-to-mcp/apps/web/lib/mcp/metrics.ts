/**
 * MCP Metrics - Performance tracking and telemetry
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

// ============================================================================
// Metric Types
// ============================================================================

/**
 * Counter metric - tracks cumulative values
 */
export interface Counter {
  readonly name: string;
  readonly value: number;
  readonly labels: Readonly<Record<string, string>>;
  increment(amount?: number): void;
  reset(): void;
}

/**
 * Gauge metric - tracks current values that can go up or down
 */
export interface Gauge {
  readonly name: string;
  readonly value: number;
  readonly labels: Readonly<Record<string, string>>;
  set(value: number): void;
  increment(amount?: number): void;
  decrement(amount?: number): void;
}

/**
 * Histogram metric - tracks distribution of values
 */
export interface Histogram {
  readonly name: string;
  readonly count: number;
  readonly sum: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly p50: number;
  readonly p90: number;
  readonly p95: number;
  readonly p99: number;
  readonly labels: Readonly<Record<string, string>>;
  observe(value: number): void;
  reset(): void;
}

/**
 * Timer metric - specialized histogram for timing operations
 */
export interface Timer extends Histogram {
  /** Start a timing observation */
  start(): TimerObservation;
  /** Time an async operation */
  time<T>(operation: () => Promise<T>): Promise<T>;
  /** Time a sync operation */
  timeSync<T>(operation: () => T): T;
}

/**
 * Active timer observation
 */
export interface TimerObservation {
  /** End the observation and record the duration */
  end(): number;
  /** Cancel the observation without recording */
  cancel(): void;
}

// ============================================================================
// Metrics Snapshot
// ============================================================================

/**
 * Point-in-time snapshot of all metrics
 */
export interface MetricsSnapshot {
  readonly timestamp: Date;
  readonly counters: Readonly<Record<string, number>>;
  readonly gauges: Readonly<Record<string, number>>;
  readonly histograms: Readonly<Record<string, HistogramSnapshot>>;
}

/**
 * Histogram snapshot data
 */
export interface HistogramSnapshot {
  readonly count: number;
  readonly sum: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly p50: number;
  readonly p90: number;
  readonly p95: number;
  readonly p99: number;
}

// ============================================================================
// MCP-Specific Metrics
// ============================================================================

/**
 * MCP client metrics
 */
export interface McpClientMetrics {
  // Connection metrics
  readonly connectionAttempts: Counter;
  readonly connectionSuccesses: Counter;
  readonly connectionFailures: Counter;
  readonly connectionDuration: Timer;
  readonly activeConnections: Gauge;
  readonly reconnectionAttempts: Counter;

  // Request metrics
  readonly requestsTotal: Counter;
  readonly requestsSuccess: Counter;
  readonly requestsFailure: Counter;
  readonly requestDuration: Timer;
  readonly requestsInFlight: Gauge;
  readonly requestTimeouts: Counter;
  readonly requestsCancelled: Counter;

  // Tool metrics
  readonly toolCalls: Counter;
  readonly toolCallDuration: Timer;
  readonly toolCallErrors: Counter;

  // Resource metrics
  readonly resourceReads: Counter;
  readonly resourceReadDuration: Timer;
  readonly resourceReadErrors: Counter;

  // Prompt metrics
  readonly promptGets: Counter;
  readonly promptGetDuration: Timer;
  readonly promptGetErrors: Counter;

  // Get snapshot of all metrics
  snapshot(): MetricsSnapshot;

  // Reset all metrics
  reset(): void;
}

/**
 * Session manager metrics
 */
export interface SessionManagerMetrics {
  readonly sessionsCreated: Counter;
  readonly sessionsDestroyed: Counter;
  readonly sessionsActive: Gauge;
  readonly sessionsEvicted: Counter;
  readonly sessionsTimedOut: Counter;
  readonly sessionDuration: Timer;
  readonly sessionCreationDuration: Timer;

  snapshot(): MetricsSnapshot;
  reset(): void;
}

// ============================================================================
// Implementations
// ============================================================================

/**
 * Simple counter implementation
 */
class SimpleCounter implements Counter {
  readonly name: string;
  readonly labels: Readonly<Record<string, string>>;
  private _value = 0;

  constructor(name: string, labels: Record<string, string> = {}) {
    this.name = name;
    this.labels = Object.freeze({ ...labels });
  }

  get value(): number {
    return this._value;
  }

  increment(amount = 1): void {
    if (amount < 0) {
      throw new Error('Counter can only be incremented by non-negative values');
    }
    this._value += amount;
  }

  reset(): void {
    this._value = 0;
  }
}

/**
 * Simple gauge implementation
 */
class SimpleGauge implements Gauge {
  readonly name: string;
  readonly labels: Readonly<Record<string, string>>;
  private _value = 0;

  constructor(name: string, labels: Record<string, string> = {}) {
    this.name = name;
    this.labels = Object.freeze({ ...labels });
  }

  get value(): number {
    return this._value;
  }

  set(value: number): void {
    this._value = value;
  }

  increment(amount = 1): void {
    this._value += amount;
  }

  decrement(amount = 1): void {
    this._value -= amount;
  }
}

/**
 * Simple histogram implementation using reservoir sampling
 */
class SimpleHistogram implements Histogram {
  readonly name: string;
  readonly labels: Readonly<Record<string, string>>;
  private _values: number[] = [];
  private _count = 0;
  private _sum = 0;
  private _min = Infinity;
  private _max = -Infinity;
  private readonly _maxSamples: number;

  constructor(name: string, labels: Record<string, string> = {}, maxSamples = 1000) {
    this.name = name;
    this.labels = Object.freeze({ ...labels });
    this._maxSamples = maxSamples;
  }

  get count(): number {
    return this._count;
  }

  get sum(): number {
    return this._sum;
  }

  get min(): number {
    return this._count === 0 ? 0 : this._min;
  }

  get max(): number {
    return this._count === 0 ? 0 : this._max;
  }

  get mean(): number {
    return this._count === 0 ? 0 : this._sum / this._count;
  }

  get p50(): number {
    return this._percentile(0.5);
  }

  get p90(): number {
    return this._percentile(0.9);
  }

  get p95(): number {
    return this._percentile(0.95);
  }

  get p99(): number {
    return this._percentile(0.99);
  }

  observe(value: number): void {
    this._count++;
    this._sum += value;
    this._min = Math.min(this._min, value);
    this._max = Math.max(this._max, value);

    // Reservoir sampling to keep memory bounded
    if (this._values.length < this._maxSamples) {
      this._values.push(value);
    } else {
      // Random replacement
      const index = Math.floor(Math.random() * this._count);
      if (index < this._maxSamples) {
        this._values[index] = value;
      }
    }
  }

  reset(): void {
    this._values = [];
    this._count = 0;
    this._sum = 0;
    this._min = Infinity;
    this._max = -Infinity;
  }

  private _percentile(p: number): number {
    if (this._values.length === 0) return 0;

    const sorted = [...this._values].sort((a, b) => a - b);
    const index = Math.ceil(p * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

/**
 * Timer implementation wrapping histogram
 */
class SimpleTimer implements Timer {
  private readonly _histogram: SimpleHistogram;

  constructor(name: string, labels: Record<string, string> = {}) {
    this._histogram = new SimpleHistogram(name, labels);
  }

  get name(): string {
    return this._histogram.name;
  }

  get labels(): Readonly<Record<string, string>> {
    return this._histogram.labels;
  }

  get count(): number {
    return this._histogram.count;
  }

  get sum(): number {
    return this._histogram.sum;
  }

  get min(): number {
    return this._histogram.min;
  }

  get max(): number {
    return this._histogram.max;
  }

  get mean(): number {
    return this._histogram.mean;
  }

  get p50(): number {
    return this._histogram.p50;
  }

  get p90(): number {
    return this._histogram.p90;
  }

  get p95(): number {
    return this._histogram.p95;
  }

  get p99(): number {
    return this._histogram.p99;
  }

  observe(value: number): void {
    this._histogram.observe(value);
  }

  reset(): void {
    this._histogram.reset();
  }

  start(): TimerObservation {
    const startTime = performance.now();
    let ended = false;

    return {
      end: () => {
        if (ended) {
          throw new Error('Timer observation already ended');
        }
        ended = true;
        const duration = performance.now() - startTime;
        this._histogram.observe(duration);
        return duration;
      },
      cancel: () => {
        ended = true;
      },
    };
  }

  async time<T>(operation: () => Promise<T>): Promise<T> {
    const observation = this.start();
    try {
      return await operation();
    } finally {
      observation.end();
    }
  }

  timeSync<T>(operation: () => T): T {
    const observation = this.start();
    try {
      return operation();
    } finally {
      observation.end();
    }
  }
}

// ============================================================================
// MCP Client Metrics Implementation
// ============================================================================

/**
 * Create MCP client metrics instance
 */
export function createClientMetrics(): McpClientMetrics {
  const counters: Map<string, SimpleCounter> = new Map();
  const gauges: Map<string, SimpleGauge> = new Map();
  const timers: Map<string, SimpleTimer> = new Map();

  const getCounter = (name: string): SimpleCounter => {
    let counter = counters.get(name);
    if (!counter) {
      counter = new SimpleCounter(name);
      counters.set(name, counter);
    }
    return counter;
  };

  const getGauge = (name: string): SimpleGauge => {
    let gauge = gauges.get(name);
    if (!gauge) {
      gauge = new SimpleGauge(name);
      gauges.set(name, gauge);
    }
    return gauge;
  };

  const getTimer = (name: string): SimpleTimer => {
    let timer = timers.get(name);
    if (!timer) {
      timer = new SimpleTimer(name);
      timers.set(name, timer);
    }
    return timer;
  };

  return {
    // Connection metrics
    connectionAttempts: getCounter('mcp_connection_attempts_total'),
    connectionSuccesses: getCounter('mcp_connection_successes_total'),
    connectionFailures: getCounter('mcp_connection_failures_total'),
    connectionDuration: getTimer('mcp_connection_duration_ms'),
    activeConnections: getGauge('mcp_active_connections'),
    reconnectionAttempts: getCounter('mcp_reconnection_attempts_total'),

    // Request metrics
    requestsTotal: getCounter('mcp_requests_total'),
    requestsSuccess: getCounter('mcp_requests_success_total'),
    requestsFailure: getCounter('mcp_requests_failure_total'),
    requestDuration: getTimer('mcp_request_duration_ms'),
    requestsInFlight: getGauge('mcp_requests_in_flight'),
    requestTimeouts: getCounter('mcp_request_timeouts_total'),
    requestsCancelled: getCounter('mcp_requests_cancelled_total'),

    // Tool metrics
    toolCalls: getCounter('mcp_tool_calls_total'),
    toolCallDuration: getTimer('mcp_tool_call_duration_ms'),
    toolCallErrors: getCounter('mcp_tool_call_errors_total'),

    // Resource metrics
    resourceReads: getCounter('mcp_resource_reads_total'),
    resourceReadDuration: getTimer('mcp_resource_read_duration_ms'),
    resourceReadErrors: getCounter('mcp_resource_read_errors_total'),

    // Prompt metrics
    promptGets: getCounter('mcp_prompt_gets_total'),
    promptGetDuration: getTimer('mcp_prompt_get_duration_ms'),
    promptGetErrors: getCounter('mcp_prompt_get_errors_total'),

    snapshot(): MetricsSnapshot {
      const counterSnapshot: Record<string, number> = {};
      const gaugeSnapshot: Record<string, number> = {};
      const histogramSnapshot: Record<string, HistogramSnapshot> = {};

      for (const [name, counter] of counters) {
        counterSnapshot[name] = counter.value;
      }

      for (const [name, gauge] of gauges) {
        gaugeSnapshot[name] = gauge.value;
      }

      for (const [name, timer] of timers) {
        histogramSnapshot[name] = {
          count: timer.count,
          sum: timer.sum,
          min: timer.min,
          max: timer.max,
          mean: timer.mean,
          p50: timer.p50,
          p90: timer.p90,
          p95: timer.p95,
          p99: timer.p99,
        };
      }

      return {
        timestamp: new Date(),
        counters: counterSnapshot,
        gauges: gaugeSnapshot,
        histograms: histogramSnapshot,
      };
    },

    reset(): void {
      for (const counter of counters.values()) {
        counter.reset();
      }
      for (const gauge of gauges.values()) {
        gauge.set(0);
      }
      for (const timer of timers.values()) {
        timer.reset();
      }
    },
  };
}

// ============================================================================
// Session Manager Metrics Implementation
// ============================================================================

/**
 * Create session manager metrics instance
 */
export function createSessionManagerMetrics(): SessionManagerMetrics {
  const counters: Map<string, SimpleCounter> = new Map();
  const gauges: Map<string, SimpleGauge> = new Map();
  const timers: Map<string, SimpleTimer> = new Map();

  const getCounter = (name: string): SimpleCounter => {
    let counter = counters.get(name);
    if (!counter) {
      counter = new SimpleCounter(name);
      counters.set(name, counter);
    }
    return counter;
  };

  const getGauge = (name: string): SimpleGauge => {
    let gauge = gauges.get(name);
    if (!gauge) {
      gauge = new SimpleGauge(name);
      gauges.set(name, gauge);
    }
    return gauge;
  };

  const getTimer = (name: string): SimpleTimer => {
    let timer = timers.get(name);
    if (!timer) {
      timer = new SimpleTimer(name);
      timers.set(name, timer);
    }
    return timer;
  };

  return {
    sessionsCreated: getCounter('mcp_sessions_created_total'),
    sessionsDestroyed: getCounter('mcp_sessions_destroyed_total'),
    sessionsActive: getGauge('mcp_sessions_active'),
    sessionsEvicted: getCounter('mcp_sessions_evicted_total'),
    sessionsTimedOut: getCounter('mcp_sessions_timed_out_total'),
    sessionDuration: getTimer('mcp_session_duration_ms'),
    sessionCreationDuration: getTimer('mcp_session_creation_duration_ms'),

    snapshot(): MetricsSnapshot {
      const counterSnapshot: Record<string, number> = {};
      const gaugeSnapshot: Record<string, number> = {};
      const histogramSnapshot: Record<string, HistogramSnapshot> = {};

      for (const [name, counter] of counters) {
        counterSnapshot[name] = counter.value;
      }

      for (const [name, gauge] of gauges) {
        gaugeSnapshot[name] = gauge.value;
      }

      for (const [name, timer] of timers) {
        histogramSnapshot[name] = {
          count: timer.count,
          sum: timer.sum,
          min: timer.min,
          max: timer.max,
          mean: timer.mean,
          p50: timer.p50,
          p90: timer.p90,
          p95: timer.p95,
          p99: timer.p99,
        };
      }

      return {
        timestamp: new Date(),
        counters: counterSnapshot,
        gauges: gaugeSnapshot,
        histograms: histogramSnapshot,
      };
    },

    reset(): void {
      for (const counter of counters.values()) {
        counter.reset();
      }
      for (const gauge of gauges.values()) {
        gauge.set(0);
      }
      for (const timer of timers.values()) {
        timer.reset();
      }
    },
  };
}

// ============================================================================
// Metrics Registry
// ============================================================================

/**
 * Global metrics registry for centralized metric management
 */
export class MetricsRegistry {
  private static _instance: MetricsRegistry | null = null;
  private _clientMetrics: McpClientMetrics | null = null;
  private _sessionMetrics: SessionManagerMetrics | null = null;

  private constructor() {}

  static getInstance(): MetricsRegistry {
    if (!MetricsRegistry._instance) {
      MetricsRegistry._instance = new MetricsRegistry();
    }
    return MetricsRegistry._instance;
  }

  get clientMetrics(): McpClientMetrics {
    if (!this._clientMetrics) {
      this._clientMetrics = createClientMetrics();
    }
    return this._clientMetrics;
  }

  get sessionMetrics(): SessionManagerMetrics {
    if (!this._sessionMetrics) {
      this._sessionMetrics = createSessionManagerMetrics();
    }
    return this._sessionMetrics;
  }

  /**
   * Get combined snapshot of all metrics
   */
  snapshot(): {
    client: MetricsSnapshot;
    session: MetricsSnapshot;
    timestamp: Date;
  } {
    return {
      client: this.clientMetrics.snapshot(),
      session: this.sessionMetrics.snapshot(),
      timestamp: new Date(),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this._clientMetrics?.reset();
    this._sessionMetrics?.reset();
  }
}

/**
 * Get the global metrics registry
 */
export function getMetricsRegistry(): MetricsRegistry {
  return MetricsRegistry.getInstance();
}
