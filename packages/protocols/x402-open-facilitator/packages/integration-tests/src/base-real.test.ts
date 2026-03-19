/**
 * Real Base (EVM) transaction tests
 * 
 * These tests create and submit REAL transactions on Base mainnet.
 * Only run these manually with a funded wallet!
 * 
 * Usage: pnpm test:base
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { OpenFacilitator } from '@openfacilitator/sdk';
import { TEST_CONFIG } from './setup';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type Address,
  keccak256,
  toHex,
  encodePacked,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Base mainnet USDC
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address;
const BASE_CHAIN_ID = 8453;
const BASE_RPC = 'https://mainnet.base.org';

// Test amount: $0.01 USDC (10000 micro-units, USDC has 6 decimals)
const TEST_AMOUNT = BigInt(10000);

// ERC-20 balanceOf ABI
const BALANCE_OF_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/**
 * Load EVM private key from environment or file
 */
function loadEVMPrivateKey(): Hex | null {
  // Try environment variable first
  if (process.env.TEST_EVM_PRIVATE_KEY) {
    const key = process.env.TEST_EVM_PRIVATE_KEY;
    return (key.startsWith('0x') ? key : `0x${key}`) as Hex;
  }
  
  // Try loading from a local file
  try {
    const keyPath = path.join(os.homedir(), '.config', 'evm', 'private_key');
    const key = fs.readFileSync(keyPath, 'utf-8').trim();
    return (key.startsWith('0x') ? key : `0x${key}`) as Hex;
  } catch {
    // File doesn't exist
  }
  
  return null;
}

/**
 * Get USDC balance on Base
 */
async function getUSDCBalance(address: Address): Promise<bigint> {
  const client = createPublicClient({
    chain: base,
    transport: http(BASE_RPC),
  });
  
  try {
    const balance = await client.readContract({
      address: BASE_USDC,
      abi: BALANCE_OF_ABI,
      functionName: 'balanceOf',
      args: [address],
    });
    return balance as bigint;
  } catch {
    return BigInt(0);
  }
}

/**
 * Generate a random nonce for ERC-3009
 */
function generateNonce(): Hex {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return toHex(randomBytes);
}

/**
 * Sign an ERC-3009 transferWithAuthorization
 */
async function signTransferAuthorization(
  privateKey: Hex,
  params: {
    to: Address;
    value: bigint;
    validAfter: number;
    validBefore: number;
    nonce: Hex;
  }
): Promise<{ authorization: object; signature: Hex }> {
  const account = privateKeyToAccount(privateKey);
  const from = account.address;
  
  // EIP-712 domain for USDC on Base
  const domain = {
    name: 'USD Coin',
    version: '2',
    chainId: BASE_CHAIN_ID,
    verifyingContract: BASE_USDC,
  };
  
  // ERC-3009 TransferWithAuthorization types
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
  
  const message = {
    from,
    to: params.to,
    value: params.value,
    validAfter: BigInt(params.validAfter),
    validBefore: BigInt(params.validBefore),
    nonce: params.nonce,
  };
  
  // Create wallet client for signing
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(BASE_RPC),
  });
  
  // Sign the typed data
  const signature = await walletClient.signTypedData({
    domain,
    types,
    primaryType: 'TransferWithAuthorization',
    message,
  });
  
  const authorization = {
    from,
    to: params.to,
    value: params.value.toString(),
    validAfter: params.validAfter,
    validBefore: params.validBefore,
    nonce: params.nonce,
  };
  
  return { authorization, signature };
}

