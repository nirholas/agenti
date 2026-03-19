/**
 * Upto EVM Verification
 *
 * Permit signature validation for the upto EVM scheme.
 */

import type {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
} from "@x402/core/types";
import type { FacilitatorEvmSigner } from "@x402/evm";
import { getAddress } from "viem";

import {
  type UptoEvmAuthorization,
  type UptoEvmPayload,
  erc20Abi,
  toBigInt,
} from "./constants.js";
import type { UptoEvmSchemeOptions } from "./facilitator.js";

/**
 * Context needed for verification.
 */
export interface VerificationContext {
  signer: FacilitatorEvmSigner;
  payload: PaymentPayload;
  requirements: PaymentRequirements;
  options?: UptoEvmSchemeOptions;
}

/**
 * Verify an upto EVM payment permit signature.
 *
 * Validates:
 * - Scheme matches "upto"
 * - Authorization payload is complete
 * - Network matches
 * - EIP-712 domain info present
 * - Spender is the facilitator
 * - Cap covers required amount
 * - Authorization not expired
 * - Permit signature is valid
 * - Optional on-chain balance preflight (if enabled)
 */
export async function verifyUptoPayment(
  ctx: VerificationContext
): Promise<VerifyResponse> {
  const { signer, payload, requirements, options } = ctx;

  const uptoPayload = payload.payload as unknown as Partial<UptoEvmPayload>;
  const authorization = uptoPayload.authorization as
    | Partial<UptoEvmAuthorization>
    | undefined;

  const payer = authorization?.from;

  // Validate scheme
  if (payload.accepted.scheme !== "upto" || requirements.scheme !== "upto") {
    return {
      isValid: false,
      invalidReason: "unsupported_scheme",
      payer,
    };
  }

  // Validate payload structure
  if (!authorization || !uptoPayload.signature) {
    return {
      isValid: false,
      invalidReason: "invalid_upto_evm_payload",
      payer,
    };
  }

  const owner = authorization.from;
  const spender = authorization.to ?? requirements.payTo;
  const nonce = authorization.nonce;
  const validBefore = authorization.validBefore;
  const value = authorization.value;

  if (!owner || !spender || !nonce || !validBefore || !value) {
    return {
      isValid: false,
      invalidReason: "invalid_upto_evm_payload",
      payer,
    };
  }

  const ownerAddress = getAddress(owner);
  const spenderAddress = getAddress(spender as `0x${string}`);

  // Validate network
  if (payload.accepted.network !== requirements.network) {
    return {
      isValid: false,
      invalidReason: "network_mismatch",
      payer,
    };
  }

  // Validate EIP-712 domain info
  const extra = requirements.extra as Record<string, unknown> | undefined;
  const name = extra?.name as string | undefined;
  const version = extra?.version as string | undefined;

  if (!name || !version) {
    return {
      isValid: false,
      invalidReason: "missing_eip712_domain",
      payer,
    };
  }

  // Validate spender is the facilitator
  const facilitatorAddresses = signer.getAddresses().map((a) => getAddress(a));
  if (!facilitatorAddresses.includes(spenderAddress)) {
    return {
      isValid: false,
      invalidReason: "spender_not_facilitator",
      payer,
    };
  }

  // Validate cap covers required amount
  const cap = toBigInt(value);
  const requiredAmount = toBigInt(requirements.amount);
  if (cap < requiredAmount) {
    return {
      isValid: false,
      invalidReason: "cap_too_low",
      payer,
    };
  }

  // Validate cap covers max amount if specified
  const maxAmountRequired = toBigInt(
    (extra?.maxAmountRequired as string | undefined) ??
      (extra?.maxAmount as string | undefined)
  );
  if (maxAmountRequired > 0n && cap < maxAmountRequired) {
    return {
      isValid: false,
      invalidReason: "cap_below_required_max",
      payer,
    };
  }

  // Validate authorization not expired (with 6 second buffer)
  const now = BigInt(Math.floor(Date.now() / 1000));
  const deadline = toBigInt(validBefore);
  if (deadline < now + 6n) {
    return {
      isValid: false,
      invalidReason: "authorization_expired",
      payer,
    };
  }

  // Validate chain ID
  const chainId = Number(requirements.network.split(":")[1]);
  if (!Number.isFinite(chainId)) {
    return {
      isValid: false,
      invalidReason: "invalid_chain_id",
      payer,
    };
  }

  // Build EIP-712 typed data for permit
  const permitTypedData = {
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    domain: {
      name,
      version,
      chainId,
      verifyingContract: getAddress(requirements.asset),
    },
    message: {
      owner: ownerAddress,
      spender: spenderAddress,
      value: cap,
      nonce: toBigInt(nonce),
      deadline,
    },
  } as const;

  // Verify permit signature
  try {
    const ok = await signer.verifyTypedData({
      address: ownerAddress,
      domain: permitTypedData.domain,
      types: permitTypedData.types,
      primaryType: permitTypedData.primaryType,
      message: permitTypedData.message as unknown as Record<string, unknown>,
      signature: uptoPayload.signature,
    });

    if (!ok) {
      return {
        isValid: false,
        invalidReason: "invalid_permit_signature",
        payer,
      };
    }
  } catch {
    return {
      isValid: false,
      invalidReason: "invalid_permit_signature",
      payer,
    };
  }

  // Optional on-chain balance preflight.
  if (options?.verifyBalanceCheck) {
    try {
      const balance = (await signer.readContract({
        address: getAddress(requirements.asset),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [ownerAddress],
      })) as bigint;

      if (balance < requiredAmount) {
        return {
          isValid: false,
          invalidReason: "insufficient_balance",
          payer,
        };
      }
    } catch {
      return {
        isValid: false,
        invalidReason: "balance_check_failed",
        payer,
      };
    }
  }

  return {
    isValid: true,
    payer,
  };
}
