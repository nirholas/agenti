import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { readFile } from "fs/promises";
import bs58 from "bs58";
import nacl from "tweetnacl";

/**
 * Configuration options for creating a Crossmint delegated wallet.
 */
export interface DelegatedWalletOptions {
  /** The Crossmint smart wallet address (e.g., "ABC123...") */
  smartWalletAddress: string;

  /** Base58-encoded private key (32 or 64 bytes) for signing approvals, OR path to keypair JSON file */
  externalPrivateKey: string;

  /** Crossmint API key for authentication */
  apiKey: string;

  /** Crossmint environment: "staging" or "production" */
  environment: "staging" | "production";

  /** Optional polling configuration for transaction status */
  polling?: {
    /** Maximum number of polling attempts (default: 30) */
    maxAttempts?: number;
    /** Delay in milliseconds between polling attempts (default: 1000) */
    delayMs?: number;
  };
}

/**
 * Wallet adapter compatible with @faremeter/payment-solana payment handlers.
 */
export interface DelegatedWallet {
  network: string;
  publicKey: PublicKey;
  sendTransaction: (tx: VersionedTransaction) => Promise<string>;
}

/**
 * Error codes for delegated wallet operations.
 */
export enum DelegatedWalletErrorCode {
  INVALID_CONFIGURATION = "INVALID_CONFIGURATION",
  INVALID_PRIVATE_KEY = "INVALID_PRIVATE_KEY",
  API_ERROR = "API_ERROR",
  NO_PENDING_APPROVAL = "NO_PENDING_APPROVAL",
  TRANSACTION_FAILED = "TRANSACTION_FAILED",
  TRANSACTION_TIMEOUT = "TRANSACTION_TIMEOUT",
  MISSING_TX_HASH = "MISSING_TX_HASH",
}

/**
 * Custom error class for delegated wallet operations.
 */
export class DelegatedWalletError extends Error {
  constructor(
    message: string,
    public code: DelegatedWalletErrorCode,
    public cause?: Error
  ) {
    super(message);
    this.name = "DelegatedWalletError";
  }
}

/**
 * Custom error class for Crossmint API errors.
 */
export class CrossmintApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = "CrossmintApiError";
  }
}

/**
 * API response types for Crossmint transactions.
 */
interface CreateTransactionResponse {
  id: string;
  status: string;
  approvals?: {
    pending?: Array<{
      message: string;
      signer: {
        address?: string;
        locator?: string;
      };
    }>;
  };
}

interface TransactionResponse {
  id: string;
  status: string;
  onChain?: {
    txId?: string;
  };
  fee?: string | number;
}

/**
 * Creates a wallet adapter using Crossmint's delegated signing flow.
 *
 * This adapter gives you cryptographic control over transaction approvals
 * while leveraging Crossmint's smart wallet infrastructure.
 *
 * @param options - Configuration for the delegated wallet
 * @returns Wallet adapter compatible with @faremeter/payment-solana
 *
 * @throws {DelegatedWalletError} If configuration is invalid or private key cannot be decoded
 *
 * @example
 * ```typescript
 * const wallet = await createCrossmintDelegatedWallet({
 *   smartWalletAddress: "ABC123...",
 *   externalPrivateKey: "base58_encoded_key",
 *   apiKey: "cm_api_key_...",
 *   environment: "staging"
 * });
 *
 * // Use with payment handler
 * const handler = createPaymentHandler(wallet, mint, connection);
 * ```
 */
