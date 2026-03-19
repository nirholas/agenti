import fs from 'fs';
import path from 'path';
import os from 'os';
import { SettingsManager } from '../src/settings/manager.js';
import { HookEngine } from '../src/hooks/engine.js';

const TEST_DIR = path.join(os.tmpdir(), `anet-hooks-test-${Date.now()}`);

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

console.log('Hooks Engine Tests\n');

fs.mkdirSync(TEST_DIR, { recursive: true });

// Setup settings with test hooks
SettingsManager.initDefaults(TEST_DIR);
const settings = new SettingsManager(
  path.join(TEST_DIR, 'config.yaml'),
  path.join(TEST_DIR, 'hooks.yaml'),
);

const engine = new HookEngine(settings);

// Test 1: Fire pre-message with passing reputation
const result1 = await engine.fire('pre-message', {
  sender: '0xabc',
  content: 'hello',
  senderReputation: 80,
});
assert(result1.allow === true, 'pre-message allowed with high rep');

// Test 2: Fire pre-message with failing reputation
const result2 = await engine.fire('pre-message', {
  sender: '0xabc',
  content: 'hello',
  senderReputation: 10,
});
assert(result2.allow === false, 'pre-message blocked with low rep');
assert(result2.reason!.includes('below threshold'), 'correct rejection reason');

// Test 3: Fire pre-sign (budget check passes)
const result3 = await engine.fire('pre-sign', {
  method: 'POST',
  url: 'https://api.example.com/service',
  amount: 0.5,
});
assert(result3.allow === true, 'pre-sign allowed within budget');

// Test 4: Post-interaction log
const logFile = path.join(TEST_DIR, 'interactions.jsonl');
// Update hooks to log to test dir
const hooks = settings.loadHooks();
hooks.hooks['post-interaction'][0].config.file = logFile;
settings.saveHooks(hooks);

const engine2 = new HookEngine(settings);
await engine2.fire('post-interaction', {
  type: 'message',
  agent: 'agent-100',
  outcome: 'success',
});
assert(fs.existsSync(logFile), 'interaction logged to file');

const logContent = fs.readFileSync(logFile, 'utf8').trim();
const logEntry = JSON.parse(logContent);
assert(logEntry.event === 'post-interaction', 'log event correct');
assert(logEntry.agent === 'agent-100', 'log data correct');

// Test 5: Fire event with no hooks configured
const result5 = await engine.fire('post-call', {});
assert(result5.allow === true, 'no hooks = allow');

// Test 6: Domain whitelist (empty = allow all)
const result6 = await engine.fire('pre-sign', {
  url: 'https://any-domain.com/api',
  amount: 0.1,
});
assert(result6.allow === true, 'empty whitelist allows all');

// Cleanup
fs.rmSync(TEST_DIR, { recursive: true });

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
