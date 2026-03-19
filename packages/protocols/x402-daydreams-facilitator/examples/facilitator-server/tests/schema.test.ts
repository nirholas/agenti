import { describe, it, expect } from "bun:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { resourceCallRecords } from "../src/schema/tracking.js";

describe("resourceCallRecords schema", () => {
  const config = getTableConfig(resourceCallRecords);

  it("is named resource_call_records", () => {
    expect(config.name).toBe("resource_call_records");
  });

  it("has all expected columns", () => {
    const columnNames = config.columns.map((c) => c.name);
    const expected = [
      "id",
      "method",
      "path",
      "route_key",
      "url",
      "timestamp",
      "payment_required",
      "payment_verified",
      "verification_error",
      "payment",
      "settlement",
      "upto_session",
      "x402_version",
      "payment_nonce",
      "payment_valid_before",
      "payload_hash",
      "requirements_hash",
      "payment_signature_hash",
      "response_status",
      "response_time_ms",
      "handler_executed",
      "request",
      "route_config",
      "metadata",
    ];

    for (const name of expected) {
      expect(columnNames).toContain(name);
    }
    expect(config.columns.length).toBe(expected.length);
  });

  it("has id as primary key", () => {
    const id = config.columns.find((c) => c.name === "id");
    expect(id).toBeDefined();
    expect(id!.primary).toBe(true);
  });

  it("has NOT NULL on required columns", () => {
    const requiredColumns = [
      "id",
      "method",
      "path",
      "route_key",
      "url",
      "timestamp",
      "payment_required",
      "payment_verified",
      "request",
    ];

    for (const name of requiredColumns) {
      const col = config.columns.find((c) => c.name === name);
      expect(col).toBeDefined();
      expect(col!.notNull).toBe(true);
    }
  });

  it("has nullable JSONB columns for optional data", () => {
    const nullableJsonb = [
      "payment",
      "settlement",
      "upto_session",
      "route_config",
      "metadata",
    ];

    for (const name of nullableJsonb) {
      const col = config.columns.find((c) => c.name === name);
      expect(col).toBeDefined();
      expect(col!.notNull).toBe(false);
      expect(col!.columnType).toBe("PgJsonb");
    }
  });

  it("has defaults on response columns", () => {
    const responseStatus = config.columns.find(
      (c) => c.name === "response_status"
    );
    expect(responseStatus).toBeDefined();
    expect(responseStatus!.hasDefault).toBe(true);

    const responseTimeMs = config.columns.find(
      (c) => c.name === "response_time_ms"
    );
    expect(responseTimeMs).toBeDefined();
    expect(responseTimeMs!.hasDefault).toBe(true);

    const handlerExecuted = config.columns.find(
      (c) => c.name === "handler_executed"
    );
    expect(handlerExecuted).toBeDefined();
    expect(handlerExecuted!.hasDefault).toBe(true);
  });
});
