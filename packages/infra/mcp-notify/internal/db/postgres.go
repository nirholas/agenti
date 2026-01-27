// Package db provides database access for MCP Notify.
package db

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pressly/goose/v3"
	"github.com/rs/zerolog/log"

	"github.com/nirholas/mcp-notify/internal/config"
	"github.com/nirholas/mcp-notify/pkg/types"
)

//go:embed migrations/*.sql
var embedMigrations embed.FS

// PostgresDB implements the Database interface using PostgreSQL.
type PostgresDB struct {
	pool *pgxpool.Pool
}

// New creates a new PostgreSQL database connection.
func New(ctx context.Context, cfg config.DatabaseConfig) (*PostgresDB, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	poolConfig.MaxConns = int32(cfg.MaxConnections)
	poolConfig.MinConns = int32(cfg.MaxIdleConns)
	poolConfig.MaxConnLifetime = cfg.ConnMaxLifetime
	poolConfig.MaxConnIdleTime = cfg.ConnMaxIdleTime

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Info().Msg("Connected to PostgreSQL database")

	return &PostgresDB{pool: pool}, nil
}

// Close closes the database connection pool.
func (db *PostgresDB) Close() error {
	db.pool.Close()
	return nil
}

// Ping checks if the database is reachable.
func (db *PostgresDB) Ping(ctx context.Context) error {
	return db.pool.Ping(ctx)
}

// Migrate runs database migrations.
func (db *PostgresDB) Migrate(ctx context.Context) error {
	goose.SetBaseFS(embedMigrations)

	conn, err := db.pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("failed to acquire connection: %w", err)
	}
	defer conn.Release()

	// Get underlying *sql.DB for goose
	// Note: This requires converting pgx connection to database/sql
	// For now, we'll use pgx directly for migrations

	log.Info().Msg("Running database migrations...")

	// Note: goose migrations are available in internal/db/migrations/ for production deployments.
	// This method uses ensureTables() for development simplicity.
	// For production, run migrations separately via: goose -dir internal/db/migrations postgres "$DATABASE_URL" up

	if err := db.ensureTables(ctx); err != nil {
		return fmt.Errorf("failed to ensure tables: %w", err)
	}

	log.Info().Msg("Database migrations completed")
	return nil
}

func (db *PostgresDB) ensureTables(ctx context.Context) error {
	// Create tables if they don't exist
	// This is a simplified version - production should use proper migrations

	queries := []string{
		`CREATE TABLE IF NOT EXISTS snapshots (
			id UUID PRIMARY KEY,
			timestamp TIMESTAMPTZ NOT NULL,
			server_count INTEGER NOT NULL,
			hash TEXT NOT NULL,
			servers_data JSONB,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON snapshots(timestamp DESC)`,

		`CREATE TABLE IF NOT EXISTS changes (
			id UUID PRIMARY KEY,
			snapshot_id UUID REFERENCES snapshots(id),
			server_name TEXT NOT NULL,
			change_type TEXT NOT NULL,
			previous_version TEXT,
			new_version TEXT,
			field_changes JSONB,
			server_data JSONB,
			previous_server_data JSONB,
			detected_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_changes_detected_at ON changes(detected_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_changes_server_name ON changes(server_name)`,

		`CREATE TABLE IF NOT EXISTS subscriptions (
			id UUID PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			filters JSONB NOT NULL DEFAULT '{}',
			status TEXT NOT NULL DEFAULT 'active',
			api_key_hash TEXT,
			api_key_hint TEXT,
			notification_count INTEGER DEFAULT 0,
			last_reset TIMESTAMPTZ DEFAULT NOW(),
			last_notified TIMESTAMPTZ,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`,
		`CREATE INDEX IF NOT EXISTS idx_subscriptions_api_key ON subscriptions(api_key_hash)`,

		`CREATE TABLE IF NOT EXISTS channels (
			id UUID PRIMARY KEY,
			subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
			type TEXT NOT NULL,
			config JSONB NOT NULL DEFAULT '{}',
			enabled BOOLEAN DEFAULT true,
			success_count INTEGER DEFAULT 0,
			failure_count INTEGER DEFAULT 0,
			last_success TIMESTAMPTZ,
			last_failure TIMESTAMPTZ,
			last_error TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_channels_subscription ON channels(subscription_id)`,

		`CREATE TABLE IF NOT EXISTS notifications (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
			channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
			change_id UUID REFERENCES changes(id),
			status TEXT NOT NULL DEFAULT 'pending',
			attempts INTEGER DEFAULT 0,
			next_retry TIMESTAMPTZ,
			sent_at TIMESTAMPTZ,
			error TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status)`,
		`CREATE INDEX IF NOT EXISTS idx_notifications_subscription ON notifications(subscription_id)`,
	}

	for _, query := range queries {
		if _, err := db.pool.Exec(ctx, query); err != nil {
			return fmt.Errorf("failed to execute query: %w", err)
		}
	}

	return nil
}

