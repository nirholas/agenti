import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test, spyOn } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { generatePrivateKey } from "viem/accounts";
import { listMcpTools, callMcpTool } from "./mcp";
import { createMcpPaymentClient, DryRunPaymentRequired, createClient } from "./client";
import { EvmPrivateKeyWallet } from "./wallets/evm-private-key";
import { PayTransaction } from "./utils/transaction";
import {
  startX402FacilitatorLocal,
  stopX402FacilitatorLocal,
  TEST_ADDRESS,
  TEST_PRIVATE_KEY,
  type X402FacilitatorLocal,
} from "./testing";
import { accounts } from "x402-fl/testcontainers";
import pkg from "./package.json" with { type: "json" };

setDefaultTimeout(30_000);

const sdkClient = createClient({});
let fixture: X402FacilitatorLocal;

beforeAll(async () => {
  fixture = await startX402FacilitatorLocal();
}, 120_000);

afterAll(async () => {
  if (fixture) await stopX402FacilitatorLocal(fixture);
}, 30_000);

function mcpUrl(): string {
  return fixture.agent.getAgentHost().replace(/\/?$/, "/mcp");
}

async function createMcpClient(): Promise<Client> {
  const client = new Client({ name: "@use-agently/sdk-test", version: pkg.version });
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl()));
  await client.connect(transport);
  return client;
}

describe("mcp free", () => {
  test("calls echo tool and returns text content", async () => {
    const client = await createMcpClient();
    try {
      const balanceBefore = await fixture.container.balance(TEST_ADDRESS);

      const result = await client.callTool({ name: "echo", arguments: { message: "hello from mcp" } });
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toStrictEqual("hello from mcp");

      const balanceAfter = await fixture.container.balance(TEST_ADDRESS);
      expect(balanceAfter.value).toStrictEqual(balanceBefore.value);
    } finally {
      await client.close();
    }
  });
});

describe("mcp x402 payment", () => {
  test("paid tool call succeeds with funded wallet and debits sender exactly $0.001", async () => {
    const wallet = new EvmPrivateKeyWallet(TEST_PRIVATE_KEY, fixture.container.getRpcUrl());
    const client = await createMcpClient();
    try {
      const senderBefore = await fixture.container.balance(TEST_ADDRESS);
      const receiverBefore = await fixture.container.balance(accounts.facilitator.address);

      const x402Client = createMcpPaymentClient(client, wallet);
      const result = await x402Client.callTool("paid-echo-tool", { message: "hello mcp x402" });
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toStrictEqual("hello mcp x402");

      const senderAfter = await fixture.container.balance(TEST_ADDRESS);
      const receiverAfter = await fixture.container.balance(accounts.facilitator.address);

      // $0.001 USDC = 1000 raw units (6 decimals)
      expect(senderBefore.value - senderAfter.value).toStrictEqual(1000n);
      expect(receiverAfter.value - receiverBefore.value).toStrictEqual(1000n);
    } finally {
      await client.close();
    }
  });

  test("unpaid tool call returns error", async () => {
    const client = await createMcpClient();
    try {
      const result = await client.callTool({ name: "paid-echo-tool", arguments: { message: "should fail" } });
      expect(result.isError).toStrictEqual(true);
    } finally {
      await client.close();
    }
  });
});

