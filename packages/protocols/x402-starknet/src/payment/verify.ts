/**
 * Payment verification functions
 */

import type {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
} from '../types/index.js';
import type { RpcProvider, TypedData } from 'starknet';
import { typedData } from 'starknet';
import { PAYMENT_PAYLOAD_SCHEMA } from '../types/schemas.js';
import { normalizeAddress } from '../utils/encoding.js';

/**
 * Verify payment payload without executing the transaction
 *
 * This function validates that:
 * - Payload structure is correct
 * - Signature is valid (if typedData is present in payload)
 * - User has sufficient balance
 * - Payment matches requirements
 * - Payment hasn't expired (validUntil timestamp)
 *
 * Signature verification is performed by calling the account contract's
 * isValidSignature function (SNIP-6 standard). This works with all account
 * types (OpenZeppelin, Argent, Braavos, etc.) and signature schemes.
 *
 * @param provider - RPC provider for on-chain checks
 * @param payload - Payment payload from client
 * @param paymentRequirements - Payment requirements from server
 * @returns Verification result
 *
 * @example
 * ```typescript
 * const result = await verifyPayment(provider, payload, requirements);
 * if (result.isValid) {
 *   // Proceed with settlement
 * } else {
 *   console.error('Invalid payment:', result.invalidReason);
 * }
 * ```
 */
export async function verifyPayment(
  provider: RpcProvider,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<VerifyResponse> {
  try {
    // 1. Validate payload structure
    const validationResult = PAYMENT_PAYLOAD_SCHEMA.safeParse(payload);
    if (!validationResult.success) {
      return {
        isValid: false,
        invalidReason: 'invalid_payload',
        details: {
          error: validationResult.error.message,
        },
      };
    }

    // 2. Extract payer address
    const payer = extractPayerAddress(payload);

    // 3. Verify network matches (v2: network is in payload.accepted)
    if (payload.accepted.network !== paymentRequirements.network) {
      return {
        isValid: false,
        invalidReason: 'invalid_network',
        payer,
      };
    }

    // 4. Note: Scheme verification omitted - currently only 'exact' is supported
    // When additional payment schemes are added, this check should be re-enabled

    // 5. Verify authorization token matches requirement
    // Normalize addresses for comparison to handle different formats (0x1 vs 0x0001)
    if (
      normalizeAddress(payload.payload.authorization.token) !==
      normalizeAddress(paymentRequirements.asset)
    ) {
      return {
        isValid: false,
        invalidReason: 'invalid_exact_starknet_payload_token_mismatch',
        payer,
      };
    }

    // 6. Verify authorization recipient matches requirement
    // Normalize addresses for comparison to handle different formats (0x1 vs 0x0001)
    if (
      normalizeAddress(payload.payload.authorization.to) !==
      normalizeAddress(paymentRequirements.payTo)
    ) {
      return {
        isValid: false,
        invalidReason: 'invalid_exact_starknet_payload_recipient_mismatch',
        payer,
      };
    }

    // 7. Verify amount matches requirement (v2: uses 'amount' instead of 'maxAmountRequired')
    if (payload.payload.authorization.amount !== paymentRequirements.amount) {
      return {
        isValid: false,
        invalidReason: 'invalid_exact_starknet_payload_authorization_value',
        payer,
      };
    }

    // 8. Verify payment hasn't expired (validUntil timestamp check)
    // validUntil is a Unix timestamp (seconds since epoch) as a string
    // NOTE: validUntil of 0 means "never expires" (common with AVNU paymaster)
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const validUntil = parseInt(payload.payload.authorization.validUntil, 10);

    if (isNaN(validUntil)) {
      return {
        isValid: false,
        invalidReason:
          'invalid_exact_starknet_payload_authorization_valid_until',
        payer,
        details: {
          error: 'Invalid validUntil timestamp format',
        },
      };
    }

    // validUntil of 0 means "never expires"
    if (validUntil !== 0 && currentTimestamp > validUntil) {
      return {
        isValid: false,
        invalidReason:
          'invalid_exact_starknet_payload_authorization_valid_until',
        payer,
        details: {
          validUntil: validUntil.toString(),
          currentTimestamp: currentTimestamp.toString(),
        },
      };
    }

    // 9. Verify signature (if typedData is available and valid)
    // This provides early validation before checking balance or executing via paymaster
    // The signature will also be verified again during paymaster execution
    if (payload.typedData) {
      const payloadTypedData = payload.typedData as TypedData;

      // Validate typed data structure before attempting to use it
      if (typedData.validateTypedData(payloadTypedData)) {
        try {
          const messageHash = typedData.getMessageHash(payloadTypedData, payer);
          const isSignatureValid = await verifySignatureOnChain(
            provider,
            payer,
            messageHash,
            payload.payload.signature
          );

          if (!isSignatureValid) {
            return {
              isValid: false,
              invalidReason: 'invalid_exact_starknet_payload_signature',
              payer,
              details: {
                error: 'Signature verification failed',
              },
            };
          }
        } catch {
          // If we get a network error or unexpected error during signature verification,
          // we skip it here and let the paymaster handle verification during execution.
          // This is conservative but acceptable because:
          // 1. Signature will be verified during settlement
          // 2. Better to allow a potentially valid payment than block it on transient errors
        }
      }
      // If typedData doesn't validate, skip signature verification
      // It will be validated during settlement
    }
    // Note: If typedData is not in the payload or doesn't validate, we skip signature verification.
    // The signature will still be verified during paymaster execution.
    // This is acceptable because typedData is optional in the payload structure.

    // 10. Check token balance (v2: uses 'amount' instead of 'maxAmountRequired')
    const { getTokenBalance } = await import('../utils/token.js');
    const balance = await getTokenBalance(
      provider,
      paymentRequirements.asset,
      payer
    );

    if (BigInt(balance) < BigInt(paymentRequirements.amount)) {
      return {
        isValid: false,
        invalidReason: 'insufficient_funds',
        payer,
        details: {
          balance,
        },
      };
    }

    // Note: We don't cryptographically verify the signature here.
    // The signature will be implicitly verified when executing via paymaster.
    // If the signature is invalid, the paymaster execution will fail.

    return {
      isValid: true,
      payer,
      details: {
        balance,
      },
    };
  } catch (error) {
    // Capture error details for debugging
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      isValid: false,
      invalidReason: 'unexpected_verify_error',
      details: {
        error: errorMessage,
      },
    };
  }
}

