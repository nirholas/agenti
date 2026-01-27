-- +goose Up
-- +goose StatementBegin

-- Snapshots indexes
CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON snapshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_hash ON snapshots(hash);

-- Changes indexes
CREATE INDEX IF NOT EXISTS idx_changes_detected_at ON changes(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_changes_server_name ON changes(server_name);
CREATE INDEX IF NOT EXISTS idx_changes_change_type ON changes(change_type);
CREATE INDEX IF NOT EXISTS idx_changes_snapshot_id ON changes(snapshot_id);

-- GIN index for JSONB field_changes queries
CREATE INDEX IF NOT EXISTS idx_changes_field_changes ON changes USING GIN (field_changes);

-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_api_key_hash ON subscriptions(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions(created_at DESC);

-- GIN index for JSONB filters queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_filters ON subscriptions USING GIN (filters);

-- Channels indexes
CREATE INDEX IF NOT EXISTS idx_channels_subscription_id ON channels(subscription_id);
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(type);
CREATE INDEX IF NOT EXISTS idx_channels_enabled ON channels(enabled);

-- GIN index for JSONB config queries
CREATE INDEX IF NOT EXISTS idx_channels_config ON channels USING GIN (config);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_subscription_id ON notifications(subscription_id);
CREATE INDEX IF NOT EXISTS idx_notifications_channel_id ON notifications(channel_id);
CREATE INDEX IF NOT EXISTS idx_notifications_change_id ON notifications(change_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Composite index for pending notifications query (status + next_retry)
CREATE INDEX IF NOT EXISTS idx_notifications_pending ON notifications(status, next_retry) 
    WHERE status = 'pending';

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- Drop notification indexes
DROP INDEX IF EXISTS idx_notifications_pending;
DROP INDEX IF EXISTS idx_notifications_created_at;
DROP INDEX IF EXISTS idx_notifications_change_id;
DROP INDEX IF EXISTS idx_notifications_channel_id;
DROP INDEX IF EXISTS idx_notifications_subscription_id;
DROP INDEX IF EXISTS idx_notifications_status;

-- Drop channel indexes
DROP INDEX IF EXISTS idx_channels_config;
DROP INDEX IF EXISTS idx_channels_enabled;
DROP INDEX IF EXISTS idx_channels_type;
DROP INDEX IF EXISTS idx_channels_subscription_id;

-- Drop subscription indexes
DROP INDEX IF EXISTS idx_subscriptions_filters;
DROP INDEX IF EXISTS idx_subscriptions_created_at;
DROP INDEX IF EXISTS idx_subscriptions_api_key_hash;
DROP INDEX IF EXISTS idx_subscriptions_status;

-- Drop change indexes
DROP INDEX IF EXISTS idx_changes_field_changes;
DROP INDEX IF EXISTS idx_changes_snapshot_id;
DROP INDEX IF EXISTS idx_changes_change_type;
DROP INDEX IF EXISTS idx_changes_server_name;
DROP INDEX IF EXISTS idx_changes_detected_at;

-- Drop snapshot indexes
DROP INDEX IF EXISTS idx_snapshots_hash;
DROP INDEX IF EXISTS idx_snapshots_timestamp;

-- +goose StatementEnd
