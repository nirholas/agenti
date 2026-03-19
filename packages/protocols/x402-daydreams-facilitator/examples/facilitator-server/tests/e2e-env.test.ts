import { describe, expect, test } from "bun:test";
import { resolveE2ePrivateKey } from "./e2e-env.js";

describe("resolveE2ePrivateKey", () => {
  test("keeps a valid 0x-prefixed private key", () => {
    const key =
      "0x0000000000000000000000000000000000000000000000000000000000000001";
    expect(resolveE2ePrivateKey(key)).toBe(key);
  });

  test("prefixes a valid 64-char hex key", () => {
    const raw =
      "0000000000000000000000000000000000000000000000000000000000000001";
    expect(resolveE2ePrivateKey(raw)).toBe(`0x${raw}`);
  });

  test("falls back for malformed values", () => {
    const fallback =
      "0x0000000000000000000000000000000000000000000000000000000000000001";
    expect(resolveE2ePrivateKey("1")).toBe(fallback);
    expect(resolveE2ePrivateKey(undefined)).toBe(fallback);
  });
});