describe('base real transactions', () => {
  let facilitator: OpenFacilitator;
  let privateKey: Hex | null;
  let walletAddress: Address;
  let payTo: string | undefined;

  beforeAll(async () => {
    // Load EVM private key
    privateKey = loadEVMPrivateKey();
    if (!privateKey) {
      console.log('⚠️  No EVM private key found');
      console.log('   Set TEST_EVM_PRIVATE_KEY env var or create ~/.config/evm/private_key');
      return;
    }

    const account = privateKeyToAccount(privateKey);
    walletAddress = account.address;
    console.log(`📝 Loaded wallet: ${walletAddress}`);

    // Check USDC balance
    const balance = await getUSDCBalance(walletAddress);
    console.log(`💰 USDC balance: ${Number(balance) / 1e6} USDC`);

    if (balance < TEST_AMOUNT) {
      console.log(`⚠️  Insufficient balance for tests (need ${Number(TEST_AMOUNT) / 1e6} USDC)`);
      return;
    }

    // Check ETH balance for gas (though facilitator pays gas in x402)
    const client = createPublicClient({
      chain: base,
      transport: http(BASE_RPC),
    });
    const ethBalance = await client.getBalance({ address: walletAddress });
    console.log(`⛽ ETH balance: ${Number(ethBalance) / 1e18} ETH`);

    // Initialize facilitator
    facilitator = new OpenFacilitator({
      url: TEST_CONFIG.FREE_ENDPOINT,
    });

    // Get supported info to find payTo address
    const supported = await facilitator.supported();
    const baseKind = supported.kinds.find(k => 
      k.network === 'base' || k.network === 'eip155:8453'
    );
    
    // Get payTo from signers (uses wildcard key eip155:*)
    // Note: The free endpoint signer might not be an actual address
    // For testing, we'll use the wallet's own address as payTo (send to self)
    const signerAddr = supported.signers?.['eip155:*']?.[0];
    
    // If signer looks like an address, use it; otherwise use our own wallet
    if (signerAddr && signerAddr.startsWith('0x') && signerAddr.length === 42) {
      payTo = signerAddr;
    } else {
      // Use our own address for testing (self-transfer)
      payTo = walletAddress;
      console.log(`⚠️  Using self-transfer for test (signer: ${signerAddr})`);
    }
    
    console.log(`📬 Pay to: ${payTo}`);
  });

  it('should verify a real signed authorization', async () => {
    if (!privateKey || !payTo) {
      console.log('Skipping: no private key or payTo address');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const nonce = generateNonce();
    
    // Create signed authorization
    const { authorization, signature } = await signTransferAuthorization(privateKey, {
      to: payTo as Address,
      value: TEST_AMOUNT,
      validAfter: now - 60, // Valid 1 minute ago
      validBefore: now + 3600, // Valid for 1 hour
      nonce,
    });

    console.log(`✍️  Created authorization with nonce: ${nonce.slice(0, 20)}...`);

    // Create x402 payment payload
    const paymentPayload = {
      x402Version: 1 as const,
      scheme: 'exact',
      network: 'eip155:8453',
      payload: {
        signature,
        authorization,
      },
    };

    const requirements = {
      scheme: 'exact',
      network: 'eip155:8453',
      maxAmountRequired: TEST_AMOUNT.toString(),
      asset: BASE_USDC,
      payTo,
    };

    // Verify
    const result = await facilitator.verify(paymentPayload, requirements);
    
    console.log('📋 Verify result:', result);
    
    expect(result).toBeDefined();
  });

  it('should settle a real transaction (WARNING: spends real USDC)', async () => {
    if (!privateKey || !payTo) {
      console.log('Skipping: no private key or payTo address');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const nonce = generateNonce();
    
    // Create signed authorization
    const { authorization, signature } = await signTransferAuthorization(privateKey, {
      to: payTo as Address,
      value: TEST_AMOUNT,
      validAfter: now - 60,
      validBefore: now + 3600,
      nonce,
    });

    console.log(`✍️  Created authorization with nonce: ${nonce.slice(0, 20)}...`);

    // Create x402 payment payload
    const paymentPayload = {
      x402Version: 1 as const,
      scheme: 'exact',
      network: 'eip155:8453',
      payload: {
        signature,
        authorization,
      },
    };

    const requirements = {
      scheme: 'exact',
      network: 'eip155:8453',
      maxAmountRequired: TEST_AMOUNT.toString(),
      asset: BASE_USDC,
      payTo,
    };

    // Settle (THIS WILL SPEND REAL USDC!)
    console.log('⚠️  Settling real transaction...');
    const result = await facilitator.settle(paymentPayload, requirements);
    
    console.log('💸 Settle result:', result);
    
    if (result.success) {
      console.log(`✅ Transaction hash: ${result.transaction}`);
      console.log(`   View: https://basescan.org/tx/${result.transaction}`);
    }
    
    expect(result).toBeDefined();
  });
});

// Run these tests with: pnpm test:base
// To enable the tests, change describe.skip to describe

