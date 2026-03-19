/**
 * Multi-Settle Test Script
 * 
 * This script demonstrates and tests the multi-settle feature of OpenFacilitator.
 * It creates a single signed authorization for a spending cap and then settles
 * multiple payments to different recipients.
 * 
 * Usage:
 *   pnpm multisettle              # Uses default test facilitator
 *   pnpm multisettle:local        # Uses local dev server
 * 
 * Environment variables:
 *   FACILITATOR_URL    - Base URL of the facilitator (default: https://free.openfacilitator.io)
 *   PAYER_PRIVATE_KEY  - Private key of the payer wallet (will generate if not set)
 *   NETWORK            - Network to use: base-sepolia, base, sepolia (default: base-sepolia)
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  type Address,
  type Hex,
  encodeFunctionData,
  parseUnits,
  formatUnits,
  keccak256,
  encodePacked,
  toHex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { baseSepolia, base, sepolia } from 'viem/chains';

// ============================================
// Configuration
// ============================================

const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://free.openfacilitator.io';
const NETWORK = process.env.NETWORK || 'base-sepolia';

// Token addresses (USDC)
const USDC_ADDRESSES: Record<string, Address> = {
  'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  'sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
};

// Chain configs
const CHAINS: Record<string, { chain: typeof baseSepolia; rpcUrl: string }> = {
  'base': { chain: base, rpcUrl: 'https://mainnet.base.org' },
  'base-sepolia': { chain: baseSepolia, rpcUrl: 'https://sepolia.base.org' },
  'sepolia': { chain: sepolia, rpcUrl: 'https://rpc.sepolia.org' },
};

// Test recipient addresses (random addresses for testing)
const TEST_RECIPIENTS: Address[] = [
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Alice
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Bob
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Carol
  '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', // Dave
];

// ERC-3009 TransferWithAuthorization type hash
const TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
  encodePacked(
    ['string'],
    ['TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)']
  )
);

// ============================================
// Utilities
// ============================================

function log(message: string, data?: unknown) {
  console.log(`\n🔹 ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function success(message: string) {
  console.log(`\n✅ ${message}`);
}

function error(message: string, err?: unknown) {
  console.error(`\n❌ ${message}`);
  if (err) {
    console.error(err);
  }
}

function formatUSDC(amount: string): string {
  return `$${formatUnits(BigInt(amount), 6)}`;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// ERC-3009 Signature Creation
// ============================================

interface ERC3009Authorization {
  from: Address;
  to: Address;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: Hex;
}

async function createERC3009Signature(params: {
  chainId: number;
  tokenAddress: Address;
  authorization: ERC3009Authorization;
  privateKey: Hex;
}): Promise<Hex> {
  const { chainId, tokenAddress, authorization, privateKey } = params;
  const account = privateKeyToAccount(privateKey);

  // EIP-712 domain for USDC
  const domain = {
    name: 'USD Coin',
    version: '2',
    chainId: BigInt(chainId),
    verifyingContract: tokenAddress,
  };

  // EIP-712 types
  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  };

  // Message to sign
  const message = {
    from: authorization.from,
    to: authorization.to,
    value: BigInt(authorization.value),
    validAfter: BigInt(authorization.validAfter),
    validBefore: BigInt(authorization.validBefore),
    nonce: authorization.nonce,
  };

  // Sign the typed data
  const signature = await account.signTypedData({
    domain,
    types,
    primaryType: 'TransferWithAuthorization',
    message,
  });

  return signature;
}

function generateNonce(): Hex {
  // Generate a random 32-byte nonce
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

// ============================================
// API Helpers
// ============================================

async function apiCall<T>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown
): Promise<T> {
  const url = `${FACILITATOR_URL}${endpoint}`;
  
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
  }

  return data as T;
}

// ============================================
// Test Functions
// ============================================

async function testMultiSettle() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Multi-Settle Test Script');
  console.log('='.repeat(60));
  console.log(`\nFacilitator URL: ${FACILITATOR_URL}`);
  console.log(`Network: ${NETWORK}`);

  const chainConfig = CHAINS[NETWORK];
  if (!chainConfig) {
    error(`Unsupported network: ${NETWORK}`);
    process.exit(1);
  }

  const tokenAddress = USDC_ADDRESSES[NETWORK];
  if (!tokenAddress) {
    error(`No USDC address for network: ${NETWORK}`);
    process.exit(1);
  }

  // Get or generate payer private key
  const payerPrivateKey = (process.env.PAYER_PRIVATE_KEY as Hex) || generatePrivateKey();
  const payerAccount = privateKeyToAccount(payerPrivateKey);
  
  log('Payer wallet', {
    address: payerAccount.address,
    privateKey: payerPrivateKey.slice(0, 10) + '...',
  });

  // Get facilitator info to know where to send funds
  log('Fetching facilitator supported tokens...');
  const supported = await apiCall<{ kinds: Array<{ network: string; asset: string; extra?: { feePayer?: string } }> }>(
    '/supported'
  );
  log('Supported payment types', supported);

  // For multi-settle, the 'to' address in the authorization should be the facilitator wallet
  // We'll use a placeholder here - in practice, you'd get this from the facilitator
  // For the free facilitator, we can use any address since it's for testing
  const facilitatorAddress = '0x0000000000000000000000000000000000000001' as Address;

  // Create authorization for $2.00 USDC cap
  const capAmount = parseUnits('2.00', 6).toString(); // $2.00 in atomic units
  const now = Math.floor(Date.now() / 1000);
  const validUntil = now + 3600; // Valid for 1 hour

  const authorization: ERC3009Authorization = {
    from: payerAccount.address,
    to: facilitatorAddress, // Funds go to facilitator for redistribution
    value: capAmount,
    validAfter: now - 60, // Valid from 1 minute ago
    validBefore: now + 3600, // Valid for 1 hour
    nonce: generateNonce(),
  };

  log('Creating ERC-3009 authorization', {
    ...authorization,
    valueFormatted: formatUSDC(authorization.value),
  });

  // Sign the authorization
  const signature = await createERC3009Signature({
    chainId: chainConfig.chain.id,
    tokenAddress,
    authorization,
    privateKey: payerPrivateKey,
  });

  log('Signature created', {
    signature: signature.slice(0, 20) + '...',
  });

  // Create payment payload
  const paymentPayload = {
    authorization,
    signature,
  };
  const encodedPayload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

  // ============================================
  // Step 1: Authorize multi-settle
  // ============================================
  console.log('\n' + '-'.repeat(40));
  console.log('Step 1: Authorize Multi-Settle');
  console.log('-'.repeat(40));

  try {
    const authorizeResponse = await apiCall<{
      success: boolean;
      authorizationId?: string;
      capAmount?: string;
      remainingAmount?: string;
      validUntil?: number;
      nonce?: string;
      errorMessage?: string;
    }>('/multisettle/authorize', 'POST', {
      paymentPayload: encodedPayload,
      paymentRequirements: {
        scheme: 'exact',
        network: NETWORK,
        maxAmountRequired: capAmount,
        asset: tokenAddress,
        resource: 'test-multisettle',
      },
      capAmount,
      validUntil,
    });

    if (!authorizeResponse.success) {
      error('Authorization failed', authorizeResponse.errorMessage);
      return;
    }

    success('Authorization created!');
    log('Authorization details', {
      authorizationId: authorizeResponse.authorizationId,
      cap: formatUSDC(authorizeResponse.capAmount!),
      remaining: formatUSDC(authorizeResponse.remainingAmount!),
      validUntil: new Date(authorizeResponse.validUntil! * 1000).toISOString(),
    });

    const authId = authorizeResponse.authorizationId!;

    // ============================================
    // Step 2: Make multiple settlements
    // ============================================
    console.log('\n' + '-'.repeat(40));
    console.log('Step 2: Make Multiple Settlements');
    console.log('-'.repeat(40));

    const settlements = [
      { recipient: TEST_RECIPIENTS[0], amount: parseUnits('0.50', 6).toString(), name: 'Alice' },
      { recipient: TEST_RECIPIENTS[1], amount: parseUnits('0.30', 6).toString(), name: 'Bob' },
      { recipient: TEST_RECIPIENTS[2], amount: parseUnits('0.40', 6).toString(), name: 'Carol' },
    ];

    for (const settlement of settlements) {
      log(`Settling ${formatUSDC(settlement.amount)} to ${settlement.name} (${settlement.recipient.slice(0, 10)}...)...`);
      
      try {
        const settleResponse = await apiCall<{
          success: boolean;
          transactionHash?: string;
          remainingAmount?: string;
          errorMessage?: string;
        }>('/multisettle/settle', 'POST', {
          authorizationId: authId,
          payTo: settlement.recipient,
          amount: settlement.amount,
        });

        if (settleResponse.success) {
          success(`Settlement to ${settlement.name} successful!`);
          log('Settlement result', {
            transactionHash: settleResponse.transactionHash,
            remaining: formatUSDC(settleResponse.remainingAmount!),
          });
        } else {
          error(`Settlement to ${settlement.name} failed`, settleResponse.errorMessage);
        }
      } catch (err) {
        error(`Settlement to ${settlement.name} threw error`, err);
      }

      // Small delay between settlements
      await sleep(1000);
    }

    // ============================================
    // Step 3: Try to exceed cap (should fail)
    // ============================================
    console.log('\n' + '-'.repeat(40));
    console.log('Step 3: Test Exceeding Cap (Should Fail)');
    console.log('-'.repeat(40));

    try {
      const exceedResponse = await apiCall<{
        success: boolean;
        remainingAmount?: string;
        errorMessage?: string;
      }>('/multisettle/settle', 'POST', {
        authorizationId: authId,
        payTo: TEST_RECIPIENTS[3],
        amount: parseUnits('1.00', 6).toString(), // $1.00 - should exceed remaining
      });

      if (!exceedResponse.success) {
        success('Correctly rejected settlement that exceeds cap!');
        log('Error message', exceedResponse.errorMessage);
      } else {
        error('Settlement should have failed but succeeded!');
      }
    } catch (err) {
      success('Correctly rejected with error');
      log('Error', err);
    }

    // ============================================
    // Step 4: Check status
    // ============================================
    console.log('\n' + '-'.repeat(40));
    console.log('Step 4: Check Authorization Status');
    console.log('-'.repeat(40));

    const statusResponse = await apiCall<{
      authorizationId: string;
      status: string;
      capAmount: string;
      remainingAmount: string;
      settlements: Array<{
        id: string;
        payTo: string;
        amount: string;
        status: string;
        transactionHash?: string;
      }>;
    }>(`/multisettle/status/${authId}`);

    log('Authorization status', {
      status: statusResponse.status,
      cap: formatUSDC(statusResponse.capAmount),
      remaining: formatUSDC(statusResponse.remainingAmount),
      settlementsCount: statusResponse.settlements.length,
    });

    console.log('\nSettlements:');
    for (const s of statusResponse.settlements) {
      console.log(`  - ${formatUSDC(s.amount)} to ${s.payTo.slice(0, 10)}... [${s.status}]`);
    }

    // ============================================
    // Step 5: Revoke authorization
    // ============================================
    console.log('\n' + '-'.repeat(40));
    console.log('Step 5: Revoke Authorization');
    console.log('-'.repeat(40));

    const revokeResponse = await apiCall<{
      success: boolean;
      remainingAmount?: string;
      errorMessage?: string;
    }>('/multisettle/revoke', 'POST', {
      authorizationId: authId,
    });

    if (revokeResponse.success) {
      success('Authorization revoked!');
      log('Unused balance', formatUSDC(revokeResponse.remainingAmount!));
    } else {
      error('Revocation failed', revokeResponse.errorMessage);
    }

    // ============================================
    // Step 6: Verify revoked (should fail)
    // ============================================
    console.log('\n' + '-'.repeat(40));
    console.log('Step 6: Verify Revoked Auth Cannot Be Used');
    console.log('-'.repeat(40));

    try {
      const postRevokeResponse = await apiCall<{
        success: boolean;
        errorMessage?: string;
      }>('/multisettle/settle', 'POST', {
        authorizationId: authId,
        payTo: TEST_RECIPIENTS[0],
        amount: parseUnits('0.10', 6).toString(),
      });

      if (!postRevokeResponse.success) {
        success('Correctly rejected settlement after revocation!');
        log('Error message', postRevokeResponse.errorMessage);
      } else {
        error('Settlement should have failed after revocation!');
      }
    } catch (err) {
      success('Correctly rejected with error');
    }

  } catch (err) {
    error('Test failed with error', err);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Multi-Settle Test Complete');
  console.log('='.repeat(60) + '\n');
}

// ============================================
// Run Tests
// ============================================

testMultiSettle().catch(console.error);

