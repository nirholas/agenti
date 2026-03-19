import { describe, test, expect, beforeEach } from "bun:test";
import { InMemoryUsageTracker } from "../../../src/auth/tracking/memory.js";
import type { UsageTracker } from "../../../src/auth/tracking/interface.js";

describe("InMemoryUsageTracker", () => {
  let tracker: UsageTracker;

  beforeEach(() => {
    tracker = new InMemoryUsageTracker();
  });

  describe("Basic Tracking", () => {
    test("tracks basic request", async () => {
      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 150,
        timestamp: new Date(),
      });

      const recent = await tracker.getRecentRequests("token-1", 10);
      expect(recent).toHaveLength(1);
      expect(recent[0].endpoint).toBe("/verify");
      expect(recent[0].method).toBe("POST");
      expect(recent[0].statusCode).toBe(200);
    });

    test("tracks multiple requests", async () => {
      const now = new Date();

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        timestamp: now,
      });

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/settle",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 200,
        timestamp: now,
      });

      const recent = await tracker.getRecentRequests("token-1", 10);
      expect(recent).toHaveLength(2);
    });

    test("tracks payment details", async () => {
      await tracker.track({
        tokenId: "token-1",
        endpoint: "/settle",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 200,
        paymentScheme: "exact",
        paymentNetwork: "evm",
        paymentAmount: 10.5,
        settlementHash: "0x123abc",
        gasUsed: 0.5,
        timestamp: new Date(),
      });

      const recent = await tracker.getRecentRequests("token-1", 10);
      expect(recent[0].paymentScheme).toBe("exact");
      expect(recent[0].paymentNetwork).toBe("evm");
      expect(recent[0].paymentAmount).toBe(10.5);
      expect(recent[0].settlementHash).toBe("0x123abc");
      expect(recent[0].gasUsed).toBe(0.5);
    });

    test("tracks request context", async () => {
      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        timestamp: new Date(),
      });

      const recent = await tracker.getRecentRequests("token-1", 10);
      expect(recent[0].ipAddress).toBe("192.168.1.1");
      expect(recent[0].userAgent).toBe("Mozilla/5.0");
    });

    test("tracks errors", async () => {
      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 400,
        success: false,
        errorMessage: "Invalid signature",
        responseTimeMs: 50,
        timestamp: new Date(),
      });

      const recent = await tracker.getRecentRequests("token-1", 10);
      expect(recent[0].success).toBe(false);
      expect(recent[0].errorMessage).toBe("Invalid signature");
    });
  });

  describe("Usage Statistics", () => {
    test("calculates total requests", async () => {
      const now = new Date();
      const period = {
        start: new Date(now.getTime() - 1000),
        end: new Date(now.getTime() + 1000),
      };

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        timestamp: now,
      });

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 150,
        timestamp: now,
      });

      const stats = await tracker.getStats("token-1", period);
      expect(stats.totalRequests).toBe(2);
    });

    test("separates successful and failed requests", async () => {
      const now = new Date();
      const period = {
        start: new Date(now.getTime() - 1000),
        end: new Date(now.getTime() + 1000),
      };

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        timestamp: now,
      });

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 400,
        success: false,
        responseTimeMs: 50,
        timestamp: now,
      });

      const stats = await tracker.getStats("token-1", period);
      expect(stats.successfulRequests).toBe(1);
      expect(stats.failedRequests).toBe(1);
    });

    test("calculates average response time", async () => {
      const now = new Date();
      const period = {
        start: new Date(now.getTime() - 1000),
        end: new Date(now.getTime() + 1000),
      };

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        timestamp: now,
      });

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 200,
        timestamp: now,
      });

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 150,
        timestamp: now,
      });

      const stats = await tracker.getStats("token-1", period);
      expect(stats.avgResponseTimeMs).toBe(150); // (100 + 200 + 150) / 3
    });

    test("groups requests by endpoint", async () => {
      const now = new Date();
      const period = {
        start: new Date(now.getTime() - 1000),
        end: new Date(now.getTime() + 1000),
      };

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        timestamp: now,
      });

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        timestamp: now,
      });

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/settle",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 200,
        timestamp: now,
      });

      const stats = await tracker.getStats("token-1", period);
      expect(stats.requestsByEndpoint["/verify"]).toBe(2);
      expect(stats.requestsByEndpoint["/settle"]).toBe(1);
    });

    test("groups requests by network", async () => {
      const now = new Date();
      const period = {
        start: new Date(now.getTime() - 1000),
        end: new Date(now.getTime() + 1000),
      };

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/settle",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        paymentNetwork: "evm",
        timestamp: now,
      });

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/settle",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        paymentNetwork: "svm",
        timestamp: now,
      });

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/settle",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        paymentNetwork: "evm",
        timestamp: now,
      });

      const stats = await tracker.getStats("token-1", period);
      expect(stats.requestsByNetwork["evm"]).toBe(2);
      expect(stats.requestsByNetwork["svm"]).toBe(1);
    });

    test("sums settlement volume and gas costs", async () => {
      const now = new Date();
      const period = {
        start: new Date(now.getTime() - 1000),
        end: new Date(now.getTime() + 1000),
      };

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/settle",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        paymentAmount: 10,
        gasUsed: 0.5,
        timestamp: now,
      });

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/settle",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        paymentAmount: 15,
        gasUsed: 0.7,
        timestamp: now,
      });

      const stats = await tracker.getStats("token-1", period);
      expect(stats.totalSettlementVolume).toBe(25);
      expect(stats.totalGasCost).toBe(1.2);
    });

    test("handles requests without payment data", async () => {
      const now = new Date();
      const period = {
        start: new Date(now.getTime() - 1000),
        end: new Date(now.getTime() + 1000),
      };

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/supported",
        method: "GET",
        statusCode: 200,
        success: true,
        responseTimeMs: 50,
        timestamp: now,
      });

      const stats = await tracker.getStats("token-1", period);
      expect(stats.totalRequests).toBe(1);
      expect(stats.totalSettlementVolume).toBe(0);
      expect(stats.totalGasCost).toBe(0);
    });
  });

  describe("Period Filtering", () => {
    test("filters by time period", async () => {
      const yesterday = new Date(Date.now() - 86400000);
      const today = new Date();

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        timestamp: yesterday,
      });

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        timestamp: today,
      });

      const stats = await tracker.getStats("token-1", {
        start: new Date(Date.now() - 3600000), // Last hour
        end: new Date(),
      });

      expect(stats.totalRequests).toBe(1);
    });

    test("returns zero stats for period with no requests", async () => {
      const stats = await tracker.getStats("token-1", {
        start: new Date(Date.now() - 3600000),
        end: new Date(),
      });

      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
      expect(stats.avgResponseTimeMs).toBe(0);
    });
  });

  describe("Recent Requests", () => {
    test("limits recent requests", async () => {
      for (let i = 0; i < 20; i++) {
        await tracker.track({
          tokenId: "token-1",
          endpoint: "/verify",
          method: "POST",
          statusCode: 200,
          success: true,
          responseTimeMs: 100,
          timestamp: new Date(),
        });
      }

      const recent = await tracker.getRecentRequests("token-1", 5);
      expect(recent).toHaveLength(5);
    });

    test("returns requests in reverse chronological order", async () => {
      const now = Date.now();

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        timestamp: new Date(now - 2000),
      });

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        timestamp: new Date(now - 1000),
      });

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        timestamp: new Date(now),
      });

      const recent = await tracker.getRecentRequests("token-1", 10);
      expect(recent[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        recent[1].timestamp.getTime(),
      );
    });

    test("defaults to 100 if no limit specified", async () => {
      for (let i = 0; i < 150; i++) {
        await tracker.track({
          tokenId: "token-1",
          endpoint: "/verify",
          method: "POST",
          statusCode: 200,
          success: true,
          responseTimeMs: 100,
          timestamp: new Date(),
        });
      }

      const recent = await tracker.getRecentRequests("token-1");
      expect(recent).toHaveLength(100);
    });
  });

  describe("Token Isolation", () => {
    test("isolates tracking per token", async () => {
      const now = new Date();

      await tracker.track({
        tokenId: "token-1",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        timestamp: now,
      });

      await tracker.track({
        tokenId: "token-2",
        endpoint: "/verify",
        method: "POST",
        statusCode: 200,
        success: true,
        responseTimeMs: 100,
        timestamp: now,
      });

      const recent1 = await tracker.getRecentRequests("token-1", 10);
      const recent2 = await tracker.getRecentRequests("token-2", 10);

      expect(recent1).toHaveLength(1);
      expect(recent2).toHaveLength(1);
    });
  });
});
