import { ethers } from 'ethers';
import { signRequest } from '../src/core/auth/signer.js';
import { buildSignatureBase, parseSignatureHeader, createContentDigest, generateNonce } from '../src/core/auth/utils.js';
import { assert, summary } from './utils.js';

console.log('Auth (ERC-8128 Signing) Tests\n');

const wallet = ethers.Wallet.createRandom();

// --- Utils ---

// Content digest
const digest = createContentDigest('{"hello":"world"}');
assert(digest.startsWith('sha-256=:'), 'content digest has correct prefix');
assert(digest.endsWith(':'), 'content digest has correct suffix');

// Same content = same digest
const digest2 = createContentDigest('{"hello":"world"}');
assert(digest === digest2, 'same content produces same digest');

// Different content = different digest
const digest3 = createContentDigest('different');
assert(digest3 !== digest, 'different content produces different digest');

// Nonce generation
const nonce1 = generateNonce();
const nonce2 = generateNonce();
assert(nonce1.length === 32, 'nonce is 32 hex chars');
assert(nonce1 !== nonce2, 'nonces are unique');

// Signature base
const base = buildSignatureBase('POST', 'https://example.com/api/call?foo=bar', '{"test":true}', 'abc123');
assert(base.includes('@method: POST'), 'signature base includes method');
assert(base.includes('@path: /api/call'), 'signature base includes path');
assert(base.includes('@query: ?foo=bar'), 'signature base includes query');
assert(base.includes('content-digest:'), 'signature base includes content-digest');
assert(base.includes('nonce: abc123'), 'signature base includes nonce');

// Parse signature header
const parsed = parseSignatureHeader('sig=:0xdeadbeef:; keyid="0xabc123"; nonce="xyz789"');
assert(parsed.signature === '0xdeadbeef', 'parsed signature');
assert(parsed.keyId === '0xabc123', 'parsed keyId');
assert(parsed.nonce === 'xyz789', 'parsed nonce');

// Parse malformed header
const bad = parseSignatureHeader('garbage');
assert(bad.signature === undefined, 'malformed: no signature');
assert(bad.keyId === undefined, 'malformed: no keyId');
assert(bad.nonce === undefined, 'malformed: no nonce');

// --- Sign + Verify round-trip ---

const signed = await signRequest(
  'POST',
  'https://agent.example.com/api/code-review',
  '{"code":"function foo() {}"}',
  wallet
);

assert(signed.signature.startsWith('0x'), 'signature is hex');
assert(signed.signerAddress === wallet.address, 'signer address matches wallet');
assert(signed.nonce.length === 32, 'nonce in signed result');
assert(signed.signatureHeader.includes('sig=:'), 'signature header format');
assert(signed.signatureHeader.includes(`keyid="${wallet.address}"`), 'header includes keyId');

// Verify the signature manually
const base2 = buildSignatureBase(
  'POST',
  'https://agent.example.com/api/code-review',
  '{"code":"function foo() {}"}',
  signed.nonce
);
const recovered = ethers.verifyMessage(base2, signed.signature);
assert(recovered === wallet.address, 'recovered address matches signer');

// Verify with different body fails
const badBase = buildSignatureBase(
  'POST',
  'https://agent.example.com/api/code-review',
  '{"code":"TAMPERED"}',
  signed.nonce
);
const badRecovered = ethers.verifyMessage(badBase, signed.signature);
assert(badRecovered !== wallet.address, 'tampered body fails verification');

// --- Multiple wallets ---

const wallet2 = ethers.Wallet.createRandom();
const signed2 = await signRequest('GET', 'https://example.com/', '', wallet2);
assert(signed2.signerAddress !== signed.signerAddress, 'different wallets produce different signers');

// Cross-wallet verification fails
const base3 = buildSignatureBase('GET', 'https://example.com/', '', signed2.nonce);
const recovered2 = ethers.verifyMessage(base3, signed2.signature);
assert(recovered2 === wallet2.address, 'wallet2 signature verifies against wallet2');
assert(recovered2 !== wallet.address, 'wallet2 signature does not verify against wallet1');

summary();