export async function createCrossmintDelegatedWallet(
  options: DelegatedWalletOptions
): Promise<DelegatedWallet> {
  const {
    smartWalletAddress,
    externalPrivateKey,
    apiKey,
    environment,
    polling = {},
  } = options;

  // Validate configuration
  if (!smartWalletAddress) {
    throw new DelegatedWalletError(
      "Missing smartWalletAddress in configuration",
      DelegatedWalletErrorCode.INVALID_CONFIGURATION
    );
  }

  if (!externalPrivateKey) {
    throw new DelegatedWalletError(
      "Missing externalPrivateKey in configuration",
      DelegatedWalletErrorCode.INVALID_CONFIGURATION
    );
  }

  if (!apiKey) {
    throw new DelegatedWalletError(
      "Missing apiKey in configuration",
      DelegatedWalletErrorCode.INVALID_CONFIGURATION
    );
  }

  if (environment !== "staging" && environment !== "production") {
    throw new DelegatedWalletError(
      `Invalid environment: "${environment}". Must be "staging" or "production"`,
      DelegatedWalletErrorCode.INVALID_CONFIGURATION
    );
  }

  // Load and decode private key (supports both file path and base58 string)
  let secretKey: Uint8Array;
  try {
    secretKey = await loadPrivateKey(externalPrivateKey);
  } catch (error) {
    throw new DelegatedWalletError(
      `Failed to load private key: ${error instanceof Error ? error.message : String(error)}`,
      DelegatedWalletErrorCode.INVALID_PRIVATE_KEY,
      error instanceof Error ? error : undefined
    );
  }

  // Derive public key for signer address
  const signerAddress = derivePublicKey(secretKey);

  // Setup configuration
  const network = environment === "production" ? "mainnet-beta" : "devnet";
  const baseUrl = getBaseUrl(environment);
  const publicKey = new PublicKey(smartWalletAddress);
  const maxAttempts = polling.maxAttempts ?? 30;
  const delayMs = polling.delayMs ?? 1000;

  console.log(`Crossmint Delegated Wallet initialized:`);
  console.log(`  Smart Wallet: ${smartWalletAddress}`);
  console.log(`  External Signer: ${signerAddress}`);
  console.log(`  Environment: ${environment} (${network})`);

  return {
    network,
    publicKey,
    sendTransaction: async (tx: VersionedTransaction): Promise<string> => {
      try {
        // Step 1: Serialize and submit transaction
        const serialized = bs58.encode(tx.serialize());

        console.log(`\nSubmitting transaction to Crossmint...`);
        const createResponse = (await crossmintApi(
          baseUrl,
          apiKey,
          `wallets/${encodeURIComponent(smartWalletAddress)}/transactions`,
          {
            params: {
              transaction: serialized,
              signer: {
                type: "external-wallet",
                locator: `external-wallet:${signerAddress}`,
              },
            },
          },
          "POST"
        )) as CreateTransactionResponse;

        const transactionId = createResponse.id;
        const pendingApproval = createResponse.approvals?.pending?.[0];

        if (!transactionId || !pendingApproval) {
          console.error("\nCrossmint API Response:", JSON.stringify(createResponse, null, 2));
          throw new DelegatedWalletError(
            "Crossmint did not return a pending approval.\n\n" +
              "This means your wallet is not configured for delegated signing.\n" +
              "To fix this:\n" +
              "1. Go to https://staging.crossmint.com/console\n" +
              "2. Find your wallet: " + smartWalletAddress + "\n" +
              "3. Add external signer: " + signerAddress + "\n" +
              "4. Enable delegated signing mode\n\n" +
              "See the API response above for details.",
            DelegatedWalletErrorCode.NO_PENDING_APPROVAL
          );
        }

        console.log(`Transaction created: ${transactionId}`);
        console.log(`Pending approval required from: ${pendingApproval.signer?.address || pendingApproval.signer?.locator || "external signer"}`);

        // Step 2: Sign approval message
        const messageToSign = pendingApproval.message;
        const pendingSigner =
          pendingApproval.signer?.address ??
          pendingApproval.signer?.locator?.split(":")[1] ??
          signerAddress;

        const signature = signMessage(messageToSign, secretKey);
        console.log(`Approval message signed`);

        // Step 3: Submit approval signature
        const approvalResponse = (await crossmintApi(
          baseUrl,
          apiKey,
          `wallets/${encodeURIComponent(smartWalletAddress)}/transactions/${encodeURIComponent(transactionId)}/approvals`,
          {
            approvals: [
              {
                signer: `external-wallet:${pendingSigner}`,
                signature,
              },
            ],
          },
          "POST"
        )) as TransactionResponse;

        console.log(`Approval submitted, polling for completion...`);

        // Step 4: Poll for transaction completion
        let status = approvalResponse.status;
        let attempts = 0;

        while (status === "pending" && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          attempts++;

          const statusResponse = (await crossmintApi(
            baseUrl,
            apiKey,
            `wallets/${encodeURIComponent(smartWalletAddress)}/transactions/${encodeURIComponent(transactionId)}`,
            {},
            "GET"
          )) as TransactionResponse;

          status = statusResponse.status;

          if (status === "success" || status === "failed") {
            break;
          }

          if (attempts % 5 === 0) {
            console.log(`  Still pending... (${attempts}/${maxAttempts})`);
          }
        }

        // Step 5: Check final status
        if (status === "pending") {
          throw new DelegatedWalletError(
            `Transaction polling timed out after ${attempts} attempts (${(attempts * delayMs) / 1000}s). ` +
              `Check transaction ${transactionId} in Crossmint dashboard.`,
            DelegatedWalletErrorCode.TRANSACTION_TIMEOUT
          );
        }

        if (status !== "success") {
          throw new DelegatedWalletError(
            `Transaction failed with status: ${status}. Transaction ID: ${transactionId}`,
            DelegatedWalletErrorCode.TRANSACTION_FAILED
          );
        }

        // Step 6: Extract on-chain transaction hash
        const finalResponse = (await crossmintApi(
          baseUrl,
          apiKey,
          `wallets/${encodeURIComponent(smartWalletAddress)}/transactions/${encodeURIComponent(transactionId)}`,
          {},
          "GET"
        )) as TransactionResponse;

        const solanaTxHash = finalResponse.onChain?.txId;

        if (!solanaTxHash) {
          throw new DelegatedWalletError(
            `No on-chain transaction hash found in completed transaction. Transaction ID: ${transactionId}`,
            DelegatedWalletErrorCode.MISSING_TX_HASH
          );
        }

        // Log fee information if available
        const fee = finalResponse.fee;
        if (fee !== undefined) {
          const feeInLamports = typeof fee === "string" ? parseInt(fee, 10) : fee;
          const feeInSOL = feeInLamports / 1_000_000_000;
          console.log(
            `Transaction completed: ${solanaTxHash}`
          );
          console.log(
            `Fee: ${feeInLamports} lamports (${feeInSOL.toFixed(9)} SOL)`
          );
        } else {
          console.log(`Transaction completed: ${solanaTxHash}`);
        }

        return solanaTxHash;
      } catch (error) {
        if (error instanceof DelegatedWalletError || error instanceof CrossmintApiError) {
          throw error;
        }
        throw new DelegatedWalletError(
          `Unexpected error during transaction: ${error instanceof Error ? error.message : String(error)}`,
          DelegatedWalletErrorCode.API_ERROR,
          error instanceof Error ? error : undefined
        );
      }
    },
  };
}

