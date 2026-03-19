import { describe, expect, it } from "vitest";

import {
  deriveSessionId,
  DEFAULT_SESSION_CONFIG,
  SessionStore,
  hashRequestContent,
} from "./session.js";

describe("deriveSessionId", () => {
  it("returns same ID for same first user message", () => {
    const messages = [{ role: "user", content: "hello world" }];
    const id1 = deriveSessionId(messages);
    const id2 = deriveSessionId(messages);
    expect(id1).toBe(id2);
  });

  it("returns different IDs for different first user messages", () => {
    const a = deriveSessionId([{ role: "user", content: "first conversation" }]);
    const b = deriveSessionId([{ role: "user", content: "second conversation" }]);
    expect(a).not.toBe(b);
  });

  it("is stable regardless of subsequent messages", () => {
    const firstMsg = { role: "user", content: "what is the capital of France?" };
    const id1 = deriveSessionId([firstMsg]);
    const id2 = deriveSessionId([
      firstMsg,
      { role: "assistant", content: "Paris" },
      { role: "user", content: "and Germany?" },
    ]);
    expect(id1).toBe(id2);
  });

  it("skips system messages and uses first user message", () => {
    const withSystem = [
      { role: "system", content: "you are a helpful assistant" },
      { role: "user", content: "my question" },
    ];
    const withoutSystem = [{ role: "user", content: "my question" }];
    expect(deriveSessionId(withSystem)).toBe(deriveSessionId(withoutSystem));
  });

  it("returns undefined when no user messages exist", () => {
    expect(deriveSessionId([])).toBeUndefined();
    expect(deriveSessionId([{ role: "system", content: "only system" }])).toBeUndefined();
  });

  it("returns a short hex string (8 chars)", () => {
    const id = deriveSessionId([{ role: "user", content: "test" }]);
    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("DEFAULT_SESSION_CONFIG", () => {
  it("has session persistence enabled by default", () => {
    expect(DEFAULT_SESSION_CONFIG.enabled).toBe(true);
  });
});

describe("SessionStore.setSession", () => {
  it("updates pinned model when fallback model differs from routing decision", () => {
    const store = new SessionStore();
    const sessionId = "abc12345";

    // First call: routing decision pins kimi-k2.5
    store.setSession(sessionId, "moonshot/kimi-k2.5", "MEDIUM");
    expect(store.getSession(sessionId)?.model).toBe("moonshot/kimi-k2.5");

    // Second call: actual model used was fallback (gemini-flash)
    store.setSession(sessionId, "google/gemini-2.5-flash-lite", "MEDIUM");
    expect(store.getSession(sessionId)?.model).toBe("google/gemini-2.5-flash-lite");
  });

  it("subsequent requests use the fallback model when pinned", () => {
    const store = new SessionStore();
    const sessionId = "abc12345";

    store.setSession(sessionId, "moonshot/kimi-k2.5", "MEDIUM");
    store.setSession(sessionId, "google/gemini-2.5-flash-lite", "MEDIUM");

    // Next request reads pinned model — should get the fallback, not the primary
    const pinned = store.getSession(sessionId);
    expect(pinned?.model).toBe("google/gemini-2.5-flash-lite");
    expect(pinned?.requestCount).toBe(2);
  });

  it("initializes three-strike fields on new session", () => {
    const store = new SessionStore();
    store.setSession("s1", "model-a", "SIMPLE");
    const entry = store.getSession("s1");
    expect(entry?.recentHashes).toEqual([]);
    expect(entry?.strikes).toBe(0);
    expect(entry?.escalated).toBe(false);
  });
});

describe("SessionStore.recordRequestHash", () => {
  it("triggers escalation after 3 consecutive identical hashes", () => {
    const store = new SessionStore();
    store.setSession("s1", "moonshot/kimi-k2.5", "MEDIUM");

    expect(store.recordRequestHash("s1", "aaa")).toBe(false); // 1st — no prior
    expect(store.recordRequestHash("s1", "aaa")).toBe(false); // 2nd — strikes=1
    expect(store.recordRequestHash("s1", "aaa")).toBe(true); // 3rd — strikes=2, trigger!
  });

  it("resets strikes when a different hash is inserted", () => {
    const store = new SessionStore();
    store.setSession("s1", "moonshot/kimi-k2.5", "MEDIUM");

    store.recordRequestHash("s1", "aaa");
    store.recordRequestHash("s1", "aaa"); // strikes=1
    store.recordRequestHash("s1", "bbb"); // different → strikes=0
    expect(store.recordRequestHash("s1", "bbb")).toBe(false); // strikes=1, not 2 yet
  });

  it("returns false for unknown session", () => {
    const store = new SessionStore();
    expect(store.recordRequestHash("nonexistent", "aaa")).toBe(false);
  });
});

describe("SessionStore.escalateSession", () => {
  const tierConfigs = {
    SIMPLE: { primary: "cheap-model", fallback: [] },
    MEDIUM: { primary: "moonshot/kimi-k2.5", fallback: ["google/gemini-2.5-flash-lite"] },
    COMPLEX: { primary: "anthropic/claude-sonnet-4", fallback: ["openai/gpt-4o"] },
    REASONING: { primary: "anthropic/claude-opus-4", fallback: [] },
  };

  it("escalates from MEDIUM to COMPLEX", () => {
    const store = new SessionStore();
    store.setSession("s1", "moonshot/kimi-k2.5", "MEDIUM");

    const result = store.escalateSession("s1", tierConfigs);
    expect(result).toEqual({ model: "anthropic/claude-sonnet-4", tier: "COMPLEX" });

    const entry = store.getSession("s1");
    expect(entry?.model).toBe("anthropic/claude-sonnet-4");
    expect(entry?.tier).toBe("COMPLEX");
    expect(entry?.escalated).toBe(true);
    expect(entry?.strikes).toBe(0);
  });

  it("returns null when already at REASONING (max tier)", () => {
    const store = new SessionStore();
    store.setSession("s1", "anthropic/claude-opus-4", "REASONING");

    const result = store.escalateSession("s1", tierConfigs);
    expect(result).toBeNull();
  });

  it("does not re-trigger after escalation (escalated flag)", () => {
    const store = new SessionStore();
    store.setSession("s1", "moonshot/kimi-k2.5", "MEDIUM");

    // Trigger escalation
    store.recordRequestHash("s1", "aaa");
    store.recordRequestHash("s1", "aaa");
    const shouldEscalate = store.recordRequestHash("s1", "aaa");
    expect(shouldEscalate).toBe(true);

    store.escalateSession("s1", tierConfigs);

    // Now even with more repeated hashes, should NOT trigger again
    store.recordRequestHash("s1", "bbb");
    store.recordRequestHash("s1", "bbb");
    expect(store.recordRequestHash("s1", "bbb")).toBe(false); // escalated=true blocks it
  });
});

describe("hashRequestContent", () => {
  it("produces same hash for identical content", () => {
    const h1 = hashRequestContent("hello world");
    const h2 = hashRequestContent("hello world");
    expect(h1).toBe(h2);
  });

  it("produces different hash for different content", () => {
    const h1 = hashRequestContent("hello world");
    const h2 = hashRequestContent("goodbye world");
    expect(h1).not.toBe(h2);
  });

  it("normalizes whitespace differences", () => {
    const h1 = hashRequestContent("hello   world\n\tfoo");
    const h2 = hashRequestContent("hello world foo");
    expect(h1).toBe(h2);
  });

  it("includes tool call names in hash", () => {
    const h1 = hashRequestContent("hello", ["read_file", "write_file"]);
    const h2 = hashRequestContent("hello");
    expect(h1).not.toBe(h2);
  });

  it("returns a 12-char hex string", () => {
    const h = hashRequestContent("test content");
    expect(h).toMatch(/^[0-9a-f]{12}$/);
  });
});
