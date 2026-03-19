CREATE TABLE IF NOT EXISTS "resource_call_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"method" varchar(10) NOT NULL,
	"path" text NOT NULL,
	"route_key" text NOT NULL,
	"url" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"payment_required" boolean NOT NULL,
	"payment_verified" boolean NOT NULL,
	"verification_error" text,
	"payment" jsonb,
	"settlement" jsonb,
	"upto_session" jsonb,
	"x402_version" integer,
	"payment_nonce" text,
	"payment_valid_before" text,
	"payload_hash" text,
	"requirements_hash" text,
	"payment_signature_hash" text,
	"response_status" integer DEFAULT 0 NOT NULL,
	"response_time_ms" integer DEFAULT 0 NOT NULL,
	"handler_executed" boolean DEFAULT false NOT NULL,
	"request" jsonb NOT NULL,
	"route_config" jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_records_timestamp" ON "resource_call_records" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_records_path" ON "resource_call_records" USING btree ("path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_records_payment_verified" ON "resource_call_records" USING btree ("payment_verified");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_records_payment_network" ON "resource_call_records" USING btree ((payment->>'network')) WHERE payment IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_records_payment_scheme" ON "resource_call_records" USING btree ((payment->>'scheme')) WHERE payment IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_records_payment_payer" ON "resource_call_records" USING btree ((payment->>'payer')) WHERE payment IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_records_settlement_success" ON "resource_call_records" USING btree ((settlement->>'success')) WHERE settlement IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_records_x402_version" ON "resource_call_records" USING btree ("x402_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_records_payment_nonce" ON "resource_call_records" USING btree ("payment_nonce");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_records_payload_hash" ON "resource_call_records" USING btree ("payload_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_records_requirements_hash" ON "resource_call_records" USING btree ("requirements_hash");
