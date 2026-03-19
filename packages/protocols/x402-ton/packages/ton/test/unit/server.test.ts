import { describe, it, expect } from "vitest";
import { SchemeNetworkServer } from "../../src/exact/server/scheme";
import {
  TON_MAINNET,
  USDT_MAINNET_MASTER,
} from "../../src/constants";

describe("SchemeNetworkServer", () => {
  const relayAddress =
    "0:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

  const server = new SchemeNetworkServer(TON_MAINNET, relayAddress, "50000");

  describe("scheme", () => {
    it('is "exact"', () => {
      expect(server.scheme).toBe("exact");
    });
  });

  describe("parsePrice", () => {
    it("parses USDT $1.00 correctly", () => {
      const result = server.parsePrice("1.00", USDT_MAINNET_MASTER);
      expect(result.asset).toBe(USDT_MAINNET_MASTER);
      expect(result.amount).toBe("1000000");
    });

    it("parses native TON 0.5 correctly", () => {
      const result = server.parsePrice("0.5", "native");
      expect(result.asset).toBe("native");
      expect(result.amount).toBe("500000000");
    });

    it("throws for unsupported asset", () => {
      expect(() => server.parsePrice("1.00", "unknown-asset")).toThrow(
        "Unsupported asset",
      );
    });

    it("throws for unsupported network", () => {
      const badServer = new SchemeNetworkServer("tvm:-999");
      expect(() => badServer.parsePrice("1.00", "native")).toThrow(
        "Unsupported network",
      );
    });
  });

  describe("enhancePaymentRequirements", () => {
    it("adds extra field with relay address and asset info", () => {
      const requirements = {
        scheme: "exact",
        network: TON_MAINNET,
        asset: "native",
        amount: "1000000000",
        payTo: "0:aaaa",
        maxTimeoutSeconds: 300,
      };

      const enhanced = server.enhancePaymentRequirements(requirements);

      expect(enhanced.extra).toBeDefined();
      expect(enhanced.extra!.relayAddress).toBe(relayAddress);
      expect(enhanced.extra!.maxRelayCommission).toBe("50000");
      expect(enhanced.extra!.assetDecimals).toBe(9); // native TON
      expect(enhanced.extra!.assetSymbol).toBe("TON");
    });

    it("uses USDT defaults for USDT asset", () => {
      const requirements = {
        scheme: "exact",
        network: TON_MAINNET,
        asset: USDT_MAINNET_MASTER,
        amount: "1000000",
        payTo: "0:aaaa",
        maxTimeoutSeconds: 300,
      };

      const enhanced = server.enhancePaymentRequirements(requirements);

      expect(enhanced.extra!.assetDecimals).toBe(6);
      expect(enhanced.extra!.assetSymbol).toBe("USDT");
    });

    it("preserves original requirement fields", () => {
      const requirements = {
        scheme: "exact",
        network: TON_MAINNET,
        asset: "native",
        amount: "1000000000",
        payTo: "0:aaaa",
        maxTimeoutSeconds: 300,
      };

      const enhanced = server.enhancePaymentRequirements(requirements);
      expect(enhanced.scheme).toBe("exact");
      expect(enhanced.network).toBe(TON_MAINNET);
      expect(enhanced.asset).toBe("native");
      expect(enhanced.amount).toBe("1000000000");
      expect(enhanced.payTo).toBe("0:aaaa");
    });

    it("works without optional relay params", () => {
      const serverNoRelay = new SchemeNetworkServer(TON_MAINNET);
      const requirements = {
        scheme: "exact",
        network: TON_MAINNET,
        asset: "native",
        amount: "1000000000",
        payTo: "0:aaaa",
        maxTimeoutSeconds: 300,
      };

      const enhanced = serverNoRelay.enhancePaymentRequirements(requirements);
      expect(enhanced.extra!.relayAddress).toBeUndefined();
      expect(enhanced.extra!.maxRelayCommission).toBeUndefined();
    });
  });
});
