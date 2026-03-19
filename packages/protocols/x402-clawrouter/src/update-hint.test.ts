/**
 * Tests for server-side update hint parsing from 429 response bodies.
 *
 * When BlockRun's API detects a stale ClawRouter user-agent, it includes
 * { update_available, update_url } in 429 responses. The proxy parses
 * these and logs a prominent update message.
 */

import { describe, expect, it, vi, afterEach } from "vitest";

/** Mirrors the parsing logic in proxy.ts's 429 handler */
function parseUpdateHint(
  errorBody: string | undefined,
): { update_available: string; update_url?: string } | null {
  try {
    const parsed = JSON.parse(errorBody || "{}");
    if (parsed.update_available) {
      return { update_available: parsed.update_available, update_url: parsed.update_url };
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

/** Mirrors getUpdateHint() on the blockrun server side */
function getUpdateHint(
  userAgent: string | undefined,
  currentVersion: string,
): { update_available: string; update_url: string } | null {
  if (!userAgent) return null;
  const match = userAgent.match(/^clawrouter\/(\d+\.\d+\.\d+)/);
  if (!match) return null;
  const clientVersion = match[1];
  const [cMaj, cMin, cPatch] = clientVersion.split(".").map(Number);
  const [sMaj, sMin, sPatch] = currentVersion.split(".").map(Number);
  if (
    cMaj < sMaj ||
    (cMaj === sMaj && cMin < sMin) ||
    (cMaj === sMaj && cMin === sMin && cPatch < sPatch)
  ) {
    return {
      update_available: currentVersion,
      update_url: "https://blockrun.ai/ClawRouter-update",
    };
  }
  return null;
}

describe("update hint — server-side generation (getUpdateHint)", () => {
  const CURRENT = "0.12.12";

  it("returns hint when client is older (patch)", () => {
    expect(getUpdateHint("clawrouter/0.12.11", CURRENT)).toEqual({
      update_available: "0.12.12",
      update_url: "https://blockrun.ai/ClawRouter-update",
    });
  });

  it("returns hint when client is older (minor)", () => {
    expect(getUpdateHint("clawrouter/0.10.22", CURRENT)).toEqual({
      update_available: "0.12.12",
      update_url: "https://blockrun.ai/ClawRouter-update",
    });
  });

  it("returns hint when client is older (major)", () => {
    expect(getUpdateHint("clawrouter/0.9.0", "1.0.0")).toEqual({
      update_available: "1.0.0",
      update_url: "https://blockrun.ai/ClawRouter-update",
    });
  });

  it("returns null when client is current", () => {
    expect(getUpdateHint("clawrouter/0.12.12", CURRENT)).toBeNull();
  });

  it("returns null when client is newer", () => {
    expect(getUpdateHint("clawrouter/0.13.0", CURRENT)).toBeNull();
  });

  it("returns null for non-clawrouter user agents", () => {
    expect(getUpdateHint("curl/7.88.0", CURRENT)).toBeNull();
    expect(getUpdateHint("Mozilla/5.0", CURRENT)).toBeNull();
  });

  it("returns null for undefined user agent", () => {
    expect(getUpdateHint(undefined, CURRENT)).toBeNull();
  });
});

describe("update hint — client-side parsing (parseUpdateHint)", () => {
  it("parses update_available from 429 body", () => {
    const body = JSON.stringify({
      error: "Rate limited",
      message: "Free tier: max 60 requests/hour.",
      update_available: "0.12.12",
      update_url: "https://blockrun.ai/ClawRouter-update",
    });
    expect(parseUpdateHint(body)).toEqual({
      update_available: "0.12.12",
      update_url: "https://blockrun.ai/ClawRouter-update",
    });
  });

  it("returns null when no update_available in body", () => {
    const body = JSON.stringify({
      error: "Rate limited",
      message: "Free tier: max 60 requests/hour.",
    });
    expect(parseUpdateHint(body)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseUpdateHint("not json")).toBeNull();
  });

  it("returns null for undefined body", () => {
    expect(parseUpdateHint(undefined)).toBeNull();
  });

  it("returns null for empty body", () => {
    expect(parseUpdateHint("")).toBeNull();
  });
});

describe("update hint — console output", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs prominent update message when hint is present in 429", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const VERSION = "0.12.11";

    // Simulate what proxy.ts does on 429 with update hint
    const errorBody = JSON.stringify({
      error: "Rate limited",
      update_available: "0.12.12",
      update_url: "https://blockrun.ai/ClawRouter-update",
    });

    try {
      const parsed = JSON.parse(errorBody || "{}");
      if (parsed.update_available) {
        console.log("");
        console.log(
          `\x1b[33m⬆️  ClawRouter ${parsed.update_available} available (you have ${VERSION})\x1b[0m`,
        );
        console.log(
          `   Run: \x1b[36mcurl -fsSL ${parsed.update_url || "https://blockrun.ai/ClawRouter-update"} | bash\x1b[0m`,
        );
        console.log("");
      }
    } catch {
      /* ignore */
    }

    // Should have logged 4 calls (empty, version, run command, empty)
    expect(logSpy).toHaveBeenCalledTimes(4);
    const allCalls = logSpy.mock.calls.map((c) => c.join(" "));
    expect(allCalls.some((c) => c.includes("0.12.12 available"))).toBe(true);
    expect(allCalls.some((c) => c.includes("you have 0.12.11"))).toBe(true);
    expect(allCalls.some((c) => c.includes("curl -fsSL"))).toBe(true);
  });

  it("does not log when no update hint in 429", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const errorBody = JSON.stringify({
      error: "Rate limited",
      message: "Provider rate limited",
    });

    try {
      const parsed = JSON.parse(errorBody || "{}");
      if (parsed.update_available) {
        console.log("should not reach here");
      }
    } catch {
      /* ignore */
    }

    expect(logSpy).not.toHaveBeenCalled();
  });
});
