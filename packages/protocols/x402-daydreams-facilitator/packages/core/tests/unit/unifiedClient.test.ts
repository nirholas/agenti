import { describe, it, expect, mock } from "bun:test";
import { privateKeyToAccount } from "viem/accounts";
import { encodePaymentRequiredHeader } from "@x402/core/http";
import type {
  PaymentPayload,
  PaymentRequired,
  PaymentRequirements,
} from "@x402/core/types";

import { createUnifiedClient } from "../../src/unifiedClient.js";

const RESOURCE = {
  url: "https://example.com/resource",
  description: "Test resource",
  mimeType: "application/json",
};

const createRequirements = (network: string): PaymentRequirements => ({
  scheme: "exact",
  network,
  asset: "0x" + "11".repeat(20),
  amount: "1000",
  payTo: "0x" + "22".repeat(20),
  maxTimeoutSeconds: 300,
  extra: {},
});

const createPaymentRequired = (network: string): PaymentRequired => {
  const requirements = createRequirements(network);
  return {
    x402Version: 2,
    error: "Payment required",
    resource: RESOURCE,
    accepts: [requirements],
  };
};

const createPaymentPayload = (
  requirements: PaymentRequirements
): PaymentPayload => ({
  x402Version: 2,
  resource: RESOURCE,
  accepted: requirements,
  payload: { signature: "0xdeadbeef" },
});

describe("Unified client", () => {
  it("requires at least one scheme configuration", () => {
    expect(() => createUnifiedClient({})).toThrow(
      "Unified client requires at least one scheme configuration."
    );
  });

  it("retries with a payment header after a 402 response", async () => {
    const paymentRequired = createPaymentRequired("eip155:8453");
    const header = encodePaymentRequiredHeader(paymentRequired);
    const payload = createPaymentPayload(paymentRequired.accepts[0]!);

    let callCount = 0;
    const fetchMock = mock((input: Request | string | URL) => {
      callCount += 1;
      const request = input instanceof Request ? input : new Request(input);

      if (callCount === 1) {
        return Promise.resolve(
          new Response(null, {
            status: 402,
            headers: { "PAYMENT-REQUIRED": header },
          })
        );
      }

      const signatureHeader =
        request.headers.get("PAYMENT-SIGNATURE") ??
        request.headers.get("X-PAYMENT");
      expect(signatureHeader).toBeTruthy();

      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    const account = privateKeyToAccount("0x" + "11".repeat(32));
    const unified = createUnifiedClient({
      evmExact: { signer: account },
      fetch: fetchMock,
    });

    unified.httpClient.createPaymentPayload = mock(() =>
      Promise.resolve(payload)
    );

    const response = await unified.fetchWithPayment(RESOURCE.url);
    expect(response.status).toBe(200);
    expect(callCount).toBe(2);
  });

  it("requires typedData for Starknet payments", async () => {
    const paymentRequired = createPaymentRequired("starknet:SN_SEPOLIA");
    const header = encodePaymentRequiredHeader(paymentRequired);
    const payload = createPaymentPayload(paymentRequired.accepts[0]!);

    let callCount = 0;
    const fetchMock = mock(() => {
      callCount += 1;
      return Promise.resolve(
        new Response(null, {
          status: 402,
          headers: { "PAYMENT-REQUIRED": header },
        })
      );
    });

    const account = privateKeyToAccount("0x" + "22".repeat(32));
    const unified = createUnifiedClient({
      evmExact: { signer: account },
      fetch: fetchMock,
    });

    unified.httpClient.createPaymentPayload = mock(() =>
      Promise.resolve(payload)
    );

    await expect(unified.fetchWithPayment(RESOURCE.url)).rejects.toThrow(
      "Starknet payment payload missing typedData (required)."
    );
    expect(callCount).toBe(1);
  });
});
