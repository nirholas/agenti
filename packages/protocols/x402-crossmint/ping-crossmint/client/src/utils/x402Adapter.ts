/**
 * Utility to adapt Crossmint wallets for x402 payment protocol
 */

import type { Wallet } from "@crossmint/wallets-sdk";
import { EVMWallet } from "@crossmint/wallets-sdk";
import type { Signer, MultiNetworkSigner } from "x402/types";
import type { Hex } from 'viem';

/**
 * Convert a Crossmint wallet to an x402-compatible signer
 * Handles ERC-6492 and EIP-1271 signature formats
 */
export function createX402Signer(wallet: Wallet<any>): Signer | MultiNetworkSigner {
  const evm = EVMWallet.from(wallet);

  // Create x402-compatible signer with required interface
  const signer: any = {
    account: { address: evm.address },
    chain: { id: 84532 },
    transport: {},

    async signTypedData(params: any) {
      const { domain, message, primaryType, types } = params;

      console.log("🔐 Signing x402 payment data:", {
        walletAddress: evm.address,
        primaryType
      });

      // Sign with Crossmint wallet
      const sig = await evm.signTypedData({
        domain,
        message,
        primaryType,
        types,
        chain: evm.chain as any
      } as any);

      return processSignature(sig.signature as string);
    }
  };

  return signer as Signer;
}

/**
 * Process and normalize signature formats for x402 compatibility
 */
function processSignature(rawSignature: string): `0x${string}` {
  const signature = ensureHexPrefix(rawSignature);

  console.log(`📝 Processing signature: ${signature.substring(0, 20)}... (${signature.length} chars)`);

  // Handle ERC-6492 wrapped signatures (for pre-deployed wallets)
  if (isERC6492Signature(signature)) {
    console.log("✅ ERC-6492 signature detected - keeping for facilitator");
    return signature;
  }

  // Handle EIP-1271 signatures (for deployed smart contract wallets)
  if (signature.length === 174) {
    console.log("✅ EIP-1271 signature detected");
    return signature;
  }

  // Handle standard ECDSA signatures (65 bytes / 132 hex chars)
  if (signature.length === 132) {
    console.log("✅ Standard ECDSA signature");
    return signature;
  }

  // Handle non-standard lengths - try to extract standard signature
  if (signature.length > 132) {
    const extracted = '0x' + signature.slice(-130);
    console.log(`🔧 Extracted standard signature from longer format`);
    return extracted as `0x${string}`;
  }

  console.log("⚠️ Using signature as-is");
  return signature;
}

/**
 * Ensure signature has 0x prefix
 */
function ensureHexPrefix(signature: string): `0x${string}` {
  return (signature.startsWith('0x') ? signature : `0x${signature}`) as `0x${string}`;
}

/**
 * Check if signature is ERC-6492 wrapped
 */
function isERC6492Signature(signature: string): boolean {
  return signature.endsWith("6492649264926492649264926492649264926492649264926492649264926492");
}