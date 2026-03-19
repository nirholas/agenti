import fs from 'fs';
import path from 'path';
import os from 'os';
import { ethers } from 'ethers';
import { computeReputationScore } from '../src/core/registry/metadata.js';
import { giveFeedback, getAgentReputation, REPUTATION_ABI } from '../src/core/registry/reputation.js';

const TEST_DIR = path.join(os.tmpdir(), `anet-rep-test-${Date.now()}`);
fs.mkdirSync(TEST_DIR, { recursive: true });
process.env.ANET_HOME = TEST_DIR;

// Import after env set
const { SettingsManager } = await import('../src/settings/manager.js');

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

console.log('Auto-Reputation Tests\n');

// === Per-call feedback scoring (used in call.ts) ===
// This mirrors the logic in call.ts:
//   timePenalty = min(20, round((responseTime / 10000) * 20))
//   feedbackScore = success ? 100 - timePenalty : 0

function perCallScore(success: boolean, responseTimeMs: number): number {
  if (!success) return 0;
  const timePenalty = Math.min(20, Math.round((responseTimeMs / 10000) * 20));
  return 100 - timePenalty;
}

console.log('Per-Call Feedback Score:');

// Test 1: Fast successful call → 100
const fast = perCallScore(true, 200);
assert(fast === 100, `200ms success → ${fast} (should be 100)`);

// Test 2: Instant call → 100
const instant = perCallScore(true, 0);
assert(instant === 100, `0ms success → ${instant} (should be 100)`);

// Test 3: 1 second → 98
const oneSecond = perCallScore(true, 1000);
assert(oneSecond === 98, `1s success → ${oneSecond} (should be 98)`);

// Test 4: 5 seconds → 90
const fiveSeconds = perCallScore(true, 5000);
assert(fiveSeconds === 90, `5s success → ${fiveSeconds} (should be 90)`);

// Test 5: 10 seconds → 80 (max penalty)
const tenSeconds = perCallScore(true, 10000);
assert(tenSeconds === 80, `10s success → ${tenSeconds} (should be 80)`);

// Test 6: 30 seconds → 80 (penalty caps at 20)
const thirtySeconds = perCallScore(true, 30000);
assert(thirtySeconds === 80, `30s success → ${thirtySeconds} (capped at 80)`);

// Test 7: Failed → 0 (not submitted, but score is 0)
const fail = perCallScore(false, 200);
assert(fail === 0, `failed call → ${fail} (should be 0)`);

// Test 8: Score range is always 80-100 for successful calls
assert(fast >= 80 && fast <= 100, 'successful score always in 80-100 range');
assert(thirtySeconds >= 80, 'even slowest successful call gets 80+');

// === Aggregate scoring (used for status/dashboard, not for per-call feedback) ===

console.log('\nAggregate Score (computeReputationScore):');

// Test 9: Full metrics → high score
const fullMetrics = computeReputationScore({
  reachable: true,
  successRate: 100,
  responseTime: 200,
  uptime: 100,
});
assert(fullMetrics > 90, `full metrics scores high (${fullMetrics})`);

// Test 10: Without uptime → partial (expected, this is aggregate)
const noUptime = computeReputationScore({
  reachable: true,
  successRate: 100,
  responseTime: 200,
});
assert(noUptime > 50 && noUptime < 80, `no uptime scores partial (${noUptime})`);

// === Config gating ===

console.log('\nConfig Gating:');

// Test 11: Default config has auto-feedback enabled
SettingsManager.initDefaults(TEST_DIR);
const settings = new SettingsManager(
  path.join(TEST_DIR, 'config.yaml'),
  path.join(TEST_DIR, 'hooks.yaml')
);
const autoFeedback = settings.get('reputation.auto-feedback');
assert(autoFeedback === true, 'default reputation.auto-feedback is true');

// Test 12: Can disable auto-feedback
settings.set('reputation.auto-feedback', 'false');
assert(settings.get('reputation.auto-feedback') === false, 'can disable auto-feedback');

// Test 13: Persists
const settings2 = new SettingsManager(
  path.join(TEST_DIR, 'config.yaml'),
  path.join(TEST_DIR, 'hooks.yaml')
);
assert(settings2.get('reputation.auto-feedback') === false, 'disabled setting persists');

// === Gating logic (simulated call.ts conditions) ===

console.log('\nSubmission Gating Logic:');

function shouldSubmitFeedback(opts: {
  success: boolean;
  autoFeedback: boolean;
  noFeedbackFlag: boolean;
  network: string;
}): { submit: boolean; reason: string } {
  if (!opts.success) return { submit: false, reason: 'call failed' };
  if (!opts.autoFeedback) return { submit: false, reason: 'auto-feedback disabled' };
  if (opts.noFeedbackFlag) return { submit: false, reason: '--no-feedback flag' };
  if (opts.network !== 'mainnet') return { submit: false, reason: 'testnet (registry mainnet-only)' };
  return { submit: true, reason: 'all conditions met' };
}