// SaveSnapshot saves a snapshot to the database.
func (db *PostgresDB) SaveSnapshot(ctx context.Context, snapshot *types.Snapshot) error {
	serversData, err := json.Marshal(snapshot.Servers)
	if err != nil {
		return fmt.Errorf("failed to marshal servers: %w", err)
	}

	_, err = db.pool.Exec(ctx,
		`INSERT INTO snapshots (id, timestamp, server_count, hash, servers_data)
		VALUES ($1, $2, $3, $4, $5)`,
		snapshot.ID, snapshot.Timestamp, snapshot.ServerCount, snapshot.Hash, serversData,
	)
	return err
}

// GetLatestSnapshot retrieves the most recent snapshot.
func (db *PostgresDB) GetLatestSnapshot(ctx context.Context) (*types.Snapshot, error) {
	var snapshot types.Snapshot
	var serversData []byte

	err := db.pool.QueryRow(ctx,
		`SELECT id, timestamp, server_count, hash, servers_data
		FROM snapshots ORDER BY timestamp DESC LIMIT 1`,
	).Scan(&snapshot.ID, &snapshot.Timestamp, &snapshot.ServerCount, &snapshot.Hash, &serversData)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(serversData, &snapshot.Servers); err != nil {
		return nil, fmt.Errorf("failed to unmarshal servers: %w", err)
	}

	return &snapshot, nil
}

// GetSnapshotByID retrieves a snapshot by ID.
func (db *PostgresDB) GetSnapshotByID(ctx context.Context, id uuid.UUID) (*types.Snapshot, error) {
	var snapshot types.Snapshot
	var serversData []byte

	err := db.pool.QueryRow(ctx,
		`SELECT id, timestamp, server_count, hash, servers_data
		FROM snapshots WHERE id = $1`, id,
	).Scan(&snapshot.ID, &snapshot.Timestamp, &snapshot.ServerCount, &snapshot.Hash, &serversData)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(serversData, &snapshot.Servers); err != nil {
		return nil, fmt.Errorf("failed to unmarshal servers: %w", err)
	}

	return &snapshot, nil
}

// GetSnapshotAt retrieves the snapshot closest to the given timestamp.
func (db *PostgresDB) GetSnapshotAt(ctx context.Context, timestamp time.Time) (*types.Snapshot, error) {
	var snapshot types.Snapshot
	var serversData []byte

	err := db.pool.QueryRow(ctx,
		`SELECT id, timestamp, server_count, hash, servers_data
		FROM snapshots WHERE timestamp <= $1 ORDER BY timestamp DESC LIMIT 1`, timestamp,
	).Scan(&snapshot.ID, &snapshot.Timestamp, &snapshot.ServerCount, &snapshot.Hash, &serversData)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(serversData, &snapshot.Servers); err != nil {
		return nil, fmt.Errorf("failed to unmarshal servers: %w", err)
	}

	return &snapshot, nil
}

// DeleteOldSnapshots removes snapshots older than the given time.
func (db *PostgresDB) DeleteOldSnapshots(ctx context.Context, olderThan time.Time) error {
	_, err := db.pool.Exec(ctx,
		`DELETE FROM snapshots WHERE timestamp < $1`, olderThan,
	)
	return err
}

