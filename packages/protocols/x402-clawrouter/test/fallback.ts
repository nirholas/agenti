/**
 * Test for model fallback logic.
 *
 * Tests that when a primary model fails with a provider error,
 * ClawRouter correctly falls back to the next model in the chain.
 *
 * Usage:
 *   npx tsx test/fallback.ts
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { generatePrivateKey } from "viem/accounts";

// Track which models were called
const modelCalls: string[] = [];
let failModels: string[] = [];
let failAllModels = false;
// Models that return 429 on their first call, then succeed (stepped backoff test)
const rateLimitOnceModels = new Set<string>();
const rateLimitAttempts = new Map<string, number>(); // model → call count
// Slow models that delay response by N ms (per-model timeout test)
let slowModelDelayMs = 0;
let slowModels: string[] = [];

// Mock BlockRun API server
async function startMockServer(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks).toString();

    try {
      const parsed = JSON.parse(body) as { model?: string; messages?: Array<{ content: string }> };
      const model = parsed.model || "unknown";
      modelCalls.push(model);

      console.log(`  [MockAPI] Request for model: ${model}`);

      // Simulate a slow model (per-model timeout test)
      if (slowModels.includes(model) && slowModelDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, slowModelDelayMs));
      }

      // Simulate 429 rate-limit on first call, succeed on retry (stepped backoff test)
      if (rateLimitOnceModels.has(model)) {
        const attempts = rateLimitAttempts.get(model) ?? 0;
        rateLimitAttempts.set(model, attempts + 1);
        if (attempts === 0) {
          res.writeHead(429, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: { message: "Rate limit exceeded", type: "rate_limited" },
            }),
          );
          return;
        }
        // Second call succeeds — fall through to normal success path
      }

      // Simulate an invalid explicit model name that should be surfaced to the caller
      // instead of being silently converted into a free-model success.
      if (model.startsWith("invalid/")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: {
              message: `Unknown model: ${model}. Available models: moonshot/kimi-k2.5, nvidia/gpt-oss-120b`,
              type: "provider_error",
            },
          }),
        );
        return;
      }

      // Simulate provider error for models in failModels list (or all models)
      if (failAllModels || failModels.includes(model)) {
        console.log(`  [MockAPI] Simulating billing error for ${model}`);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: {
              message: "API provider returned a billing error: your API key has run out of credits",
              type: "provider_error",
            },
          }),
        );
        return;
      }

      // Success response
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: "chatcmpl-test",
          object: "chat.completion",
          created: Date.now(),
          model,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: `Response from ${model}` },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        }),
      );
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid request" }));
    }
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      resolve({
        port: addr.port,
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

// Import after mock server is ready (to avoid wallet key requirement during import)
async function runTests() {
  const { startProxy } = await import("../src/proxy.js");

  console.log("\n═══ Fallback Logic Tests ═══\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  // Start mock BlockRun API
  const mockApi = await startMockServer();
  console.log(`Mock API started on port ${mockApi.port}`);

  // Generate an ephemeral test wallet key
  const testWalletKey = generatePrivateKey();

  // Start ClawRouter proxy pointing to mock API
  const proxy = await startProxy({
    wallet: testWalletKey,
    apiBase: `http://127.0.0.1:${mockApi.port}`,
    port: 0,
    skipBalanceCheck: true, // Skip balance check for testing
    onReady: (port) => console.log(`ClawRouter proxy started on port ${port}`),
    onRouted: (d) => console.log(`  [Routed] ${d.model} (${d.tier}) - ${d.reasoning}`),
  });

  // Helper to generate unique message content (prevents dedup cache hits)
  let testCounter = 0;
  const uniqueMessage = (base: string) => `${base} [test-${++testCounter}-${Date.now()}]`;
  const reasoningPrompt = () => uniqueMessage("Prove step by step that sqrt(2) is irrational");

  // Test 1: Primary model succeeds - no fallback needed
  {
    console.log("\n--- Test 1: Primary model succeeds ---");
    modelCalls.length = 0;
    failModels = [];
    failAllModels = false;

    const res = await fetch(`${proxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "auto",
        messages: [{ role: "user", content: uniqueMessage("Hello") }],
        max_tokens: 50,
      }),
    });

    assert(res.ok, `Response OK: ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content || "";
    assert(content.startsWith("Response from "), `Response from routed model: ${content}`);
    assert(modelCalls.length === 1, `Only 1 model called: ${modelCalls.join(", ")}`);
  }

  // Test 1b: Free profile should only call the free model
  {
    console.log("\n--- Test 1b: Free profile uses free model directly ---");
    modelCalls.length = 0;
    failModels = [];
    failAllModels = false;

    const res = await fetch(`${proxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "blockrun/free",
        messages: [{ role: "user", content: uniqueMessage("Free profile hello") }],
        max_tokens: 50,
      }),
    });

    assert(res.ok, `Free profile succeeds: ${res.status}`);
    assert(modelCalls.length === 1, `Only 1 model called: ${modelCalls.join(", ")}`);
    assert(
      modelCalls[0] === "nvidia/gpt-oss-120b",
      `Free profile forwarded free model: ${modelCalls[0]}`,
    );
  }

  // Probe reasoning route once so fallback tests adapt to current config.
  let reasoningPrimary = "";
  let reasoningFirstFallback = "";
  {
    modelCalls.length = 0;
    failModels = [];
    failAllModels = false;

    const res = await fetch(`${proxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "auto",
        messages: [{ role: "user", content: reasoningPrompt() }],
        max_tokens: 50,
      }),
    });
    assert(res.ok, `Reasoning probe succeeds: ${res.status}`);
    reasoningPrimary = modelCalls[0] || "";
    assert(!!reasoningPrimary, `Reasoning primary detected: ${reasoningPrimary}`);
  }

  // Test 2: Reasoning primary fails with billing error - should fallback
  {
    console.log("\n--- Test 2: Primary fails, fallback succeeds ---");
    modelCalls.length = 0;
    failModels = [reasoningPrimary];
    failAllModels = false;

    const res = await fetch(`${proxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "auto",
        messages: [{ role: "user", content: reasoningPrompt() }],
        max_tokens: 50,
      }),
    });

    assert(res.ok, `Response OK after fallback: ${res.status}`);
    const data = (await res.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content || "";
    assert(content.startsWith("Response from "), `Response from fallback model: ${content}`);
    assert(modelCalls.length >= 2, `At least 2 models called: ${modelCalls.join(", ")}`);
    assert(modelCalls[0] === reasoningPrimary, `First tried primary: ${modelCalls[0]}`);
    assert(modelCalls[1] !== reasoningPrimary, `Then tried fallback: ${modelCalls[1]}`);
    reasoningFirstFallback = modelCalls[1] || "";
  }

  // Test 3: Primary and first fallback fail - should try second fallback
  {
    console.log("\n--- Test 3: Primary + first fallback fail, second fallback succeeds ---");
    modelCalls.length = 0;
    // Reuse the previous test's observed first fallback if available.
    failModels = reasoningFirstFallback
      ? [reasoningPrimary, reasoningFirstFallback]
      : [reasoningPrimary];
    failAllModels = false;

    const res = await fetch(`${proxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "auto",
        messages: [{ role: "user", content: reasoningPrompt() }],
        max_tokens: 50,
      }),
    });

    assert(res.ok, `Response OK after 2nd fallback: ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content || "";
    assert(content.startsWith("Response from "), `Response from deeper fallback: ${content}`);
    assert(modelCalls.length >= 2, `At least 2 models called: ${modelCalls.join(", ")}`);
  }

  // Test 4: All models fail - should return error
  {
    console.log("\n--- Test 4: All models fail - returns error ---");
    modelCalls.length = 0;
    failModels = [];
    failAllModels = true;

    const res = await fetch(`${proxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "auto",
        messages: [{ role: "user", content: reasoningPrompt() }],
        max_tokens: 50,
      }),
    });

    assert(!res.ok, `Response is error: ${res.status}`);
    const data = (await res.json()) as { error?: { message?: string; type?: string } };
    assert(
      data.error?.type === "provider_error",
      `Error type is provider_error: ${data.error?.type}`,
    );
    assert(
      modelCalls.length >= 1,
      `Tried at least one model before failing: ${modelCalls.join(", ")}`,
    );
  }

  // Test 5: Explicit model (not auto) - falls back to free model on failure
  // Changed behavior: explicit models now have emergency fallback to nvidia/gpt-oss-120b
  // This ensures users always get a response even if their wallet runs out mid-request
  {
    console.log("\n--- Test 5: Explicit model - fallback to free model ---");
    modelCalls.length = 0;
    failModels = ["openai/gpt-4o"];
    failAllModels = false;

    const res = await fetch(`${proxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: uniqueMessage("Hello") }],
        max_tokens: 50,
      }),
    });

    // Should succeed via fallback to free model
    assert(res.ok, `Explicit model with fallback succeeds: ${res.status}`);
    assert(
      modelCalls.length === 2,
      `2 models called (primary + free fallback): ${modelCalls.join(", ")}`,
    );
    assert(modelCalls[0] === "openai/gpt-4o", `First tried explicit model: ${modelCalls[0]}`);
    assert(
      modelCalls[1] === "nvidia/gpt-oss-120b",
      `Then fell back to free model: ${modelCalls[1]}`,
    );
  }

  // Test 6: Explicit model normalization (case + whitespace) routes to canonical model ID
  {
    console.log("\n--- Test 6: Explicit model normalization (case + whitespace) ---");
    modelCalls.length = 0;
    failModels = [];
    failAllModels = false;

    const res = await fetch(`${proxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "  DEEPSEEK/deepseek-chat  ",
        messages: [{ role: "user", content: uniqueMessage("Normalize explicit model ID") }],
        max_tokens: 50,
      }),
    });

    assert(res.ok, `Normalized explicit model succeeds: ${res.status}`);
    assert(modelCalls.length === 1, `Only 1 model called: ${modelCalls.join(", ")}`);
    assert(
      modelCalls[0] === "deepseek/deepseek-chat",
      `Canonical model ID forwarded upstream: ${modelCalls[0]}`,
    );
  }

  // Test 6b: Delisted explicit model IDs should alias to a live replacement
  {
    console.log("\n--- Test 6b: Delisted explicit model alias ---");
    modelCalls.length = 0;
    failModels = [];
    failAllModels = false;

    const res = await fetch(`${proxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "blockrun/xai/grok-code-fast-1",
        messages: [{ role: "user", content: uniqueMessage("Legacy grok-code model should alias") }],
        max_tokens: 50,
      }),
    });

    assert(res.ok, `Delisted explicit model alias succeeds: ${res.status}`);
    assert(modelCalls.length === 1, `Only 1 model called: ${modelCalls.join(", ")}`);
    assert(
      modelCalls[0] === "deepseek/deepseek-chat",
      `Delisted model redirected to replacement: ${modelCalls[0]}`,
    );
  }

  // Test 7: Normalized explicit model still falls back to free on provider error
  {
    console.log("\n--- Test 7: Normalized explicit model + fallback ---");
    modelCalls.length = 0;
    failModels = ["deepseek/deepseek-chat"];
    failAllModels = false;

    const res = await fetch(`${proxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "DEEPSEEK/deepseek-chat",
        messages: [
          { role: "user", content: uniqueMessage("Trigger fallback after normalization") },
        ],
        max_tokens: 50,
      }),
    });

    assert(res.ok, `Normalized explicit model fallback succeeds: ${res.status}`);
    assert(
      modelCalls.length === 2,
      `2 models called (canonical primary + free fallback): ${modelCalls.join(", ")}`,
    );
    assert(
      modelCalls[0] === "deepseek/deepseek-chat",
      `Primary canonical model used: ${modelCalls[0]}`,
    );
    assert(modelCalls[1] === "nvidia/gpt-oss-120b", `Fallback model used: ${modelCalls[1]}`);
  }

  // Test 8: Invalid explicit model should surface the error (no free fallback)
  {
    console.log("\n--- Test 8: Invalid explicit model returns error ---");
    modelCalls.length = 0;
    failModels = [];
    failAllModels = false;

    const res = await fetch(`${proxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "invalid/nonexistent-model",
        messages: [{ role: "user", content: uniqueMessage("Invalid model should error") }],
        max_tokens: 50,
      }),
    });

    assert(!res.ok, `Invalid explicit model returns error: ${res.status}`);
    const data = (await res.json()) as { error?: { message?: string } };
    assert(
      (data.error?.message || "").includes("Unknown model"),
      `Error surfaces unknown model message: ${data.error?.message}`,
    );
    assert(modelCalls.length === 1, `Only invalid model was tried: ${modelCalls.join(", ")}`);
    assert(
      modelCalls[0] === "invalid/nonexistent-model",
      `Did not fall back away from invalid model: ${modelCalls[0]}`,
    );
  }

  // Test 9: 429 stepped backoff — rate-limited model is retried before failover
  {
    console.log("\n--- Test 9: 429 stepped backoff retry ---");
    modelCalls.length = 0;
    rateLimitOnceModels.clear();
    rateLimitAttempts.clear();
    failModels = [];
    failAllModels = false;

    // gpt-4o will return 429 on first call, succeed on the 200ms-delayed retry
    rateLimitOnceModels.add("openai/gpt-4o");

    const res = await fetch(`${proxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: uniqueMessage("stepped backoff test") }],
        max_tokens: 50,
      }),
    });

    assert(res.ok, `Response OK after stepped backoff retry: ${res.status}`);
    const gpt4oCalls = modelCalls.filter((m) => m === "openai/gpt-4o");
    assert(
      gpt4oCalls.length >= 2,
      `gpt-4o called at least twice (429 → retry → success): ${modelCalls.join(", ")}`,
    );
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content || "";
    assert(
      content.includes("openai/gpt-4o"),
      `Response came from retried model, not fallback: ${content}`,
    );
  }

  // Test 10: maxCostPerRun strict mode — blocks the request that WOULD overshoot the cap
  // cap=$0.001: first request projected=$0.001 (not > cap) → succeeds;
  // second request projected=$0.002 (> cap) → blocked BEFORE executing, not after.
  // This proves the projected-cost check, not just a trailing "already exceeded" check.
  {
    console.log("\n--- Test 10: maxCostPerRun strict mode (hard 429) ---");
    modelCalls.length = 0;
    rateLimitOnceModels.clear();
    rateLimitAttempts.clear();
    failModels = [];
    failAllModels = false;

    // cap=$0.001 equals the minimum per-request estimate, so:
    //   request 1 projected = $0 + $0.001 = $0.001 which is NOT > $0.001 → allowed
    //   request 2 projected = $0.001 + $0.001 = $0.002 which IS > $0.001 → blocked
    const costCapProxy = await startProxy({
      wallet: testWalletKey,
      apiBase: `http://127.0.0.1:${mockApi.port}`,
      port: 0,
      skipBalanceCheck: true,
      maxCostPerRunUsd: 0.001,
      maxCostPerRunMode: "strict",
    });

    const sessionHeader = `cost-cap-test-${Date.now()}`;

    // First request: projected cost = cap exactly → allowed (not strictly greater)
    const res1 = await fetch(`${costCapProxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": sessionHeader },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: uniqueMessage("first within cap") }],
        max_tokens: 50,
      }),
    });
    assert(res1.ok, `First request succeeds (within cap): ${res1.status}`);

    modelCalls.length = 0; // reset so we can assert second request never reaches the API

    // Second request: projected = $0.001 spent + $0.001 est = $0.002 > $0.001 → blocked
    // This is the request that WOULD overshoot the cap — blocked before it executes.
    const res2 = await fetch(`${costCapProxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": sessionHeader },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: uniqueMessage("second exceeds cap") }],
        max_tokens: 50,
      }),
    });
    assert(!res2.ok, `Second request blocked by cost cap: ${res2.status}`);
    assert(res2.status === 429, `Status is 429: ${res2.status}`);
    assert(
      res2.headers.get("X-ClawRouter-Cost-Cap-Exceeded") === "1",
      `X-ClawRouter-Cost-Cap-Exceeded header set: ${res2.headers.get("X-ClawRouter-Cost-Cap-Exceeded")}`,
    );
    const capData = (await res2.json()) as { error?: { type?: string } };
    assert(
      capData.error?.type === "cost_cap_exceeded",
      `Error type is cost_cap_exceeded: ${capData.error?.type}`,
    );
    assert(
      modelCalls.length === 0,
      `No model called (blocked before routing): ${modelCalls.join(", ")}`,
    );

    await costCapProxy.close();
  }

  // Test 10b: maxCostPerRun graceful mode — mid-task downgrade via routing profile
  // Uses blockrun/auto (routing profile) so ClawRouter chose the model and can downgrade.
  // cap=$0.0015: first request succeeds ($0.001 minimum cost), second is downgraded ($0.0005 left).
  {
    console.log("\n--- Test 10b: maxCostPerRun graceful mode (routing profile mid-task downgrade) ---");
    modelCalls.length = 0;
    rateLimitOnceModels.clear();
    rateLimitAttempts.clear();
    failModels = [];
    failAllModels = false;

    // Graceful proxy: cap allows first request but not a second routed (non-free) model call.
    // $0.001 is the minimum estimate for any model. First request accumulates $0.001;
    // second request has $0.0005 remaining, which is below the $0.001 minimum → downgrade.
    const gracefulProxy = await startProxy({
      wallet: testWalletKey,
      apiBase: `http://127.0.0.1:${mockApi.port}`,
      port: 0,
      skipBalanceCheck: true,
      maxCostPerRunUsd: 0.0015,
      maxCostPerRunMode: "graceful",
    });

    const sessionHeader = `graceful-cap-test-${Date.now()}`;

    // First request: blockrun/auto routing profile, succeeds, accumulates cost ($0.001 min)
    const res1 = await fetch(`${gracefulProxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": sessionHeader },
      body: JSON.stringify({
        model: "blockrun/auto",
        messages: [{ role: "user", content: uniqueMessage("first routing profile within cap") }],
        max_tokens: 50,
      }),
    });
    assert(res1.ok, `First request succeeds: ${res1.status}`);
    const res1Data = (await res1.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content1 = res1Data.choices?.[0]?.message?.content ?? "";
    assert(
      !content1.includes("⚠️"),
      `First request has no budget warning (within cap): ${content1.slice(0, 80)}`,
    );

    modelCalls.length = 0;

    // Second request: $0.0005 remaining < $0.001 minimum estimate → all non-free models excluded
    // → graceful downgrade to free model with visible warning. NOT a 429.
    const res2 = await fetch(`${gracefulProxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": sessionHeader },
      body: JSON.stringify({
        model: "blockrun/auto",
        messages: [{ role: "user", content: uniqueMessage("second routing profile exceeds cap") }],
        max_tokens: 50,
      }),
    });
    assert(res2.ok, `Second request succeeds via graceful downgrade: ${res2.status}`);
    assert(res2.status !== 429, `No 429 in graceful mode: ${res2.status}`);
    assert(
      modelCalls.includes("nvidia/gpt-oss-120b"),
      `Graceful downgrade used free model: ${modelCalls.join(", ")}`,
    );
    // A: visible warning notice is prepended to response body
    const res2Data = (await res2.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content2 = res2Data.choices?.[0]?.message?.content ?? "";
    assert(
      content2.includes("⚠️") && content2.includes("Budget"),
      `Response body contains budget warning: ${content2.slice(0, 80)}`,
    );
    // B: orchestration header is set
    assert(
      res2.headers.get("x-clawrouter-budget-downgrade") === "1",
      `x-clawrouter-budget-downgrade header set: ${res2.headers.get("x-clawrouter-budget-downgrade")}`,
    );
    assert(
      res2.headers.get("x-clawrouter-budget-mode") === "downgraded",
      `x-clawrouter-budget-mode is downgraded: ${res2.headers.get("x-clawrouter-budget-mode")}`,
    );

    await gracefulProxy.close();
  }

  // Test 10d: maxCostPerRun graceful mode — explicit model blocked (not downgraded) when over budget
  // Explicit model requests bypass graceful downgrade: user chose a specific model,
  // substituting it with free model would be deceptive regardless of task complexity.
  {
    console.log("\n--- Test 10d: maxCostPerRun graceful mode (explicit model → blocked, not silently downgraded) ---");
    modelCalls.length = 0;
    rateLimitOnceModels.clear();
    rateLimitAttempts.clear();
    failModels = [];
    failAllModels = false;

    // First request succeeds (cap=$0.0015 ≥ $0.001 minimum). Second request is blocked.
    const explicitBlockProxy = await startProxy({
      wallet: testWalletKey,
      apiBase: `http://127.0.0.1:${mockApi.port}`,
      port: 0,
      skipBalanceCheck: true,
      maxCostPerRunUsd: 0.0015,
      maxCostPerRunMode: "graceful",
    });

    const sessionHeader2 = `explicit-block-test-${Date.now()}`;

    // First request: explicit model, budget = $0.0015 ≥ $0.001 → succeeds
    const res1d = await fetch(`${explicitBlockProxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": sessionHeader2 },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: uniqueMessage("explicit first within budget") }],
        max_tokens: 50,
      }),
    });
    assert(res1d.ok, `First explicit request succeeds: ${res1d.status}`);

    modelCalls.length = 0;

    // Second request: remaining = $0.0005 < $0.001 estimate → blocked with 429 (not silently downgraded)
    const res2d = await fetch(`${explicitBlockProxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": sessionHeader2 },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: uniqueMessage("explicit second over budget") }],
        max_tokens: 50,
      }),
    });
    assert(!res2d.ok, `Second explicit request blocked: ${res2d.status}`);
    assert(res2d.status === 429, `Status is 429: ${res2d.status}`);
    assert(
      res2d.headers.get("X-ClawRouter-Budget-Mode") === "blocked",
      `X-ClawRouter-Budget-Mode is blocked: ${res2d.headers.get("X-ClawRouter-Budget-Mode")}`,
    );
    const blockData2 = (await res2d.json()) as { error?: { type?: string; code?: string } };
    assert(
      blockData2.error?.type === "cost_cap_exceeded",
      `Error type is cost_cap_exceeded: ${blockData2.error?.type}`,
    );
    assert(
      blockData2.error?.code === "budget_exhausted",
      `Error code is budget_exhausted: ${blockData2.error?.code}`,
    );
    assert(
      modelCalls.length === 0,
      `No model called (blocked before routing): ${modelCalls.join(", ")}`,
    );

    await explicitBlockProxy.close();
  }

  // Test 10e: wallet empty + graceful budget cap → free model fallback (regression for isFreeModel sync bug)
  // When the wallet is empty the balance check falls back to free model (modelId = FREE_MODEL,
  // isFreeModel = true). Budget logic gates on !isFreeModel — all three checks must short-circuit
  // so the request is served by the free model, NOT rejected with 429 budget_exhausted.
  {
    console.log("\n--- Test 10e: wallet empty + graceful budget cap → free model, no 429 ---");
    modelCalls.length = 0;
    rateLimitOnceModels.clear();
    rateLimitAttempts.clear();
    failModels = [];
    failAllModels = false;

    // Mock balance monitor: always returns isEmpty=true / not sufficient
    const emptyWalletMonitor = {
      async checkBalance() {
        return {
          balance: 0n,
          balanceUSD: "$0.00",
          isLow: true,
          isEmpty: true,
          walletAddress: "0x0000000000000000000000000000000000000000",
        };
      },
      async checkSufficient(_amount: bigint) {
        return {
          sufficient: false,
          info: {
            balance: 0n,
            balanceUSD: "$0.00",
            isLow: true,
            isEmpty: true,
            walletAddress: "0x0000000000000000000000000000000000000000",
          },
        };
      },
      deductEstimated(_amount: bigint) { /* no-op */ },
      invalidate() { /* no-op */ },
    };

    const emptyWalletProxy = await startProxy({
      wallet: testWalletKey,
      apiBase: `http://127.0.0.1:${mockApi.port}`,
      port: 0,
      // skipBalanceCheck intentionally NOT set — balance check must run so the fallback fires
      maxCostPerRunUsd: 0.0015,
      maxCostPerRunMode: "graceful",
      // @ts-expect-error — internal test hook
      _balanceMonitorOverride: emptyWalletMonitor,
    });

    const res = await fetch(`${emptyWalletProxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": `empty-wallet-test-${Date.now()}` },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: uniqueMessage("empty wallet with budget cap") }],
        max_tokens: 50,
      }),
    });

    // Must succeed (200) — balance fallback switches to free model before budget checks run.
    // Before the fix (isFreeModel was const), this would 429 because budget checks would
    // see !isFreeModel=true then second-pass block with routingDecision===undefined.
    assert(res.ok, `Empty wallet + budget cap returns 200 (not 429): ${res.status}`);
    assert(res.status !== 429, `No 429 budget_exhausted for empty wallet: ${res.status}`);
    assert(
      modelCalls.includes("nvidia/gpt-oss-120b"),
      `Free model was used (balance fallback active): ${modelCalls.join(", ")}`,
    );
    assert(
      !modelCalls.includes("openai/gpt-4o"),
      `Paid model was NOT called (wallet was empty): ${modelCalls.join(", ")}`,
    );

    await emptyWalletProxy.close();
  }

  // Test 10c: maxCostPerRun graceful mode — tools request blocked when budget can't afford any model
  {
    console.log("\n--- Test 10c: maxCostPerRun graceful mode (tools → blocked, not silent downgrade) ---");
    modelCalls.length = 0;
    rateLimitOnceModels.clear();
    rateLimitAttempts.clear();
    failModels = [];
    failAllModels = false;

    // Graceful proxy: near-zero cap — no priced model fits, free model doesn't support tools
    const toolsBlockProxy = await startProxy({
      wallet: testWalletKey,
      apiBase: `http://127.0.0.1:${mockApi.port}`,
      port: 0,
      skipBalanceCheck: true,
      maxCostPerRunUsd: 0.000001, // $0.000001 — no priced model fits
      maxCostPerRunMode: "graceful",
    });

    const sessionHeader = `tools-block-test-${Date.now()}`;

    // Request WITH tools: budget can't afford any model → explicit block, not silent downgrade
    const res = await fetch(`${toolsBlockProxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": sessionHeader },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: uniqueMessage("tools request over budget") }],
        max_tokens: 50,
        tools: [
          {
            type: "function",
            function: {
              name: "get_weather",
              description: "Get current weather",
              parameters: { type: "object", properties: {} },
            },
          },
        ],
      }),
    });
    assert(!res.ok, `Tools request blocked by budget: ${res.status}`);
    assert(res.status === 429, `Status is 429: ${res.status}`);
    assert(
      res.headers.get("X-ClawRouter-Budget-Mode") === "blocked",
      `X-ClawRouter-Budget-Mode is blocked: ${res.headers.get("X-ClawRouter-Budget-Mode")}`,
    );
    const blockData = (await res.json()) as { error?: { type?: string; code?: string } };
    assert(
      blockData.error?.type === "cost_cap_exceeded",
      `Error type is cost_cap_exceeded: ${blockData.error?.type}`,
    );
    assert(
      blockData.error?.code === "budget_exhausted",
      `Error code is budget_exhausted: ${blockData.error?.code}`,
    );
    assert(
      modelCalls.length === 0,
      `No model was called (blocked before routing): ${modelCalls.join(", ")}`,
    );

    await toolsBlockProxy.close();
  }

  // Test 11: Provider error fallback for explicit model — primary fails, falls back to free model
  {
    console.log("\n--- Test 11: Explicit model provider error → free model fallback ---");
    modelCalls.length = 0;
    rateLimitOnceModels.clear();
    rateLimitAttempts.clear();
    failModels = [];
    failAllModels = false;

    const explicitFallbackProxy = await startProxy({
      wallet: testWalletKey,
      apiBase: `http://127.0.0.1:${mockApi.port}`,
      port: 0,
      skipBalanceCheck: true,
      requestTimeoutMs: 30_000,
    });

    failModels = ["openai/gpt-4o"]; // Make explicit primary fail with provider error

    const res = await fetch(`${explicitFallbackProxy.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: uniqueMessage("explicit model fallback test") }],
        max_tokens: 50,
      }),
    });

    // Explicit model fails → free model fallback
    assert(res.ok, `Fallback succeeds after primary error: ${res.status}`);
    assert(
      modelCalls.length >= 2,
      `At least 2 models tried (primary + fallback): ${modelCalls.join(", ")}`,
    );
    assert(
      modelCalls[modelCalls.length - 1] === "nvidia/gpt-oss-120b",
      `Last resort fallback is free model: ${modelCalls[modelCalls.length - 1]}`,
    );

    await explicitFallbackProxy.close();
  }

  // Cleanup
  await proxy.close();
  await mockApi.close();
  console.log("\nServers closed.");

  // Summary
  console.log("\n═══════════════════════════════════");
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
