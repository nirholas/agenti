import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '../src/middleware/rate-limit';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests within limit', () => {
    const limiter = new RateLimiter(3, 60000);
    expect(limiter.isAllowed('key1')).toBe(true);
    expect(limiter.isAllowed('key1')).toBe(true);
    expect(limiter.isAllowed('key1')).toBe(true);
  });

  it('blocks requests exceeding limit', () => {
    const limiter = new RateLimiter(2, 60000);
    expect(limiter.isAllowed('key1')).toBe(true);
    expect(limiter.isAllowed('key1')).toBe(true);
    expect(limiter.isAllowed('key1')).toBe(false);
  });

  it('different keys have independent limits', () => {
    const limiter = new RateLimiter(1, 60000);
    expect(limiter.isAllowed('key1')).toBe(true);
    expect(limiter.isAllowed('key2')).toBe(true);
    expect(limiter.isAllowed('key1')).toBe(false);
  });

  it('allows requests after window expires', () => {
    const limiter = new RateLimiter(1, 60000);
    expect(limiter.isAllowed('key1')).toBe(true);
    expect(limiter.isAllowed('key1')).toBe(false);

    vi.advanceTimersByTime(61000);
    expect(limiter.isAllowed('key1')).toBe(true);
  });

  it('cleanup removes expired entries', () => {
    const limiter = new RateLimiter(10, 60000);
    limiter.isAllowed('key1');
    limiter.isAllowed('key2');

    vi.advanceTimersByTime(61000);
    const removed = limiter.cleanup();
    expect(removed).toBe(2);
  });

  it('cleanup does not remove active entries', () => {
    const limiter = new RateLimiter(10, 60000);
    limiter.isAllowed('key1');

    vi.advanceTimersByTime(30000);
    const removed = limiter.cleanup();
    expect(removed).toBe(0);
  });

  it('reset clears all entries', () => {
    const limiter = new RateLimiter(1, 60000);
    limiter.isAllowed('key1');
    expect(limiter.isAllowed('key1')).toBe(false);

    limiter.reset();
    expect(limiter.isAllowed('key1')).toBe(true);
  });
});
