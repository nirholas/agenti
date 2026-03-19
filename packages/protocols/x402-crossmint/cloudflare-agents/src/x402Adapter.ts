/**
 * Adapter to make Crossmint wallets compatible with x402 payment protocol
 * Creates a viem LocalAccount-compatible interface with signature processing
 */

import type { Wallet } from "@crossmint/wallets-sdk";
import { EVMWallet } from "@crossmint/wallets-sdk";
import type { LocalAccount, Hex } from "viem";

/**
 * Create an x402-compatible signer from a Crossmint wallet
 * Returns a viem LocalAccount-compatible object
 */
export function createX402Signer(wallet: Wallet<any>) {
  const evm = EVMWallet.from(wallet);

  // Create x402-compatible signer with viem wallet client structure
  // Must have account, chain, and transport properties for x402 to recognize it as SignerWallet
  const signer: any = {
    account: {
      address: evm.address,
      type: "local",
      source: "custom"
    },
    chain: {
      id: 84532, // Base Sepolia chain ID
      name: "Base Sepolia",
      network: "base-sepolia",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: {
        default: { http: ["https://base-sepolia.g.alchemy.com/v2/m8uZ16oNz2KOgSqu-9Pv6E1fkc69n8Xf"] },
        public: { http: ["https://base-sepolia.g.alchemy.com/v2/m8uZ16oNz2KOgSqu-9Pv6E1fkc69n8Xf"] }
      }
    },
    transport: {
      type: "http",
      url: "https://sepolia.base.org"
    },

    async signTypedData(params: any) {
      const { domain, message, primaryType, types } = params;

      console.log("🔐 Signing x402 payment:", {
        from: evm.address,
        to: domain.verifyingContract,
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

      console.log("🔍 Raw signature from Crossmint:", {
        signatureLength: sig.signature.length,
        signatureStart: sig.signature.substring(0, 66)
      });

      return processSignature(sig.signature as string);
    }
  };

  return signer;
}

/**
 * Process and normalize signature formats for x402 compatibility
 * Handles ERC-6492 (pre-deployed), EIP-1271 (deployed), and standard ECDSA signatures
 */
function processSignature(rawSignature: string): Hex {
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
    return extracted as Hex;
  }

  console.log("⚠️ Using signature as-is");
  return signature;
}

/**
 * Ensure signature has 0x prefix
 */
function ensureHexPrefix(signature: string): Hex {
  return (signature.startsWith('0x') ? signature : `0x${signature}`) as Hex;
}

/**
 * Check if signature is ERC-6492 wrapped
 * ERC-6492 signatures end with the magic bytes
 */
function isERC6492Signature(signature: string): boolean {
  return signature.endsWith("6492649264926492649264926492649264926492649264926492649264926492");
}
