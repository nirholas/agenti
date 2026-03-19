import type { Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_PRIVATE_KEY: Hex =
  "0x0ee876735a3d8ea5507a6e984ed60e7f16ceb60aca56546f2dbcac61ebd40730";

const mockWrappedFetch = vi.fn();

vi.mock("@libertai/x402", () => ({
  wrapFetchWithPayment: () => mockWrappedFetch,
}));

describe("createLLMClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an OpenAI instance with default baseURL", async () => {
    const { createLLMClient } = await import("../src/client.js");
    const client = createLLMClient(TEST_PRIVATE_KEY);

    expect(client).toBeDefined();
    expect(client.chat).toBeDefined();
    expect(client.chat.completions).toBeDefined();
    expect(client.baseURL).toBe("https://api.libertai.io/v1");
  });

  it("accepts custom baseURL", async () => {
    const { createLLMClient } = await import("../src/client.js");
    const client = createLLMClient(TEST_PRIVATE_KEY, {
      baseURL: "https://custom.api/v1",
    });

    expect(client.baseURL).toBe("https://custom.api/v1");
  });

  it("uses wrapFetchWithPayment as fetch", async () => {
    const { createLLMClient } = await import("../src/client.js");
    const client = createLLMClient(TEST_PRIVATE_KEY);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((client as any).fetch).toBe(mockWrappedFetch);
  });
});
