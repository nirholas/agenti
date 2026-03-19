export interface PaymentRequirements {
  /** Scheme of the payment protocol to use */
  scheme: string;
  /** Network of the blockchain (e.g., "aptos-testnet", "aptos-mainnet") */
  network: string;
  /** Maximum amount required in atomic units (octas for Aptos) */
  maxAmountRequired: string;
  /** URL of resource to pay for */
  resource: string;
  /** Description of the resource */
  description: string;
  /** MIME type of the resource response */
  mimeType?: string;
  /** Output schema of the resource response */
  outputSchema?: object | null;
  /** Address to pay value to */
  payTo: string;
  /** Maximum time in seconds for the resource server to respond */
  maxTimeoutSeconds?: number;
  /** Address of the asset/coin contract */
  asset: string;
  /** Extra information about the payment details specific to the scheme */
  extra?: object | null;
}

export interface PaymentRequiredResponse {
  /** Version of the x402 payment protocol */
  x402Version: number;
  /** List of payment requirements that the resource server accepts */
  accepts: PaymentRequirements[];
  /** Message from the resource server to communicate errors */
  error?: string;
}

export interface PaymentPayload {
  /** Version of the x402 payment protocol */
  x402Version: number;
  /** Scheme from accepted paymentRequirements */
  scheme: string;
  /** Network from accepted paymentRequirements */
  network: string;
  /** Scheme-specific payment payload */
  payload: AptosPaymentPayloadData;
}

export interface AptosPaymentPayloadData {
  /** Sender address authorizing the transfer */
  from: string;
  /** Recipient address(es) */
  to: string | string[];
  /** Amount(s) in octas */
  amount: string | string[];
  /** Unique nonce for replay protection */
  nonce: string;
  /** Transaction authenticator (fee payer protocol) */
  authenticator: string;
  /** User's public key (optional - included for convenience but authenticator is sufficient) */
  publicKey?: string;
  /** Unix timestamp when authorization expires */
  validUntil: number;
  /** Chain ID for replay protection (1=mainnet, 2=testnet, 3=devnet) */
  chainId: number;
}

export interface VerifyPaymentRequest {
  /** x402 protocol version */
  x402Version: number;
  /** Base64 encoded payment header */
  paymentHeader: string;
  /** Payment requirements from 402 response */
  paymentRequirements: PaymentRequirements;
}

export interface VerifyPaymentResponse {
  /** Whether the payment is valid */
  isValid: boolean;
  /** Reason for invalidity if isValid is false */
  invalidReason: string | null;
}

export interface SettlePaymentRequest {
  /** x402 protocol version */
  x402Version: number;
  /** Base64 encoded payment header */
  paymentHeader: string;
  /** Payment requirements from 402 response */
  paymentRequirements: PaymentRequirements;
}

export interface SettlePaymentResponse {
  /** Whether the payment was successful */
  success: boolean;
  /** Error message if success is false */
  error: string | null;
  /** Transaction hash of the settled payment */
  txHash: string | null;
  /** Network id of the blockchain */
  networkId: string | null;
  /** Address of the payer */
  payer: string;
  /** JWT proof for client (optional, only on success) */
  proof?: string;
}

export interface SupportedKind {
  /** x402 protocol version */
  x402Version: number;
  /** Payment scheme (e.g., "exact") */
  scheme: string;
  /** Network identifier (e.g., "aptos-testnet", "aptos-mainnet") */
  network: string;
}

export interface SupportedPaymentsResponse {
  kinds: SupportedKind[];
}

export interface PaymentProof {
  /** Unique identifier */
  id: string;
  /** Transaction hash on blockchain */
  txHash: string;
  /** Resource that was paid for (e.g., blob name, track ID) */
  blobName?: string;
  /** Resource URL */
  resourceUrl: string;
  /** User address that paid */
  userAddress: string;
  /** Amount paid in atomic units */
  amountPaid: string;
  /** JWT signature of the proof */
  proofSignature: string;
  /** When the proof expires */
  expiresAt: Date;
  /** When the proof was created */
  createdAt: Date;
}

export interface PaymentProofJWT {
  /** Transaction hash */
  txHash: string;
  /** Resource identifier */
  resource: string;
  /** User address */
  user: string;
  /** Amount paid */
  amount: string;
  /** Issued at timestamp */
  iat: number;
  /** Expiration timestamp */
  exp: number;
}

export interface X402RequestOptions extends RequestInit {
  /** Cached payment proof to include in request */
  paymentProof?: string;
  /** Callback when 402 response is received */
  onPaymentRequired?: (response: PaymentRequiredResponse) => Promise<void>;
  /** Whether to automatically trigger payment flow */
  autoPayment?: boolean;
}

export interface X402RequestResult {
  /** The response from the server */
  response: Response;
  /** Payment proof if payment was made */
  paymentProof?: string;
  /** Whether payment was required */
  paymentWasRequired: boolean;
}

export interface MultiRecipientPayment {
  /** Recipient addresses [artist, platform] */
  recipients: string[];
  /** Amounts in octas [artistAmount, platformFee] */
  amounts: string[];
  /** Total amount */
  totalAmount: string;
}

export interface AptosTransferMessage {
  from: string;
  to: string | string[];
  amount: string | string[];
  nonce: string;
}

/** Chain IDs for Aptos networks */
export enum AptosChainId {
  MAINNET = 1,
  TESTNET = 2,
  DEVNET = 3,
}

/** Transaction payload for client to sign */
export interface TransactionPayloadForSigning {
  /** Serialized transaction (base64 or hex) */
  transaction: string;
  /** Sender address */
  sender: string;
  /** Contract function being called */
  function: string;
  /** Function arguments */
  functionArguments: unknown[];
  /** Expiration timestamp */
  validUntil: number;
  /** Chain ID */
  chainId: number;
  /** Nonce for replay protection */
  nonce: string;
}

/** Fee payer payment requirements (extended from PaymentRequirements) */
export interface FeePayerPaymentRequirements extends PaymentRequirements {
  /** Transaction payload for client to sign */
  transactionPayload: TransactionPayloadForSigning;
  /** Contract address */
  contractAddress: string;
}

/** Transaction authenticator result from client signing */
export interface TransactionAuthenticatorResult {
  /** Serialized account authenticator */
  authenticator: string;
  /** User's public key */
  publicKey: string;
  /** User's address */
  address: string;
  /** The transaction that was signed */
  transactionHash: string;
}

/** Options for building a sponsored transaction */
export interface BuildSponsoredTransactionOptions {
  /** User address (sender) */
  from: string;
  /** Recipient address(es) */
  to: string | string[];
  /** Amount(s) in octas */
  amount: string | string[];
  /** Unique nonce */
  nonce: string;
  /** Expiration timestamp (seconds) */
  validUntil: number;
  /** Chain ID */
  chainId: AptosChainId;
  /** Contract address */
  contractAddress: string;
}