// SaveChange saves a change to the database.
func (db *PostgresDB) SaveChange(ctx context.Context, change *types.Change) error {
	fieldChanges, _ := json.Marshal(change.FieldChanges)
	serverData, _ := json.Marshal(change.Server)
	prevServerData, _ := json.Marshal(change.PreviousServer)

	_, err := db.pool.Exec(ctx,
		`INSERT INTO changes (id, snapshot_id, server_name, change_type, previous_version, new_version, field_changes, server_data, previous_server_data, detected_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		change.ID, change.SnapshotID, change.ServerName, change.ChangeType,
		change.PreviousVersion, change.NewVersion, fieldChanges, serverData, prevServerData, change.DetectedAt,
	)
	return err
}

// GetChangeByID retrieves a change by ID.
func (db *PostgresDB) GetChangeByID(ctx context.Context, id uuid.UUID) (*types.Change, error) {
	var change types.Change
	var fieldChanges, serverData, prevServerData []byte

	err := db.pool.QueryRow(ctx,
		`SELECT id, snapshot_id, server_name, change_type, previous_version, new_version, field_changes, server_data, previous_server_data, detected_at
		FROM changes WHERE id = $1`, id,
	).Scan(&change.ID, &change.SnapshotID, &change.ServerName, &change.ChangeType,
		&change.PreviousVersion, &change.NewVersion, &fieldChanges, &serverData, &prevServerData, &change.DetectedAt)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	json.Unmarshal(fieldChanges, &change.FieldChanges)
	json.Unmarshal(serverData, &change.Server)
	json.Unmarshal(prevServerData, &change.PreviousServer)

	return &change, nil
}

// GetChangesSince retrieves changes since the given timestamp.
func (db *PostgresDB) GetChangesSince(ctx context.Context, since time.Time, limit int) ([]types.Change, error) {
	rows, err := db.pool.Query(ctx,
		`SELECT id, snapshot_id, server_name, change_type, previous_version, new_version, field_changes, server_data, previous_server_data, detected_at
		FROM changes WHERE detected_at >= $1 ORDER BY detected_at DESC LIMIT $2`, since, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var changes []types.Change
	for rows.Next() {
		var change types.Change
		var fieldChanges, serverData, prevServerData []byte

		if err := rows.Scan(&change.ID, &change.SnapshotID, &change.ServerName, &change.ChangeType,
			&change.PreviousVersion, &change.NewVersion, &fieldChanges, &serverData, &prevServerData, &change.DetectedAt); err != nil {
			return nil, err
		}

		json.Unmarshal(fieldChanges, &change.FieldChanges)
		json.Unmarshal(serverData, &change.Server)
		json.Unmarshal(prevServerData, &change.PreviousServer)

		changes = append(changes, change)
	}

	return changes, nil
}

// GetChangesForServer retrieves changes for a specific server.
func (db *PostgresDB) GetChangesForServer(ctx context.Context, serverName string, limit int) ([]types.Change, error) {
	rows, err := db.pool.Query(ctx,
		`SELECT id, snapshot_id, server_name, change_type, previous_version, new_version, field_changes, server_data, previous_server_data, detected_at
		FROM changes WHERE server_name = $1 ORDER BY detected_at DESC LIMIT $2`, serverName, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var changes []types.Change
	for rows.Next() {
		var change types.Change
		var fieldChanges, serverData, prevServerData []byte

		if err := rows.Scan(&change.ID, &change.SnapshotID, &change.ServerName, &change.ChangeType,
			&change.PreviousVersion, &change.NewVersion, &fieldChanges, &serverData, &prevServerData, &change.DetectedAt); err != nil {
			return nil, err
		}

		json.Unmarshal(fieldChanges, &change.FieldChanges)
		json.Unmarshal(serverData, &change.Server)
		json.Unmarshal(prevServerData, &change.PreviousServer)

		changes = append(changes, change)
	}

	return changes, nil
}

// GetChangeCountSince returns the count of changes since the given timestamp.
func (db *PostgresDB) GetChangeCountSince(ctx context.Context, since time.Time) (int, error) {
	var count int
	err := db.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM changes WHERE detected_at >= $1`, since,
	).Scan(&count)
	return count, err
}

// Subscription CRUD operations

