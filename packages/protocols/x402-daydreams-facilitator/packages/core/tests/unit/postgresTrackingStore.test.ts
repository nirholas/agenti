import { describe, expect, it, mock } from "bun:test";
import { PostgresResourceTrackingStore } from "../../src/tracking/postgres-store.js";
import type { ResourceCallRecord } from "../../src/tracking/types.js";

describe("PostgresResourceTrackingStore", () => {
  it("persists expanded x402 audit columns during create", async () => {
    const query = mock(async () => []);
    const store = new PostgresResourceTrackingStore({
      query,
      queryOne: mock(async () => undefined),
      queryScalar: mock(async () => undefined),
    });

    const record: ResourceCallRecord = {
      id: "6ec9d404-3525-4f0d-8bfa-905f7f58f8cb",
      method: "POST",
      path: "/verify",
      routeKey: "POST /verify",
      url: "http://localhost/verify",
      timestamp: new Date(),
      paymentRequired: true,
      paymentVerified: true,
      verificationError: undefined,
      payment: {
        scheme: "exact",
        network: "eip155:8453",
        networkType: "evm",
        asset: "0xtoken",
        amount: "1",
        amountDecimal: "0.0001",
        currency: "TOK",
        payer: "0xpayer",
        payTo: "0xrecipient",
      },
      settlement: undefined,
      uptoSession: undefined,
      responseStatus: 200,
      responseTimeMs: 12,
      handlerExecuted: true,
      request: { headers: {}, queryParams: {} },
      routeConfig: undefined,
      metadata: undefined,
      x402Version: 2,
      paymentNonce: "42",
      paymentValidBefore: "1700000000",
      payloadHash:
        "f22f8a8e8fbd4f180f4eb253cd268f6f19a8dba5e5ddaf91164a3d622a4e5530",
      requirementsHash:
        "31b8f4f789f67bfa6dd0d9ee2b372d08eb5b601f08d6f6e130f03f4fbef64f7f",
      paymentSignatureHash:
        "465eb3f1bb45f4718b58434f3f8ef08d1a4f0f7cb5293f33fca3653405666b32",
    };

    await store.create(record);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("x402_version");
    expect(sql).toContain("payment_nonce");
    expect(sql).toContain("payment_valid_before");
    expect(sql).toContain("payload_hash");
    expect(sql).toContain("requirements_hash");
    expect(sql).toContain("payment_signature_hash");
    expect(params).toContain(2);
    expect(params).toContain("42");
  });

  it("clears verification_error when paymentVerified is true", async () => {
    const query = mock(async () => []);
    const queryOne = mock(async () => ({ id: "row-1" }));
    const queryScalar = mock(async () => undefined);

    const store = new PostgresResourceTrackingStore({
      query,
      queryOne,
      queryScalar,
    });

    await store.update("row-1", { paymentVerified: true });

    expect(queryOne).toHaveBeenCalledTimes(1);
    const [sql, params] = queryOne.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("payment_verified = $1");
    expect(sql).toContain("verification_error = NULL");
    expect(sql).toContain("RETURNING id");
    expect(params).toEqual([true, "row-1"]);
  });

  it("throws when update targets a missing record", async () => {
    const store = new PostgresResourceTrackingStore({
      query: mock(async () => []),
      queryOne: mock(async () => undefined),
      queryScalar: mock(async () => undefined),
    });

    await expect(
      store.update("missing-id", { responseStatus: 200 })
    ).rejects.toThrow("Tracking record not found");
  });
});
