import { describe, expect, it } from "bun:test";
import {
  extractX402AuditFields,
  extractPaymentDetails,
  hashCanonicalJson,
} from "../../src/tracking/helpers.js";

describe("x402 tracking helpers", () => {
  it("produces stable hashes for equivalent JSON objects", () => {
    const left = {
      b: 2,
      a: 1,
      nested: {
        z: true,
        y: "ok",
      },
    };
    const right = {
      nested: {
        y: "ok",
        z: true,
      },
      a: 1,
      b: 2,
    };

    expect(hashCanonicalJson(left)).toBe(hashCanonicalJson(right));
  });

  it("omits undefined object fields when hashing canonical JSON", () => {
    const withUndefined = {
      a: 1,
      b: undefined,
    };
    const withoutUndefined = {
      a: 1,
    };

    expect(hashCanonicalJson(withUndefined)).toBe(hashCanonicalJson(withoutUndefined));
  });

  it("extracts x402 fields from nested payment payload", () => {
    const payload = {
      x402Version: 2,
      payload: {
        signature: "0xabc123",
        authorization: {
          nonce: "42",
          validBefore: "1700000000",
        },
      },
    } as any;

    const requirements = {
      scheme: "exact",
      network: "eip155:8453",
      asset: "0xtoken",
      amount: "1",
      payTo: "0xrecipient",
    } as any;

    const fields = extractX402AuditFields(payload, requirements);
    expect(fields.x402Version).toBe(2);
    expect(fields.paymentNonce).toBe("42");
    expect(fields.paymentValidBefore).toBe("1700000000");
    expect(fields.payloadHash).toHaveLength(64);
    expect(fields.requirementsHash).toHaveLength(64);
    expect(fields.paymentSignatureHash).toHaveLength(64);
  });

  it("extracts payer from nested payload authorization", () => {
    const payload = {
      payload: {
        authorization: {
          from: "0xabc0000000000000000000000000000000000000",
        },
      },
    } as any;
    const requirements = {
      scheme: "exact",
      network: "eip155:8453",
      asset: "0xtoken",
      amount: "1",
      payTo: "0xrecipient",
    } as any;

    const payment = extractPaymentDetails(payload, requirements);
    expect(payment.payer).toBe("0xabc0000000000000000000000000000000000000");
  });

  it("ignores non-integer x402 version values", () => {
    const payload = {
      x402Version: "2.5",
      payload: {
        signature: "0xabc123",
        authorization: {
          nonce: "42",
          validBefore: "1700000000",
        },
      },
    } as any;
    const requirements = {
      scheme: "exact",
      network: "eip155:8453",
      asset: "0xtoken",
      amount: "1",
      payTo: "0xrecipient",
    } as any;

    const fields = extractX402AuditFields(payload, requirements);
    expect(fields.x402Version).toBeUndefined();
  });
});
