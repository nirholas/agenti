import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  captureOutput,
  mockConfigModule,
  startX402FacilitatorLocal,
  stopX402FacilitatorLocal,
  TEST_ADDRESS,
  type X402FacilitatorLocal,
} from "../testing";

mockConfigModule();

const { cli } = await import("../cli");

describe("balance command", () => {
  const out = captureOutput();
  let fixture: X402FacilitatorLocal;

  beforeAll(async () => {
    fixture = await startX402FacilitatorLocal();
  }, 120_000);

  afterAll(async () => {
    if (fixture) await stopX402FacilitatorLocal(fixture);
  }, 30_000);

  test("json output (default in non-TTY)", async () => {
    await cli.parseAsync(["test", "use-agently", "-o", "json", "balance", "--rpc", fixture.container.getRpcUrl()]);

    const parsed = out.json as Record<string, unknown>;
    expect(parsed.address).toStrictEqual(TEST_ADDRESS);
    expect(parsed.currency).toStrictEqual("USDC");
    expect(parsed.network).toStrictEqual("Base");
    expect(Number(parsed.balance as string)).toBeGreaterThan(0);
  });

  test("json output", async () => {
    await cli.parseAsync(["test", "use-agently", "-o", "json", "balance", "--rpc", fixture.container.getRpcUrl()]);

    const parsed = out.json as Record<string, unknown>;
    expect(parsed).toStrictEqual({
      address: TEST_ADDRESS,
      currency: "USDC",
      network: "Base",
      balance: expect.any(String),
    });
    expect(Number(parsed.balance)).toBeGreaterThan(0);
  });
});
