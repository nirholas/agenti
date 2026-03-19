/**
 * Reusable migration function for server startup.
 * Safe to call on every startup -- already-applied migrations are skipped.
 */

import type { Pool } from "pg";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRIZZLE_MIGRATIONS_TABLE = `"public"."__drizzle_migrations"`;
const STATEMENT_BREAKPOINT = "--> statement-breakpoint";

interface MigrationJournalEntry {
  when: number;
  tag: string;
}

interface MigrationJournal {
  entries: MigrationJournalEntry[];
}

const toErrorMessage = (value: unknown): string => {
  if (value instanceof Error) return value.message;
  return String(value);
};

export function isSchemaCreateFailure(value: unknown): boolean {
  const message = toErrorMessage(value).toUpperCase();
  return message.includes("CREATE SCHEMA IF NOT EXISTS");
}

const parseMigrationSql = (migrationSql: string): string[] =>
  migrationSql
    .split(STATEMENT_BREAKPOINT)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

export function buildMigrationConfig(migrationsFolder: string) {
  return {
    migrationsFolder,
    migrationsSchema: "public" as const,
  };
}

export async function runMigrationsFallback(
  pool: Pool,
  migrationsFolder: string
): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${DRIZZLE_MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const migrationState = await pool.query<{ created_at: string | number }>(
    `SELECT created_at FROM ${DRIZZLE_MIGRATIONS_TABLE} ORDER BY created_at DESC LIMIT 1`
  );
  const lastApplied = Number(migrationState.rows[0]?.created_at ?? 0);

  const journalPath = resolve(migrationsFolder, "meta", "_journal.json");
  const journalContent = await readFile(journalPath, "utf8");
  const journal = JSON.parse(journalContent) as MigrationJournal;
  const pendingEntries = [...journal.entries]
    .sort((a, b) => a.when - b.when)
    .filter((entry) => entry.when > lastApplied);

  for (const entry of pendingEntries) {
    const migrationPath = resolve(migrationsFolder, `${entry.tag}.sql`);
    const migrationSql = await readFile(migrationPath, "utf8");
    const statements = parseMigrationSql(migrationSql);
    const hash = createHash("sha256").update(migrationSql).digest("hex");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      for (const statement of statements) {
        await client.query(statement);
      }
      await client.query(
        `INSERT INTO ${DRIZZLE_MIGRATIONS_TABLE} ("hash", "created_at") VALUES ($1, $2)`,
        [hash, entry.when]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export async function runMigrations(
  pool: Pool,
  migrateFn: typeof migrate = migrate
): Promise<void> {
  const db = drizzle(pool);
  const migrationsFolder = resolve(__dirname, "../drizzle");
  try {
    await migrateFn(db, buildMigrationConfig(migrationsFolder));
  } catch (error) {
    if (!isSchemaCreateFailure(error)) {
      throw error;
    }

    await runMigrationsFallback(pool, migrationsFolder);
  }
}
