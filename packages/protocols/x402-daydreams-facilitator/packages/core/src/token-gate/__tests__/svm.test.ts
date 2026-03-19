import { describe, it, expect } from "vitest";
import { parseSvmCaip2, isSvmNetwork } from "../networks/svm.js";

// Note: checkSplTokenBalance requires real RPC calls, so we test the parsing utilities
// The balance check is tested via mocks in checker.test.ts

describe("SVM Network Utilities", () => {
  describe("isSvmNetwork", () => {
    it("returns true for solana networks", () => {
      expect(isSvmNetwork("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")).toBe(true);
      expect(isSvmNetwork("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")).toBe(true);
    });

    it("returns false for non-Solana networks", () => {
      expect(isSvmNetwork("eip155:8453")).toBe(false);
      expect(isSvmNetwork("starknet:SN_MAIN")).toBe(false);
    });
  });

  describe("parseSvmCaip2", () => {
    it("parses Solana mainnet", () => {
      expect(parseSvmCaip2("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")).toBe(
        "solana-mainnet"
      );
    });

    it("parses Solana devnet", () => {
      expect(parseSvmCaip2("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1")).toBe(
        "solana-devnet"
      );
    });

    it("parses Solana testnet", () => {
      expect(parseSvmCaip2("solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z")).toBe(
        "solana-testnet"
      );
    });

    it("returns null for unknown Solana network", () => {
      expect(parseSvmCaip2("solana:unknown")).toBeNull();
    });

    it("returns null for non-Solana CAIP", () => {
      expect(parseSvmCaip2("eip155:8453")).toBeNull();
    });
  });
});
