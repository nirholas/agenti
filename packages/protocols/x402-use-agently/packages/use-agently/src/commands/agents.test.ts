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
    name: "Test Agent",
    description: "A test agent",
    created_at: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "eip155:8453/erc8004:0x1234/2",
    chain_id: "eip155:8453",
    address: "0x1234",
    agent_id: "2",
    owner: null,
    name: "Another Agent",
    description: "Another test agent",
    created_at: "2025-01-01T00:00:00.000Z",
  },
];

describe("agents command", () => {
  const out = captureOutput();
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ hits: TEST_HITS, found: 2, page: 1, per_page: 20 })),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test("json output", async () => {
    await cli.parseAsync(["test", "use-agently", "-o", "json", "agents"]);

    const lines = out.jsonLines as any[];
    expect(lines).toHaveLength(2);
    expect(Object.keys(lines[0])).toEqual(["id", "name", "description"]);
  });

  test("tui output renders a table with items", async () => {
    await cli.parseAsync(["test", "use-agently", "-o", "tui", "agents"]);

    const rendered = out.stdout;
    expect(rendered).toContain("Test Agent");
    expect(rendered).toContain("Another Agent");
    expect(rendered).toContain("─");
  });

  test("tui output for empty list renders boxen to stderr", async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ hits: [], found: 0, page: 1, per_page: 20 })));
    await cli.parseAsync(["test", "use-agently", "-o", "tui", "agents"]);

    expect(out.stderr).toContain("No results found.");
  });

  test("empty agents list", async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ hits: [], found: 0, page: 1, per_page: 20 })));
    await cli.parseAsync(["test", "use-agently", "-o", "json", "agents"]);

    expect(out.jsonLines).toEqual([]);
  });

  test("fetches from agently search API", async () => {
    await cli.parseAsync(["test", "use-agently", "agents"]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.origin).toBe("https://api.use-agently.com");
    expect(calledUrl.pathname).toBe("/search");
  });

  test("sends User-Agent header containing use-agently.com", async () => {
    await cli.parseAsync(["test", "use-agently", "agents"]);

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init?.headers);
    expect(headers.get("User-Agent")).toContain("use-agently.com");
  });
});