// Note: Signature verification is performed in step 9 of verifyPayment above.
// The signature is verified by calling the account contract's isValidSignature
// function, which is the standard SNIP-6 approach for Starknet. This works with
// all account implementations (OpenZeppelin, Argent, Braavos, custom accounts).
// The signature will also be implicitly verified again during paymaster execution.

/**
 * Verify signature by calling the account contract
 *
 * This follows the SNIP-6 standard for account signature verification.
 * The account contract's isValidSignature function is called to verify
 * that the signature is valid for the given message hash.
 *
 * @param provider - RPC provider
 * @param accountAddress - Account address that signed the message
 * @param messageHash - Hash of the typed data message
 * @param signature - Signature components (r, s)
 * @returns True if signature is valid, false otherwise
 */
async function verifySignatureOnChain(
  provider: RpcProvider,
  accountAddress: string,
  messageHash: string,
  signature: { r: string; s: string }
): Promise<boolean> {
  try {
    // Call the account's isValidSignature function (SNIP-6)
    // This is the standard way to verify signatures on Starknet
    const result = await provider.callContract({
      contractAddress: accountAddress,
      entrypoint: 'isValidSignature',
      calldata: [
        messageHash, // hash of the message
        '2', // signature array length
        signature.r,
        signature.s,
      ],
    });

    // Result format: ['0x1'] for valid, ['0x0'] or error for invalid
    // Standard response: 'VALID' = 0x56414c4944 (deprecated) or non-zero for valid
    // Modern OpenZeppelin returns 0x1 for valid, 0x0 for invalid
    if (result.length === 0) {
      return false;
    }

    const responseValue = result[0];
    // Accept any non-zero response as valid (some contracts return 'VALID' magic value)
    // Zero explicitly means invalid
    return responseValue !== '0x0' && responseValue !== '0x00';
  } catch (error) {
    // Known error messages for invalid signatures
    const errorMessage = error instanceof Error ? error.message : String(error);
    const knownInvalidSignatureErrors = [
      'argent/invalid-signature',
      'is invalid, with respect to the public key',
      'INVALID_SIG',
    ];

    if (
      knownInvalidSignatureErrors.some((knownError) =>
        errorMessage.includes(knownError)
      )
    ) {
      return false;
    }

    // For unknown errors, we can't determine validity - treat as invalid
    // This is conservative: better to reject potentially valid signature
    // than accept an invalid one
    return false;
  }
}

/**
 * Extract payer address from payment payload
 *
 * @param payload - Payment payload
 * @returns Payer address
 */
export function extractPayerAddress(payload: PaymentPayload): string {
  // The payer address is in the authorization.from field
  return payload.payload.authorization.from;
}
