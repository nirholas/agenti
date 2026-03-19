import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { captureOutput, mockConfigModule } from "../testing";

mockConfigModule();

const { cli } = await import("../cli");

const TEST_AGENT = {
  id: "eip155:8453/erc8004:0x1234/1",
  chain_id: "eip155:8453",
  address: "0x1234",
  agent_id: "1",
  owner: "0xabc",
  name: "Echo Agent",
  description: "An echo agent",
  protocols: ["a2a"],
  created_at: "2025-01-01T00:00:00.000Z",
  metadata: {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "Echo Agent",
    description: "An echo agent",
    services: [{ name: "a2a", endpoint: "https://echo.example.com", version: "1.0" }],
  },
};

describe("view command", () => {
  const out = captureOutput();
  let fetchSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  test("displays agent details", async () => {
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(TEST_AGENT)));
    await cli.parseAsync(["test", "use-agently", "-o", "json", "view", "--uri", "eip155:8453/erc8004:0x1234/1"]);
    const parsed = out.json as Record<string, unknown>;
    expect(parsed).toHaveProperty("name", "Echo Agent");
    expect(parsed).toHaveProperty("id", "eip155:8453/erc8004:0x1234/1");
    expect(parsed).toHaveProperty("metadata");
  });

  test("json output", async () => {
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(TEST_AGENT)));
    await cli.parseAsync(["test", "use-agently", "-o", "json", "view", "--uri", "eip155:8453/erc8004:0x1234/1"]);
    const parsed = out.json as Record<string, unknown>;
    expect(parsed).toHaveProperty("name", "Echo Agent");
    expect(parsed).toHaveProperty("metadata");
  });

  test("throws error for unknown agent", async () => {
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Agent not found" }), { status: 404 }),
    );
    await expect(
      cli.parseAsync(["test", "use-agently", "view", "--uri", "eip155:8453/erc8004:0xDEAD/99"]),
    ).rejects.toThrow("No agent found for URI");
  });
});
