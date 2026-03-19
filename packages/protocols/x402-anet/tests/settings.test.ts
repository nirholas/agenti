import fs from 'fs';
import path from 'path';
import os from 'os';
import { SettingsManager } from '../src/settings/manager.js';

const TEST_DIR = path.join(os.tmpdir(), `anet-test-${Date.now()}`);
const CONFIG_PATH = path.join(TEST_DIR, 'config.yaml');
const HOOKS_PATH = path.join(TEST_DIR, 'hooks.yaml');

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
}

console.log('Settings Manager Tests\n');

// Setup
fs.mkdirSync(TEST_DIR, { recursive: true });

// Test 1: Init defaults
SettingsManager.initDefaults(TEST_DIR);
assert(fs.existsSync(CONFIG_PATH), 'config.yaml created');
assert(fs.existsSync(HOOKS_PATH), 'hooks.yaml created');

// Test 2: Load defaults
const settings = new SettingsManager(CONFIG_PATH, HOOKS_PATH);
assert(settings.get('agent.name') === 'my-agent', 'default agent.name');
assert(settings.get('network') === 'testnet', 'default network');
assert(settings.get('signing.policy') === 'prompt', 'default signing policy');
assert(settings.get('social.min-friend-rep') === 50, 'default min-friend-rep');
assert(settings.get('payments.max-per-tx') === 1, 'default max-per-tx');
assert(settings.get('discovery.sync-interval') === 3600, 'default sync interval');

// Test 3: Set and get
settings.set('agent.name', 'test-agent');
assert(settings.get('agent.name') === 'test-agent', 'set agent.name');

settings.set('signing.policy', 'always');
assert(settings.get('signing.policy') === 'always', 'set signing policy');

settings.set('social.min-friend-rep', '75');
assert(settings.get('social.min-friend-rep') === 75, 'set numeric value from string');

settings.set('messaging.webhook', 'https://hooks.example.com');
assert(settings.get('messaging.webhook') === 'https://hooks.example.com', 'set string value');

settings.set('discovery.auto-sync', 'false');
assert(settings.get('discovery.auto-sync') === false, 'set boolean from string');

// Test 4: Persistence
const settings2 = new SettingsManager(CONFIG_PATH, HOOKS_PATH);
assert(settings2.get('agent.name') === 'test-agent', 'persisted agent.name');
assert(settings2.get('signing.policy') === 'always', 'persisted signing policy');

// Test 5: Nested get
const agent = settings.get('agent');
assert(typeof agent === 'object' && agent.name === 'test-agent', 'get nested object');

// Test 6: Non-existent key
assert(settings.get('nonexistent.key') === undefined, 'undefined for missing key');

// Test 7: Hooks
const hooks = settings.loadHooks();
assert(hooks.hooks !== undefined, 'hooks loaded');
assert(Array.isArray(hooks.hooks['pre-message']), 'pre-message hooks exist');
assert(hooks.hooks['pre-message'][0].action === 'rate-limit', 'rate-limit action');

// Test 8: Modify hooks
hooks.hooks['post-call'] = [{ action: 'log' }];
settings.saveHooks(hooks);
const hooks2 = settings.loadHooks();
assert(hooks2.hooks['post-call'][0].action === 'log', 'hook modification persisted');

// Test 9: getAll
const all = settings.getAll();
assert(all.agent.name === 'test-agent', 'getAll returns full config');
assert(all.payments.currency === 'USDC', 'getAll includes defaults');

cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
