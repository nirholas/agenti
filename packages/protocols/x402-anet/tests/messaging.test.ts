import fs from 'fs';
import path from 'path';
import os from 'os';

const TEST_DIR = path.join(os.tmpdir(), `anet-msg-test-${Date.now()}`);
fs.mkdirSync(TEST_DIR, { recursive: true });
process.env.ANET_HOME = TEST_DIR;

// Import after env set
const { MessageHandler } = await import('../src/core/messaging/handler.js');

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

console.log('Message Handler Tests\n');

// === No skills, no config ===

console.log('No Skills Configured (voicemail mode):');

const emptyHandler = new MessageHandler({ agentName: 'test-agent' });

// Test 1: Plain text → not-configured message
const noSkillsText = JSON.parse(await emptyHandler.handleMessage('0xabc', 'hello'));
assert(noSkillsText.type === 'not-configured', 'plain text → not-configured type');
assert(noSkillsText.message.includes('not been configured'), 'message says not configured');
assert(noSkillsText.message.includes('test-agent'), 'message includes agent name');

// Test 2: Service request → error with empty available list
const noSkillsReq = JSON.parse(await emptyHandler.handleMessage('0xabc',
  JSON.stringify({ type: 'service-request', service: 'foo', payload: {} })
));
assert(noSkillsReq.status === 'error', 'unknown service → error');
assert(noSkillsReq.result.includes('Unknown service'), 'says unknown service');

emptyHandler.destroy();

// === With skills ===

console.log('\nWith Skills (capabilities mode):');

const skills = [
  { name: 'summarize', description: 'Summarize text', handler: 'placeholder' as const, tags: ['nlp'] },
  { name: 'code-review', description: 'Review code', price: '$0.50', handler: 'placeholder' as const, tags: ['code'] },
];

const skillHandler = new MessageHandler({
  skills,
  agentName: 'my-agent',
  agentId: 692,
  httpEndpoint: 'https://myagent.example.com',
});

// Test 3: Plain text → capabilities response
const capsText = JSON.parse(await skillHandler.handleMessage('0xabc', 'what can you do?'));
assert(capsText.type === 'capabilities', 'plain text → capabilities type');
assert(capsText.agentId === 692, 'capabilities include agentId');
assert(capsText.name === 'my-agent', 'capabilities include name');
assert(capsText.services.length === 2, 'capabilities list 2 services');

// Test 4: Capabilities structure
assert(capsText.freeServices.length === 1, '1 free service');
assert(capsText.freeServices[0] === 'summarize', 'free service is summarize');
assert(capsText.paidServices.length === 1, '1 paid service');
assert(capsText.paidServices[0] === 'code-review', 'paid service is code-review');
assert(capsText.httpEndpoint === 'https://myagent.example.com', 'httpEndpoint included');

// Test 5: Capabilities usage hints
assert(capsText.usage.free !== null, 'free usage hint present');
assert(capsText.usage.free.service === 'summarize', 'free usage shows summarize');
assert(capsText.usage.paid !== null, 'paid usage hint present');
assert(capsText.usage.paid.includes('anet call'), 'paid usage mentions anet call');

// Test 6: Service details for free service
assert(capsText.services[0].name === 'summarize', 'first service is summarize');
assert(capsText.services[0].price === null, 'free service price is null');
assert(capsText.services[1].name === 'code-review', 'second service is code-review');
assert(capsText.services[1].price === '$0.50', 'paid service has price');

// === Free service execution over XMTP ===

console.log('\nFree Service Execution:');

// Test 7: Free service-request → executes directly
const freeReq = JSON.parse(await skillHandler.handleMessage('0xabc',
  JSON.stringify({ type: 'service-request', service: 'summarize', payload: { text: 'hello' } })
));
assert(freeReq.status === 'success', 'free service returns success');
assert(freeReq.result.skill === 'summarize', 'result references skill name');

// Test 8: Free service with request ID
const freeReqId = JSON.parse(await skillHandler.handleMessage('0xabc',
  JSON.stringify({ type: 'service-request', id: 'req-123', service: 'summarize', payload: {} })
));
assert(freeReqId.requestId === 'req-123', 'request ID passed through');

// === Paid service redirect ===

console.log('\nPaid Service Redirect:');

// Test 9: Paid service-request → payment-required redirect
const paidReq = JSON.parse(await skillHandler.handleMessage('0xabc',
  JSON.stringify({ type: 'service-request', service: 'code-review', payload: {} })
));
assert(paidReq.status === 'payment-required', 'paid service → payment-required');
assert(paidReq.result.includes('$0.50'), 'mentions price');
assert(paidReq.httpEndpoint === 'https://myagent.example.com/api/code-review', 'includes HTTP endpoint');
assert(paidReq.usage.includes('anet call 692'), 'includes CLI usage with agent ID');

// === Service inquiry ===

console.log('\nService Inquiry:');

// Test 10: Inquiry for existing skill with details
const inquiry1 = JSON.parse(await skillHandler.handleMessage('0xabc',
  JSON.stringify({ type: 'service-inquiry', service: 'code-review', question: 'how much?' })
));
assert(inquiry1.type === 'service-details', 'inquiry returns service-details');
assert(inquiry1.available === true, 'service is available');
assert(inquiry1.description === 'Review code', 'includes description');
assert(inquiry1.price === '$0.50', 'includes price');
assert(inquiry1.paid === true, 'marked as paid');
assert(inquiry1.httpEndpoint === 'https://myagent.example.com/api/code-review', 'includes endpoint');

