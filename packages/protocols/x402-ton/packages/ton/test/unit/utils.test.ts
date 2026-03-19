import { describe, it, expect } from "vitest";
import { beginCell } from "@ton/core";
import {
  validateBoc,
  getCellDepth,
  getCellCount,
  toAtomicUnits,
  fromAtomicUnits,
  validateTonAddress,
  rawToBase64url,
  base64urlToRaw,
  hashBoc,
  extractPayerFromPayload,
} from "../../src/utils";

describe("utils", () => {
  describe("BOC Validation", () => {
    it("valid BOC passes validation", () => {
      const cell = beginCell().storeUint(42, 32).endCell();
      const boc = cell.toBoc().toString("base64");
      const result = validateBoc(boc);
      expect(result).toBeDefined();
    });

    it("oversized BOC (>64KB) is rejected with boc_too_large", () => {
      // Create a large buffer and encode as base64
      // We need a valid-looking base64 that decodes to >64KB
      const largeBuffer = Buffer.alloc(65537, 0);
      const largeBoc = largeBuffer.toString("base64");
      expect(() => validateBoc(largeBoc)).toThrow("boc_too_large");
    });

    it("invalid base64 / non-BOC data is rejected", () => {
      expect(() => validateBoc("not-a-valid-boc!!!")).toThrow();
    });

    it("empty string is rejected", () => {
      expect(() => validateBoc("")).toThrow();
    });

    describe("getCellDepth", () => {
      it("returns 0 for a single cell with no refs", () => {
        const cell = beginCell().storeUint(1, 8).endCell();
        expect(getCellDepth(cell)).toBe(0);
      });

      it("returns correct depth for nested cells", () => {
        const inner = beginCell().storeUint(1, 8).endCell();
        const middle = beginCell().storeRef(inner).endCell();
        const outer = beginCell().storeRef(middle).endCell();
        expect(getCellDepth(outer)).toBe(2);
      });
    });

    describe("getCellCount", () => {
      it("returns 1 for a single cell", () => {
        const cell = beginCell().storeUint(1, 8).endCell();
        expect(getCellCount(cell)).toBe(1);
      });

      it("returns correct count for tree of cells", () => {
        const leaf1 = beginCell().storeUint(1, 8).endCell();
        const leaf2 = beginCell().storeUint(2, 8).endCell();
        const parent = beginCell().storeRef(leaf1).storeRef(leaf2).endCell();
        expect(getCellCount(parent)).toBe(3);
      });
    });
  });

  describe("Amount Math", () => {
    describe("toAtomicUnits", () => {
      it('toAtomicUnits("1.5", 9) returns 1500000000n', () => {
        expect(toAtomicUnits("1.5", 9)).toBe(1500000000n);
      });

      it('toAtomicUnits("1.0", 6) returns 1000000n', () => {
        expect(toAtomicUnits("1.0", 6)).toBe(1000000n);
      });

      it('toAtomicUnits("0.000001", 6) returns 1n', () => {
        expect(toAtomicUnits("0.000001", 6)).toBe(1n);
      });

      it('toAtomicUnits("0", 6) returns 0n', () => {
        expect(toAtomicUnits("0", 6)).toBe(0n);
      });

      it('toAtomicUnits("100", 9) returns 100000000000n', () => {
        expect(toAtomicUnits("100", 9)).toBe(100000000000n);
      });

      it('toAtomicUnits("-1", 9) throws Invalid amount format', () => {
        expect(() => toAtomicUnits("-1", 9)).toThrow("Invalid amount format");
      });

      it('toAtomicUnits("", 9) throws Invalid amount format', () => {
        expect(() => toAtomicUnits("", 9)).toThrow("Invalid amount format");
      });

      it('toAtomicUnits("abc", 9) throws Invalid amount format', () => {
        expect(() => toAtomicUnits("abc", 9)).toThrow("Invalid amount format");
      });

      it('toAtomicUnits("1.2.3", 9) throws Invalid amount format', () => {
        expect(() => toAtomicUnits("1.2.3", 9)).toThrow("Invalid amount format");
      });

      it('toAtomicUnits(".5", 9) throws Invalid amount format (leading dot)', () => {
        expect(() => toAtomicUnits(".5", 9)).toThrow("Invalid amount format");
      });
    });

    describe("fromAtomicUnits", () => {
      it('fromAtomicUnits(1500000000n, 9) returns "1.5"', () => {
        expect(fromAtomicUnits(1500000000n, 9)).toBe("1.5");
      });

      it('fromAtomicUnits(1000000n, 6) returns "1"', () => {
        expect(fromAtomicUnits(1000000n, 6)).toBe("1");
      });
    });
  });

  describe("Address", () => {
    describe("validateTonAddress", () => {
      it("accepts valid workchain 0 address", () => {
        expect(
          validateTonAddress(
            "0:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          ),
        ).toBe(true);
      });

      it("accepts valid workchain -1 address", () => {
        expect(
          validateTonAddress(
            "-1:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          ),
        ).toBe(true);
      });

      it("rejects invalid workchain 2", () => {
        expect(
          validateTonAddress(
            "2:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          ),
        ).toBe(false);
      });

      it("rejects base64url format (EQ...)", () => {
        expect(validateTonAddress("EQAbcdef1234567890")).toBe(false);
      });
    });

    describe("rawToBase64url / base64urlToRaw roundtrip", () => {
      it("converts raw to base64url and back", () => {
        const raw =
          "0:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
        const base64url = rawToBase64url(raw);
        expect(base64url).toBeTruthy();
        const backToRaw = base64urlToRaw(base64url);
        expect(backToRaw).toBe(raw);
      });
    });

    describe("hashBoc", () => {
      it("returns a 64-char hex string", () => {
        const cell = beginCell().storeUint(42, 32).endCell();
        const boc = cell.toBoc().toString("base64");
        const hash = hashBoc(boc);
        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      });

      it("returns different hashes for different BOCs", () => {
        const cell1 = beginCell().storeUint(1, 32).endCell();
        const cell2 = beginCell().storeUint(2, 32).endCell();
        const hash1 = hashBoc(cell1.toBoc().toString("base64"));
        const hash2 = hashBoc(cell2.toBoc().toString("base64"));
        expect(hash1).not.toBe(hash2);
      });
    });

    describe("extractPayerFromPayload", () => {
      it("returns null for undefined inputs", () => {
        expect(extractPayerFromPayload(undefined, undefined)).toBeNull();
      });

      it("returns null for missing signedBoc", () => {
        expect(extractPayerFromPayload(undefined, "aa".repeat(32))).toBeNull();
      });

      it("returns null for missing walletPublicKey", () => {
        expect(extractPayerFromPayload("dGVzdA==", undefined)).toBeNull();
      });

      it("returns null for invalid key length", () => {
        expect(extractPayerFromPayload("dGVzdA==", "aabb")).toBeNull();
      });

      it("returns raw address for valid 32-byte public key", () => {
        const validKey = "a".repeat(64);
        const result = extractPayerFromPayload("dGVzdA==", validKey);
        expect(result).not.toBeNull();
        expect(result).toMatch(/^0:[0-9a-f]{64}$/);
      });
    });
  });
});
