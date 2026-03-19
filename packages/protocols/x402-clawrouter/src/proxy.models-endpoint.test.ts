import { describe, expect, it } from "vitest";

import { buildProxyModelList } from "./proxy.js";

describe("buildProxyModelList", () => {
  it("includes alias models used by /model commands", () => {
    const list = buildProxyModelList(1234567890);
    const ids = new Set(list.map((model) => model.id));

    expect(ids.has("flash")).toBe(true);
    expect(ids.has("kimi")).toBe(true);
    expect(ids.has("free")).toBe(true);
    expect(ids.has("google/gemini-2.5-flash")).toBe(true);
    expect(ids.has("moonshot/kimi-k2.5")).toBe(true);
  });

  it("returns unique model IDs", () => {
    const list = buildProxyModelList(1234567890);
    const ids = list.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
