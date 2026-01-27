-- +goose Up
-- +goose StatementBegin

-- Snapshots table: stores point-in-time snapshots of the registry
CREATE TABLE IF NOT EXISTS snapshots (
    id UUID PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    server_count INTEGER NOT NULL DEFAULT 0,
    hash TEXT NOT NULL,
    servers_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Changes table: stores detected changes between snapshots
CREATE TABLE IF NOT EXISTS changes (
    id UUID PRIMARY KEY,
    snapshot_id UUID REFERENCES snapshots(id) ON DELETE SET NULL,
    server_name TEXT NOT NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('new', 'updated', 'removed')),
    previous_version TEXT,
    new_version TEXT,
    field_changes JSONB,
    server_data JSONB,
    previous_server_data JSONB,
    detected_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscriptions table: stores user subscriptions for notifications
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    filters JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired')),
    api_key_hash TEXT,
    api_key_hint TEXT,
    notification_count INTEGER NOT NULL DEFAULT 0,
    last_reset TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_notified TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Channels table: stores notification channels for subscriptions
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('discord', 'slack', 'email', 'webhook', 'rss')),
    config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_success TIMESTAMPTZ,
    last_failure TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications table: tracks individual notification delivery attempts
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    change_id UUID REFERENCES changes(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    next_retry TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS channels;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS changes;
DROP TABLE IF EXISTS snapshots;

-- +goose StatementEnd
