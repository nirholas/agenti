import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createWebhookManager, createWebhookMiddleware } from '../../src/automation/webhooks';
import { signPayload } from '../../src/tools/webhooks';

function startWebhookServer() {
  const manager = createWebhookManager();
  const app = createServer((req, res) => {
    if (!req.url || req.method !== 'POST') {
      res.statusCode = 404;
      res.end();
      return;
    }

    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk.toString();
    });
    req.on('end', async () => {
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const signature = req.headers['x-webhook-signature'] as string | undefined;
      const middleware = createWebhookMiddleware(manager);

      const reqShim = {
        path: req.url,
        url: req.url,
        body: payload,
        rawBody,
        headers: req.headers,
      } as any;
      const resShim = {
        status(code: number) {
          res.statusCode = code;
          return this;
        },
        json(data: unknown) {
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(data));
        },
      } as any;

      reqShim.headers['x-webhook-signature'] = signature;
      await middleware(reqShim, resShim);
    });
  });

  return new Promise<{
    manager: ReturnType<typeof createWebhookManager>;
    server: ReturnType<typeof createServer>;
    port: number;
  }>((resolve) => {
    app.listen(0, () => {
      const address = app.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ manager, server: app, port });
    });
  });
}

async function postJson(url: string, payload: unknown, signature?: string) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (signature) headers['x-webhook-signature'] = signature;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

test('webhook HTTP middleware validates signature', async () => {
  const previous = process.env.CLODDS_WEBHOOK_REQUIRE_SIGNATURE;
  delete process.env.CLODDS_WEBHOOK_REQUIRE_SIGNATURE;

  const { manager, server, port } = await startWebhookServer();
  manager.register('t1', '/webhook/test', async () => {}, { secret: 'secret', enabled: true });

  try {
    const payload = { ok: true };
    const signature = signPayload('secret', payload);
    const good = await postJson(`http://127.0.0.1:${port}/webhook/test`, payload, signature);
    assert.equal(good.status, 200);
    assert.equal(good.body.ok, true);

    const bad = await postJson(`http://127.0.0.1:${port}/webhook/test`, payload, 'bad');
    assert.equal(bad.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (previous === undefined) {
      delete process.env.CLODDS_WEBHOOK_REQUIRE_SIGNATURE;
    } else {
      process.env.CLODDS_WEBHOOK_REQUIRE_SIGNATURE = previous;
    }
  }
});

test('webhook HTTP middleware enforces rate limit', async () => {
  const previous = process.env.CLODDS_WEBHOOK_REQUIRE_SIGNATURE;
  delete process.env.CLODDS_WEBHOOK_REQUIRE_SIGNATURE;

  const { manager, server, port } = await startWebhookServer();
  manager.register('t2', '/webhook/limited', async () => {}, { secret: 'secret', enabled: true, rateLimit: 1 });

  try {
    const payload = { ok: true };
    const signature = signPayload('secret', payload);
    const first = await postJson(`http://127.0.0.1:${port}/webhook/limited`, payload, signature);
    assert.equal(first.status, 200);

    const second = await postJson(`http://127.0.0.1:${port}/webhook/limited`, payload, signature);
    assert.equal(second.status, 429);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (previous === undefined) {
      delete process.env.CLODDS_WEBHOOK_REQUIRE_SIGNATURE;
    } else {
      process.env.CLODDS_WEBHOOK_REQUIRE_SIGNATURE = previous;
    }
  }
});
