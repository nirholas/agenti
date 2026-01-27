import { describe, it, expect } from 'vitest';
import {
  LyraError,
  APIKeyError,
  RateLimitError,
  NetworkError,
  AnalysisError,
  AIResponseError,
  ValidationError,
  isRateLimitError,
  isRetryableError,
  getRetryAfter,
} from '../errors.js';

describe('errors', () => {
  describe('LyraError', () => {
    it('should create base error with code', () => {
      const error = new LyraError('Test error', 'TEST_CODE');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('LyraError');
    });

    it('should include cause', () => {
      const cause = new Error('Original error');
      const error = new LyraError('Wrapped error', 'WRAPPED', cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('APIKeyError', () => {
    it('should create error for OpenAI', () => {
      const error = new APIKeyError('openai');

      expect(error.message).toContain('OPENAI_API_KEY');
      expect(error.code).toBe('API_KEY_ERROR');
      expect(error.name).toBe('APIKeyError');
    });

    it('should create error for Anthropic', () => {
      const error = new APIKeyError('anthropic');

      expect(error.message).toContain('ANTHROPIC_API_KEY');
    });

    it('should accept custom message', () => {
      const error = new APIKeyError('openai', 'Custom message');

      expect(error.message).toBe('Custom message');
    });
  });

  describe('RateLimitError', () => {
    it('should create error with provider', () => {
      const error = new RateLimitError('github');

      expect(error.provider).toBe('github');
      expect(error.message).toContain('github');
      expect(error.code).toBe('RATE_LIMIT_ERROR');
    });

    it('should include retryAfter', () => {
      const error = new RateLimitError('npm', 60);

      expect(error.retryAfter).toBe(60);
      expect(error.message).toContain('60s');
    });
  });

  describe('NetworkError', () => {
    it('should create error with URL', () => {
      const error = new NetworkError('https://api.example.com/test');

      expect(error.url).toBe('https://api.example.com/test');
      expect(error.message).toContain('https://api.example.com/test');
    });

    it('should include status code', () => {
      const error = new NetworkError('https://api.example.com/test', 500);

      expect(error.status).toBe(500);
      expect(error.message).toContain('500');
    });
  });

  describe('AnalysisError', () => {
    it('should create error with tool name', () => {
      const error = new AnalysisError('my-tool');

      expect(error.toolName).toBe('my-tool');
      expect(error.message).toContain('my-tool');
    });
  });

  describe('AIResponseError', () => {
    it('should create error with provider', () => {
      const error = new AIResponseError('openai', '{"invalid": json}');

      expect(error.provider).toBe('openai');
      expect(error.rawResponse).toBe('{"invalid": json}');
    });
  });

  describe('ValidationError', () => {
    it('should create error with field', () => {
      const error = new ValidationError('Invalid value', 'config.url');

      expect(error.field).toBe('config.url');
    });
  });

  describe('isRateLimitError', () => {
    it('should return true for RateLimitError', () => {
      expect(isRateLimitError(new RateLimitError('github'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isRateLimitError(new Error('test'))).toBe(false);
      expect(isRateLimitError(new NetworkError('url'))).toBe(false);
      expect(isRateLimitError(null)).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for RateLimitError', () => {
      expect(isRetryableError(new RateLimitError('github'))).toBe(true);
    });

    it('should return true for NetworkError', () => {
      expect(isRetryableError(new NetworkError('url', 500))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isRetryableError(new APIKeyError('openai'))).toBe(false);
      expect(isRetryableError(new Error('test'))).toBe(false);
    });
  });

  describe('getRetryAfter', () => {
    it('should parse retry-after header', () => {
      const headers = new Headers();
      headers.set('retry-after', '30');

      const response = new Response(null, { headers });
      const retryAfter = getRetryAfter(response);

      expect(retryAfter).toBe(30);
    });

    it('should parse x-ratelimit-reset header', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 60;
      const headers = new Headers();
      headers.set('x-ratelimit-reset', String(futureTime));

      const response = new Response(null, { headers });
      const retryAfter = getRetryAfter(response);

      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });

    it('should return undefined for missing headers', () => {
      const response = new Response(null);
      const retryAfter = getRetryAfter(response);

      expect(retryAfter).toBeUndefined();
    });
  });
});