func (db *PostgresDB) CreateSubscription(ctx context.Context, sub *types.Subscription) error {
	filters, _ := json.Marshal(sub.Filters)
	_, err := db.pool.Exec(ctx,
		`INSERT INTO subscriptions (id, name, description, filters, status, api_key_hash, api_key_hint, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		sub.ID, sub.Name, sub.Description, filters, sub.Status, sub.APIKey, sub.APIKeyHint, sub.CreatedAt, sub.UpdatedAt,
	)
	return err
}

// GetSubscriptionByID retrieves a subscription by ID with its channels.
func (db *PostgresDB) GetSubscriptionByID(ctx context.Context, id uuid.UUID) (*types.Subscription, error) {
	var sub types.Subscription
	var filters []byte
	var lastNotified *time.Time

	err := db.pool.QueryRow(ctx,
		`SELECT id, name, description, filters, status, api_key_hash, api_key_hint, 
		        notification_count, last_reset, last_notified, created_at, updated_at
		FROM subscriptions WHERE id = $1`, id,
	).Scan(&sub.ID, &sub.Name, &sub.Description, &filters, &sub.Status,
		&sub.APIKey, &sub.APIKeyHint, &sub.NotificationCount, &sub.LastReset,
		&lastNotified, &sub.CreatedAt, &sub.UpdatedAt)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription: %w", err)
	}

	if err := json.Unmarshal(filters, &sub.Filters); err != nil {
		return nil, fmt.Errorf("failed to unmarshal filters: %w", err)
	}
	sub.LastNotified = lastNotified

	// Load channels
	channels, err := db.GetChannelsForSubscription(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get channels: %w", err)
	}
	sub.Channels = channels

	return &sub, nil
}

// GetSubscriptionByAPIKey retrieves a subscription by hashed API key.
func (db *PostgresDB) GetSubscriptionByAPIKey(ctx context.Context, apiKeyHash string) (*types.Subscription, error) {
	var sub types.Subscription
	var filters []byte
	var lastNotified *time.Time

	err := db.pool.QueryRow(ctx,
		`SELECT id, name, description, filters, status, api_key_hash, api_key_hint,
		        notification_count, last_reset, last_notified, created_at, updated_at
		FROM subscriptions WHERE api_key_hash = $1`, apiKeyHash,
	).Scan(&sub.ID, &sub.Name, &sub.Description, &filters, &sub.Status,
		&sub.APIKey, &sub.APIKeyHint, &sub.NotificationCount, &sub.LastReset,
		&lastNotified, &sub.CreatedAt, &sub.UpdatedAt)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription by API key: %w", err)
	}

	if err := json.Unmarshal(filters, &sub.Filters); err != nil {
		return nil, fmt.Errorf("failed to unmarshal filters: %w", err)
	}
	sub.LastNotified = lastNotified

	// Load channels
	channels, err := db.GetChannelsForSubscription(ctx, sub.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get channels: %w", err)
	}
	sub.Channels = channels

	return &sub, nil
}

// GetActiveSubscriptions retrieves all active subscriptions with their channels.
func (db *PostgresDB) GetActiveSubscriptions(ctx context.Context) ([]types.Subscription, error) {
	rows, err := db.pool.Query(ctx,
		`SELECT id, name, description, filters, status, api_key_hash, api_key_hint,
		        notification_count, last_reset, last_notified, created_at, updated_at
		FROM subscriptions WHERE status = 'active'`,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query active subscriptions: %w", err)
	}
	defer rows.Close()

	var subscriptions []types.Subscription
	for rows.Next() {
		var sub types.Subscription
		var filters []byte
		var lastNotified *time.Time

		if err := rows.Scan(&sub.ID, &sub.Name, &sub.Description, &filters, &sub.Status,
			&sub.APIKey, &sub.APIKeyHint, &sub.NotificationCount, &sub.LastReset,
			&lastNotified, &sub.CreatedAt, &sub.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan subscription: %w", err)
		}

		if err := json.Unmarshal(filters, &sub.Filters); err != nil {
			return nil, fmt.Errorf("failed to unmarshal filters: %w", err)
		}
		sub.LastNotified = lastNotified

		// Load channels for each subscription
		channels, err := db.GetChannelsForSubscription(ctx, sub.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to get channels for subscription %s: %w", sub.ID, err)
		}
		sub.Channels = channels

		subscriptions = append(subscriptions, sub)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating subscriptions: %w", err)
	}

	return subscriptions, nil
}

// UpdateSubscription updates a subscription's fields.
func (db *PostgresDB) UpdateSubscription(ctx context.Context, sub *types.Subscription) error {
	filters, err := json.Marshal(sub.Filters)
	if err != nil {
		return fmt.Errorf("failed to marshal filters: %w", err)
	}

	sub.UpdatedAt = time.Now().UTC()

	result, err := db.pool.Exec(ctx,
		`UPDATE subscriptions SET 
			name = $2, description = $3, filters = $4, status = $5,
			notification_count = $6, last_reset = $7, last_notified = $8, updated_at = $9
		WHERE id = $1`,
		sub.ID, sub.Name, sub.Description, filters, sub.Status,
		sub.NotificationCount, sub.LastReset, sub.LastNotified, sub.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to update subscription: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("subscription not found: %s", sub.ID)
	}

	return nil
}

// DeleteSubscription deletes a subscription by ID.
func (db *PostgresDB) DeleteSubscription(ctx context.Context, id uuid.UUID) error {
	result, err := db.pool.Exec(ctx, `DELETE FROM subscriptions WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete subscription: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("subscription not found: %s", id)
	}
	return nil
}