// Test 11: Inquiry for free service
const inquiry2 = JSON.parse(await skillHandler.handleMessage('0xabc',
  JSON.stringify({ type: 'service-inquiry', service: 'summarize', question: 'how to use?' })
));
assert(inquiry2.available === true, 'free service available');
assert(inquiry2.price === null, 'free service price is null');
assert(inquiry2.paid === false, 'marked as not paid');
assert(typeof inquiry2.usage === 'object', 'free service has usage example object');

// Test 12: Inquiry for missing service
const inquiry3 = JSON.parse(await skillHandler.handleMessage('0xabc',
  JSON.stringify({ type: 'service-inquiry', service: 'nonexistent', question: 'do you have this?' })
));
assert(inquiry3.available === false, 'missing service not available');
assert(inquiry3.allServices.length === 2, 'lists all available services');

// === Unknown service request ===

console.log('\nUnknown Service:');

// Test 13: Unknown service includes available list
const unknownReq = JSON.parse(await skillHandler.handleMessage('0xabc',
  JSON.stringify({ type: 'service-request', service: 'nonexistent', payload: {} })
));
assert(unknownReq.status === 'error', 'unknown service → error');
assert(unknownReq.available.length === 2, 'error includes available service list');

skillHandler.destroy();

// === Friend requests still work ===

console.log('\nFriend Requests:');

let friendRequestReceived = false;
const friendHandler = new MessageHandler({
  skills,
  onFriendRequest: async () => { friendRequestReceived = true; },
});

// Test 14: Friend request handled
const friendReq = JSON.parse(await friendHandler.handleMessage('0xabc',
  JSON.stringify({ type: 'friend-request', agentId: 123, name: 'Alice', reputation: 80 })
));
assert(friendReq.type === 'ack', 'friend request acked');
assert(friendRequestReceived, 'friend request callback fired');

friendHandler.destroy();

// === Reputation gating ===

console.log('\nReputation Gating:');

const repHandler = new MessageHandler({
  skills: [{ name: 'test', description: 'Test', handler: 'placeholder' as const }],
  reputationChecker: async () => 10, // low rep
});

// Test 15: Low rep blocked from service request
const lowRep = JSON.parse(await repHandler.handleMessage('0xbad',
  JSON.stringify({ type: 'service-request', service: 'test', payload: {} })
));
assert(lowRep.status === 'error', 'low rep → error');
assert(lowRep.result.includes('reputation'), 'mentions reputation');

repHandler.destroy();

// === Rate limiting ===

console.log('\nRate Limiting:');

const rateLimited = new MessageHandler({
  maxMessagesPerMinute: 2,
  skills,
});

// Test 16: Rate limit kicks in
await rateLimited.handleMessage('0xspam', 'msg1');
await rateLimited.handleMessage('0xspam', 'msg2');
const rateLimitResp = JSON.parse(await rateLimited.handleMessage('0xspam', 'msg3'));
assert(rateLimitResp.type === 'error', 'rate limited → error');
assert(rateLimitResp.error.includes('Rate limit'), 'mentions rate limit');

rateLimited.destroy();

// === buildCapabilities() ===

console.log('\nBuild Capabilities:');

const capsHandler = new MessageHandler({
  skills: [
    { name: 'free1', description: 'Free skill 1', handler: 'placeholder' as const },
    { name: 'free2', description: 'Free skill 2', handler: 'placeholder' as const },
    { name: 'paid1', description: 'Paid skill', price: '$1.00', handler: 'placeholder' as const },
  ],
  agentName: 'caps-agent',
  agentId: 42,
  httpEndpoint: 'https://example.com',
});

// Test 17: buildCapabilities is callable directly
const caps = capsHandler.buildCapabilities();
assert(caps.type === 'capabilities', 'buildCapabilities returns capabilities type');
assert(caps.freeServices.length === 2, '2 free services');
assert(caps.paidServices.length === 1, '1 paid service');
assert(caps.usage.free?.service === 'free1', 'first free service in usage hint');

capsHandler.destroy();

// === No agentId fallback ===

console.log('\nNo Agent ID Fallback:');

const noIdHandler = new MessageHandler({
  skills: [{ name: 'paid', description: 'Paid', price: '$1', handler: 'placeholder' as const }],
});

// Test 18: Paid redirect uses <agent-id> placeholder
const noIdReq = JSON.parse(await noIdHandler.handleMessage('0xabc',
  JSON.stringify({ type: 'service-request', service: 'paid', payload: {} })
));
assert(noIdReq.usage.includes('<agent-id>'), 'uses placeholder when no agentId');

noIdHandler.destroy();

// === Custom service handler override ===

console.log('\nCustom Service Handler:');

const customHandler = new MessageHandler({
  skills: [{ name: 'custom', description: 'Custom skill', handler: 'placeholder' as const }],
});
customHandler.registerService('custom', async (_sender, payload) => {
  return { custom: true, received: payload };
});

// Test 19: Registered handler overrides placeholder
const customReq = JSON.parse(await customHandler.handleMessage('0xabc',
  JSON.stringify({ type: 'service-request', service: 'custom', payload: { data: 'test' } })
));
assert(customReq.status === 'success', 'custom handler returns success');
assert(customReq.result.custom === true, 'custom handler result used');
assert(customReq.result.received.data === 'test', 'payload passed through');

customHandler.destroy();

cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
