/**
 * Layer 1 — /debug command integration tests (no API keys required).
 *
 * Verifies that sending "/debug" as a user message returns routing
 * diagnostics as a synthetic chat completion — no upstream API call.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestProxy, stopTestProxy, getTestProxyUrl } from "./setup.js";

describe("/debug command", () => {
  beforeAll(async () => {
    await startTestProxy();
  });

  afterAll(async () => {
    await stopTestProxy();
  });

  it("returns routing diagnostics for /debug with no prompt (non-streaming)", async () => {
    const res = await fetch(`${getTestProxyUrl()}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "blockrun/auto",
        messages: [{ role: "user", content: "/debug" }],
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      model: string;
      choices: Array<{ message: { role: string; content: string }; finish_reason: string }>;
    };

    expect(body.model).toBe("clawrouter/debug");
    expect(body.id).toMatch(/^chatcmpl-debug-/);
    expect(body.choices).toHaveLength(1);
    expect(body.choices[0].finish_reason).toBe("stop");

    const content = body.choices[0].message.content;
    expect(content).toContain("ClawRouter Debug");
    expect(content).toContain("Profile:");
    expect(content).toContain("Tier:");
    expect(content).toContain("Model:");
    expect(content).toContain("Confidence:");
    expect(content).toContain("Scoring (weighted:");
    expect(content).toContain("Tier Boundaries:");
  });

  it("returns diagnostics for /debug with a custom prompt", async () => {
    const res = await fetch(`${getTestProxyUrl()}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "blockrun/auto",
        messages: [
          { role: "user", content: "/debug write a recursive fibonacci function in python" },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = body.choices[0].message.content;
    expect(content).toContain("ClawRouter Debug");
    // A coding prompt should score on codePresence
    expect(content).toContain("codePresence:");
  });

  it("returns SSE streaming response for /debug with stream: true", async () => {
    const res = await fetch(`${getTestProxyUrl()}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "blockrun/auto",
        messages: [{ role: "user", content: "/debug hello world" }],
        stream: true,
      }),
    });

    expect(res.status).toBe(200);
    const contentType = res.headers.get("content-type") ?? "";
    expect(contentType).toContain("text/event-stream");

    const text = await res.text();
    expect(text).toContain("data: ");
    expect(text).toContain("[DONE]");
    expect(text).toContain("ClawRouter Debug");
    expect(text).toContain("clawrouter/debug");
  });

  it("works with eco routing profile", async () => {
    const res = await fetch(`${getTestProxyUrl()}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "blockrun/eco",
        messages: [{ role: "user", content: "/debug explain quantum computing" }],
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = body.choices[0].message.content;
    expect(content).toContain("Profile: eco");
  });

  it("works with premium routing profile", async () => {
    const res = await fetch(`${getTestProxyUrl()}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "blockrun/premium",
        messages: [{ role: "user", content: "/debug analyze this complex algorithm" }],
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = body.choices[0].message.content;
    expect(content).toContain("Profile: premium");
  });

  it("does not intercept normal messages that just contain 'debug'", async () => {
    // "debug my code" should NOT trigger the /debug handler
    // This request goes upstream — so it will fail without a funded wallet,
    // but the key thing is it should NOT return clawrouter/debug model
    const res = await fetch(`${getTestProxyUrl()}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "blockrun/auto",
        messages: [{ role: "user", content: "debug my code" }],
      }),
    });

    // Whether it succeeds or fails upstream, the model should not be "clawrouter/debug"
    if (res.status === 200) {
      const body = (await res.json()) as { model: string };
      expect(body.model).not.toBe("clawrouter/debug");
    }
    // If it's a non-200 (payment error), that's fine — it means it went upstream (not intercepted)
  }, 30_000);

  it("includes dimension scores in output", async () => {
    const res = await fetch(`${getTestProxyUrl()}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "blockrun/auto",
        messages: [{ role: "user", content: "/debug step by step prove P=NP" }],
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = body.choices[0].message.content;
    // Should contain all key dimension names
    expect(content).toContain("tokenCount:");
    expect(content).toContain("codePresence:");
    expect(content).toContain("reasoningMarkers:");
    expect(content).toContain("simpleIndicators:");
    expect(content).toContain("agenticTask:");
  });
});
