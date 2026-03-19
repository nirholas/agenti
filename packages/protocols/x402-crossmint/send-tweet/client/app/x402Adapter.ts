/**
 * Utility to adapt Crossmint wallets for x402 payment protocol
 * Based on ping-crossmint implementation
 */

import { EVMWallet, type Wallet } from "@crossmint/wallets-sdk";
import type { Signer } from "x402/types";

/**
 * Convert a Crossmint wallet to an x402-compatible signer
 * Handles ERC-6492 and EIP-1271 signature formats
 */
export function createX402Signer(wallet: Wallet<any>): Signer {
  const evm = EVMWallet.from(wallet);

  const signer: any = {
    account: { address: evm.address },
    chain: { id: 84532 }, // Base Sepolia
    transport: {},

    async signTypedData(params: any) {
      const { domain, message, primaryType, types } = params;

      console.log("🔐 Signing x402 payment data:", {
        walletAddress: evm.address,
        primaryType,
        domain,
        message
      });

      // Sign with Crossmint wallet
      const sig = await evm.signTypedData({
        domain,
        message,
        primaryType,
        types,
        chain: evm.chain as any
      } as any);

      console.log("📝 Raw signature from Crossmint:", {
        signature: sig.signature,
        length: sig.signature?.length,
        prefix: sig.signature?.substring(0, 20)
      });

      const processedSig = processSignature(sig.signature as string);

      console.log("✅ Processed signature for x402:", {
        signature: processedSig,
        length: processedSig.length,
        prefix: processedSig.substring(0, 20),
        isERC6492: isERC6492Signature(processedSig),
        isEIP1271: processedSig.length === 174
      });

      return processedSig;
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
    console.log(`   Length: ${signature.length} chars`);
    console.log(`   Suffix: ...${signature.substring(signature.length - 70)}`);
    return signature;
  }

  // Handle EIP-1271 signatures (for deployed smart contract wallets)
  if (signature.length === 174) {
    console.log("✅ EIP-1271 signature detected");
    return signature;
  }

  // Handle standard ECDSA signatures (65 bytes / 132 hex chars)
  if (signature.length === 132) {
    console.log("✅ Standard ECDSA signature (65 bytes)");
    return signature;
  }

  // Handle non-standard lengths - extract standard signature
  if (signature.length > 132) {
    console.log(`⚠️ Non-standard signature length: ${signature.length} chars`);
    console.log(`   Full signature: ${signature}`);

    const extracted = '0x' + signature.slice(-130);
    console.log(`🔧 Extracted standard signature from longer format: ${extracted.substring(0, 20)}...`);
    return extracted as `0x${string}`;
  }

  console.log(`⚠️ Unusual signature length (${signature.length}), using as-is`);
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
