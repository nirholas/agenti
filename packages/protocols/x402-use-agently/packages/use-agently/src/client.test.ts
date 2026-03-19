import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { DryRunPaymentRequired as SdkDryRunPaymentRequired } from "@use-agently/sdk";
import { mockConfigModule } from "./testing";

mockConfigModule();

const { DryRunPaymentRequired, clientFetch } = await import("./client");

describe("DryRunPaymentRequired", () => {
  test("formats USDC amount with --pay hint", () => {
    const err = new DryRunPaymentRequired([
      { amount: "1000000", network: "eip155:8453", description: "", payTo: "0x0", asset: "USDC" },
    ]);
    expect(err.message).toContain("$1 USDC");
    expect(err.message).toContain("--pay");
  });

  test("handles missing amount gracefully", () => {
    const err = new DryRunPaymentRequired([]);
    expect(err.message).toContain("could not be determined");
    expect(err.message).toContain("--pay");
  });

  test("extends SDK DryRunPaymentRequired", () => {
    const err = new DryRunPaymentRequired([
      { amount: "1000000", network: "eip155:8453", description: "", payTo: "0x0", asset: "USDC" },
    ]);
    expect(err).toBeInstanceOf(SdkDryRunPaymentRequired);
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

  test("sets User-Agent header", async () => {
    await clientFetch("http://example.com");
    const headers = fetchSpy.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("User-Agent")).toMatch(/^use-agently:\S+ \(use-agently\.com\)$/);
  });

  test("does not override existing User-Agent header", async () => {
    await clientFetch("http://example.com", { headers: { "User-Agent": "custom/1.0" } });
    const headers = fetchSpy.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("User-Agent")).toStrictEqual("custom/1.0");
  });
});
