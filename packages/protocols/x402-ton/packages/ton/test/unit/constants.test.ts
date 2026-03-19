import { describe, it, expect } from "vitest";
import {
  TON_MAINNET,
  TON_TESTNET,
  TVM_CAIP_FAMILY,
  USDT_MAINNET_MASTER,
  USDT_TESTNET_MASTER,
  NETWORK_CONFIG,
  RAW_ADDRESS_REGEX,
  W5_CODE_HASH,
  TON_DECIMALS,
  USDT_DECIMALS,
} from "../../src/constants";

describe("constants", () => {
  describe("CAIP-2 identifiers", () => {
    it("TON_MAINNET is tvm:-239", () => {
      expect(TON_MAINNET).toBe("tvm:-239");
    });

    it("TON_TESTNET is tvm:-3", () => {
      expect(TON_TESTNET).toBe("tvm:-3");
    });

    it("TVM_CAIP_FAMILY is tvm:*", () => {
      expect(TVM_CAIP_FAMILY).toBe("tvm:*");
    });
  });

  describe("USDT addresses", () => {
    it("USDT mainnet master matches verified address", () => {
      expect(USDT_MAINNET_MASTER).toBe(
        "0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe",
      );
    });

    it("USDT testnet master is defined", () => {
      expect(USDT_TESTNET_MASTER).toBe(
        "0:d042a064f1966eb895936684a6cdf53a6fd6fe09bf762488045e8b2e8c564f9b",
      );
    });
  });

  describe("NETWORK_CONFIG", () => {
    it("has mainnet entry", () => {
      const config = NETWORK_CONFIG[TON_MAINNET];
      expect(config).toBeDefined();
      expect(config.networkId).toBe(TON_MAINNET);
      expect(config.toncenterUrl).toBe("https://toncenter.com/api/v2/jsonRPC");
    });

    it("has testnet entry", () => {
      const config = NETWORK_CONFIG[TON_TESTNET];
      expect(config).toBeDefined();
      expect(config.networkId).toBe(TON_TESTNET);
      expect(config.toncenterUrl).toBe("https://testnet.toncenter.com/api/v2/jsonRPC");
    });

    it("mainnet has native TON asset with 9 decimals", () => {
      const config = NETWORK_CONFIG[TON_MAINNET];
      expect(config.assets["native"]).toEqual({
        symbol: "TON",
        decimals: TON_DECIMALS,
      });
    });

    it("mainnet has USDT asset with 6 decimals", () => {
      const config = NETWORK_CONFIG[TON_MAINNET];
      const usdtConfig = config.assets[USDT_MAINNET_MASTER];
      expect(usdtConfig).toBeDefined();
      expect(usdtConfig.symbol).toBe("USDT");
      expect(usdtConfig.decimals).toBe(USDT_DECIMALS);
      expect(usdtConfig.jettonMaster).toBe(USDT_MAINNET_MASTER);
    });

    it("testnet has USDT asset", () => {
      const config = NETWORK_CONFIG[TON_TESTNET];
      const usdtConfig = config.assets[USDT_TESTNET_MASTER];
      expect(usdtConfig).toBeDefined();
      expect(usdtConfig.symbol).toBe("USDT");
      expect(usdtConfig.decimals).toBe(USDT_DECIMALS);
    });
  });

  describe("RAW_ADDRESS_REGEX", () => {
    it("matches valid workchain 0 address", () => {
      expect(
        RAW_ADDRESS_REGEX.test(
          "0:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        ),
      ).toBe(true);
    });

    it("matches valid workchain -1 address", () => {
      expect(
        RAW_ADDRESS_REGEX.test(
          "-1:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        ),
      ).toBe(true);
    });

    it("rejects address without colon", () => {
      expect(
        RAW_ADDRESS_REGEX.test(
          "0abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        ),
      ).toBe(false);
    });

    it("rejects address with short hash", () => {
      expect(RAW_ADDRESS_REGEX.test("0:abcdef")).toBe(false);
    });

    it("rejects base64url format", () => {
      expect(RAW_ADDRESS_REGEX.test("EQAbcdef1234567890")).toBe(false);
    });
  });

  describe("W5_CODE_HASH", () => {
    it("is a 64-character hex string", () => {
      expect(W5_CODE_HASH).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("decimals", () => {
    it("TON has 9 decimals", () => {
      expect(TON_DECIMALS).toBe(9);
    });

    it("USDT has 6 decimals", () => {
      expect(USDT_DECIMALS).toBe(6);
    });
  });
});
