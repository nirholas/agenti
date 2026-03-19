/**
 * Payment settlement functions
 */

import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
} from '../types/index.js';
import type {
  RpcProvider,
  GetTransactionReceiptResponse,
  TypedData,
} from 'starknet';
import { verifyPayment } from './verify.js';
import { err, wrapUnknown } from '../errors.js';

/**
 * Settle payment by executing the transaction
 *
 * This function:
 * - Verifies the payment first
 * - Executes the transaction (via paymaster or direct)
 * - Waits for confirmation
 * - Returns transaction details
 *
 * @param provider - RPC provider
 * @param payload - Payment payload from client
 * @param paymentRequirements - Payment requirements from server
 * @param options - Settlement options (paymaster config, etc.)
 * @returns Settlement result with transaction hash
 *
 * @example
 * ```typescript
 * const result = await settlePayment(
 *   provider,
 *   payload,
 *   requirements,
 *   { paymasterEndpoint: 'https://paymaster.example.com' }
 * );
 *
 * if (result.success) {
 *   console.log('Payment settled:', result.transaction);
 * }
 * ```
 */
export async function settlePayment(
  provider: RpcProvider,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  options?: {
    paymasterConfig?: {
      endpoint?: string;
      network?: string;
      apiKey?: string;
    };
    [key: string]: unknown;
  }
): Promise<SettleResponse> {
  // 1. Verify payment first
  const verification = await verifyPayment(
    provider,
    payload,
    paymentRequirements
  );

  if (!verification.isValid) {
    const errorReason = verification.invalidReason;
    return {
      success: false,
      ...(errorReason ? { errorReason } : {}),
      transaction: '',
      network: paymentRequirements.network,
      ...(verification.payer ? { payer: verification.payer } : {}),
    };
  }

  try {
    // 2. Get paymaster configuration and typed_data
    // Extract from payload if available, otherwise use options
    const paymasterEndpoint =
      options?.paymasterConfig?.endpoint ?? payload.paymasterEndpoint;
    const typedData = payload.typedData as TypedData | undefined;

    if (!paymasterEndpoint) {
      throw err.invalid('Paymaster endpoint not provided');
    }

    if (!typedData) {
      throw err.invalid(
        'Typed data not found in payment payload - client must store it during payment creation'
      );
    }

    // 3. Create paymaster client
    const { createPaymasterClient, executeTransaction, createTransferCall } =
      await import('../paymaster/index.js');

    const paymasterClient = createPaymasterClient({
      endpoint: paymasterEndpoint,
      network: paymentRequirements.network,
      ...(options?.paymasterConfig?.apiKey
        ? { apiKey: options.paymasterConfig.apiKey }
        : {}),
    });

    // 4. Create transfer call (v2: uses 'amount' instead of 'maxAmountRequired')
    const transferCall = createTransferCall(
      paymentRequirements.asset,
      paymentRequirements.payTo,
      paymentRequirements.amount
    );

    // 5. Execute transaction via paymaster with the original typed_data
    const result = await executeTransaction(
      paymasterClient,
      payload.payload.authorization.from,
      [transferCall],
      { mode: 'sponsored' }, // Facilitator pays gas
      typedData, // Pass the typed_data that was signed
      [payload.payload.signature.r, payload.payload.signature.s]
    );

    // 6. Wait for transaction to be accepted
    const receipt = await waitForSettlement(provider, result.transaction_hash);

    // Extract block info if available (successful receipts have these)
    const blockNumber =
      'block_number' in receipt ? receipt.block_number : undefined;
    const blockHash = 'block_hash' in receipt ? receipt.block_hash : undefined;

    return {
      success: true,
      transaction: result.transaction_hash,
      network: paymentRequirements.network,
      ...(verification.payer ? { payer: verification.payer } : {}),
      ...(blockNumber !== undefined ? { blockNumber } : {}),
      ...(blockHash !== undefined ? { blockHash } : {}),
    };
  } catch (error) {
    const wrappedError = wrapUnknown(error);
    // Extract the original error message if available
    const errorMessage =
      error instanceof Error ? error.message : wrappedError.message;
    return {
      success: false,
      errorReason: `unexpected_settle_error: ${errorMessage}`,
      transaction: '',
      network: paymentRequirements.network,
      ...(verification.payer ? { payer: verification.payer } : {}),
    };
  }
}

/**
 * Wait for transaction to be accepted on L2
 *
 * @param provider - RPC provider
 * @param transactionHash - Transaction hash to wait for
 * @param options - Wait options
 * @returns Transaction receipt
 */
export async function waitForSettlement(
  provider: RpcProvider,
  transactionHash: string,
  options?: {
    retryInterval?: number;
    maxRetries?: number;
  }
): Promise<GetTransactionReceiptResponse> {
  return provider.waitForTransaction(transactionHash, {
    retryInterval: options?.retryInterval ?? 2000,
    successStates: ['ACCEPTED_ON_L2', 'ACCEPTED_ON_L1'],
  });
}
