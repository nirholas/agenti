import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  extractAgentText,
  extractStreamEventText,
  sendMessage,
  sendMessageStream,
  getAgentCard,
  createA2AClient,
} from "./a2a";
import { createPaymentFetch, createDryRunFetch, DryRunPaymentRequired, createClient } from "./client";
import { DryRunTransaction, PayTransaction } from "./utils/transaction";
import { EvmPrivateKeyWallet } from "./wallets/evm-private-key";
import {
  startX402FacilitatorLocal,
  stopX402FacilitatorLocal,
  TEST_ADDRESS,
  TEST_PRIVATE_KEY,
  type X402FacilitatorLocal,
} from "./testing";
import { accounts } from "x402-fl/testcontainers";

setDefaultTimeout(30_000);

describe("extractAgentText", () => {
  test("returns fallback for null/undefined result", () => {
    expect(extractAgentText(null)).toStrictEqual("The agent processed your request but returned no response.");
    expect(extractAgentText(undefined)).toStrictEqual("The agent processed your request but returned no response.");
  });

  test("extracts text from direct message response", () => {
    const result = {
      kind: "message",
      parts: [
        { kind: "text", text: "Hello " },
        { kind: "text", text: "world" },
      ],
    };
    expect(extractAgentText(result)).toStrictEqual("Hello world");
  });

  test("extracts agent messages from task-based response", () => {
    const result = {
      kind: "task",
      messages: [
        { role: "user", parts: [{ kind: "text", text: "ignored" }] },
        { role: "agent", parts: [{ kind: "text", text: "agent reply" }] },
      ],
    };
    expect(extractAgentText(result)).toStrictEqual("agent reply");
  });

  test("extracts text from task artifacts", () => {
    const result = {
      kind: "task",
      messages: [],
      artifacts: [{ parts: [{ kind: "text", text: "artifact text" }] }],
    };
    expect(extractAgentText(result)).toStrictEqual("artifact text");
  });

  test("falls back to result.text property", () => {
    const result = { text: "fallback text" };
    expect(extractAgentText(result)).toStrictEqual("fallback text");
  });

  test("returns fallback when no text found", () => {
    const result = { kind: "unknown" };
    expect(extractAgentText(result)).toStrictEqual("The agent processed your request but returned no text response.");
  });
});

describe("extractStreamEventText", () => {
  test("extracts text from artifact-update events", () => {
    const event = {
      kind: "artifact-update",
      artifact: { parts: [{ kind: "text", text: "streamed artifact" }] },
    };
    expect(extractStreamEventText(event)).toStrictEqual("streamed artifact");
  });

  test("extracts text from agent message events", () => {
    const event = {
      kind: "message",
      role: "agent",
      parts: [{ kind: "text", text: "streamed message" }],
    };
    expect(extractStreamEventText(event)).toStrictEqual("streamed message");
  });

  test("returns empty string for unknown event kinds", () => {
    expect(extractStreamEventText({ kind: "status-update" })).toStrictEqual("");
    expect(extractStreamEventText({ kind: "message", role: "user", parts: [] })).toStrictEqual("");
  });
});

const sdkClient = createClient({});
let fixture: X402FacilitatorLocal;

beforeAll(async () => {
  fixture = await startX402FacilitatorLocal();
}, 120_000);

afterAll(async () => {
  if (fixture) await stopX402FacilitatorLocal(fixture);
}, 30_000);

describe("a2a free", () => {
  test("sendMessage returns echoed text", async () => {
    const client = await createA2AClient(sdkClient, fixture.agent.getAgentHost() + "/free-echo/", fetch);
    const balanceBefore = await fixture.container.balance(TEST_ADDRESS);

    const result = await client.sendMessage({
      message: {
        kind: "message",
        messageId: randomUUID(),
        role: "user",
        parts: [{ kind: "text", text: "hello world" }],
      },
    });
    expect(extractAgentText(result)).toStrictEqual("hello world");

    const balanceAfter = await fixture.container.balance(TEST_ADDRESS);
    expect(balanceAfter.value).toStrictEqual(balanceBefore.value);
  });
});

