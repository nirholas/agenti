import { describe, expect, test } from "bun:test";
import { loadWallet } from "./wallet";
import { EvmPrivateKeyWallet, generateEvmPrivateKeyConfig } from "./evm-private-key";
import { privateKeyToAccount } from "viem/accounts";

describe("loadWallet", () => {
  test("creates EvmPrivateKeyWallet for type evm-private-key", () => {
    const config = generateEvmPrivateKeyConfig();
    const wallet = loadWallet(config);
    expect(wallet).toBeInstanceOf(EvmPrivateKeyWallet);
    expect(wallet.type).toBe("evm-private-key");
    expect(wallet.address).toBe(config.address);
  });

  test("throws for unknown wallet type", () => {
    expect(() => loadWallet({ type: "ledger" })).toThrow("Unknown wallet type: ledger");
  });
});

describe("generateEvmPrivateKeyConfig", () => {
  test("returns config with type, privateKey, and address", () => {
    const config = generateEvmPrivateKeyConfig();
    expect(config.type).toBe("evm-private-key");
    expect(config.privateKey).toMatch(/^0x[0-9a-f]{64}$/);
    expect(config.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  test("generated address matches the private key", () => {
    const config = generateEvmPrivateKeyConfig();
    const account = privateKeyToAccount(config.privateKey);
    expect(account.address).toStrictEqual(config.address as `0x${string}`);
  });
});

describe("EvmPrivateKeyWallet", () => {
  const config = generateEvmPrivateKeyConfig();

  test("sets address from private key", () => {
    const wallet = new EvmPrivateKeyWallet(config.privateKey);
    expect(wallet.address).toBe(config.address);
  });

  test("has type evm-private-key", () => {
    const wallet = new EvmPrivateKeyWallet(config.privateKey);
    expect(wallet.type).toBe("evm-private-key");
  });
});
