import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { resolveConfigPath, resolveStateDir, resolveWorkspaceDir } from '../../src/utils/config';

test('resolveStateDir uses override', () => {
  const env = { CLODDS_STATE_DIR: '/tmp/clodds-state' } as NodeJS.ProcessEnv;
  assert.equal(resolveStateDir(env), resolve('/tmp/clodds-state'));
});

test('resolveConfigPath uses override', () => {
  const env = { CLODDS_CONFIG_PATH: '/tmp/clodds.json' } as NodeJS.ProcessEnv;
  assert.equal(resolveConfigPath(env), resolve('/tmp/clodds.json'));
});

test('resolveWorkspaceDir uses override', () => {
  const env = { CLODDS_WORKSPACE: '/tmp/clodds-workspace' } as NodeJS.ProcessEnv;
  assert.equal(resolveWorkspaceDir(env), resolve('/tmp/clodds-workspace'));
});