// ListSubscriptions returns a paginated list of subscriptions with total count.
func (db *PostgresDB) ListSubscriptions(ctx context.Context, limit, offset int) ([]types.Subscription, int, error) {
	// Get total count
	var total int
	if err := db.pool.QueryRow(ctx, `SELECT COUNT(*) FROM subscriptions`).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count subscriptions: %w", err)
	}

	// Get paginated results
	rows, err := db.pool.Query(ctx,
		`SELECT id, name, description, filters, status, api_key_hash, api_key_hint,
		        notification_count, last_reset, last_notified, created_at, updated_at
		FROM subscriptions ORDER BY created_at DESC LIMIT $1 OFFSET $2`, limit, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query subscriptions: %w", err)
	}
	defer rows.Close()

	var subscriptions []types.Subscription
	for rows.Next() {
		var sub types.Subscription
		var filters []byte
		var lastNotified *time.Time

		if err := rows.Scan(&sub.ID, &sub.Name, &sub.Description, &filters, &sub.Status,
			&sub.APIKey, &sub.APIKeyHint, &sub.NotificationCount, &sub.LastReset,
			&lastNotified, &sub.CreatedAt, &sub.UpdatedAt); err != nil {
			return nil, 0, fmt.Errorf("failed to scan subscription: %w", err)
		}

		if err := json.Unmarshal(filters, &sub.Filters); err != nil {
			return nil, 0, fmt.Errorf("failed to unmarshal filters: %w", err)
		}
		sub.LastNotified = lastNotified

		// Load channels
		channels, err := db.GetChannelsForSubscription(ctx, sub.ID)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to get channels: %w", err)
		}
		sub.Channels = channels

		subscriptions = append(subscriptions, sub)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating subscriptions: %w", err)
	}

	return subscriptions, total, nil
}

