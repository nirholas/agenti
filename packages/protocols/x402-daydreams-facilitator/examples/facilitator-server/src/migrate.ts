#!/usr/bin/env node
/**
 * Standalone migration runner for the facilitator database.
 *
 * Usage:
 *   bun run src/migrate.ts
 *   bun run db:migrate
 *
 * Requires DATABASE_URL environment variable.
 */

import "dotenv/config";
import pg from "pg";
import { runMigrations } from "./db-migrate.js";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required for migrations");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

console.log("Running migrations...");
await runMigrations(pool);
console.log("Migrations complete.");

await pool.end();
