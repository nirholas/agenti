import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState } from "react";
import { initializeRegistry } from "./useRegistryInit";
import { calculatePaymentAmounts } from "./usePaymentCalculation";
import { executePaymentTransaction } from "./usePaymentExecution";

declare global {
  interface Window {
    X402_CONTRACT_ADDRESS?: string;
    X402_PLATFORM_ADDRESS?: string;
    X402_FACILITATOR_ADDRESS?: string;
  }
}

const DEFAULT_PLATFORM_FEE_PERCENTAGE = 0.015; // 1.5%

export type PaymentType = "stream" | "tip" | "comment" | "purchase";

export interface X402PaymentParams {
  /** Amount in APT (e.g., 0.01 for comments, 1.5 for tips) */
  amount: number;
  /** Primary recipient address (artist, creator) */
  recipientAddress: string;
  /** Payment type for tracking */
  paymentType: PaymentType;
  /** Resource identifier (track blob, comment ID, etc.) */
  resourceId: string;
  /** Optional description */
  description?: string;
}

export interface X402PaymentConfig {
  /** API endpoint for building transactions (default: /api/facilitator/build) */
  buildEndpoint?: string;
  /** API endpoint for verifying payments (default: /api/facilitator/verify) */
  verifyEndpoint?: string;
  /** API endpoint for initialization (default: /api/facilitator/init) */
  initEndpoint?: string;
  /** Platform fee percentage (default: 0.015 = 1.5%) */
  platformFeePercentage?: number;
  /** Platform fee recipient address (overrides env var) */
  platformAddress?: string;
  /** Contract address (overrides env var) */
  contractAddress?: string;
  /** Network (default: aptos-testnet) */
  network?: string;
  /** Toast notification function */
  toast?: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
}

export interface UseX402PaymentResult {
  executePayment: (params: X402PaymentParams) => Promise<string | null>;

  /** Whether payment is currently processing */
  isProcessing: boolean;

  /** Current payment status */
  paymentStatus: "idle" | "signing" | "settling" | "success" | "error";

  /** Transaction hash (available after settlement) */
  txHash: string | null;
}

export function useX402Payment(config: X402PaymentConfig = {}): UseX402PaymentResult {
  const wallet = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "signing" | "settling" | "success" | "error"
  >("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

  const {
    buildEndpoint = "/api/facilitator/build",
    verifyEndpoint = "/api/facilitator/verify",
    initEndpoint = "/api/facilitator/init",
    platformFeePercentage = DEFAULT_PLATFORM_FEE_PERCENTAGE,
    platformAddress,
    contractAddress,
    network = "aptos-testnet",
    toast,
  } = config;

  const executePayment = async (params: X402PaymentParams): Promise<string | null> => {
    const { amount, recipientAddress, paymentType, resourceId, description } = params;

    if (!wallet.connected || !wallet.account) {
      toast?.error("Please connect your wallet");
      return null;
    }

    if (amount <= 0) {
      toast?.error("Invalid payment amount");
      return null;
    }

    setIsProcessing(true);
    setPaymentStatus("signing");
    setTxHash(null);

    try {
      // 1. Initialize registry if needed
      await initializeRegistry(wallet, {
        initEndpoint,
        contractAddress,
        toast,
      });

      // 2. Calculate payment amounts
      const amounts = calculatePaymentAmounts({
        amount,
        recipientAddress,
        platformFeePercentage,
        platformAddress,
      });

      setPaymentStatus("settling");

      // 3. Execute payment transaction
      const result = await executePaymentTransaction({
        wallet,
        recipientAddress,
        recipientAmount: amounts.recipientAmount,
        platformAddress: amounts.platformAddress,
        platformFee: amounts.platformFee,
        totalAmount: amounts.totalOctas,
        network,
        paymentType,
        resourceId,
        description,
        buildEndpoint,
        verifyEndpoint,
      });

      if (!result.success) {
        throw new Error(result.error || "Payment failed");
      }

      setPaymentStatus("success");
      setTxHash(result.txHash || null);

      const feePercentDisplay = (platformFeePercentage * 100).toFixed(1);
      toast?.success(`Payment confirmed! (${feePercentDisplay}% platform fee)`);

      return result.proof || result.txHash || null;
    } catch (error) {
      console.error("[useX402Payment] Payment failed:", error);
      setPaymentStatus("error");

      const errorMessage = error instanceof Error ? error.message : "Payment failed";
      toast?.error(errorMessage);

      return null;
    } finally {
      setIsProcessing(false);

      setTimeout(() => {
        setPaymentStatus("idle");
        setTxHash(null);
      }, 5000);
    }
  };

  return {
    executePayment,
    isProcessing,
    paymentStatus,
    txHash,
  };
}
