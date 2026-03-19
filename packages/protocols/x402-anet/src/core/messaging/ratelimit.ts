export class RateLimiter {
  private limits: Map<string, number[]> = new Map();
  private defaultMaxPerMinute: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(maxPerMinute: number = 10) {
    this.defaultMaxPerMinute = maxPerMinute;
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 300_000);
  }

  checkLimit(sender: string, maxPerMinute?: number): boolean {
    const max = maxPerMinute ?? this.defaultMaxPerMinute;
    const now = Date.now();
    const timestamps = this.limits.get(sender) || [];

    // Filter to last minute
    const recent = timestamps.filter(ts => now - ts < 60_000);

    if (recent.length >= max) {
      this.limits.set(sender, recent);
      return false;
    }

    recent.push(now);
    this.limits.set(sender, recent);
    return true;
  }

  getRemainingQuota(sender: string): number {
    const now = Date.now();
    const timestamps = this.limits.get(sender) || [];
    const recent = timestamps.filter(ts => now - ts < 60_000);
    return Math.max(0, this.defaultMaxPerMinute - recent.length);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [sender, timestamps] of this.limits.entries()) {
      const recent = timestamps.filter(ts => now - ts < 60_000);
      if (recent.length === 0) {
        this.limits.delete(sender);
      } else {
        this.limits.set(sender, recent);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
