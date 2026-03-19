/**
 * Upto EVM Facilitator Scheme
 *
 * Implements the SchemeNetworkFacilitator interface for the upto (batched payment)
 * scheme on EVM networks. Uses EIP-2612 permit signatures for gasless approvals.
 */

import type {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import type { FacilitatorEvmSigner } from "@x402/evm";

import { verifyUptoPayment } from "./verification.js";
import { settleUptoPayment } from "./settlement.js";

export interface UptoEvmSchemeOptions {
  /**
   * Enable an on-chain `balanceOf(owner)` preflight check during verify.
   * Disabled by default to avoid additional RPC latency.
   */
  verifyBalanceCheck?: boolean;
}

/**
 * Upto EVM scheme facilitator.
 *
 * Handles verification and settlement of upto payments using EIP-2612 permits.
 * The upto scheme allows users to pre-authorize a spending cap, enabling
 * multiple smaller payments to be batched and settled together.
 */
export class UptoEvmScheme implements SchemeNetworkFacilitator {
  readonly scheme = "upto";
  readonly caipFamily = "eip155:*";

  constructor(
    private readonly signer: FacilitatorEvmSigner,
    private readonly options: UptoEvmSchemeOptions = {}
  ) {}

  getExtra(_: string): Record<string, unknown> | undefined {
    return undefined;
  }

  getSigners(_: string): string[] {
    return [...this.signer.getAddresses()];
  }

  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    return verifyUptoPayment({
      signer: this.signer,
      payload,
      requirements,
      options: this.options,
    });
  }

  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    const verification = await this.verify(payload, requirements);

    return settleUptoPayment({
      signer: this.signer,
      payload,
      requirements,
      verification,
    });
  }
}