// Test 14: Success + mainnet + enabled → submit
const case1 = shouldSubmitFeedback({ success: true, autoFeedback: true, noFeedbackFlag: false, network: 'mainnet' });
assert(case1.submit === true, 'success + mainnet + enabled → submit');

// Test 15: Failed call → no submit
const case2 = shouldSubmitFeedback({ success: false, autoFeedback: true, noFeedbackFlag: false, network: 'mainnet' });
assert(case2.submit === false, 'failed call → no submit');

// Test 16: Testnet → no submit
const case3 = shouldSubmitFeedback({ success: true, autoFeedback: true, noFeedbackFlag: false, network: 'testnet' });
assert(case3.submit === false, 'testnet → no submit');

// Test 17: Config disabled → no submit
const case4 = shouldSubmitFeedback({ success: true, autoFeedback: false, noFeedbackFlag: false, network: 'mainnet' });
assert(case4.submit === false, 'config disabled → no submit');

// Test 18: --no-feedback flag → no submit
const case5 = shouldSubmitFeedback({ success: true, autoFeedback: true, noFeedbackFlag: true, network: 'mainnet' });
assert(case5.submit === false, '--no-feedback flag → no submit');

// === giveFeedback contract interface ===

console.log('\nContract Interface:');

// Test 19: giveFeedback is a function
assert(typeof giveFeedback === 'function', 'giveFeedback is exported function');

// Test 20: getAgentReputation is a function
assert(typeof getAgentReputation === 'function', 'getAgentReputation is exported function');

// Test 21: Reputation ABI has giveFeedback
const hasFeedback = REPUTATION_ABI.some((entry: any) => entry.name === 'giveFeedback');
assert(hasFeedback, 'ABI includes giveFeedback function');

// Test 22: giveFeedback ABI has correct params
const feedbackAbi = REPUTATION_ABI.find((entry: any) => entry.name === 'giveFeedback');
assert(feedbackAbi.inputs.length === 9, `giveFeedback has 9 params (${feedbackAbi.inputs.length})`);
assert(feedbackAbi.inputs[0].name === 'schemaId', 'param 0: schemaId');
assert(feedbackAbi.inputs[1].name === 'agentId', 'param 1: agentId');
assert(feedbackAbi.inputs[2].name === 'value', 'param 2: value (int128)');
assert(feedbackAbi.inputs[4].name === 'tag1', 'param 4: tag1');
assert(feedbackAbi.inputs[5].name === 'tag2', 'param 5: tag2');
assert(feedbackAbi.inputs[6].name === 'ref', 'param 6: ref');

// Test 23: Reputation ABI has getSummary
const hasSummary = REPUTATION_ABI.some((entry: any) => entry.name === 'getSummary');
assert(hasSummary, 'ABI includes getSummary function');

// === Tag encoding ===

console.log('\nTag Encoding:');

// Test 24: Service name fits in bytes32
const serviceTag = ethers.encodeBytes32String('code-review');
assert(serviceTag.length === 66, 'service name encodes to bytes32');

// Test 25: "anet" tag fits in bytes32
const anetTag = ethers.encodeBytes32String('anet');
assert(anetTag.length === 66, '"anet" tag encodes to bytes32');

// Test 26: Long service names get truncated (bytes32 = 31 chars max)
const longName = 'a-very-long-service-name-that-exceeds';
try {
  ethers.encodeBytes32String(longName);
  assert(false, 'long name should throw');
} catch {
  assert(true, 'long service names (>31 chars) correctly rejected by bytes32');
}

// Test 27: Typical skill names work fine
const shortNames = ['summarize', 'audit', 'code-review', 'research', 'translate'];
let allOk = true;
for (const name of shortNames) {
  try {
    ethers.encodeBytes32String(name);
  } catch {
    allOk = false;
  }
}
assert(allOk, 'typical skill names all fit in bytes32');

// === Feedback value semantics ===

console.log('\nFeedback Value Semantics:');

// Test 28: A fast successful call submits 100 — the agent delivered perfectly
assert(perCallScore(true, 50) === 100, 'perfect call → 100 on-chain');

// Test 29: A slightly slow call still submits high — it delivered
assert(perCallScore(true, 3000) >= 94, '3s call still scores 94+');

// Test 30: The floor for successful calls is 80 — always positive feedback
assert(perCallScore(true, 999999) === 80, 'even worst-case success → 80');

// Test 31: Failed calls are never submitted (score 0, but gating prevents submission)
assert(perCallScore(false, 100) === 0, 'failed calls score 0 (gated, never submitted)');

cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
