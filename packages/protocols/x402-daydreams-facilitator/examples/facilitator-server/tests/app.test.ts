import { beforeEach, describe, expect, it } from "bun:test";
import { createApp } from "../src/app.js";
import { createTracking } from "../src/db.js";
import type { AppConfig } from "../src/app.js";
import { createBearerTokenModule } from "../src/modules/bearer-token.js";

let tracking: ReturnType<typeof createTracking>;
let app: ReturnType<typeof createApp>;

const mockFacilitator: AppConfig["facilitator"] = {
  verify: async () => ({ valid: true } as any),
  settle: async () =>
    ({
      success: true,
      network: "eip155:8453",
      transaction: "0xabc",
    }) as any,
  getSupported: () => ({ kinds: [], extensions: [], signers: {} }),
};

const paymentPayload = {
  accepted: { scheme: "exact", network: "eip155:8453" },
  authorization: { from: "0x1234567890123456789012345678901234567890" },
};

const paymentRequirements = {
  scheme: "exact",
  network: "eip155:8453",
  asset: "usdc",
  amount: "1000000",
  payTo: "0x2222222222222222222222222222222222222222",
};

beforeEach(() => {
  tracking = createTracking(undefined, { asyncTracking: false });
  app = createApp({ facilitator: mockFacilitator, tracking });
});

describe("/verify tracking", () => {
  it("creates a tracking record with verification and request metadata", async () => {
    const response = await app.handle(
      new Request("http://localhost/verify?tag=a&tag=b", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": "req-verify-1",
          "user-agent": "bun-test",
        },
        body: JSON.stringify({
          paymentPayload,
          paymentRequirements,
        }),
      })
    );

    expect(response.status).toBe(200);

    const records = await tracking.list({ limit: 10, filters: { path: "/verify" } });
    expect(records.total).toBe(1);

    const record = records.records[0];
    expect(record.method).toBe("POST");
    expect(record.path).toBe("/verify");
    expect(record.responseStatus).toBe(200);
    expect(record.paymentVerified).toBe(true);
    expect(record.payment?.network).toBe("eip155:8453");
    expect(record.payment?.payer).toBe("0x1234567890123456789012345678901234567890");
    expect(record.request.queryParams.tag).toEqual(["a", "b"]);
    expect(record.request.headers["x-request-id"]).toBe("req-verify-1");
  });

  it("tracks payment details when verify throws with valid body", async () => {
    const failingApp = createApp({
      facilitator: {
        ...mockFacilitator,
        verify: async () => {
          throw new Error("verify failed");
        },
      },
      tracking,
    });

    const response = await failingApp.handle(
      new Request("http://localhost/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentPayload,
          paymentRequirements,
        }),
      })
    );

    expect(response.status).toBe(500);

    const records = await tracking.list({ limit: 10, filters: { path: "/verify" } });
    expect(records.total).toBe(1);

    const record = records.records[0];
    expect(record.paymentVerified).toBe(false);
    expect(record.payment?.network).toBe("eip155:8453");
    expect(record.payment?.payer).toBe("0x1234567890123456789012345678901234567890");
  });
});

describe("/settle tracking", () => {
  it("creates a tracking record with settlement details", async () => {
    const response = await app.handle(
      new Request("http://localhost/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentPayload,
          paymentRequirements,
        }),
      })
    );

    expect(response.status).toBe(200);

    const records = await tracking.list({ limit: 10, filters: { path: "/settle" } });
    expect(records.total).toBe(1);
    const record = records.records[0];
    expect(record.method).toBe("POST");
    expect(record.paymentVerified).toBe(true);
    expect(record.settlement?.attempted).toBe(true);
    expect(record.settlement?.success).toBe(true);
    expect(record.settlement?.transactionHash).toBe("0xabc");
    expect(record.responseStatus).toBe(200);
  });
});

describe("/verify tracking with missing body", () => {
  it("tracks failed requests (400) without executing handler", async () => {
    const response = await app.handle(
      new Request("http://localhost/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(400);

    const records = await tracking.list({
      limit: 10,
      filters: { path: "/verify" },
    });
    expect(records.total).toBe(1);
    const record = records.records[0];
    expect(record.responseStatus).toBe(400);
    expect(record.handlerExecuted).toBe(false);
    expect(record.paymentVerified).toBe(false);
  });

  it("handles undefined request body without crashing catch path", async () => {
    const response = await app.handle(
      new Request("http://localhost/verify", {
        method: "POST",
      })
    );

    expect(response.status).toBe(500);

    const records = await tracking.list({
      limit: 10,
      filters: { path: "/verify" },
    });
    expect(records.total).toBe(1);
    const record = records.records[0];
    expect(record.responseStatus).toBe(500);
    expect(record.handlerExecuted).toBe(false);
    expect(record.paymentVerified).toBe(false);
  });
});

describe("bearer token module integration", () => {
  it("rejects /verify without authorization header when module is configured", async () => {
    const guardedApp = createApp({
      facilitator: mockFacilitator,
      tracking,
      modules: [
        createBearerTokenModule({
          tokens: ["DREAMS"],
        }),
      ],
    });

    const response = await guardedApp.handle(
      new Request("http://localhost/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentPayload,
          paymentRequirements,
        }),
      })
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer realm="facilitator"'
    );
  });
});
