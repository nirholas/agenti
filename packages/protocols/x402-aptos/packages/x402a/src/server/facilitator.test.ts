/**
 * Tests for x402a Facilitator Functions
 *
 * Tests server-side payment processing utilities
 */

import { describe, expect, it } from "vitest";
import type { PaymentResponseData } from "./facilitator";
import {
  createPaymentResponseHeader,
  getSupportedPayments,
  parsePaymentHeader,
  parsePaymentResponseHeader,
  validatePaymentPayload,
} from "./facilitator";
import type { AptosPaymentPayloadData, PaymentPayload } from "../types";
import { X402_VERSION } from "../types";

// Helper to create V2 test payload (fee payer protocol)
function createV2Payload(overrides?: Partial<AptosPaymentPayloadData>): AptosPaymentPayloadData {
  return {
    from: `0x${"00".repeat(32)}`,
    to: `0x${"11".repeat(32)}`,
    amount: "1000000",
    nonce: `0x${"aa".repeat(16)}`,
    authenticator: `0x${"cc".repeat(64)}`,
    publicKey: `0x${"bb".repeat(32)}`,
    validUntil: Math.floor(Date.now() / 1000) + 3600,
    chainId: 2,
    ...overrides,
  };
}

describe("Facilitator - parsePaymentHeader", () => {
  it("should parse valid base64 payment header", () => {
    const payload: PaymentPayload = {
      x402Version: 1,
      scheme: "exact",
      network: "aptos-testnet",
      payload: createV2Payload(),
    };

    const json = JSON.stringify(payload);
    const base64 = Buffer.from(json).toString("base64");

    const parsed = parsePaymentHeader(base64);

    expect(parsed).toEqual(payload);
    expect(parsed.x402Version).toBe(1);
    expect(parsed.scheme).toBe("exact");
    expect(parsed.network).toBe("aptos-testnet");
  });

  it("should throw error on invalid base64", () => {
    const invalidBase64 = "not-valid-base64!!!";

    expect(() => parsePaymentHeader(invalidBase64)).toThrow("Invalid payment header format");
  });

  it("should throw error on malformed JSON", () => {
    const invalidJson = Buffer.from("{not valid json}").toString("base64");

    expect(() => parsePaymentHeader(invalidJson)).toThrow("Invalid payment header format");
  });

  it("should handle empty string", () => {
    expect(() => parsePaymentHeader("")).toThrow();
  });
});

describe("Facilitator - validatePaymentPayload", () => {
  it("should validate correct single-recipient payload", () => {
    const payload = createV2Payload();

    const result = validatePaymentPayload(payload);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should validate correct multi-recipient payload", () => {
    const payload = createV2Payload({
      to: [`0x${"11".repeat(32)}`, `0x${"22".repeat(32)}`],
      amount: ["900000", "100000"],
    });

    const result = validatePaymentPayload(payload);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should reject payload missing 'from'", () => {
    const payload = {
      to: `0x${"11".repeat(32)}`,
      amount: "1000000",
      nonce: `0x${"aa".repeat(16)}`,
      authenticator: `0x${"cc".repeat(64)}`,
      publicKey: `0x${"bb".repeat(32)}`,
      validUntil: Math.floor(Date.now() / 1000) + 3600,
      chainId: 2,
    } as AptosPaymentPayloadData;

    const result = validatePaymentPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Missing required fields");
  });

  it("should reject payload missing 'to'", () => {
    const payload = {
      from: `0x${"00".repeat(32)}`,
      amount: "1000000",
      nonce: `0x${"aa".repeat(16)}`,
      authenticator: `0x${"cc".repeat(64)}`,
      publicKey: `0x${"bb".repeat(32)}`,
      validUntil: Math.floor(Date.now() / 1000) + 3600,
      chainId: 2,
    } as AptosPaymentPayloadData;

    const result = validatePaymentPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Missing required fields");
  });

  it("should reject payload missing 'amount'", () => {
    const payload = {
      from: `0x${"00".repeat(32)}`,
      to: `0x${"11".repeat(32)}`,
      nonce: `0x${"aa".repeat(16)}`,
      authenticator: `0x${"cc".repeat(64)}`,
      publicKey: `0x${"bb".repeat(32)}`,
      validUntil: Math.floor(Date.now() / 1000) + 3600,
      chainId: 2,
    } as AptosPaymentPayloadData;

    const result = validatePaymentPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Missing required fields");
  });

  it("should reject payload missing signature fields", () => {
    const payload = {
      from: `0x${"00".repeat(32)}`,
      to: `0x${"11".repeat(32)}`,
      amount: "1000000",
    } as AptosPaymentPayloadData;

    const result = validatePaymentPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Missing required fields (nonce, authenticator, validUntil, chainId)");
  });

  it("should reject multi-recipient with non-array amount", () => {
    const payload = createV2Payload({
      to: [`0x${"11".repeat(32)}`, `0x${"22".repeat(32)}`],
      amount: "1000000", // Should be array!
    });

    const result = validatePaymentPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Amount must be array for multi-recipient");
  });

  it("should reject multi-recipient with mismatched lengths", () => {
    const payload = createV2Payload({
      to: [`0x${"11".repeat(32)}`, `0x${"22".repeat(32)}`],
      amount: ["1000000"], // Wrong length!
    });

    const result = validatePaymentPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Recipients and amounts length mismatch");
  });

  it("should reject empty recipient array", () => {
    const payload = createV2Payload({
      to: [],
      amount: [],
    });

    const result = validatePaymentPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Must have at least one recipient");
  });
});

