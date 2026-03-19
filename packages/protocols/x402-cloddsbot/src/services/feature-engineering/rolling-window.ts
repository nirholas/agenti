/**
 * Rolling Window Buffer for Feature Computation
 *
 * Efficient circular buffer for computing rolling statistics.
 */

export class RollingWindow<T> {
  private buffer: T[];
  private head: number = 0;
  private count: number = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Add a value to the window
   */
  push(value: T): void {
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /**
   * Get all values in order (oldest to newest)
   */
  getAll(): T[] {
    if (this.count === 0) return [];

    const result: T[] = [];
    const start = this.count < this.capacity ? 0 : this.head;

    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.capacity;
      result.push(this.buffer[idx]);
    }

    return result;
  }

  /**
   * Get the most recent value
   */
  latest(): T | undefined {
    if (this.count === 0) return undefined;
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[idx];
  }

  /**
   * Get value at offset from latest (0 = latest, 1 = second latest, etc.)
   */
  get(offset: number): T | undefined {
    if (offset < 0 || offset >= this.count) return undefined;
    const idx = (this.head - 1 - offset + this.capacity * 2) % this.capacity;
    return this.buffer[idx];
  }

  /**
   * Get the oldest value
   */
  oldest(): T | undefined {
    if (this.count === 0) return undefined;
    const idx = this.count < this.capacity ? 0 : this.head;
    return this.buffer[idx];
  }

  /**
   * Get current count
   */
  size(): number {
    return this.count;
  }

  /**
   * Check if buffer is full
   */
  isFull(): boolean {
    return this.count === this.capacity;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}

/**
 * Rolling statistics calculator
 */
export class RollingStats {
  private window: RollingWindow<number>;
  private sum: number = 0;
  private sumSq: number = 0;
  private pushCount: number = 0;
  private readonly recomputeEvery: number;

  constructor(capacity: number) {
    this.window = new RollingWindow(capacity);
    // Recompute from scratch every 1000 pushes to prevent floating-point drift
    this.recomputeEvery = 1000;
  }

  /**
   * Recompute sum/sumSq from the actual buffer to eliminate accumulated
   * floating-point drift from incremental subtraction.
   */
  private recompute(): void {
    const values = this.window.getAll();
    this.sum = 0;
    this.sumSq = 0;
    for (const v of values) {
      this.sum += v;
      this.sumSq += v * v;
    }
  }

  /**
   * Add a value
   */
  push(value: number): void {
    // If window is full, subtract the oldest value
    if (this.window.isFull()) {
      const oldest = this.window.oldest()!;
      this.sum -= oldest;
      this.sumSq -= oldest * oldest;
    }

    this.window.push(value);
    this.sum += value;
    this.sumSq += value * value;

    // Guard against overflow in sumSq accumulation
    if (!Number.isFinite(this.sumSq) || this.sumSq > Number.MAX_SAFE_INTEGER / 2) {
      // Recompute from scratch to avoid accumulated precision errors
      this.recompute();
      this.pushCount = 0;
      return;
    }

    this.pushCount++;
    if (this.pushCount >= this.recomputeEvery) {
      this.recompute();
      this.pushCount = 0;
    }
  }

  /**
   * Get mean
   */
  mean(): number {
    const n = this.window.size();
    if (n === 0) return 0;
    return this.sum / n;
  }

  /**
   * Get variance
   */
  variance(): number {
    const n = this.window.size();
    if (n < 2) return 0;
    const mean = this.sum / n;
    return Math.max(0, (this.sumSq / n) - (mean * mean));
  }

  /**
   * Get standard deviation
   */
  stdDev(): number {
    return Math.sqrt(this.variance());
  }

  /**
   * Get latest value
   */
  latest(): number | undefined {
    return this.window.latest();
  }

  /**
   * Get value at offset
   */
  get(offset: number): number | undefined {
    return this.window.get(offset);
  }

  /**
   * Get count
   */
  size(): number {
    return this.window.size();
  }

  /**
   * Get all values
   */
  getAll(): number[] {
    return this.window.getAll();
  }

  /**
   * Clear
   */
  clear(): void {
    this.window.clear();
    this.sum = 0;
    this.sumSq = 0;
    this.pushCount = 0;
  }
}