// CreateChannel creates a new notification channel.
func (db *PostgresDB) CreateChannel(ctx context.Context, channel *types.Channel) error {
	configData, err := json.Marshal(channel.Config)
	if err != nil {
		return fmt.Errorf("failed to marshal channel config: %w", err)
	}

	_, err = db.pool.Exec(ctx,
		`INSERT INTO channels (id, subscription_id, type, config, enabled, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		channel.ID, channel.SubscriptionID, channel.Type, configData, channel.Enabled, channel.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create channel: %w", err)
	}
	return nil
}

// GetChannelByID retrieves a channel by ID.
func (db *PostgresDB) GetChannelByID(ctx context.Context, id uuid.UUID) (*types.Channel, error) {
	var channel types.Channel
	var configData []byte
	var lastSuccess, lastFailure *time.Time
	var lastError *string

	err := db.pool.QueryRow(ctx,
		`SELECT id, subscription_id, type, config, enabled, success_count, failure_count,
		        last_success, last_failure, last_error, created_at
		FROM channels WHERE id = $1`, id,
	).Scan(&channel.ID, &channel.SubscriptionID, &channel.Type, &configData, &channel.Enabled,
		&channel.SuccessCount, &channel.FailureCount, &lastSuccess, &lastFailure, &lastError, &channel.CreatedAt)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get channel: %w", err)
	}

	if err := json.Unmarshal(configData, &channel.Config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal channel config: %w", err)
	}
	channel.LastSuccess = lastSuccess
	channel.LastFailure = lastFailure
	if lastError != nil {
		channel.LastError = *lastError
	}

	return &channel, nil
}

// GetChannelsForSubscription retrieves all channels for a subscription.
func (db *PostgresDB) GetChannelsForSubscription(ctx context.Context, subscriptionID uuid.UUID) ([]types.Channel, error) {
	rows, err := db.pool.Query(ctx,
		`SELECT id, subscription_id, type, config, enabled, success_count, failure_count,
		        last_success, last_failure, last_error, created_at
		FROM channels WHERE subscription_id = $1`, subscriptionID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query channels: %w", err)
	}
	defer rows.Close()

	var channels []types.Channel
	for rows.Next() {
		var channel types.Channel
		var configData []byte
		var lastSuccess, lastFailure *time.Time
		var lastError *string

		if err := rows.Scan(&channel.ID, &channel.SubscriptionID, &channel.Type, &configData, &channel.Enabled,
			&channel.SuccessCount, &channel.FailureCount, &lastSuccess, &lastFailure, &lastError, &channel.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan channel: %w", err)
		}

		if err := json.Unmarshal(configData, &channel.Config); err != nil {
			return nil, fmt.Errorf("failed to unmarshal channel config: %w", err)
		}
		channel.LastSuccess = lastSuccess
		channel.LastFailure = lastFailure
		if lastError != nil {
			channel.LastError = *lastError
		}

		channels = append(channels, channel)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating channels: %w", err)
	}

	return channels, nil
}

// UpdateChannel updates a channel including stats fields.
func (db *PostgresDB) UpdateChannel(ctx context.Context, channel *types.Channel) error {
	configData, err := json.Marshal(channel.Config)
	if err != nil {
		return fmt.Errorf("failed to marshal channel config: %w", err)
	}

	result, err := db.pool.Exec(ctx,
		`UPDATE channels SET
			type = $2, config = $3, enabled = $4, success_count = $5, failure_count = $6,
			last_success = $7, last_failure = $8, last_error = $9
		WHERE id = $1`,
		channel.ID, channel.Type, configData, channel.Enabled, channel.SuccessCount, channel.FailureCount,
		channel.LastSuccess, channel.LastFailure, channel.LastError,
	)
	if err != nil {
		return fmt.Errorf("failed to update channel: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("channel not found: %s", channel.ID)
	}

	return nil
}

// DeleteChannel deletes a channel by ID.
func (db *PostgresDB) DeleteChannel(ctx context.Context, id uuid.UUID) error {
	result, err := db.pool.Exec(ctx, `DELETE FROM channels WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete channel: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("channel not found: %s", id)
	}
	return nil
}