describe("Facilitator - createPaymentResponseHeader", () => {
  it("should create valid payment response header", () => {
    const response: PaymentResponseData = {
      success: true,
      transaction: "0xabc123",
      network: "aptos-testnet",
      payer: `0x${"00".repeat(32)}`,
      errorReason: null,
    };

    const header = createPaymentResponseHeader(response);

    expect(header).toBeTruthy();
    expect(typeof header).toBe("string");

    // Should be base64
    expect(() => Buffer.from(header, "base64")).not.toThrow();
  });

  it("should encode all response fields", () => {
    const response: PaymentResponseData = {
      success: true,
      transaction: "0xabc123def456",
      network: "aptos-mainnet",
      payer: `0x${"11".repeat(32)}`,
      errorReason: null,
    };

    const header = createPaymentResponseHeader(response);
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));

    expect(decoded.success).toBe(true);
    expect(decoded.transaction).toBe("0xabc123def456");
    expect(decoded.network).toBe("aptos-mainnet");
    expect(decoded.payer).toBe(`0x${"11".repeat(32)}`);
    expect(decoded.errorReason).toBe(null);
  });

  it("should handle failed payment response", () => {
    const response: PaymentResponseData = {
      success: false,
      transaction: "",
      network: "aptos-testnet",
      payer: `0x${"00".repeat(32)}`,
      errorReason: "insufficient_funds",
    };

    const header = createPaymentResponseHeader(response);
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));

    expect(decoded.success).toBe(false);
    expect(decoded.transaction).toBe("");
    expect(decoded.errorReason).toBe("insufficient_funds");
  });

  it("should handle empty/null values", () => {
    const response: PaymentResponseData = {
      success: false,
      transaction: "",
      network: "",
      payer: "",
      errorReason: "some_error",
    };

    const header = createPaymentResponseHeader(response);
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));

    expect(decoded.transaction).toBe("");
    expect(decoded.network).toBe("");
    expect(decoded.payer).toBe("");
  });
});

describe("Facilitator - parsePaymentResponseHeader", () => {
  it("should parse valid payment response header", () => {
    const original: PaymentResponseData = {
      success: true,
      transaction: "0xabc123",
      network: "aptos-testnet",
      payer: `0x${"00".repeat(32)}`,
      errorReason: null,
    };

    const header = createPaymentResponseHeader(original);
    const parsed = parsePaymentResponseHeader(header);

    expect(parsed).toEqual(original);
  });

  it("should handle failed payment response", () => {
    const original: PaymentResponseData = {
      success: false,
      transaction: "",
      network: "aptos-testnet",
      payer: `0x${"00".repeat(32)}`,
      errorReason: "nonce_already_used",
    };

    const header = createPaymentResponseHeader(original);
    const parsed = parsePaymentResponseHeader(header);

    expect(parsed.success).toBe(false);
    expect(parsed.errorReason).toBe("nonce_already_used");
  });

  it("should throw error on invalid base64", () => {
    const invalidBase64 = "not-valid-base64!!!";

    expect(() => parsePaymentResponseHeader(invalidBase64)).toThrow(
      "Invalid X-PAYMENT-RESPONSE header format"
    );
  });

  it("should throw error on malformed JSON", () => {
    const invalidJson = Buffer.from("{not valid json}").toString("base64");

    expect(() => parsePaymentResponseHeader(invalidJson)).toThrow(
      "Invalid X-PAYMENT-RESPONSE header format"
    );
  });

  it("should be reversible with createPaymentResponseHeader", () => {
    const original: PaymentResponseData = {
      success: true,
      transaction: "0xdeadbeef",
      network: "aptos-mainnet",
      payer: `0x${"99".repeat(32)}`,
      errorReason: null,
    };

    const header = createPaymentResponseHeader(original);
    const parsed = parsePaymentResponseHeader(header);

    expect(parsed).toEqual(original);
  });
});

