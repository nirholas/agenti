import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { installHttpClient, configureHttpClient } from '../src/utils/http.ts';

const realFetch = globalThis.fetch;
let handler: (input: string | URL | Request, init?: RequestInit) => Promise<Response> = async () =>
  new Response('ok', { status: 200 });

globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => handler(input, init);
installHttpClient();

after(() => {
  globalThis.fetch = realFetch;
});

test('http rate limiting waits per host', async () => {
  configureHttpClient({
    enabled: true,
    defaultRateLimit: { maxRequests: 1, windowMs: 80 },
    retry: { enabled: false },
  });

  let calls = 0;
  handler = async () => {
    calls += 1;
    return new Response('ok', { status: 200 });
  };

  const start = Date.now();
  await fetch('https://rate.test/one');
  await fetch('https://rate.test/two');
  const elapsed = Date.now() - start;

  assert.equal(calls, 2);
  assert.ok(elapsed >= 60);
});

test('http retries on 429 for GET requests', async () => {
  configureHttpClient({
    enabled: true,
    defaultRateLimit: { maxRequests: 100, windowMs: 1 },
    retry: { enabled: true, maxAttempts: 2, minDelay: 10, maxDelay: 80, methods: ['GET'] },
  });

  let calls = 0;
  handler = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response('rate limited', { status: 429, headers: { 'retry-after': '1' } });
    }
    return new Response('ok', { status: 200 });
  };

  const response = await fetch('https://retry.test/resource');
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});

test('http does not retry on POST by default', async () => {
  configureHttpClient({
    enabled: true,
    defaultRateLimit: { maxRequests: 100, windowMs: 1 },
    retry: { enabled: true, maxAttempts: 3, minDelay: 10, maxDelay: 30, methods: ['GET'] },
  });

  let calls = 0;
  handler = async () => {
    calls += 1;
    return new Response('rate limited', { status: 429 });
  };

  const response = await fetch('https://post.test/resource', { method: 'POST' });
  assert.equal(response.status, 429);
  assert.equal(calls, 1);
});
