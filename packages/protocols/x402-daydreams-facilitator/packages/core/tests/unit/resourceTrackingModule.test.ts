import { describe, expect, it } from "bun:test";
import {
  createResourceTrackingModule,
  type ResourceTrackingModule,
} from "../../src/tracking/lib.js";
import type { ResourceTrackingStore } from "../../src/tracking/store.js";
import type {
  ListOptions,
  ListResult,
  ResourceCallRecord,
  TrackingStats,
} from "../../src/tracking/types.js";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function createStoreForOrderingTest(
  events: string[],
  createGate: Promise<void>
): ResourceTrackingStore {
  return {
    async create(_record: ResourceCallRecord): Promise<void> {
      events.push("create:start");
      await createGate;
      events.push("create:end");
    },
    async update(_id: string, updates: Partial<ResourceCallRecord>): Promise<void> {
      if (updates.paymentVerified !== undefined) {
        events.push("update:verification");
      } else if (updates.responseStatus !== undefined) {
        events.push("update:finalize");
      } else {
        events.push("update:other");
      }
    },
    async get(): Promise<ResourceCallRecord | undefined> {
      return undefined;
    },
    async list(_options: ListOptions): Promise<ListResult> {
      return { records: [], total: 0, hasMore: false };
    },
    async getStats(_start: Date, _end: Date): Promise<TrackingStats> {
      return {
        period: { start: new Date(0), end: new Date(0) },
        totalRequests: 0,
        paymentRequiredRequests: 0,
        verifiedPayments: 0,
        successfulSettlements: 0,
        failedSettlements: 0,
        totalVolumeByNetwork: {},
        totalVolumeByAsset: {},
        avgResponseTimeMs: 0,
        p95ResponseTimeMs: 0,
        requestsByPath: {},
        requestsByNetwork: {},
        requestsByScheme: {},
      };
    },
    async prune(): Promise<number> {
      return 0;
    },
  };
}

describe("ResourceTrackingModule write ordering", () => {
  it("serializes lifecycle updates after startTracking in async mode", async () => {
    const events: string[] = [];
    let releaseCreate: (() => void) | undefined;
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    const store = createStoreForOrderingTest(events, createGate);

    const tracking: ResourceTrackingModule = createResourceTrackingModule({
      store,
      asyncTracking: true,
    });

    const id = await tracking.startTracking({
      method: "POST",
      path: "/verify",
      url: "http://localhost/verify",
      paymentRequired: true,
      request: { headers: {}, queryParams: {} },
    });

    await tracking.recordVerification(id, true);
    await tracking.finalizeTracking(id, 200, 12, true);

    await sleep(5);
    expect(events.includes("update:verification")).toBe(false);
    expect(events.includes("update:finalize")).toBe(false);

    releaseCreate?.();
    await sleep(10);

    const createEnd = events.indexOf("create:end");
    const verificationUpdate = events.indexOf("update:verification");
    const finalizeUpdate = events.indexOf("update:finalize");

    expect(createEnd).toBeGreaterThanOrEqual(0);
    expect(verificationUpdate).toBeGreaterThan(createEnd);
    expect(finalizeUpdate).toBeGreaterThan(verificationUpdate);
  });
});
