import { describe, it, expect } from "bun:test";
import { toBigInt, errorSummary } from "../../src/upto/evm/constants.js";

describe("constants", () => {
  describe("toBigInt", () => {
    it("converts valid string to bigint", () => {
      expect(toBigInt("123456")).toBe(123456n);
      expect(toBigInt("0")).toBe(0n);
      expect(toBigInt("999999999999999999999")).toBe(999999999999999999999n);
    });

    it("returns 0n for undefined", () => {
      expect(toBigInt(undefined)).toBe(0n);
    });

    it("returns 0n for empty string", () => {
      expect(toBigInt("")).toBe(0n);
    });

    it("returns 0n for invalid string", () => {
      expect(toBigInt("not-a-number")).toBe(0n);
      expect(toBigInt("12.34")).toBe(0n);
      expect(toBigInt("abc123")).toBe(0n);
    });
  });

  describe("errorSummary", () => {
    it("returns 'unknown_error' for null/undefined", () => {
      expect(errorSummary(null)).toBe("unknown_error");
      expect(errorSummary(undefined)).toBe("unknown_error");
    });

    it("returns string errors as-is", () => {
      expect(errorSummary("Something went wrong")).toBe("Something went wrong");
    });

    it("extracts message from Error instances", () => {
      expect(errorSummary(new Error("Test error"))).toBe("Test error");
      expect(errorSummary(new TypeError("Type error"))).toBe("Type error");
    });

    it("extracts shortMessage from viem-style errors", () => {
      const viemError = { shortMessage: "Gas estimation failed" };
      expect(errorSummary(viemError)).toBe("Gas estimation failed");
    });

    it("extracts message from objects with message property", () => {
      const errorObj = { message: "Custom error message" };
      expect(errorSummary(errorObj)).toBe("Custom error message");
    });

    it("prefers shortMessage over message", () => {
      const errorObj = {
        shortMessage: "Short version",
        message: "Long version",
      };
      expect(errorSummary(errorObj)).toBe("Short version");
    });

    it("JSON stringifies objects without message properties", () => {
      const errorObj = { code: 123, reason: "failed" };
      expect(errorSummary(errorObj)).toBe('{"code":123,"reason":"failed"}');
    });

    it("handles objects with non-string message/shortMessage", () => {
      const errorObj = { message: 123, shortMessage: null };
      expect(errorSummary(errorObj)).toBe('{"message":123,"shortMessage":null}');
    });

    it("falls back to String() for non-serializable objects", () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(errorSummary(circular)).toBe("[object Object]");
    });

    it("handles numbers and booleans", () => {
      expect(errorSummary(42)).toBe("42");
      expect(errorSummary(true)).toBe("true");
    });
  });
});
