import { randomBytes } from "crypto";
import type {
  PaymentHandler,
  PaymentExecer,
  RequestContext,
} from "@faremeter/types/client";
import {
  lookupX402Network,
  findAssetInfo,
  type AssetNameOrContractInfo,
} from "@faremeter/info/evm";
import type { x402PaymentRequirements } from "@faremeter/types/x402v2";
import type { Hex } from "viem";
import { isAddress } from "viem";
import { type } from "arktype";
import {
  EIP712_TYPES,
  eip712Domain,
  type x402ExactPayload,
  type eip3009Authorization,
} from "./constants";

import { generateMatcher } from "./common";

interface WalletForPayment {
  chain: {
    id: number;
    name: string;
  };
  address: Hex;
  account: {
    signTypedData: (params: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }) => Promise<Hex>;
  };
}

/**
 * Options for creating an EVM exact payment handler.
 */
export type CreatePaymentHandlerOpts = {
  /** The asset to use for payments (defaults to USDC) */
  asset?: AssetNameOrContractInfo;
};

/**
 * Creates a payment handler for the EVM exact payment scheme.
 *
 * The handler generates EIP-3009 transferWithAuthorization signatures
 * that can be executed by the facilitator to complete payments.
 *
 * @param wallet - Wallet providing chain context and signing capabilities
 * @param opts - Optional configuration for the asset
 * @returns A PaymentHandler function for use with the x402 client
 */
export function createPaymentHandler(
  wallet: WalletForPayment,
  opts: CreatePaymentHandlerOpts = {},
): PaymentHandler {
  const x402Network = lookupX402Network(wallet.chain.id);

  const assetInfo = findAssetInfo(x402Network, opts.asset ?? "USDC");
  if (!assetInfo) {
    throw new Error(
      `Couldn't look up USDC information on network '${x402Network}'`,
    );
  }

  const { isMatchingRequirement } = generateMatcher(
    x402Network,
    assetInfo.address,
  );

  return async function handlePayment(
    _context: RequestContext,
    accepts: x402PaymentRequirements[],
  ): Promise<PaymentExecer[]> {
    const compatibleRequirements = accepts.filter(isMatchingRequirement);

    return compatibleRequirements.map((requirements) => ({
      requirements,
      exec: async () => {
        if (!isAddress(requirements.payTo)) {
          throw new Error(`Invalid payTo address: ${requirements.payTo}`);
        }
        const payToAddress = requirements.payTo;

        // Generate nonce for EIP-3009 authorization (32 bytes hex with 0x prefix)
        const nonce = `0x${randomBytes(32).toString("hex")}` as const;
        const now = Math.floor(Date.now() / 1000);
        const validAfter = now - 60; // Valid from 60 seconds ago
        const validBefore = now + requirements.maxTimeoutSeconds;

        // Create the authorization parameters for EIP-3009
        const authorization: eip3009Authorization = {
          from: wallet.address,
          to: payToAddress,
          value: requirements.amount, // String value of amount
          validAfter: validAfter.toString(),
          validBefore: validBefore.toString(),
          nonce: nonce,
        };

        // Validate and extract EIP-712 domain parameters from requirements.extra
        const extraResult = eip712Domain(requirements.extra ?? {});
        if (extraResult instanceof type.errors) {
          throw new Error(
            `Invalid EIP-712 domain parameters: ${extraResult.summary}`,
          );
        }

        const verifyingContract =
          extraResult.verifyingContract ??
          requirements.asset ??
          assetInfo.address;
        if (!isAddress(verifyingContract)) {
          throw new Error(`Invalid verifying contract: ${verifyingContract}`);
        }

        const domain = {
          name: extraResult.name ?? assetInfo.contractName,
          version: extraResult.version ?? "2",
          chainId: extraResult.chainId ?? wallet.chain.id,
          verifyingContract,
        } as const;

        const types = EIP712_TYPES;

        // Message for EIP-712 signing (using BigInt for signing)
        const message = {
          from: wallet.address,
          to: payToAddress,
          value: BigInt(requirements.amount),
          validAfter: BigInt(validAfter),
          validBefore: BigInt(validBefore),
          nonce: nonce,
        };

        // Sign the EIP-712 typed data
        const signature = await wallet.account.signTypedData({
          domain,
          types,
          primaryType: "TransferWithAuthorization",
          message,
        });

        // Create the x402 exact scheme payload
        const payload: x402ExactPayload = {
          signature: signature,
          authorization: authorization,
        };

        // Return the EIP-3009 authorization payload
        return {
          payload,
        };
      },
    }));
  };
}