// SaveNotification saves a notification record.
func (db *PostgresDB) SaveNotification(ctx context.Context, notification *types.Notification) error {
	_, err := db.pool.Exec(ctx,
		`INSERT INTO notifications (id, subscription_id, channel_id, change_id, status, attempts, next_retry, sent_at, error, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		notification.ID, notification.SubscriptionID, notification.ChannelID, notification.ChangeID,
		notification.Status, notification.Attempts, notification.NextRetry, notification.SentAt,
		notification.Error, notification.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to save notification: %w", err)
	}
	return nil
}

// UpdateNotification updates a notification's status, attempts, and error.
func (db *PostgresDB) UpdateNotification(ctx context.Context, notification *types.Notification) error {
	result, err := db.pool.Exec(ctx,
		`UPDATE notifications SET
			status = $2, attempts = $3, next_retry = $4, sent_at = $5, error = $6
		WHERE id = $1`,
		notification.ID, notification.Status, notification.Attempts, notification.NextRetry,
		notification.SentAt, notification.Error,
	)
	if err != nil {
		return fmt.Errorf("failed to update notification: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("notification not found: %s", notification.ID)
	}

	return nil
}

// GetPendingNotifications retrieves pending notifications for retry processing.
func (db *PostgresDB) GetPendingNotifications(ctx context.Context, limit int) ([]types.Notification, error) {
	rows, err := db.pool.Query(ctx,
		`SELECT id, subscription_id, channel_id, change_id, status, attempts, next_retry, sent_at, error, created_at
		FROM notifications
		WHERE status = 'pending' AND (next_retry IS NULL OR next_retry <= NOW())
		ORDER BY created_at ASC LIMIT $1`, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query pending notifications: %w", err)
	}
	defer rows.Close()

	var notifications []types.Notification
	for rows.Next() {
		var n types.Notification
		var nextRetry, sentAt *time.Time
		var errStr *string

		if err := rows.Scan(&n.ID, &n.SubscriptionID, &n.ChannelID, &n.ChangeID, &n.Status,
			&n.Attempts, &nextRetry, &sentAt, &errStr, &n.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan notification: %w", err)
		}

		n.NextRetry = nextRetry
		n.SentAt = sentAt
		if errStr != nil {
			n.Error = *errStr
		}

		notifications = append(notifications, n)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating notifications: %w", err)
	}

	return notifications, nil
}

// GetNotificationsForSubscription retrieves notification history for a subscription.
func (db *PostgresDB) GetNotificationsForSubscription(ctx context.Context, subscriptionID uuid.UUID, limit int) ([]types.Notification, error) {
	rows, err := db.pool.Query(ctx,
		`SELECT id, subscription_id, channel_id, change_id, status, attempts, next_retry, sent_at, error, created_at
		FROM notifications
		WHERE subscription_id = $1
		ORDER BY created_at DESC LIMIT $2`, subscriptionID, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query notifications: %w", err)
	}
	defer rows.Close()

	var notifications []types.Notification
	for rows.Next() {
		var n types.Notification
		var nextRetry, sentAt *time.Time
		var errStr *string

		if err := rows.Scan(&n.ID, &n.SubscriptionID, &n.ChannelID, &n.ChangeID, &n.Status,
			&n.Attempts, &nextRetry, &sentAt, &errStr, &n.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan notification: %w", err)
		}

		n.NextRetry = nextRetry
		n.SentAt = sentAt
		if errStr != nil {
			n.Error = *errStr
		}

		notifications = append(notifications, n)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating notifications: %w", err)
	}

	return notifications, nil
}

// GetStats returns aggregate statistics.
func (db *PostgresDB) GetStats(ctx context.Context) (*types.StatsResponse, error) {
	stats := &types.StatsResponse{}

	// Get subscription counts
	err := db.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM subscriptions`,
	).Scan(&stats.TotalSubscriptions)
	if err != nil {
		return nil, fmt.Errorf("failed to count subscriptions: %w", err)
	}

	err = db.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM subscriptions WHERE status = 'active'`,
	).Scan(&stats.ActiveSubscriptions)
	if err != nil {
		return nil, fmt.Errorf("failed to count active subscriptions: %w", err)
	}

	// Get change counts
	err = db.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM changes`,
	).Scan(&stats.TotalChanges)
	if err != nil {
		return nil, fmt.Errorf("failed to count changes: %w", err)
	}

	twentyFourHoursAgo := time.Now().UTC().Add(-24 * time.Hour)
	err = db.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM changes WHERE detected_at >= $1`, twentyFourHoursAgo,
	).Scan(&stats.ChangesLast24h)
	if err != nil {
		return nil, fmt.Errorf("failed to count recent changes: %w", err)
	}

	// Get notification count
	err = db.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM notifications`,
	).Scan(&stats.TotalNotifications)
	if err != nil {
		return nil, fmt.Errorf("failed to count notifications: %w", err)
	}

	// Get last poll time and server count from latest snapshot
	var lastPollTime *time.Time
	var serverCount *int
	err = db.pool.QueryRow(ctx,
		`SELECT timestamp, server_count FROM snapshots ORDER BY timestamp DESC LIMIT 1`,
	).Scan(&lastPollTime, &serverCount)
	if err != nil && err != pgx.ErrNoRows {
		return nil, fmt.Errorf("failed to get latest snapshot: %w", err)
	}
	if lastPollTime != nil {
		stats.LastPollTime = *lastPollTime
	}
	if serverCount != nil {
		stats.ServerCount = *serverCount
	}

	return stats, nil
}