/**
 * Loads a private key from either a file path or base58-encoded string.
 *
 * @param keyOrPath - Either a base58-encoded private key or a path to a keypair JSON file
 * @returns 64-byte secret key
 * @throws {Error} If key cannot be loaded or is invalid
 */
async function loadPrivateKey(keyOrPath: string): Promise<Uint8Array> {
  // Try to load as file first
  if (keyOrPath.includes("/") || keyOrPath.includes("\\") || keyOrPath.endsWith(".json")) {
    try {
      const keypairData = await readFile(keyOrPath, "utf-8");
      const secretKey = Uint8Array.from(JSON.parse(keypairData));

      if (secretKey.length === 64) {
        return secretKey;
      }

      if (secretKey.length === 32) {
        return nacl.sign.keyPair.fromSeed(secretKey).secretKey;
      }

      throw new Error(
        `Invalid keypair file. Expected 32 or 64 bytes, received ${secretKey.length}`
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("no such file")) {
        throw new Error(`Keypair file not found: ${keyOrPath}`);
      }
      throw error;
    }
  }

  // Otherwise treat as base58-encoded key
  return decodePrivateKey(keyOrPath);
}

/**
 * Decodes a base58-encoded private key.
 *
 * Supports both 32-byte seeds (which are expanded to 64-byte keypairs)
 * and 64-byte full keypairs.
 *
 * @param key - Base58-encoded private key
 * @returns 64-byte secret key
 * @throws {Error} If key length is invalid
 */
