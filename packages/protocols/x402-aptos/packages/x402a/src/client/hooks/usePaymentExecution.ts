import type { WalletContextState } from "@aptos-labs/wallet-adapter-react";
import { generateSecureNonce } from "../encoding";
import { calculateExpiration, getChainId, signTransactionForFeePayer } from "../signature";

export interface PaymentExecutionOptions {
  wallet: WalletContextState;
  recipientAddress: string;
  recipientAmount: bigint;
  platformAddress: string;
  platformFee: bigint;
  totalAmount: bigint;
  network: string;
  paymentType: string;
  resourceId: string;
  description?: string;
  buildEndpoint?: string;
  verifyEndpoint?: string;
}

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  proof?: string;
  error?: string;
}

/**
 * Execute a payment transaction
 * Handles transaction building, signing, and verification
 */
export async function executePaymentTransaction(
  options: PaymentExecutionOptions
): Promise<PaymentResult> {
  const {
    wallet,
    recipientAddress,
    recipientAmount,
    platformAddress,
    platformFee,
    totalAmount,
    network,
    paymentType,
    resourceId,
    description,
    buildEndpoint = "/api/facilitator/build",
    verifyEndpoint = "/api/facilitator/verify",
  } = options;

  if (!wallet.connected || !wallet.account) {
    return { success: false, error: "Wallet not connected" };
  }

  const userAddress = wallet.account.address.toString();
  const nonce = generateSecureNonce();
  const validUntil = calculateExpiration(3600); // 1 hour
  const chainId = getChainId(network);

  // 1. Build transaction from facilitator
  const buildResponse = await fetch(buildEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: userAddress,
      to: [recipientAddress, platformAddress],
      amount: [recipientAmount.toString(), platformFee.toString()],
      nonce,
      validUntil,
      chainId,
    }),
  });

  if (!buildResponse.ok) {
    const buildError = await buildResponse.json();
    return { success: false, error: buildError.error || "Failed to build transaction" };
  }

  const buildData = await buildResponse.json();
  const transactionPayload = buildData.transactionPayload;

  // 2. Sign transaction
  const authResult = await signTransactionForFeePayer(wallet, transactionPayload);

  // 3. Create payment payload
  const paymentPayload = {
    x402Version: 1,
    scheme: "exact",
    network,
    payload: {
      from: userAddress,
      to: [recipientAddress, platformAddress],
      amount: [recipientAmount.toString(), platformFee.toString()],
      nonce,
      authenticator: authResult.authenticator,
      publicKey: authResult.publicKey,
      validUntil,
      chainId,
    },
  };

  const paymentHeader = btoa(JSON.stringify(paymentPayload));

  // 4. Verify/submit payment
  const verifyResponse = await fetch(verifyEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      x402Version: 1,
      paymentHeader,
      paymentRequirements: {
        scheme: "exact",
        network,
        maxAmountRequired: totalAmount.toString(),
        resource: `${paymentType}:${resourceId}`,
        description: description || `${paymentType} payment`,
        payTo: recipientAddress,
        asset: "0x1::aptos_coin::AptosCoin",
      },
    }),
  });

  if (!verifyResponse.ok) {
    const error = await verifyResponse.json();
    return { success: false, error: error.error || "Payment verification failed" };
  }

  const result = await verifyResponse.json();

  if (!result.success) {
    return { success: false, error: result.error || "Payment failed" };
  }

  return {
    success: true,
    txHash: result.txHash || authResult.transactionHash,
    proof: result.proof,
  };
}
