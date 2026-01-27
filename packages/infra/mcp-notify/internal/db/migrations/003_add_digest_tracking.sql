-- +goose Up
-- +goose StatementBegin

-- Digest batches table: tracks batched notifications for digest emails
CREATE TABLE IF NOT EXISTS digest_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL CHECK (frequency IN ('hourly', 'daily', 'weekly')),
    status TEXT NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting', 'sending', 'sent', 'failed')),
    change_count INTEGER NOT NULL DEFAULT 0,
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Digest items table: links changes to digest batches
CREATE TABLE IF NOT EXISTS digest_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES digest_batches(id) ON DELETE CASCADE,
    change_id UUID NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate changes in the same batch
    UNIQUE(batch_id, change_id)
);

-- Indexes for digest_batches
CREATE INDEX IF NOT EXISTS idx_digest_batches_subscription_id ON digest_batches(subscription_id);
CREATE INDEX IF NOT EXISTS idx_digest_batches_channel_id ON digest_batches(channel_id);
CREATE INDEX IF NOT EXISTS idx_digest_batches_status ON digest_batches(status);
CREATE INDEX IF NOT EXISTS idx_digest_batches_scheduled_for ON digest_batches(scheduled_for);

-- Composite index for finding batches ready to send
CREATE INDEX IF NOT EXISTS idx_digest_batches_ready ON digest_batches(status, scheduled_for)
    WHERE status = 'collecting';

-- Indexes for digest_items
CREATE INDEX IF NOT EXISTS idx_digest_items_batch_id ON digest_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_digest_items_change_id ON digest_items(change_id);

-- Add digest settings column to subscriptions (for tracking last digest times)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_digest_hourly TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_digest_daily TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_digest_weekly TIMESTAMPTZ;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- Remove digest columns from subscriptions
ALTER TABLE subscriptions DROP COLUMN IF EXISTS last_digest_weekly;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS last_digest_daily;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS last_digest_hourly;

-- Drop digest_items indexes
DROP INDEX IF EXISTS idx_digest_items_change_id;
DROP INDEX IF EXISTS idx_digest_items_batch_id;

-- Drop digest_batches indexes
DROP INDEX IF EXISTS idx_digest_batches_ready;
DROP INDEX IF EXISTS idx_digest_batches_scheduled_for;
DROP INDEX IF EXISTS idx_digest_batches_status;
DROP INDEX IF EXISTS idx_digest_batches_channel_id;
DROP INDEX IF EXISTS idx_digest_batches_subscription_id;

-- Drop tables
DROP TABLE IF EXISTS digest_items;
DROP TABLE IF EXISTS digest_batches;

-- +goose StatementEnd