function decodePrivateKey(key: string): Uint8Array {
  const decoded = bs58.decode(key);

  if (decoded.length === 64) {
    return decoded;
  }

  if (decoded.length === 32) {
    return nacl.sign.keyPair.fromSeed(decoded).secretKey;
  }

  throw new Error(
    `Invalid Solana private key length. Expected 32 or 64 bytes, received ${decoded.length}`
  );
}

/**
 * Derives the public key address from a secret key.
 *
 * @param secretKey - 32 or 64 byte secret key
 * @returns Base58-encoded public key
 */
function derivePublicKey(secretKey: Uint8Array): string {
  const publicKey =
    secretKey.length === 64
      ? secretKey.slice(32)
      : nacl.sign.keyPair.fromSeed(secretKey).publicKey;

  return bs58.encode(publicKey);
}

/**
 * Signs a message using Ed25519 signature scheme.
 *
 * The message is first attempted to be decoded as base58. If that fails,
 * it's treated as a UTF-8 string. This handles both binary and text messages.
 *
 * @param message - The message to sign (base58-encoded or UTF-8 string)
 * @param secretKey - 64-byte Ed25519 secret key
 * @returns Base58-encoded signature (64 bytes)
 */
function signMessage(message: string, secretKey: Uint8Array): string {
  let messageBytes: Uint8Array;

  try {
    messageBytes = bs58.decode(message);
  } catch {
    messageBytes = new TextEncoder().encode(message);
  }

  const signature = nacl.sign.detached(messageBytes, secretKey);
  return bs58.encode(signature);
}

/**
 * Gets the Crossmint API base URL for an environment.
 *
 * @param environment - "staging" or "production"
 * @returns Base URL for Crossmint API
 */
function getBaseUrl(environment: "staging" | "production"): string {
  return environment === "production"
    ? "https://www.crossmint.com/api"
    : "https://staging.crossmint.com/api";
}

/**
 * Makes an API call to the Crossmint API.
 *
 * @param baseUrl - Base URL for the API
 * @param apiKey - API key for authentication
 * @param endpoint - API endpoint (without leading slash)
 * @param body - Request body (for POST requests)
 * @param method - HTTP method
 * @returns Parsed JSON response
 * @throws {CrossmintApiError} If the API returns an error
 */
async function crossmintApi(
  baseUrl: string,
  apiKey: string,
  endpoint: string,
  body: unknown,
  method: "GET" | "POST" = "POST"
): Promise<unknown> {
  const url = `${baseUrl}/2025-06-09/${endpoint}`;
  const fetchOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
  };

  if (method === "POST" && body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  const text = await response.text();
  let json: unknown = undefined;

  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // Keep raw text for error reporting
    }
  }

  if (!response.ok) {
    throw new CrossmintApiError(
      `Crossmint API error ${response.status} ${response.statusText}: ${text}`,
      response.status,
      json
    );
  }

  if (json === undefined) {
    throw new CrossmintApiError(
      "Crossmint API returned non-JSON response",
      response.status,
      text
    );
  }

  return json;
}