describe("Facilitator - getSupportedPayments", () => {
  it("should return default supported payments", () => {
    const supported = getSupportedPayments();

    expect(supported).toHaveProperty("kinds");
    expect(Array.isArray(supported.kinds)).toBe(true);
    expect(supported.kinds.length).toBeGreaterThan(0);
  });

  it("should include x402Version in each kind", () => {
    const supported = getSupportedPayments();

    supported.kinds.forEach((kind) => {
      expect(kind).toHaveProperty("x402Version");
      expect(kind.x402Version).toBe(X402_VERSION);
    });
  });

  it("should include scheme in each kind", () => {
    const supported = getSupportedPayments();

    supported.kinds.forEach((kind) => {
      expect(kind).toHaveProperty("scheme");
      expect(typeof kind.scheme).toBe("string");
      expect(kind.scheme.length).toBeGreaterThan(0);
    });
  });

  it("should include network in each kind", () => {
    const supported = getSupportedPayments();

    supported.kinds.forEach((kind) => {
      expect(kind).toHaveProperty("network");
      expect(typeof kind.network).toBe("string");
      expect(kind.network.length).toBeGreaterThan(0);
    });
  });

  it("should support exact scheme", () => {
    const supported = getSupportedPayments();

    const hasExact = supported.kinds.some((kind) => kind.scheme === "exact");
    expect(hasExact).toBe(true);
  });

  it("should support aptos-testnet network", () => {
    const supported = getSupportedPayments();

    const hasTestnet = supported.kinds.some((kind) => kind.network === "aptos-testnet");
    expect(hasTestnet).toBe(true);
  });

  it("should support aptos-mainnet network", () => {
    const supported = getSupportedPayments();

    const hasMainnet = supported.kinds.some((kind) => kind.network === "aptos-mainnet");
    expect(hasMainnet).toBe(true);
  });

  it("should accept custom networks", () => {
    const customNetworks = ["custom-network-1", "custom-network-2"];
    const supported = getSupportedPayments(customNetworks);

    const hasCustom1 = supported.kinds.some((kind) => kind.network === "custom-network-1");
    const hasCustom2 = supported.kinds.some((kind) => kind.network === "custom-network-2");

    expect(hasCustom1).toBe(true);
    expect(hasCustom2).toBe(true);
  });

  it("should generate all scheme+network combinations", () => {
    const supported = getSupportedPayments();

    // With 1 scheme ("exact") and 2 networks (testnet, mainnet)
    // Should have 2 combinations
    expect(supported.kinds.length).toBe(2);
  });

  it("should generate unique combinations", () => {
    const supported = getSupportedPayments();

    const combinations = supported.kinds.map((kind) => `${kind.scheme}:${kind.network}`);
    const uniqueCombinations = new Set(combinations);

    expect(uniqueCombinations.size).toBe(combinations.length);
  });

  it("should handle empty custom networks array", () => {
    const supported = getSupportedPayments([]);

    expect(supported.kinds).toEqual([]);
  });

  it("should handle single custom network", () => {
    const supported = getSupportedPayments(["my-network"]);

    expect(supported.kinds.length).toBe(1);
    expect(supported.kinds[0]?.network).toBe("my-network");
    expect(supported.kinds[0]?.scheme).toBe("exact");
  });
});

describe("Facilitator - Integration scenarios", () => {
  it("should handle complete payment flow data", () => {
    // Simulate a payment being created, sent, and response returned
    const paymentPayload: PaymentPayload = {
      x402Version: 1,
      scheme: "exact",
      network: "aptos-testnet",
      payload: createV2Payload(),
    };

    // 1. Encode payment header
    const headerJson = JSON.stringify(paymentPayload);
    const paymentHeader = Buffer.from(headerJson).toString("base64");

    // 2. Parse payment header
    const parsed = parsePaymentHeader(paymentHeader);
    expect(parsed).toEqual(paymentPayload);

    // 3. Validate payload
    const validation = validatePaymentPayload(parsed.payload);
    expect(validation.valid).toBe(true);

    // 4. Create response header (simulating successful payment)
    const responseData: PaymentResponseData = {
      success: true,
      transaction: "0xabc123def456",
      network: "aptos-testnet",
      payer: parsed.payload.from,
      errorReason: null,
    };

    const responseHeader = createPaymentResponseHeader(responseData);

    // 5. Parse response header
    const parsedResponse = parsePaymentResponseHeader(responseHeader);
    expect(parsedResponse).toEqual(responseData);
  });

  it("should handle split payment scenario", () => {
    const splitPayload: PaymentPayload = {
      x402Version: 1,
      scheme: "exact",
      network: "aptos-mainnet",
      payload: createV2Payload({
        to: [`0x${"11".repeat(32)}`, `0x${"22".repeat(32)}`],
        amount: ["985000", "15000"], // 98.5% + 1.5% split
      }),
    };

    const headerJson = JSON.stringify(splitPayload);
    const paymentHeader = Buffer.from(headerJson).toString("base64");

    const parsed = parsePaymentHeader(paymentHeader);
    const validation = validatePaymentPayload(parsed.payload);

    expect(validation.valid).toBe(true);
    expect(Array.isArray(parsed.payload.to)).toBe(true);
    expect(Array.isArray(parsed.payload.amount)).toBe(true);
  });

  it("should handle failed payment scenario", () => {
    const failedResponse: PaymentResponseData = {
      success: false,
      transaction: "",
      network: "aptos-testnet",
      payer: `0x${"00".repeat(32)}`,
      errorReason: "insufficient_funds",
    };

    const header = createPaymentResponseHeader(failedResponse);
    const parsed = parsePaymentResponseHeader(header);

    expect(parsed.success).toBe(false);
    expect(parsed.errorReason).toBe("insufficient_funds");
    expect(parsed.transaction).toBe("");
  });
});
