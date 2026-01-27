/**
 * Registry Module Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Register Module', () => {
  describe('getRegistrationState', () => {
    it('should return registration state', async () => {
      const { getRegistrationState } = await import('../register.js');
      const state = getRegistrationState();
      assert.ok(state);
      assert.ok(typeof state.registered === 'boolean');
    });
  });

  describe('Registration Flow', () => {
    it('should not register if no registry URL', async () => {
      const originalEnv = process.env.REGISTRY_URL;
      delete process.env.REGISTRY_URL;
      
      const { getRegistrationState } = await import('../register.js?' + Date.now());
      const state = getRegistrationState();
      
      // Without registry URL, should not be registered
      assert.strictEqual(state.registered, false);
      
      process.env.REGISTRY_URL = originalEnv;
    });
  });
});
