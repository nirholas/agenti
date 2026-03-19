import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { captureOutput, mockConfigModule } from "../testing";

mockConfigModule();

const { cli } = await import("../cli");

const TEST_HITS = [
  {
    id: "eip155:8453/erc8004:0x1234/1",
    chain_id: "eip155:8453",
    address: "0x1234",
    agent_id: "1",
    owner: "0xabc",
    name: "Echo Agent",
    description: "An echo agent",
    created_at: "2025-01-01T00:00:00.000Z",
  },
];

describe("search command", () => {
  const out = captureOutput();
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ hits: TEST_HITS, found: 1, page: 1, per_page: 20 })),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test("returns agents with no query", async () => {
    await cli.parseAsync(["test", "use-agently", "-o", "json", "search"]);
    const parsed = out.jsonLines as any;
    expect(parsed).toHaveLength(1);
  });

  test("passes query to search API", async () => {
    await cli.parseAsync(["test", "use-agently", "search", "-q", "echo"]);
    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("q")).toBe("echo");
  });

  test("json output", async () => {
    await cli.parseAsync(["test", "use-agently", "-o", "json", "search"]);
    const lines = out.jsonLines as any[];
    expect(lines).toHaveLength(1);
    expect(lines[0].name).toBe("Echo Agent");
  });
});
