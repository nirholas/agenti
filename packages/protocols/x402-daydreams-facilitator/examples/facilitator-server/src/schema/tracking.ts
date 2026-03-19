/**
 * Drizzle ORM schema for the resource_call_records table.
 *
 * Mirrors the POSTGRES_SCHEMA SQL from @daydreamsai/facilitator/tracking.
 * Use with drizzle-kit for migrations or db.select()/db.insert() for typed queries.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const resourceCallRecords = pgTable(
  "resource_call_records",
  {
    id: uuid("id").primaryKey(),
    method: varchar("method", { length: 10 }).notNull(),
    path: text("path").notNull(),
    routeKey: text("route_key").notNull(),
    url: text("url").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),

    paymentRequired: boolean("payment_required").notNull(),
    paymentVerified: boolean("payment_verified").notNull(),
    verificationError: text("verification_error"),

    payment: jsonb("payment"),
    settlement: jsonb("settlement"),
    uptoSession: jsonb("upto_session"),
    x402Version: integer("x402_version"),
    paymentNonce: text("payment_nonce"),
    paymentValidBefore: text("payment_valid_before"),
    payloadHash: text("payload_hash"),
    requirementsHash: text("requirements_hash"),
    paymentSignatureHash: text("payment_signature_hash"),

    responseStatus: integer("response_status").notNull().default(0),
    responseTimeMs: integer("response_time_ms").notNull().default(0),
    handlerExecuted: boolean("handler_executed").notNull().default(false),

    request: jsonb("request").notNull(),
    routeConfig: jsonb("route_config"),
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("idx_records_timestamp").on(table.timestamp),
    index("idx_records_path").on(table.path),
    index("idx_records_payment_verified").on(table.paymentVerified),
    index("idx_records_x402_version").on(table.x402Version),
    index("idx_records_payment_nonce").on(table.paymentNonce),
    index("idx_records_payload_hash").on(table.payloadHash),
    index("idx_records_requirements_hash").on(table.requirementsHash),
  ],
);
