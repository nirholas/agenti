import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWebhookManager } from '../../src/automation/webhooks';
import { signPayload } from '../../src/tools/webhooks';

test('webhook manager rejects invalid signature', async () => {
  const manager = createWebhookManager();
  manager.register('t1', '/webhook/test', async () => {}, { secret: 'secret', enabled: true });

  const res = await manager.handle('/webhook/test', { hello: 'world' }, 'bad-signature', '{"hello":"world"}');
  assert.equal(res.success, false);
  assert.equal(res.error, 'Invalid signature');
});

test('webhook manager enforces rate limit', async () => {
  const manager = createWebhookManager();
  manager.register('t2', '/webhook/limited', async () => {}, { secret: 'secret', enabled: true, rateLimit: 1 });

  const payload = '{"ok":true}';
  const signatureOk = signPayload('secret', payload);

  const first = await manager.handle('/webhook/limited', { ok: true }, signatureOk, payload);
  assert.equal(first.success, true);

  const second = await manager.handle('/webhook/limited', { ok: true }, signatureOk, payload);
  assert.equal(second.success, false);
  assert.equal(second.error, 'Rate limit exceeded');
});
