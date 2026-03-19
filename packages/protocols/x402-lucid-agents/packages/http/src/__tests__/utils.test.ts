import { describe, expect, it } from 'bun:test';

import { normalizeOrigin } from '../utils';

describe('normalizeOrigin', () => {
  it('uses X-Forwarded-Proto header to set protocol', () => {
    const req = new Request('http://localhost:3000/.well-known/agent.json', {
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'agent.example.com',
      },
    });
    const origin = normalizeOrigin(req);
    expect(origin).toBe('https://agent.example.com');
  });

  it('uses X-Forwarded-Host header when present', () => {
    const req = new Request('http://localhost:3000/.well-known/agent.json', {
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'custom.example.com',
      },
    });
    const origin = normalizeOrigin(req);
    expect(origin).toBe('https://custom.example.com');
  });

  it('preserves http:// for localhost requests', () => {
    const req = new Request('http://localhost:3000/.well-known/agent.json', {
      headers: {
        'x-forwarded-proto': 'https',
      },
    });
    const origin = normalizeOrigin(req);
    expect(origin).toBe('http://localhost:3000');
  });

  it('preserves http:// for 127.0.0.1 requests', () => {
    const req = new Request('http://127.0.0.1:3000/.well-known/agent.json', {
      headers: {
        'x-forwarded-proto': 'https',
      },
    });
    const origin = normalizeOrigin(req);
    expect(origin).toBe('http://127.0.0.1:3000');
  });

  it('falls back to URL protocol when headers are missing', () => {
    const req = new Request('https://example.com/.well-known/agent.json');
    const origin = normalizeOrigin(req);
    expect(origin).toBe('https://example.com');
  });

  it('handles only X-Forwarded-Proto without X-Forwarded-Host', () => {
    const req = new Request('http://agent.example.com/.well-known/agent.json', {
      headers: {
        'x-forwarded-proto': 'https',
      },
    });
    const origin = normalizeOrigin(req);
    expect(origin).toBe('https://agent.example.com');
  });

  it('handles X-Forwarded-Proto: http', () => {
    const req = new Request(
      'https://agent.example.com/.well-known/agent.json',
      {
        headers: {
          'x-forwarded-proto': 'http',
        },
      }
    );
    const origin = normalizeOrigin(req);
    expect(origin).toBe('http://agent.example.com');
  });

  it('handles only X-Forwarded-Host without X-Forwarded-Proto', () => {
    const req = new Request('http://localhost:3000/.well-known/agent.json', {
      headers: {
        'x-forwarded-host': 'agent.example.com',
      },
    });
    const origin = normalizeOrigin(req);
    expect(origin).toBe('http://agent.example.com');
  });

  it('handles case-insensitive header names', () => {
    const req = new Request('http://localhost:3000/.well-known/agent.json', {
      headers: {
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'agent.example.com',
      },
    });
    const origin = normalizeOrigin(req);
    expect(origin).toBe('https://agent.example.com');
  });
});
