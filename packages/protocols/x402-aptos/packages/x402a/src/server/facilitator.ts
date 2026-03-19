import {
  Account,
  AccountAddress,
  AccountAuthenticator,
  Aptos,
  Deserializer,
  Ed25519PrivateKey,
  SimpleTransaction,
} from "@aptos-labs/ts-sdk";
import type {
  AptosChainId,
  AptosPaymentPayloadData,
  BuildSponsoredTransactionOptions,
  PaymentPayload,
  SupportedKind,
  SupportedPaymentsResponse,
  TransactionPayloadForSigning,
} from "../types";
import { SUPPORTED_NETWORKS, SUPPORTED_SCHEMES, X402_VERSION } from "../types";
import { hexToBytes } from "../client/encoding";
import { getAptosConfig } from "../utils/aptos";
import { createLogger } from "../utils/logger";

export interface FacilitatorConfig {
  privateKey: string;
  contractAddress: string;
  network: string;
}

export interface SubmitPaymentOptions {
  from: string;
  to: string | string[];
  amount: string | string[];
  nonce: string;
  authenticator: string;
  validUntil: number;
  chainId: number;
  transactionHex?: string; // Optional: the transaction hex from buildTransactionForClient
}

export interface SubmitPaymentResult {
  txHash: string;
  success: boolean;
  error?: string;
}

export class X402Facilitator {
  private account: Account;
  private aptos: Aptos;
  private contractAddress: string;
  private logger: ReturnType<typeof createLogger>;

  constructor(config: FacilitatorConfig) {
    const privateKey = new Ed25519PrivateKey(config.privateKey);
    this.account = Account.fromPrivateKey({ privateKey });

    const aptosConfig = getAptosConfig(config.network);
    this.aptos = new Aptos(aptosConfig);

    this.contractAddress = config.contractAddress;

    this.logger = createLogger({
      component: "X402Facilitator",
      facilitatorAddress: this.account.accountAddress.toString(),
      contractAddress: config.contractAddress,
      network: config.network,
    });

    this.logger.info("Facilitator initialized");
  }

  async submitPayment(options: SubmitPaymentOptions): Promise<SubmitPaymentResult> {
    const { from, to, amount, nonce, authenticator, validUntil, chainId, transactionHex } = options;
    const isMultiRecipient = Array.isArray(to);

    this.logger.info(
      {
        from,
        to,
        amount,
        nonce,
        validUntil,
        chainId,
        isMultiRecipient,
      },
      "Submitting sponsored payment"
    );

    try {
      let transaction: SimpleTransaction;

      // If transactionHex is provided, use it (client already has this from build endpoint)
      // Otherwise, rebuild the transaction (backwards compatibility)
      if (transactionHex) {
        this.logger.debug("Using provided transaction hex");
        const transactionBytes = Buffer.from(transactionHex.replace("0x", ""), "hex");
        const deserializer = new Deserializer(new Uint8Array(transactionBytes));
        transaction = SimpleTransaction.deserialize(deserializer);
      } else {
        this.logger.debug("Rebuilding transaction (transactionHex not provided)");
        // Build transaction for this payment
        const transactionPayload = await this.buildTransactionForClient({
          from,
          to,
          amount,
          nonce,
          validUntil,
          chainId: chainId as AptosChainId,
          contractAddress: this.contractAddress,
        });

        const transactionBytes = Buffer.from(
          transactionPayload.transaction.replace("0x", ""),
          "hex"
        );
        const deserializer = new Deserializer(new Uint8Array(transactionBytes));
        transaction = SimpleTransaction.deserialize(deserializer);
      }

      // Submit with user's authenticator and facilitator as fee payer
      return await this.submitSponsoredPayment(authenticator, transaction);
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          from,
          to,
          amount,
          nonce,
        },
        "Payment submission failed"
      );

