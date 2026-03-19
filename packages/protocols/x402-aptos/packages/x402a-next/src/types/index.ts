import type { PaymentRequirements } from "../middleware/protocol";

export interface RouteConfig {
  /** Amount required in octas */
  price: string;
  /** Network to use (defaults to aptos-testnet) */
  network?: "aptos-testnet" | "aptos-mainnet";
  /** Optional description shown to users */
  description?: string;
  /** Optional resource identifier (defaults to the route path) */
  resource?: string;
  /** Optional custom payment requirements (overrides price/network) */
  paymentRequirements?: PaymentRequirements;
}

export interface FacilitatorConfig {
  /** URL of the facilitator service */
  url: string;
  /** Optional authentication headers */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
}

export interface MiddlewareConfig {
  /** Address to receive payments */
  payTo: string;

  /** Route configurations mapping path patterns to payment requirements */
  routes: Record<string, RouteConfig>;

  /** Facilitator configuration (optional, for payment verification) */
  facilitator?: FacilitatorConfig;

  /** Contract address for payment verification (required if facilitator not provided) */
  contractAddress?: string;

  /** Called when payment is required (402 response) */
  onPaymentRequired?: (
    req: Request,
    paymentRequirements: PaymentRequirements
  ) => void | Promise<void>;

  /** Called when payment is verified */
  onPaymentVerified?: (req: Request, payer: string) => void | Promise<void>;

  /** Called when payment settles on-chain */
  onPaymentSettled?: (req: Request, txHash: string) => void | Promise<void>;

  /** Called on payment errors */
  onPaymentError?: (req: Request, error: Error) => void | Promise<void>;

  /** Custom error page HTML or redirect URL */
  errorPage?: string;

  /** Enable detailed logging (default: false) */
  debug?: boolean;
}

export interface PaymentContext {
  /** Address of the payer */
  payer: string;
  /** Transaction hash (if settled) */
  txHash?: string;
  /** Payment amount in octas */
  amount: string;
  /** Network the payment was made on */
  network: string;
  /** Timestamp of payment verification */
  verifiedAt: number;
}

export interface VerificationResult {
  /** Whether payment is valid */
  valid: boolean;
  /** Payer address if valid */
  payer?: string;
  /** Transaction hash if settled */
  txHash?: string;
  /** Error message if invalid */
  error?: string;
}
