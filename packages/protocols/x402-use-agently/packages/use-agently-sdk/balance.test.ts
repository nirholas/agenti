import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { getBalance } from "./balance";
import {
  startX402FacilitatorLocal,
  stopX402FacilitatorLocal,
  TEST_ADDRESS,
  type X402FacilitatorLocal,
} from "./testing";

let fixture: X402FacilitatorLocal;

beforeAll(async () => {
  fixture = await startX402FacilitatorLocal();
}, 120_000);

afterAll(async () => {
  if (fixture) await stopX402FacilitatorLocal(fixture);
}, 30_000);

describe("getBalance", () => {
  test("returns funded wallet balance", async () => {
    const result = await getBalance(TEST_ADDRESS, { rpc: fixture.container.getRpcUrl() });
    expect(result.address).toStrictEqual(TEST_ADDRESS);
    expect(result.currency).toStrictEqual("USDC");
    expect(result.network).toStrictEqual("Base");
    expect(parseFloat(result.balance)).toBeGreaterThan(0);
  });

  test("returns zero balance for unfunded wallet", async () => {
    const { generatePrivateKey, privateKeyToAccount } = await import("viem/accounts");
    const emptyAddress = privateKeyToAccount(generatePrivateKey()).address;

    const result = await getBalance(emptyAddress, { rpc: fixture.container.getRpcUrl() });
    expect(result.address).toStrictEqual(emptyAddress);
    expect(result.balance).toStrictEqual("0");
    expect(result.currency).toStrictEqual("USDC");
    expect(result.network).toStrictEqual("Base");
  });

  test("reflects exact balance after funding", async () => {
    const { generatePrivateKey, privateKeyToAccount } = await import("viem/accounts");
    const address = privateKeyToAccount(generatePrivateKey()).address;

    const before = await getBalance(address, { rpc: fixture.container.getRpcUrl() });
    expect(before.balance).toStrictEqual("0");

    await fixture.container.fund(address, "42.5");

    const after = await getBalance(address, { rpc: fixture.container.getRpcUrl() });
    expect(after.balance).toStrictEqual("42.5");
  });
});
