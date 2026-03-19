/**
 * E2E test: USDT gasless payment via x402 relay.
 * Client signs a jetton transfer, facilitator broadcasts via TONAPI gasless.
 *
 * Usage:
 *   CLIENT_MNEMONIC="..." VENDOR_ADDRESS="0:..." npx tsx scripts/test-e2e-usdt.ts [facilitator-url]
 *
 * Env:
 *   CLIENT_MNEMONIC  — 24-word mnemonic of the funded client wallet (must have USDT + be deployed)
 *   VENDOR_ADDRESS    — raw address of the vendor (payTo)
 *   FACILITATOR_URL   — facilitator URL (default: https://x402.resistance.dog)
 */

import { TonSigner, SchemeNetworkClient, USDT_MAINNET_MASTER } from 'x402ton';
import type { TonExtra, PaymentRequirements } from 'x402ton';

const FACILITATOR_URL =
  process.argv[2] || process.env.FACILITATOR_URL || 'https://x402.resistance.dog';
const CLIENT_MNEMONIC = process.env.CLIENT_MNEMONIC;
const VENDOR_ADDRESS = process.env.VENDOR_ADDRESS;
const TONCENTER_API_KEY = process.env.TONCENTER_API_KEY;
const TONAPI_KEY = process.env.TONAPI_KEY;

if (!CLIENT_MNEMONIC) {
  console.error('CLIENT_MNEMONIC env var required');
  process.exit(1);
}
if (!VENDOR_ADDRESS) {
  console.error('VENDOR_ADDRESS env var required');
  process.exit(1);
}

async function main() {
  console.log('=== x402ton E2E Test — USDT Gasless (Relay Model) ===\n');

  // 1. Fetch facilitator config
  console.log(`1. Fetching ${FACILITATOR_URL}/supported ...`);
  const supported = await fetch(`${FACILITATOR_URL}/supported`).then((r) => r.json());
  const kind = supported.kinds[0];
  const extra: TonExtra = kind.extra;
  console.log(`   Network: ${kind.network}`);
  console.log(`   Relay address: ${extra.relayAddress || '(none)'}`);
  console.log(`   Asset: ${extra.assetSymbol} (${extra.assetDecimals} decimals)`);

  // 2. Init client signer
  console.log('\n2. Initializing client wallet ...');
  const mnemonic = CLIENT_MNEMONIC.trim().split(/\s+/);
  const signer = new TonSigner(mnemonic);
  await signer.init();
  const clientAddress = signer.getAddress();
  console.log(`   Client: ${clientAddress}`);

  // 3. Build USDT payment — 0.01 USDT (10000 micro-USDT since 6 decimals)
  const amount = '10000'; // 0.01 USDT = 10000 (6 decimals)
  const asset = USDT_MAINNET_MASTER;
  console.log(`\n3. Building USDT payment (gasless) ...`);
  console.log(`   Amount: ${amount} micro-USDT (0.01 USDT)`);
  console.log(`   Asset: ${asset}`);
  console.log(`   Vendor (payTo): ${VENDOR_ADDRESS}`);

  const client = new SchemeNetworkClient(signer, {
    toncenterApiKey: TONCENTER_API_KEY,
    tonApiKey: TONAPI_KEY,
  });
  const payload = await client.createPaymentPayload(
    kind.network,
    amount,
    asset,
    VENDOR_ADDRESS,
    120, // 2 min timeout
    extra,
  );

  console.log(`   BOC length: ${payload.signedBoc.length} chars`);
  console.log(`   Wallet address: ${payload.walletAddress}`);
  console.log(`   Seqno: ${payload.seqno}`);
  console.log(`   Valid until: ${new Date(payload.validUntil * 1000).toISOString()}`);

  // 4. Verify
  const paymentRequirements: PaymentRequirements = {
    scheme: 'exact',
    network: kind.network,
    asset,
    amount,
    payTo: VENDOR_ADDRESS,
    maxTimeoutSeconds: 120,
    extra,
  };

  console.log(`\n4. POST ${FACILITATOR_URL}/verify ...`);
  const verifyRes = await fetch(`${FACILITATOR_URL}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentPayload: { x402Version: 2, payload },
      paymentRequirements,
    }),
  });
  const verifyResult = await verifyRes.json();
  console.log(`   Status: ${verifyRes.status}`);
  console.log(`   Result:`, JSON.stringify(verifyResult, null, 2));

  if (!verifyResult.isValid) {
    console.error(
      `\n   VERIFY FAILED: ${verifyResult.invalidReason} — ${verifyResult.invalidMessage}`,
    );
    process.exit(1);
  }
  console.log(`   Payer: ${verifyResult.payer}`);

  // 5. Settle — facilitator broadcasts gasless via TONAPI
  const idempotencyKey = crypto.randomUUID();
  console.log(`\n5. POST ${FACILITATOR_URL}/settle ...`);
  console.log(`   Idempotency-Key: ${idempotencyKey}`);
  const settleRes = await fetch(`${FACILITATOR_URL}/settle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      paymentPayload: { x402Version: 2, payload },
      paymentRequirements,
    }),
  });
  const settleResult = await settleRes.json();
  console.log(`   Status: ${settleRes.status}`);
  console.log(`   Result:`, JSON.stringify(settleResult, null, 2));

  if (!settleResult.success) {
    console.error(
      `\n   SETTLE FAILED: ${settleResult.errorReason} — ${settleResult.errorMessage}`,
    );
    process.exit(1);
  }

  console.log(`\n=== E2E USDT GASLESS SUCCESS ===`);
  console.log(`   Transaction: ${settleResult.transaction}`);
  console.log(`   Payer: ${settleResult.payer}`);
  console.log(`   Network: ${settleResult.network}`);
  console.log(`   Vendor received: ${amount} micro-USDT (0.01 USDT) via gasless relay`);
}

main().catch((err) => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
