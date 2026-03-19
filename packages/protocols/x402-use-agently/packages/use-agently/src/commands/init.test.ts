import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { privateKeyToAccount } from "viem/accounts";
import { captureOutput, TEST_PRIVATE_KEY } from "../testing";

const TEST_ADDRESS = privateKeyToAccount(TEST_PRIVATE_KEY).address;

let mockExistingConfig: unknown = undefined;
const saveConfigSpy = mock(async (_config: unknown, _scope: unknown) => {});

mock.module("../config.js", () => ({
  loadConfig: async () => mockExistingConfig,
  saveConfig: saveConfigSpy,
  backupConfig: async () => "/backup/config.json",
  getConfigOrThrow: async () => {
    throw new Error("No wallet configured.");
  },
}));

const sdk = await import("@use-agently/sdk");
mock.module("@use-agently/sdk", () => ({
  ...sdk,
  generateEvmPrivateKeyConfig: () => ({
    type: "evm-private-key",
    privateKey: TEST_PRIVATE_KEY,
    address: TEST_ADDRESS,
  }),
}));

const { cli } = await import("../cli");

describe("init command", () => {
  const out = captureOutput();
  let exitSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    mockExistingConfig = undefined;
    saveConfigSpy.mockClear();
    exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  test("json output on new wallet", async () => {
    await cli.parseAsync(["test", "use-agently", "-o", "json", "init"]);

    expect(out.json).toEqual({
      address: TEST_ADDRESS,
      message: "fund this address to start using agents on use-agently.com",
    });
  });

  test("calls saveConfig with generated wallet", async () => {
    await cli.parseAsync(["test", "use-agently", "init"]);

    expect(saveConfigSpy).toHaveBeenCalledTimes(1);
    const [config, scope] = saveConfigSpy.mock.calls[0];
    expect(config).toEqual({
      wallet: {
        type: "evm-private-key",
        privateKey: TEST_PRIVATE_KEY,
        address: TEST_ADDRESS,
      },
    });
    expect(scope).toStrictEqual("global");
  });

  test("errors when wallet already exists without --regenerate", async () => {
    mockExistingConfig = { wallet: { type: "evm-private-key" } };

    try {
      await cli.parseAsync(["test", "use-agently", "init"]);
    } catch {
      // expected: process.exit throws
    }

    expect(out.stderr).toContain("Wallet already configured");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test("regenerate creates new wallet with json output", async () => {
    mockExistingConfig = { wallet: { type: "evm-private-key" } };
    await cli.parseAsync(["test", "use-agently", "-o", "json", "init", "--regenerate"]);

    expect(out.json).toEqual({
      address: TEST_ADDRESS,
      message: "fund this address to start using agents on use-agently.com",
    });
    expect(saveConfigSpy).toHaveBeenCalledTimes(1);
  });
});
