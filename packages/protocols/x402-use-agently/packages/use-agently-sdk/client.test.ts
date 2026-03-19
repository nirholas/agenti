import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { DryRunPaymentRequired, createDryRunFetch, clientFetch, type PaymentRequirementsInfo } from "./client";

describe("DryRunPaymentRequired", () => {
  test("formats USDC amount with network", () => {
    const err = new DryRunPaymentRequired([
      {
        amount: "1000",
        network: "eip155:8453",
        description: "Payment required",
        payTo: "0xabc",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      },
    ]);
    expect(err.name).toBe("DryRunPaymentRequired");
    expect(err.message).toBe(
      "This request requires payment of $0.001 USDC on eip155:8453.\nUse createPaymentFetch() instead of createDryRunFetch() to authorize the transaction.",
    );
  });

  test("formats whole dollar amount without trailing decimals", () => {
    const err = new DryRunPaymentRequired([
      {
        amount: "1000000",
        network: "eip155:8453",
        description: "",
        payTo: "0xabc",
        asset: "0xabc",
      },
    ]);
    expect(err.message).toBe(
      "This request requires payment of $1 USDC on eip155:8453.\nUse createPaymentFetch() instead of createDryRunFetch() to authorize the transaction.",
    );
  });

  test("uses fallback message when requirements are empty", () => {
    const err = new DryRunPaymentRequired([]);
    expect(err.message).toBe(
      "This request requires payment, but the amount could not be determined.\nInspect the endpoint manually or use createPaymentFetch() to authorize payment.",
    );
  });

  test("stores requirements on the error instance", () => {
    const reqs: PaymentRequirementsInfo[] = [
      { amount: "500", network: "eip155:1", description: "", payTo: "0xabc", asset: "0xabc" },
    ];
    const err = new DryRunPaymentRequired(reqs);
    expect(err.requirements).toEqual(reqs);
  });
});

describe("createDryRunFetch", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  test("passes through non-402 responses", async () => {
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
    const dryRunFetch = createDryRunFetch();
    const response = await dryRunFetch("https://example.com");
    expect(response.status).toBe(200);
  });

  test("throws DryRunPaymentRequired on 402 with PAYMENT-REQUIRED header", async () => {
    const paymentRequired = {
      x402Version: 2,
      accepts: [
        {
          amount: "1000",
          network: "eip155:8453",
          description: "Test payment",
          payTo: "0xabc",
          asset: "0xabc",
        },
      ],
    };
    const header = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");

    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 402, headers: { "PAYMENT-REQUIRED": header } }),
    );

    const dryRunFetch = createDryRunFetch();
    try {
      await dryRunFetch("https://example.com/paid");
      throw new Error("Expected DryRunPaymentRequired to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DryRunPaymentRequired);
      expect((err as DryRunPaymentRequired).requirements[0].amount).toBe("1000");
    }
  });

  test("throws DryRunPaymentRequired with empty requirements on 402 without header", async () => {
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 402 }));

    const dryRunFetch = createDryRunFetch();
    try {
      await dryRunFetch("https://example.com/paid");
      throw new Error("Expected DryRunPaymentRequired to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DryRunPaymentRequired);
      expect((err as DryRunPaymentRequired).requirements).toEqual([]);
    }
  });
});

describe("clientFetch", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test("sets User-Agent header automatically", async () => {
    await clientFetch("https://example.com");
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init?.headers);
    expect(headers.get("User-Agent")).toMatch("@use-agently/sdk:");
  });

  test("preserves existing User-Agent if already set", async () => {
    await clientFetch("https://example.com", { headers: { "User-Agent": "custom/1.0" } });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init?.headers);
    expect(headers.get("User-Agent")).toBe("custom/1.0");
  });
});