describe("listMcpTools", () => {
  test("returns array including echo tool", async () => {
    const tools = await listMcpTools(sdkClient, mcpUrl());
    expect(Array.isArray(tools)).toBe(true);
    const echoTool = tools.find((t) => t.name === "echo");
    expect(echoTool).toBeDefined();
  });

  test("sends User-Agent header by default (via clientFetch)", async () => {
    const spy = spyOn(globalThis, "fetch");
    try {
      await listMcpTools(sdkClient, mcpUrl());
      const headers = new Headers(spy.mock.calls[0][1]?.headers);
      expect(headers.get("User-Agent")).toMatch("@use-agently/sdk:");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("callMcpTool", () => {
  test("free tool call succeeds in dry-run mode", async () => {
    const result = await callMcpTool(sdkClient, mcpUrl(), "echo", { message: "hello high-level" });
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toStrictEqual("hello high-level");
  });

  test("paid tool call succeeds with PayTransaction", async () => {
    const wallet = new EvmPrivateKeyWallet(TEST_PRIVATE_KEY, fixture.container.getRpcUrl());
    const senderBefore = await fixture.container.balance(TEST_ADDRESS);
    const receiverBefore = await fixture.container.balance(accounts.facilitator.address);

    const result = await callMcpTool(
      sdkClient,
      mcpUrl(),
      "paid-echo-tool",
      { message: "hello paid high-level" },
      {
        transaction: PayTransaction(wallet),
      },
    );
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toStrictEqual("hello paid high-level");

    const senderAfter = await fixture.container.balance(TEST_ADDRESS);
    const receiverAfter = await fixture.container.balance(accounts.facilitator.address);
    expect(senderBefore.value - senderAfter.value).toStrictEqual(1000n);
    expect(receiverAfter.value - receiverBefore.value).toStrictEqual(1000n);
  });

  test("paid tool dry-run throws DryRunPaymentRequired with cost info", async () => {
    try {
      await callMcpTool(sdkClient, mcpUrl(), "paid-echo-tool", { message: "should fail" });
      throw new Error("Expected DryRunPaymentRequired to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(DryRunPaymentRequired);
      const err = e as DryRunPaymentRequired;
      expect(err.requirements.length).toBeGreaterThan(0);
      expect(err.requirements[0].amount).toStrictEqual("1000");
      expect(err.requirements[0].network).toStrictEqual("eip155:8453");
      expect(err.message).toContain("$0.001");
      expect(err.message).toContain("USDC");
    }
  });

  test("custom fetchImpl is used for paid tool call", async () => {
    const wallet = new EvmPrivateKeyWallet(TEST_PRIVATE_KEY, fixture.container.getRpcUrl());
    const spy = spyOn(globalThis, "fetch");
    try {
      // @ts-expect-error — Bun's typeof fetch includes preconnect namespace (oven-sh/bun#23741)
      const customFetch: typeof fetch = (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("X-Custom-Header", "pay-test");
        return globalThis.fetch(input, { ...init, headers });
      };

      const result = await callMcpTool(
        sdkClient,
        mcpUrl(),
        "paid-echo-tool",
        { message: "hello custom fetch pay" },
        {
          transaction: PayTransaction(wallet),
          fetchImpl: customFetch,
        },
      );
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toStrictEqual("hello custom fetch pay");

      // Verify the custom header was sent on at least one underlying fetch call
      const hasCustomHeader = spy.mock.calls.some((call) => {
        const headers = new Headers(call[1]?.headers);
        return headers.get("X-Custom-Header") === "pay-test";
      });
      expect(hasCustomHeader).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  test("custom fetchImpl is used for dry-run tool call", async () => {
    const spy = spyOn(globalThis, "fetch");
    try {
      // @ts-expect-error — Bun's typeof fetch includes preconnect namespace (oven-sh/bun#23741)
      const customFetch: typeof fetch = (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("X-Custom-Header", "dryrun-test");
        return globalThis.fetch(input, { ...init, headers });
      };

      const result = await callMcpTool(
        sdkClient,
        mcpUrl(),
        "echo",
        { message: "hello custom fetch dryrun" },
        { fetchImpl: customFetch },
      );
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toStrictEqual("hello custom fetch dryrun");

      const hasCustomHeader = spy.mock.calls.some((call) => {
        const headers = new Headers(call[1]?.headers);
        return headers.get("X-Custom-Header") === "dryrun-test";
      });
      expect(hasCustomHeader).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  test("paid tool with unfunded wallet returns isError with insufficient_funds", async () => {
    const unfundedKey = generatePrivateKey();
    const unfundedWallet = new EvmPrivateKeyWallet(unfundedKey, fixture.container.getRpcUrl());

    const result = await callMcpTool(
      sdkClient,
      mcpUrl(),
      "paid-echo-tool",
      { message: "should fail — no funds" },
      { transaction: PayTransaction(unfundedWallet) },
    );

    expect(result.isError).toStrictEqual(true);

    const content = result.content as Array<{ type: string; text?: string }>;
    expect(content.length).toBeGreaterThan(0);
    expect(content[0].type).toStrictEqual("text");

    const parsed = JSON.parse(content[0].text!);
    expect(parsed.x402Version).toBeDefined();
    expect(parsed.accepts).toBeDefined();
    expect(Array.isArray(parsed.accepts)).toBe(true);
    expect(parsed.error).toContain("insufficient_funds");
  });
});
