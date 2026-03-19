import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";

import {
  captureOutput,
  mockConfigModule,
  startX402FacilitatorLocal,
  stopX402FacilitatorLocal,
  TEST_ADDRESS,
  testWalletConfig,
  type X402FacilitatorLocal,
} from "../testing";

setDefaultTimeout(30_000);

mockConfigModule();

const { cli } = await import("../cli");

let fixture: X402FacilitatorLocal;

beforeAll(async () => {
  fixture = await startX402FacilitatorLocal();
}, 120_000);

afterAll(async () => {
  if (fixture) await stopX402FacilitatorLocal(fixture);
}, 30_000);

describe("a2a send command (free)", () => {
  const out = captureOutput();

  test("text output", async () => {
    await cli.parseAsync([
      "test",
      "use-agently",
      "a2a",
      "send",
      "--uri",
      fixture.agent.getAgentHost() + "/free-echo/",
      "-m",
      "hello world",
    ]);
    expect(out.stdout).toStrictEqual("hello world");
  });

  test("streams text output 10 times", async () => {
    await cli.parseAsync([
      "test",
      "use-agently",
      "a2a",
      "send",
      "--uri",
      fixture.agent.getAgentHost() + "/free-echo-10/",
      "-m",
      "hi",
    ]);
    // free-echo-10 streams the message back 10 times with 200ms delays between each chunk
    const expected = "hi\nhi\nhi\nhi\nhi\nhi\nhi\nhi\nhi\nhi";
    expect(out.stdout).toStrictEqual(expected);
  }, 15000);
});

describe("a2a card command (free)", () => {
  const out = captureOutput();

  test("json output returns agent card fields", async () => {
    await cli.parseAsync(["test", "use-agently", "-o", "json", "a2a", "card", "--uri", fixture.agent.getAgentHost()]);
    const card = out.json as Record<string, unknown>;
    expect(card).toHaveProperty("name");
    expect(card).toHaveProperty("description");
    expect(card).toHaveProperty("url");
  });

  test("json output returns agent card as JSON", async () => {
    await cli.parseAsync(["test", "use-agently", "-o", "json", "a2a", "card", "--uri", fixture.agent.getAgentHost()]);
    const card = out.json as Record<string, unknown>;
    expect(card).toHaveProperty("name");
    expect(card).toHaveProperty("description");
    expect(card).toHaveProperty("url");
  });
});

describe("a2a send command (paid)", () => {
  const out = captureOutput();

  test("a2a send without --pay on paid agent shows dry-run cost message and exits 1", async () => {
    let exitCode: number | undefined;
    const origExit = process.exit.bind(process);
    process.exit = ((code?: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit;

    try {
      await cli.parseAsync([
        "test",
        "use-agently",
        "a2a",
        "send",
        "--uri",
        fixture.agent.getAgentHost() + "/paid-echo/",
        "-m",
        "hello",
      ]);
    } catch {
      // expected: process.exit throws
    } finally {
      process.exit = origExit;
    }

    expect(exitCode).toBe(1);
    expect(out.stderr).toContain("--pay");
  });

  test("a2a send with --pay on paid agent succeeds and debits sender", async () => {
    mockConfigModule(() => ({ wallet: testWalletConfig(fixture.container.getRpcUrl()) }));

    const senderBefore = await fixture.container.balance(TEST_ADDRESS);

    await cli.parseAsync([
      "test",
      "use-agently",
      "a2a",
      "send",
      "--uri",
      fixture.agent.getAgentHost() + "/paid-echo/",
      "-m",
      "paid cli test",
      "--pay",
    ]);
    expect(out.stdout).toStrictEqual("paid cli test");

    const senderAfter = await fixture.container.balance(TEST_ADDRESS);
    expect(senderBefore.value - senderAfter.value).toStrictEqual(1000n);

    // Restore default mock
    mockConfigModule();
  }, 30_000);
});
