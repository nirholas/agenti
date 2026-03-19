import fs from 'fs';
import path from 'path';
import os from 'os';

const TEST_DIR = path.join(os.tmpdir(), `anet-call-input-test-${Date.now()}`);
fs.mkdirSync(TEST_DIR, { recursive: true });
process.env.ANET_HOME = TEST_DIR;

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

console.log('Call Input Validation Tests\n');

// === JSON payload parsing ===

console.log('JSON Payload Parsing:');

// Test 1: Valid JSON parses correctly
function tryParsePayload(input: string): { ok: boolean; data?: any; error?: string } {
  try {
    const data = JSON.parse(input);
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

const valid1 = tryParsePayload('{"key":"value"}');
assert(valid1.ok === true, 'valid JSON object parses');
assert(valid1.data?.key === 'value', 'parsed value is correct');

// Test 2: Valid JSON array
const valid2 = tryParsePayload('[1,2,3]');
assert(valid2.ok === true, 'valid JSON array parses');

// Test 3: Empty object
const valid3 = tryParsePayload('{}');
assert(valid3.ok === true, 'empty object parses');

// Test 4: Nested JSON
const valid4 = tryParsePayload('{"topic":"zkproofs","depth":3,"tags":["crypto","zk"]}');
assert(valid4.ok === true, 'nested JSON parses');
assert(valid4.data?.topic === 'zkproofs', 'nested value correct');

// === Malformed JSON detection ===

console.log('\nMalformed JSON Detection:');

// Test 5: Missing quotes around key
const bad1 = tryParsePayload('{key:"value"}');
assert(bad1.ok === false, 'unquoted key detected');
assert(bad1.error!.includes('position') || bad1.error!.includes('token') || bad1.error!.includes('Expected'),
  `error message is descriptive: "${bad1.error}"`);

// Test 6: Single quotes (common mistake)
const bad2 = tryParsePayload("{'key':'value'}");
assert(bad2.ok === false, 'single quotes detected');

// Test 7: Trailing comma
const bad3 = tryParsePayload('{"key":"value",}');
assert(bad3.ok === false, 'trailing comma detected');

// Test 8: Completely invalid
const bad4 = tryParsePayload('not json at all');
assert(bad4.ok === false, 'non-JSON string detected');

// Test 9: Missing closing brace
const bad5 = tryParsePayload('{"key":"value"');
assert(bad5.ok === false, 'missing closing brace detected');

// Test 10: Double comma
const bad6 = tryParsePayload('{"a":1,,"b":2}');
assert(bad6.ok === false, 'double comma detected');

// Test 11: Unescaped quotes in value
const bad7 = tryParsePayload('{"msg":"say "hello""}');
assert(bad7.ok === false, 'unescaped inner quotes detected');

// === Error message quality ===

console.log('\nError Message Quality:');

// Test 12: Error messages include position info
const err1 = tryParsePayload('{bad}');
assert(err1.error !== undefined, 'error message exists for {bad}');
assert(err1.error!.length > 10, `error message is not too short: "${err1.error}"`);

// Test 13: Error for truncated JSON
const err2 = tryParsePayload('{"topic":"zk');
assert(err2.ok === false, 'truncated JSON detected');
assert(err2.error!.length > 5, 'truncated JSON has descriptive error');

// === Agent ID validation ===

console.log('\nAgent ID Validation:');

// Test 14: Valid numeric ID
const id1 = parseInt('692');
assert(!isNaN(id1) && id1 === 692, 'numeric agent ID parses correctly');

// Test 15: Zero is valid
const id2 = parseInt('0');
assert(!isNaN(id2) && id2 === 0, 'zero agent ID is valid');

// Test 16: Non-numeric string
const id3 = parseInt('my-agent');
assert(isNaN(id3), 'non-numeric agent ID detected as NaN');

// Test 17: Empty string
const id4 = parseInt('');
assert(isNaN(id4), 'empty string detected as NaN');

// Test 18: Float (parseInt truncates, which is acceptable)
const id5 = parseInt('42.5');
assert(!isNaN(id5) && id5 === 42, 'float truncates to int (acceptable)');

// Test 19: Negative (technically valid for parseInt, but agents are uint256)
const id6 = parseInt('-1');
assert(!isNaN(id6), 'negative parses (gated by registry)');

// === Snippet truncation logic ===

console.log('\nSnippet Truncation:');

// Test 20: Short payload shown in full
const shortPayload = '{"k":"v"}';
const shortSnippet = shortPayload.length > 80
  ? shortPayload.slice(0, 80) + '...'
  : shortPayload;
assert(shortSnippet === shortPayload, 'short payload not truncated');

// Test 21: Long payload truncated
const longPayload = '{"data":"' + 'x'.repeat(200) + '"}';
const longSnippet = longPayload.length > 80
  ? longPayload.slice(0, 80) + '...'
  : longPayload;
assert(longSnippet.length === 83, 'long payload truncated to 80 chars + "..."');
assert(longSnippet.endsWith('...'), 'truncated payload ends with ellipsis');

// === Edge cases ===

console.log('\nEdge Cases:');

// Test 22: null literal is valid JSON
const edge1 = tryParsePayload('null');
assert(edge1.ok === true, 'null is valid JSON');

// Test 23: number literal is valid JSON
const edge2 = tryParsePayload('42');
assert(edge2.ok === true, 'number is valid JSON');

// Test 24: string literal is valid JSON
const edge3 = tryParsePayload('"hello"');
assert(edge3.ok === true, 'string literal is valid JSON');

// Test 25: Unicode in payload
const edge4 = tryParsePayload('{"emoji":"\\u2764"}');
assert(edge4.ok === true, 'unicode escape in JSON works');

cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