describe("a2a x402 payment", () => {
  test("paid send succeeds with funded wallet and debits sender exactly $0.001", async () => {
    const wallet = new EvmPrivateKeyWallet(TEST_PRIVATE_KEY, fixture.container.getRpcUrl());
    const paymentFetch = createPaymentFetch(wallet);
    const client = await createA2AClient(
      sdkClient,
      fixture.agent.getAgentHost() + "/paid-echo/",
      paymentFetch as typeof fetch,
    );

    const senderBefore = await fixture.container.balance(TEST_ADDRESS);
    const receiverBefore = await fixture.container.balance(accounts.facilitator.address);

    const result = await client.sendMessage({
      message: {
        kind: "message",
        messageId: randomUUID(),
        role: "user",
        parts: [{ kind: "text", text: "hello x402" }],
      },
    });

    expect(extractAgentText(result)).toStrictEqual("hello x402");

    const senderAfter = await fixture.container.balance(TEST_ADDRESS);
    const receiverAfter = await fixture.container.balance(accounts.facilitator.address);

    // $0.001 USDC = 1000 raw units (6 decimals)
    expect(senderBefore.value - senderAfter.value).toStrictEqual(1000n);
    expect(receiverAfter.value - receiverBefore.value).toStrictEqual(1000n);
  });

  test("dry-run on paid endpoint throws DryRunPaymentRequired with cost info", async () => {
    const dryRunFetch = createDryRunFetch();
    const client = await createA2AClient(sdkClient, fixture.agent.getAgentHost() + "/paid-echo/", dryRunFetch);

    try {
      await client.sendMessage({
        message: {
          kind: "message",
          messageId: randomUUID(),
          role: "user",
          parts: [{ kind: "text", text: "dry run" }],
        },
      });
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

  test("unpaid send returns 402", async () => {
    const client = await createA2AClient(sdkClient, fixture.agent.getAgentHost() + "/paid-echo/", fetch);

    try {
      await client.sendMessage({
        message: {
          kind: "message",
          messageId: randomUUID(),
          role: "user",
          parts: [{ kind: "text", text: "should fail" }],
        },
      });
      throw new Error("Expected promise to reject, but it resolved");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toContain("402");
    }
  });

  test("unfunded wallet fails payment", async () => {
    const { generatePrivateKey } = await import("viem/accounts");
    const emptyKey = generatePrivateKey();
    const wallet = new EvmPrivateKeyWallet(emptyKey, fixture.container.getRpcUrl());
    const paymentFetch = createPaymentFetch(wallet);
    const client = await createA2AClient(
      sdkClient,
      fixture.agent.getAgentHost() + "/paid-echo/",
      paymentFetch as typeof fetch,
    );

    try {
      await client.sendMessage({
        message: {
          kind: "message",
          messageId: randomUUID(),
          role: "user",
          parts: [{ kind: "text", text: "should fail" }],
        },
      });
      throw new Error("Expected promise to reject, but it resolved");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toContain("402");
    }
  });
});

describe("sendA2AMessage", () => {
  test("free endpoint returns echoed text with no transaction mode", async () => {
    const result = await sendMessage(sdkClient, fixture.agent.getAgentHost() + "/free-echo/", "hello sdk");
    expect(result.text).toStrictEqual("hello sdk");
    expect(result.raw).not.toStrictEqual(undefined);
  });

  test("pay transaction with wallet succeeds", async () => {
    const wallet = new EvmPrivateKeyWallet(TEST_PRIVATE_KEY, fixture.container.getRpcUrl());
    const senderBefore = await fixture.container.balance(TEST_ADDRESS);

    const result = await sendMessage(sdkClient, fixture.agent.getAgentHost() + "/paid-echo/", "paid sdk", {
      mode: PayTransaction(wallet),
    });
    expect(result.text).toStrictEqual("paid sdk");

    const senderAfter = await fixture.container.balance(TEST_ADDRESS);
    expect(senderBefore.value - senderAfter.value).toStrictEqual(1000n);
  });

  test("dry-run on paid endpoint throws DryRunPaymentRequired", async () => {
    try {
      await sendMessage(sdkClient, fixture.agent.getAgentHost() + "/paid-echo/", "dry run", {
        mode: DryRunTransaction,
      });
      throw new Error("Expected DryRunPaymentRequired to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(DryRunPaymentRequired);
      const err = e as DryRunPaymentRequired;
      expect(err.requirements.length).toBeGreaterThan(0);
      expect(err.requirements[0].amount).toStrictEqual("1000");
    }
  });
});

describe("sendA2AMessageStream", () => {
  test("returns iterable stream with text chunks", async () => {
    const stream = await sendMessageStream(sdkClient, fixture.agent.getAgentHost() + "/free-echo/", "stream test");

    const events: unknown[] = [];
    for await (const event of stream) {
      events.push(event);
    }
    expect(events.length).toBeGreaterThan(0);

    // At least one event should contain extractable text
    const texts = events.map((e) => extractStreamEventText(e)).filter(Boolean);
    // The final event should be extractable via extractAgentText as fallback
    const lastEvent = events[events.length - 1];
    const finalText = texts.length > 0 ? texts.join("") : extractAgentText(lastEvent);
    expect(finalText).toContain("stream test");
  });
});

describe("getA2ACard", () => {
  test("returns agent card object", async () => {
    const card = await getAgentCard(sdkClient, fixture.agent.getAgentHost());
    expect(card.name).toStrictEqual("localhost-aixyz");
    expect(card.description).toStrictEqual("Local development agent for testing use-agently CLI.");
    expect(card.url).toStrictEqual(`${fixture.agent.getAgentHost()}/agent`);
  });
});
