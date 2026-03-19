import { describe, expect, test } from "bun:test";
import { search, getAgent } from "./agently";
import { createClient } from "./client";

const client = createClient({});

describe("search", () => {
  test("returns search results with default options", async () => {
    const result = await search(client);
    expect(result.hits).toBeInstanceOf(Array);
    expect(result.found).toBeGreaterThanOrEqual(0);
    expect(result.page).toBe(1);
    expect(result.per_page).toBe(20);
  });

  test("search with query returns matching results", async () => {
    const result = await search(client, { q: "echo" });
    expect(result.hits).toBeInstanceOf(Array);
    for (const hit of result.hits) {
      expect(hit.id).toBeDefined();
      expect(hit.name).toBeDefined();
    }
  });

  test("search with chain_id filters results", async () => {
    const result = await search(client, { chain_id: ["eip155:8453"] });
    expect(result.hits).toBeInstanceOf(Array);
    for (const hit of result.hits) {
      expect(hit.chain_id).toBe("eip155:8453");
    }
  });

  test("search with pagination", async () => {
    const result = await search(client, { page: 1, per_page: 5 });
    expect(result.hits.length).toBeLessThanOrEqual(5);
    expect(result.page).toBe(1);
    expect(result.per_page).toBe(5);
  });

  test("search result hits have required fields", async () => {
    const result = await search(client, { per_page: 1 });
    if (result.hits.length > 0) {
      const hit = result.hits[0];
      expect(hit.id).toBeString();
      expect(hit.chain_id).toBeString();
      expect(hit.address).toBeString();
      expect(hit.agent_id).toBeString();
      expect(hit.name).toBeString();
      expect(hit.description).toBeString();
      expect(hit.created_at).toBeString();
    }
  });
});

describe("getAgent", () => {
  test("returns agent with metadata for a known agent", async () => {
    const agentId = "eip155:8453/erc8004:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432/25330";
    const agent = (await getAgent(client, agentId))!;
    expect(agent).toBeDefined();
    expect(agent.id).toBe(agentId);
    expect(agent.chain_id).toBe("eip155:8453");
    expect(agent.address).toBe("0x8004a169fb4a3325136eb29fa0ceb6d2e539a432");
    expect(agent.agent_id).toBe("25330");
    expect(agent.name).toBeString();
    expect(agent.metadata).toBeDefined();
    expect(agent.metadata.type).toBeString();
    expect(agent.metadata.services).toBeInstanceOf(Array);
  });

  test("resolves mixed-case address to the same agent", async () => {
    const mixedCaseId = "eip155:8453/erc8004:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/25330";
    const agent = await getAgent(client, mixedCaseId);
    expect(agent).toBeDefined();
    expect(agent!.id).toBe("eip155:8453/erc8004:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432/25330");
  });

  test("returns undefined for non-existent agent", async () => {
    const agent = await getAgent(client, "eip155:1/erc8004:0x0000000000000000000000000000000000000000/999999");
    expect(agent).toBeUndefined();
  });
});
