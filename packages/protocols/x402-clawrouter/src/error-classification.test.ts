import { describe, it, expect } from "bun:test";
import { categorizeError } from "./proxy.js";

describe("categorizeError", () => {
  it("classifies 401 as auth_failure", () => {
    expect(categorizeError(401, "Unauthorized")).toBe("auth_failure");
    expect(categorizeError(401, "api key invalid")).toBe("auth_failure");
    expect(categorizeError(401, "")).toBe("auth_failure");
  });

  it("classifies 403 with quota body as quota_exceeded", () => {
    expect(categorizeError(403, "plan limit reached")).toBe("quota_exceeded");
    expect(categorizeError(403, "quota exceeded for this month")).toBe("quota_exceeded");
    expect(categorizeError(403, "subscription required")).toBe("quota_exceeded");
  });

  it("classifies 403 without quota body as auth_failure", () => {
    expect(categorizeError(403, "Forbidden")).toBe("auth_failure");
    expect(categorizeError(403, "")).toBe("auth_failure");
  });

  it("classifies 402 as payment_error", () => {
    expect(categorizeError(402, "payment required")).toBe("payment_error");
    expect(categorizeError(402, "")).toBe("payment_error");
  });

  it("classifies 429 as rate_limited", () => {
    expect(categorizeError(429, "rate limit exceeded")).toBe("rate_limited");
    expect(categorizeError(429, "")).toBe("rate_limited");
  });

  it("classifies 529 as overloaded", () => {
    expect(categorizeError(529, "")).toBe("overloaded");
    expect(categorizeError(529, "overloaded")).toBe("overloaded");
  });

  it("classifies 503 with overload body as overloaded", () => {
    expect(categorizeError(503, "service overloaded, try again")).toBe("overloaded");
    expect(categorizeError(503, "over capacity")).toBe("overloaded");
    expect(categorizeError(503, "too many requests")).toBe("overloaded");
  });

  it("classifies 503 without overload body as server_error", () => {
    expect(categorizeError(503, "service unavailable")).toBe("server_error");
    expect(categorizeError(503, "")).toBe("server_error");
  });

  it("classifies 5xx as server_error", () => {
    expect(categorizeError(500, "internal server error")).toBe("server_error");
    expect(categorizeError(502, "bad gateway")).toBe("server_error");
    expect(categorizeError(504, "gateway timeout")).toBe("server_error");
  });

  it("classifies 413 with size body as config_error", () => {
    expect(categorizeError(413, "request too large")).toBe("config_error");
    expect(categorizeError(413, "payload too large")).toBe("config_error");
  });

  it("classifies 200 as null (not a provider error)", () => {
    expect(categorizeError(200, "ok")).toBeNull();
  });

  it("classifies bare 400 with no pattern match as null", () => {
    expect(categorizeError(400, "bad request")).toBeNull();
  });

  it("classifies 400 with billing body as config_error", () => {
    expect(categorizeError(400, "billing issue with account")).toBe("config_error");
    expect(categorizeError(400, "insufficient balance")).toBe("config_error");
  });
});
