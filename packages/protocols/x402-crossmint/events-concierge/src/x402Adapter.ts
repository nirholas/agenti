/**
 * Adapter to make Crossmint wallets compatible with x402 payment protocol
 * Creates a viem LocalAccount-compatible interface with signature processing
 */

import type { Wallet } from "@crossmint/wallets-sdk";
import { EVMWallet } from "@crossmint/wallets-sdk";
import type { Hex } from "viem";

/**
 * Create an x402-compatible Account from a Crossmint wallet
 * Returns a viem Account-compatible object that x402 can use
 */
export function createX402Signer(wallet: Wallet<any>) {
  const evm = EVMWallet.from(wallet);

  console.log("🔧 Creating x402 account:", {
    walletAddress: wallet.address,
    evmAddress: evm.address,
    addressType: typeof evm.address
  });

  // Create viem Account-compatible object
  // x402 expects an Account with address, type, and signTypedData method
  const account: any = {
    address: evm.address as `0x${string}`,
    type: "local",
    source: "custom",

    // signTypedData method required by x402 for payment signatures
    signTypedData: async (params: any) => {
      console.log("🔐 signTypedData called for address:", evm.address);
      const { domain, message, primaryType, types } = params;

      console.log("🔐 Full EIP-712 payload being signed:");
      console.log("  Domain:", JSON.stringify(domain, null, 2));
      console.log("  Message:", JSON.stringify(message, null, 2));
      console.log("  PrimaryType:", primaryType);
      console.log("  Types:", JSON.stringify(types, null, 2));

      console.log("🔐 Key fields:");
      console.log("  - Payer (from):", evm.address);
      console.log("  - Recipient (to):", message?.to || message?.recipient || message?.payTo || 'MISSING');
      console.log("  - Verifying contract:", domain?.verifyingContract);

      // Sign with Crossmint wallet
      console.log("📝 Calling Crossmint signTypedData...");
      const sig = await evm.signTypedData({
        domain,
        message,
        primaryType,
        types,
        chain: evm.chain as any
      } as any);

      console.log("✅ Signature received from Crossmint");
      console.log("🔍 Signature details:", {
        signatureLength: sig.signature.length,
        signatureStart: sig.signature.substring(0, 66),
        isERC6492: sig.signature.endsWith("6492649264926492649264926492649264926492649264926492649264926492")
      });

      const processed = processSignature(sig.signature as string);
      console.log("📤 Processed signature ready for x402 facilitator");

      return processed;
    }
  };

  console.log("✅ x402 account created with address:", account.address);

  return account;
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

/**
 * Check if a wallet is deployed on-chain
 */
export async function checkWalletDeployment(
  walletAddress: string,
  chain: string
): Promise<boolean> {
  try {
    const { createPublicClient, http } = await import("viem");
    const { baseSepolia } = await import("viem/chains");

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http("https://sepolia.base.org")
    });

    const code = await publicClient.getCode({
      address: walletAddress as `0x${string}`
    });

    // If bytecode exists and is not just "0x", the wallet is deployed
    return code !== undefined && code !== '0x' && code.length > 2;
  } catch (error) {
    console.error('❌ Failed to check wallet deployment:', error);
    return false;
  }
}

/**
 * Deploy a pre-deployed wallet by making a minimal self-transfer
 */
export async function deployWallet(wallet: Wallet<any>): Promise<string> {
  console.log("🚀 Deploying wallet on-chain...");

  try {
    const { EVMWallet } = await import("@crossmint/wallets-sdk");
    const evmWallet = EVMWallet.from(wallet);

    // Deploy wallet with a minimal self-transfer (1 wei)
    const deploymentTx = await evmWallet.sendTransaction({
      to: wallet.address,
      value: 1n, // 1 wei
      data: "0x"
    });

    console.log(`✅ Wallet deployed! Transaction: ${deploymentTx.hash}`);
    return deploymentTx.hash || `deployment_tx_${Date.now()}`;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ Deployment error:", error);

    if (errorMsg.includes('insufficient') || errorMsg.includes('balance')) {
      throw new Error("Insufficient ETH balance for deployment gas fees");
    }

    throw new Error(`Wallet deployment failed: ${errorMsg}`);
  }
}
