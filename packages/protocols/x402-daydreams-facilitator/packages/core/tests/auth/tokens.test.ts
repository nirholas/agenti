import { describe, test, expect } from "bun:test";
import { generateToken, hashToken, validateTokenFormat } from "../../src/auth/tokens.js";

describe("Token Generation", () => {
  test("generates test environment token with correct prefix", () => {
    const token = generateToken("test");
    expect(token).toMatch(/^fac_test_[a-zA-Z0-9]{24}$/);
  });

  test("generates live environment token with correct prefix", () => {
    const token = generateToken("live");
    expect(token).toMatch(/^fac_live_[a-zA-Z0-9]{24}$/);
  });

  test("generates unique tokens on each call", () => {
    const token1 = generateToken("test");
    const token2 = generateToken("test");
    expect(token1).not.toBe(token2);
  });

  test("generates tokens with consistent length", () => {
    const token = generateToken("test");
    expect(token.length).toBe(33); // fac_test_ (9) + random (24)
  });

  test("generates live tokens with consistent length", () => {
    const token = generateToken("live");
    expect(token.length).toBe(33); // fac_live_ (9) + random (24)
  });

  test("uses only base58 characters in random part", () => {
    const token = generateToken("test");
    const randomPart = token.split("_")[2];
    // Base58: no 0, O, I, l to avoid confusion
    expect(randomPart).toMatch(/^[1-9A-HJ-NP-Za-km-z]{24}$/);
  });
});

describe("Token Hashing", () => {
  test("generates consistent SHA256 hash for same token", () => {
    const token = "fac_test_abc123";
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
  });

  test("generates different hashes for different tokens", () => {
    const hash1 = hashToken("fac_test_abc123");
    const hash2 = hashToken("fac_test_xyz789");
    expect(hash1).not.toBe(hash2);
  });

  test("generates 64-character hex hash", () => {
    const hash = hashToken("fac_test_abc123");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("Token Validation", () => {
  test("validates correct test token format", () => {
    expect(validateTokenFormat("fac_test_s1xPo5F3Hbbmqyy2cEEWs3hz")).toBe(true);
  });

  test("validates correct live token format", () => {
    expect(validateTokenFormat("fac_live_9G42BNYx7AiScpizFhQEpmWn")).toBe(true);
  });

  test("rejects token with wrong prefix", () => {
    expect(validateTokenFormat("xyz_test_1234567890abcdefghij1234")).toBe(false);
  });

  test("rejects token with wrong environment", () => {
    expect(validateTokenFormat("fac_prod_1234567890abcdefghij1234")).toBe(false);
  });

  test("rejects token with wrong length", () => {
    expect(validateTokenFormat("fac_test_short")).toBe(false);
  });

  test("rejects token with invalid characters", () => {
    expect(validateTokenFormat("fac_test_123456789@abcdefghij1234")).toBe(false);
  });

  test("rejects empty string", () => {
    expect(validateTokenFormat("")).toBe(false);
  });

  test("rejects malformed token", () => {
    expect(validateTokenFormat("not_a_valid_token")).toBe(false);
  });
});
