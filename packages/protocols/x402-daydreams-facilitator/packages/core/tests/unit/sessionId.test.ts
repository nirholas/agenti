import { describe, it, expect } from "bun:test";
import {
  generateSessionId,
  extractUptoAuthorization,
} from "../../src/upto/sessionId.js";
import type { PaymentPayload } from "@x402/core/types";

const createValidPayload = (): PaymentPayload =>
  ({
    accepted: {
      scheme: "upto",
      network: "eip155:8453",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
    payload: {
      authorization: {
        from: "0x1234567890123456789012345678901234567890",
        to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        value: "1000000",
        validBefore: "1700000000",
        nonce: "42",
      },
      signature: "0xdeadbeef",
    },
  }) as PaymentPayload;

describe("sessionId", () => {
  describe("extractUptoAuthorization", () => {
    it("extracts valid authorization fields", () => {
      const payload = createValidPayload();
      const auth = extractUptoAuthorization(payload);

      expect(auth).toBeDefined();
      expect(auth!.owner).toBe("0x1234567890123456789012345678901234567890");
      expect(auth!.spender).toBe("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
      expect(auth!.value).toBe("1000000");
      expect(auth!.nonce).toBe("42");
      expect(auth!.deadline).toBe("1700000000");
      expect(auth!.signature).toBe("0xdeadbeef");
    });

    it("returns undefined for missing payload", () => {
      const payload = { accepted: { scheme: "upto" } } as PaymentPayload;
      expect(extractUptoAuthorization(payload)).toBeUndefined();
    });

    it("returns undefined for missing authorization", () => {
      const payload = {
        accepted: { scheme: "upto" },
        payload: { signature: "0xabc" },
      } as PaymentPayload;
      expect(extractUptoAuthorization(payload)).toBeUndefined();
    });

    it("returns undefined for missing signature", () => {
      const payload = createValidPayload();
      delete (payload.payload as Record<string, unknown>).signature;
      expect(extractUptoAuthorization(payload)).toBeUndefined();
    });

    it("returns undefined for missing owner (from)", () => {
      const payload = createValidPayload();
      const auth = (payload.payload as Record<string, unknown>)
        .authorization as Record<string, unknown>;
      delete auth.from;
      expect(extractUptoAuthorization(payload)).toBeUndefined();
    });

    it("returns undefined for missing spender (to)", () => {
      const payload = createValidPayload();
      const auth = (payload.payload as Record<string, unknown>)
        .authorization as Record<string, unknown>;
      delete auth.to;
      expect(extractUptoAuthorization(payload)).toBeUndefined();
    });

    it("returns undefined for missing value", () => {
      const payload = createValidPayload();
      const auth = (payload.payload as Record<string, unknown>)
        .authorization as Record<string, unknown>;
      delete auth.value;
      expect(extractUptoAuthorization(payload)).toBeUndefined();
    });

    it("returns undefined for missing nonce", () => {
      const payload = createValidPayload();
      const auth = (payload.payload as Record<string, unknown>)
        .authorization as Record<string, unknown>;
      delete auth.nonce;
      expect(extractUptoAuthorization(payload)).toBeUndefined();
    });

    it("returns undefined for missing validBefore (deadline)", () => {
      const payload = createValidPayload();
      const auth = (payload.payload as Record<string, unknown>)
        .authorization as Record<string, unknown>;
      delete auth.validBefore;
      expect(extractUptoAuthorization(payload)).toBeUndefined();
    });
  });

  describe("generateSessionId", () => {
    it("generates consistent hash for same payload", () => {
      const payload = createValidPayload();
      const id1 = generateSessionId(payload);
      const id2 = generateSessionId(payload);

      expect(id1).toBe(id2);
      expect(id1).toHaveLength(64); // SHA-256 hex = 64 chars
    });

    it("generates different hash for different owner", () => {
      const payload1 = createValidPayload();
      const payload2 = createValidPayload();
      const auth2 = (payload2.payload as Record<string, unknown>)
        .authorization as Record<string, unknown>;
      auth2.from = "0x9999999999999999999999999999999999999999";

      expect(generateSessionId(payload1)).not.toBe(generateSessionId(payload2));
    });

    it("generates different hash for different nonce", () => {
      const payload1 = createValidPayload();
      const payload2 = createValidPayload();
      const auth2 = (payload2.payload as Record<string, unknown>)
        .authorization as Record<string, unknown>;
      auth2.nonce = "99";

      expect(generateSessionId(payload1)).not.toBe(generateSessionId(payload2));
    });

    it("generates different hash for different network", () => {
      const payload1 = createValidPayload();
      const payload2 = createValidPayload();
      payload2.accepted.network = "eip155:1";

      expect(generateSessionId(payload1)).not.toBe(generateSessionId(payload2));
    });

    it("generates different hash for different signature", () => {
      const payload1 = createValidPayload();
      const payload2 = createValidPayload();
      (payload2.payload as Record<string, unknown>).signature = "0xdifferent";

      expect(generateSessionId(payload1)).not.toBe(generateSessionId(payload2));
    });

    it("handles invalid payload gracefully", () => {
      const payload = { accepted: { network: "eip155:8453" } } as PaymentPayload;
      const id = generateSessionId(payload);

      // Should still generate an ID (with undefined auth fields)
      expect(id).toHaveLength(64);
    });
  });
});
