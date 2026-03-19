import { describe, expect, it, mock } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildMigrationConfig,
  isSchemaCreateFailure,
  runMigrations,
  runMigrationsFallback,
} from "../src/db-migrate.js";

describe("buildMigrationConfig", () => {
  it("stores drizzle migration metadata in public schema", () => {
    const config = buildMigrationConfig("/tmp/drizzle");

    expect(config.migrationsFolder).toBe("/tmp/drizzle");
    expect(config.migrationsSchema).toBe("public");
  });
});

describe("isSchemaCreateFailure", () => {
  it("detects schema create failures from Drizzle error messages", () => {
    expect(
      isSchemaCreateFailure(
        new Error('Failed query: CREATE SCHEMA IF NOT EXISTS "public"')
      )
    ).toBe(true);
  });

  it("returns false for non-schema errors", () => {
    expect(isSchemaCreateFailure(new Error("connection reset by peer"))).toBe(
      false
    );
  });
});

describe("runMigrationsFallback", () => {
  it("applies pending SQL statements and records migration metadata", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "facilitator-migrate-"));
    await mkdir(join(tempDir, "meta"), { recursive: true });
    await writeFile(
      join(tempDir, "meta", "_journal.json"),
      JSON.stringify({
        version: "7",
        dialect: "postgresql",
        entries: [{ when: 100, tag: "0000_test" }],
      }),
      "utf8"
    );
    await writeFile(
      join(tempDir, "0000_test.sql"),
      `CREATE TABLE IF NOT EXISTS "resource_call_records" ("id" uuid PRIMARY KEY);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_records_timestamp" ON "resource_call_records" ("id");`,
      "utf8"
    );

    const clientQuery = mock(async () => ({ rows: [] as unknown[] }));
    const release = mock(() => {});
    const pool = {
      query: mock(async (sql: string) => {
        if (sql.includes("SELECT created_at")) {
          return { rows: [] as unknown[] };
        }
        return { rows: [] as unknown[] };
      }),
      connect: mock(async () => ({
        query: clientQuery,
        release,
      })),
    };

    try {
      await runMigrationsFallback(pool as any, tempDir);

      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(pool.connect).toHaveBeenCalledTimes(1);
      expect(clientQuery).toHaveBeenCalledTimes(5);
      expect(clientQuery.mock.calls[0]?.[0]).toBe("BEGIN");
      expect(String(clientQuery.mock.calls[1]?.[0])).toContain(
        "CREATE TABLE IF NOT EXISTS"
      );
      expect(String(clientQuery.mock.calls[2]?.[0])).toContain(
        "CREATE INDEX IF NOT EXISTS"
      );
      expect(String(clientQuery.mock.calls[3]?.[0])).toContain(
        `INSERT INTO "public"."__drizzle_migrations"`
      );
      expect(clientQuery.mock.calls[4]?.[0]).toBe("COMMIT");
      expect(release).toHaveBeenCalledTimes(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("runMigrations", () => {
  it("falls back to SQL file execution when Drizzle schema bootstrap fails", async () => {
    const clientQuery = mock(async () => ({ rows: [] as unknown[] }));
    const pool = {
      query: mock(async (sql: string) => {
        if (sql.includes("SELECT created_at")) {
          return { rows: [] as unknown[] };
        }
        return { rows: [] as unknown[] };
      }),
      connect: mock(async () => ({
        query: clientQuery,
        release: () => {},
      })),
    };

    await runMigrations(
      pool as any,
      mock(async () => {
        throw new Error('Failed query: CREATE SCHEMA IF NOT EXISTS "public"');
      }) as any
    );

    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(clientQuery).toHaveBeenCalled();
  });

  it("rethrows non-schema migration failures", async () => {
    const pool = {
      query: mock(async () => ({ rows: [] as unknown[] })),
      connect: mock(async () => ({
        query: mock(async () => ({ rows: [] as unknown[] })),
        release: () => {},
      })),
    };

    await expect(
      runMigrations(
        pool as any,
        mock(async () => {
          throw new Error("network timeout");
        }) as any
      )
    ).rejects.toThrow("network timeout");
  });
});