      return {
        txHash: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async isNonceUsed(account: string, nonce: string): Promise<boolean> {
    try {
      const nonceBytes = hexToBytes(nonce);

      const result = await this.aptos.view({
        payload: {
          function: `${this.contractAddress}::x402_transfer::is_nonce_used`,
          functionArguments: [account, Array.from(nonceBytes)],
        },
      });

      const isUsed = result[0] as boolean;
      this.logger.debug({ account, nonce, isUsed }, "Checked nonce status");
      return isUsed;
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          account,
          nonce,
        },
        "Error checking nonce"
      );
      return false;
    }
  }

  async isRegistryInitialized(account: string): Promise<boolean> {
    try {
      const result = await this.aptos.view({
        payload: {
          function: `${this.contractAddress}::x402_transfer::is_registry_initialized`,
          functionArguments: [account],
        },
      });

      const isInitialized = result[0] as boolean;
      this.logger.debug({ account, isInitialized }, "Checked registry status");
      return isInitialized;
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          account,
        },
        "Error checking registry"
      );
      return false;
    }
  }

  /**
   * Build a transaction for the client to sign (fee payer flow)
   * Server builds the transaction, client signs it, server signs as fee payer and submits
   */
  async buildTransactionForClient(
    options: BuildSponsoredTransactionOptions
  ): Promise<TransactionPayloadForSigning> {
    const { from, to, amount, nonce, validUntil, chainId, contractAddress } = options;

    const isMultiRecipient = Array.isArray(to);
    const functionName = isMultiRecipient ? "transfer_sponsored_split" : "transfer_sponsored";

    // Convert nonce string to bytes
    const nonceBytes = Buffer.from(nonce, "utf-8");

    // Build function arguments based on transfer type
    const functionArguments = isMultiRecipient
      ? [
          to, // recipients: vector<address>
          amount, // amounts: vector<u64>
          Array.from(nonceBytes), // nonce: vector<u8>
          validUntil, // valid_until: u64
          chainId, // chain_id: u8
        ]
      : [
          to, // to: address
          amount, // amount: u64
          Array.from(nonceBytes), // nonce: vector<u8>
          validUntil, // valid_until: u64
          chainId, // chain_id: u8
        ];

    this.logger.debug(
      { function: functionName, from, to, amount, validUntil, chainId },
      "Building transaction for client"
    );

    // Build transaction with fee payer enabled
    const transaction = await this.aptos.transaction.build.simple({
      sender: AccountAddress.from(from),
      withFeePayer: true, // CRITICAL: Enable fee payer mode
      data: {
        function: `${contractAddress}::x402_transfer::${functionName}`,
        functionArguments,
      },
    });

    // Serialize transaction for client
    const transactionBytes = transaction.bcsToBytes();
    const transactionHex = Buffer.from(transactionBytes).toString("hex");

    this.logger.info(
      { function: functionName, from, validUntil, chainId },
      "Built transaction for client signing"
    );

    return {
      transaction: `0x${transactionHex}`,
      sender: from,
      function: `${contractAddress}::x402_transfer::${functionName}`,
      functionArguments,
      validUntil,
      chainId,
      nonce,
    };
  }

  /**
   * Submit a sponsored payment where user has already signed the transaction
   * Facilitator signs as fee payer and submits
   */
  async submitSponsoredPayment(
    userAuthenticatorHex: string,
    transaction: SimpleTransaction
  ): Promise<SubmitPaymentResult> {
    try {
      this.logger.debug("Submitting sponsored payment");

      // Parse user's authenticator from hex
      const userAuthBytes = hexToBytes(userAuthenticatorHex);

      // Sign as fee payer
      const feePayerAuthenticator = await this.aptos.transaction.signAsFeePayer({
        signer: this.account,
        transaction,
      });

      this.logger.debug("Signed as fee payer, submitting transaction");

      // Deserialize user's authenticator from bytes
      const authDeserializer = new Deserializer(new Uint8Array(userAuthBytes));
      const senderAuthenticator = AccountAuthenticator.deserialize(authDeserializer);

      // Submit with both authenticators
      const committedTxn = await this.aptos.transaction.submit.simple({
        transaction,
        senderAuthenticator, // User's signature
        feePayerAuthenticator, // Facilitator's signature
      });

      this.logger.debug(
        { txHash: committedTxn.hash },
        "Transaction submitted, waiting for confirmation"
      );

      // Wait for confirmation
      const executedTransaction = await this.aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      this.logger.info(
        { txHash: committedTxn.hash, success: executedTransaction.success },
        "Sponsored payment completed"
      );

      return {
        txHash: committedTxn.hash,
        success: executedTransaction.success,
      };
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : "Unknown error" },
        "Failed to submit sponsored payment"
      );

      return {
        txHash: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  getAddress(): string {
    return this.account.accountAddress.toString();
  }
}

export function parsePaymentHeader(paymentHeader: string): PaymentPayload {
  try {
    const decoded = Buffer.from(paymentHeader, "base64").toString("utf-8");
    return JSON.parse(decoded) as PaymentPayload;
  } catch (_error) {
    throw new Error("Invalid payment header format");
  }
}

export function validatePaymentPayload(payload: AptosPaymentPayloadData): {
  valid: boolean;
  error?: string;
} {
  if (!payload.from || !payload.to || !payload.amount) {
    return { valid: false, error: "Missing required fields" };
  }

  if (!payload.nonce || !payload.authenticator || !payload.validUntil || !payload.chainId) {
    return {
      valid: false,
      error: "Missing required fields (nonce, authenticator, validUntil, chainId)",
    };
  }

  const isMultiRecipient = Array.isArray(payload.to);
  if (isMultiRecipient) {
    if (!Array.isArray(payload.amount)) {
      return { valid: false, error: "Amount must be array for multi-recipient" };
    }

    if ((payload.to as string[]).length !== (payload.amount as string[]).length) {
      return { valid: false, error: "Recipients and amounts length mismatch" };
    }

    if ((payload.to as string[]).length === 0) {
      return { valid: false, error: "Must have at least one recipient" };
    }
  }

  return { valid: true };
}

export interface PaymentResponseData {
  /** Whether the payment was successful */
  success: boolean;
  /** Transaction hash (empty string if failed) */
  transaction: string;
  /** Network identifier */
  network: string;
  /** Payer address */
  payer: string;
  /** Error reason if failed, null otherwise */
  errorReason: string | null;
}

export function createPaymentResponseHeader(response: PaymentResponseData): string {
  const json = JSON.stringify({
    success: response.success,
    transaction: response.transaction || "",
    network: response.network || "",
    payer: response.payer || "",
    errorReason: response.errorReason || null,
  });
  return Buffer.from(json).toString("base64");
}

export function parsePaymentResponseHeader(headerValue: string): PaymentResponseData {
  try {
    const decoded = Buffer.from(headerValue, "base64").toString("utf-8");
    return JSON.parse(decoded) as PaymentResponseData;
  } catch (_error) {
    throw new Error("Invalid X-PAYMENT-RESPONSE header format");
  }
}

export function getSupportedPayments(customNetworks?: string[]): SupportedPaymentsResponse {
  const networks = customNetworks || Array.from(SUPPORTED_NETWORKS);
  const kinds: SupportedKind[] = [];

  for (const scheme of SUPPORTED_SCHEMES) {
    for (const network of networks) {
      kinds.push({
        x402Version: X402_VERSION,
        scheme,
        network,
      });
    }
  }

  return { kinds };
}
