import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';

// Set ANET_HOME before importing SkillsManager (it reads from config.ts)
const TEST_DIR = path.join(os.tmpdir(), `anet-skills-test-${Date.now()}`);
fs.mkdirSync(TEST_DIR, { recursive: true });
process.env.ANET_HOME = TEST_DIR;

// Dynamic import after env is set
const { SkillsManager } = await import('../src/skills/manager.js');

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

console.log('Skills Manager Tests\n');

const SKILLS_PATH = path.join(TEST_DIR, 'skills.yaml');

// Test 1: initDefaults creates skills.yaml
SkillsManager.initDefaults(TEST_DIR);
assert(fs.existsSync(SKILLS_PATH), 'skills.yaml created by initDefaults');

// Test 2: Empty skills list
const manager = new SkillsManager(SKILLS_PATH);
assert(manager.list().length === 0, 'empty skills list on fresh init');

// Test 3: Add a skill
manager.add({
  name: 'code-review',
  description: 'Review code for bugs and security',
  price: '$0.50',
  handler: 'placeholder',
  tags: ['code', 'security'],
});
assert(manager.list().length === 1, 'list has 1 skill after add');

// Test 4: Get skill by name
const skill = manager.get('code-review');
assert(skill !== undefined, 'get returns skill');
assert(skill!.name === 'code-review', 'skill name matches');
assert(skill!.price === '$0.50', 'skill price matches');
assert(skill!.handler === 'placeholder', 'skill handler matches');
assert(skill!.tags?.length === 2, 'skill tags count');

// Test 5: Add second skill
manager.add({
  name: 'summarize',
  description: 'Summarize any text',
  handler: 'webhook',
  webhook: 'http://localhost:8080/summarize',
  tags: ['nlp'],
});
assert(manager.list().length === 2, 'list has 2 skills');

// Test 6: YAML round-trip
const manager2 = new SkillsManager(SKILLS_PATH);
assert(manager2.list().length === 2, 'skills persist to YAML');
const reloaded = manager2.get('code-review');
assert(reloaded?.price === '$0.50', 'price persists through YAML');
assert(reloaded?.tags?.[0] === 'code', 'tags persist through YAML');

// Test 7: Remove skill
const removed = manager.remove('summarize');
assert(removed === true, 'remove returns true for existing skill');
assert(manager.list().length === 1, 'list has 1 skill after remove');

// Test 8: Remove non-existent
const removedFake = manager.remove('nonexistent');
assert(removedFake === false, 'remove returns false for missing skill');

// Test 9: Get non-existent
assert(manager.get('nonexistent') === undefined, 'get returns undefined for missing');

// Test 10: toRouteConfig
manager.add({
  name: 'paid-service',
  description: 'A paid service',
  price: '$1.00',
  handler: 'placeholder',
});
manager.add({
  name: 'free-service',
  description: 'A free service',
  handler: 'placeholder',
});
const routes = manager.toRouteConfig('base-testnet');
assert('POST /api/code-review' in routes, 'paid skill in routes');
assert('POST /api/paid-service' in routes, 'second paid skill in routes');
assert(!('POST /api/free-service' in routes), 'free skill NOT in routes');
assert(routes['POST /api/code-review'].price === '$0.50', 'route price correct');

// Test 11: toServiceEntries
const entries = manager.toServiceEntries('http://localhost:3000');
assert(entries.length === 3, 'service entries for all skills');
assert(entries[0].endpoint === 'http://localhost:3000/api/code-review', 'service entry endpoint');
assert(entries[0].version === '$0.50', 'service entry version = price');

// Test 12: toCapabilities
const caps = manager.toCapabilities();
assert(caps.includes('code-review'), 'capabilities include skill name');
assert(caps.includes('code'), 'capabilities include tag');
assert(caps.includes('security'), 'capabilities include second tag');

// Test 13: hash stability
const hash1 = manager.hash();
const hash2 = manager.hash();
assert(hash1 === hash2, 'hash is stable across calls');
assert(hash1.length === 64, 'hash is SHA-256 (64 hex chars)');

// Test 14: hash changes on modification
manager.add({ name: 'new-skill', description: 'test', handler: 'placeholder' });
const hash3 = manager.hash();
assert(hash3 !== hash1, 'hash changes after adding skill');

// Test 15: method support
manager.add({
  name: 'get-status',
  description: 'Get status via GET',
  handler: 'placeholder',
  method: 'GET',
});
const getSkill = manager.get('get-status');
assert(getSkill?.method === 'GET', 'GET method preserved');

// Test 16: toRouteConfig respects method
const routes2 = manager.toRouteConfig('base-testnet');
assert(!('GET /api/get-status' in routes2), 'free GET not in paid routes');

manager.add({
  name: 'paid-get',
  description: 'Paid GET',
  handler: 'placeholder',
  method: 'GET',
  price: '$0.25',
});
const routes3 = manager.toRouteConfig('base-testnet');
assert('GET /api/paid-get' in routes3, 'paid GET in routes with correct method');

// Test 17: initDefaults doesn't overwrite
const before = fs.readFileSync(SKILLS_PATH, 'utf8');
SkillsManager.initDefaults(TEST_DIR);
const after = fs.readFileSync(SKILLS_PATH, 'utf8');
assert(before === after, 'initDefaults does not overwrite existing file');

cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
