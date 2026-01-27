// Package db provides database access for MCP Notify.
package db

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/nirholas/mcp-notify/internal/config"
	"github.com/nirholas/mcp-notify/pkg/types"
)

// setupTestPostgres creates a PostgreSQL container for testing.
func setupTestPostgres(t *testing.T) (*PostgresDB, func()) {
	t.Helper()
	ctx := context.Background()

	req := testcontainers.ContainerRequest{
		Image:        "postgres:16-alpine",
		ExposedPorts: []string{"5432/tcp"},
		Env: map[string]string{
			"POSTGRES_USER":     "test",
			"POSTGRES_PASSWORD": "test",
			"POSTGRES_DB":       "testdb",
		},
		WaitingFor: wait.ForLog("database system is ready to accept connections").
			WithOccurrence(2).
			WithStartupTimeout(60 * time.Second),
	}

	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	require.NoError(t, err)

	host, err := container.Host(ctx)
	require.NoError(t, err)

	port, err := container.MappedPort(ctx, "5432")
	require.NoError(t, err)

	dsn := fmt.Sprintf("postgres://test:test@%s:%s/testdb?sslmode=disable", host, port.Port())

	cfg := config.DatabaseConfig{
		URL:             dsn,
		MaxConnections:  5,
		MaxIdleConns:    2,
		ConnMaxLifetime: time.Hour,
		ConnMaxIdleTime: 30 * time.Minute,
	}

	db, err := New(ctx, cfg)
	require.NoError(t, err)

	// Run migrations
	err = db.Migrate(ctx)
	require.NoError(t, err)

	cleanup := func() {
		db.Close()
		container.Terminate(ctx)
	}

	return db, cleanup
}

func TestPostgresDB_Ping(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db, cleanup := setupTestPostgres(t)
	defer cleanup()

	ctx := context.Background()
	err := db.Ping(ctx)
	assert.NoError(t, err)
}

func TestPostgresDB_Snapshot(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db, cleanup := setupTestPostgres(t)
	defer cleanup()

	ctx := context.Background()

	// Create a snapshot
	snapshot := &types.Snapshot{
		ID:          uuid.New(),
		Timestamp:   time.Now().UTC().Truncate(time.Microsecond),
		ServerCount: 3,
		Hash:        "abc123",
		Servers: map[string]types.Server{
			"server1": {Name: "server1", Description: "Test server 1"},
			"server2": {Name: "server2", Description: "Test server 2"},
			"server3": {Name: "server3", Description: "Test server 3"},
		},
	}

	// Save snapshot
	err := db.SaveSnapshot(ctx, snapshot)
	require.NoError(t, err)

	// Get latest snapshot
	retrieved, err := db.GetLatestSnapshot(ctx)
	require.NoError(t, err)
	require.NotNil(t, retrieved)

	assert.Equal(t, snapshot.ID, retrieved.ID)
	assert.Equal(t, snapshot.ServerCount, retrieved.ServerCount)
	assert.Equal(t, snapshot.Hash, retrieved.Hash)
	assert.Equal(t, len(snapshot.Servers), len(retrieved.Servers))

	// Get snapshot by ID
	byID, err := db.GetSnapshotByID(ctx, snapshot.ID)
	require.NoError(t, err)
	require.NotNil(t, byID)
	assert.Equal(t, snapshot.ID, byID.ID)

	// Get non-existent snapshot
	nonExistent, err := db.GetSnapshotByID(ctx, uuid.New())
	require.NoError(t, err)
	assert.Nil(t, nonExistent)

	// Delete old snapshots
	err = db.DeleteOldSnapshots(ctx, time.Now().Add(time.Hour))
	require.NoError(t, err)

	// Verify deleted
	deleted, err := db.GetLatestSnapshot(ctx)
	require.NoError(t, err)
	assert.Nil(t, deleted)
}

func TestPostgresDB_Change(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db, cleanup := setupTestPostgres(t)
	defer cleanup()

	ctx := context.Background()

	// Create a snapshot first
	snapshot := &types.Snapshot{
		ID:          uuid.New(),
		Timestamp:   time.Now().UTC(),
		ServerCount: 1,
		Hash:        "hash123",
		Servers:     map[string]types.Server{},
	}
	err := db.SaveSnapshot(ctx, snapshot)
	require.NoError(t, err)

	// Create a change
	server := types.Server{Name: "test-server", Description: "Test"}
	change := &types.Change{
		ID:         uuid.New(),
		SnapshotID: snapshot.ID,
		ServerName: "test-server",
		ChangeType: types.ChangeTypeNew,
		NewVersion: "1.0.0",
		FieldChanges: []types.FieldChange{
			{Field: "description", OldValue: nil, NewValue: "Test"},
		},
		Server:     &server,
		DetectedAt: time.Now().UTC().Truncate(time.Microsecond),
	}

	// Save change
	err = db.SaveChange(ctx, change)
	require.NoError(t, err)

	// Get change by ID
	retrieved, err := db.GetChangeByID(ctx, change.ID)
	require.NoError(t, err)
	require.NotNil(t, retrieved)
	assert.Equal(t, change.ID, retrieved.ID)
	assert.Equal(t, change.ServerName, retrieved.ServerName)
	assert.Equal(t, change.ChangeType, retrieved.ChangeType)

	// Get changes since
	since := time.Now().Add(-time.Hour)
	changes, err := db.GetChangesSince(ctx, since, 10)
	require.NoError(t, err)
	assert.Len(t, changes, 1)

	// Get changes for server
	serverChanges, err := db.GetChangesForServer(ctx, "test-server", 10)
	require.NoError(t, err)
	assert.Len(t, serverChanges, 1)

	// Get change count since
	count, err := db.GetChangeCountSince(ctx, since)
	require.NoError(t, err)
	assert.Equal(t, 1, count)
}

func TestPostgresDB_Subscription(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db, cleanup := setupTestPostgres(t)
	defer cleanup()

	ctx := context.Background()

	// Create a subscription
	sub := &types.Subscription{
		ID:          uuid.New(),
		Name:        "Test Subscription",
		Description: "Test description",
		Filters: types.SubscriptionFilter{
			Keywords:    []string{"test", "example"},
			ChangeTypes: []types.ChangeType{types.ChangeTypeNew},
		},
		Status:     types.SubscriptionStatusActive,
		APIKey:     "hashed-api-key-123",
		APIKeyHint: "...k123",
		CreatedAt:  time.Now().UTC().Truncate(time.Microsecond),
		UpdatedAt:  time.Now().UTC().Truncate(time.Microsecond),
		LastReset:  time.Now().UTC().Truncate(time.Microsecond),
	}

	// Create subscription
	err := db.CreateSubscription(ctx, sub)
	require.NoError(t, err)

	// Get by ID
	retrieved, err := db.GetSubscriptionByID(ctx, sub.ID)
	require.NoError(t, err)
	require.NotNil(t, retrieved)
	assert.Equal(t, sub.ID, retrieved.ID)
	assert.Equal(t, sub.Name, retrieved.Name)
	assert.Equal(t, sub.Description, retrieved.Description)
	assert.Equal(t, sub.Filters.Keywords, retrieved.Filters.Keywords)

	// Get by API key
	byAPIKey, err := db.GetSubscriptionByAPIKey(ctx, "hashed-api-key-123")
	require.NoError(t, err)
	require.NotNil(t, byAPIKey)
	assert.Equal(t, sub.ID, byAPIKey.ID)

	// Get non-existent by API key
	notFound, err := db.GetSubscriptionByAPIKey(ctx, "nonexistent")
	require.NoError(t, err)
	assert.Nil(t, notFound)

	// Get active subscriptions
	active, err := db.GetActiveSubscriptions(ctx)
	require.NoError(t, err)
	assert.Len(t, active, 1)

	// Update subscription
	sub.Name = "Updated Name"
	sub.NotificationCount = 5
	err = db.UpdateSubscription(ctx, sub)
	require.NoError(t, err)

	updated, err := db.GetSubscriptionByID(ctx, sub.ID)
	require.NoError(t, err)
	assert.Equal(t, "Updated Name", updated.Name)
	assert.Equal(t, 5, updated.NotificationCount)

	// List subscriptions
	list, total, err := db.ListSubscriptions(ctx, 10, 0)
	require.NoError(t, err)
	assert.Equal(t, 1, total)
	assert.Len(t, list, 1)

	// Delete subscription
	err = db.DeleteSubscription(ctx, sub.ID)
	require.NoError(t, err)

	deleted, err := db.GetSubscriptionByID(ctx, sub.ID)
	require.NoError(t, err)
	assert.Nil(t, deleted)
}

func TestPostgresDB_Channel(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db, cleanup := setupTestPostgres(t)
	defer cleanup()

	ctx := context.Background()

	// Create a subscription first
	sub := &types.Subscription{
		ID:        uuid.New(),
		Name:      "Test Sub",
		Filters:   types.SubscriptionFilter{},
		Status:    types.SubscriptionStatusActive,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
		LastReset: time.Now().UTC(),
	}
	err := db.CreateSubscription(ctx, sub)
	require.NoError(t, err)

	// Create a channel
	channel := &types.Channel{
		ID:             uuid.New(),
		SubscriptionID: sub.ID,
		Type:           types.ChannelDiscord,
		Config: types.ChannelConfig{
			DiscordWebhookURL: "https://discord.com/api/webhooks/123",
			DiscordUsername:   "MCP Watch",
		},
		Enabled:   true,
		CreatedAt: time.Now().UTC().Truncate(time.Microsecond),
	}

	err = db.CreateChannel(ctx, channel)
	require.NoError(t, err)

	// Get channel by ID
	retrieved, err := db.GetChannelByID(ctx, channel.ID)
	require.NoError(t, err)
	require.NotNil(t, retrieved)
	assert.Equal(t, channel.ID, retrieved.ID)
	assert.Equal(t, channel.Type, retrieved.Type)
	assert.Equal(t, channel.Config.DiscordUsername, retrieved.Config.DiscordUsername)

	// Get channels for subscription
	channels, err := db.GetChannelsForSubscription(ctx, sub.ID)
	require.NoError(t, err)
	assert.Len(t, channels, 1)

	// Update channel
	now := time.Now().UTC()
	channel.SuccessCount = 10
	channel.FailureCount = 2
	channel.LastSuccess = &now
	channel.LastError = "test error"
	err = db.UpdateChannel(ctx, channel)
	require.NoError(t, err)

	updated, err := db.GetChannelByID(ctx, channel.ID)
	require.NoError(t, err)
	assert.Equal(t, 10, updated.SuccessCount)
	assert.Equal(t, 2, updated.FailureCount)
	assert.Equal(t, "test error", updated.LastError)

	// Delete channel
	err = db.DeleteChannel(ctx, channel.ID)
	require.NoError(t, err)

	deleted, err := db.GetChannelByID(ctx, channel.ID)
	require.NoError(t, err)
	assert.Nil(t, deleted)
}

func TestPostgresDB_Notification(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db, cleanup := setupTestPostgres(t)
	defer cleanup()

	ctx := context.Background()

	// Create subscription and channel first
	sub := &types.Subscription{
		ID:        uuid.New(),
		Name:      "Test Sub",
		Filters:   types.SubscriptionFilter{},
		Status:    types.SubscriptionStatusActive,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
		LastReset: time.Now().UTC(),
	}
	err := db.CreateSubscription(ctx, sub)
	require.NoError(t, err)

	channel := &types.Channel{
		ID:             uuid.New(),
		SubscriptionID: sub.ID,
		Type:           types.ChannelWebhook,
		Config:         types.ChannelConfig{WebhookURL: "https://example.com/webhook"},
		Enabled:        true,
		CreatedAt:      time.Now().UTC(),
	}
	err = db.CreateChannel(ctx, channel)
	require.NoError(t, err)

	// Create a snapshot and change
	snapshot := &types.Snapshot{
		ID:          uuid.New(),
		Timestamp:   time.Now().UTC(),
		ServerCount: 1,
		Hash:        "hash",
		Servers:     map[string]types.Server{},
	}
	err = db.SaveSnapshot(ctx, snapshot)
	require.NoError(t, err)

	change := &types.Change{
		ID:         uuid.New(),
		SnapshotID: snapshot.ID,
		ServerName: "test-server",
		ChangeType: types.ChangeTypeNew,
		DetectedAt: time.Now().UTC(),
	}
	err = db.SaveChange(ctx, change)
	require.NoError(t, err)

	// Create notification
	notification := &types.Notification{
		ID:             uuid.New(),
		SubscriptionID: sub.ID,
		ChannelID:      channel.ID,
		ChangeID:       change.ID,
		Status:         "pending",
		Attempts:       0,
		CreatedAt:      time.Now().UTC().Truncate(time.Microsecond),
	}

	err = db.SaveNotification(ctx, notification)
	require.NoError(t, err)

	// Get pending notifications
	pending, err := db.GetPendingNotifications(ctx, 10)
	require.NoError(t, err)
	assert.Len(t, pending, 1)
	assert.Equal(t, notification.ID, pending[0].ID)

	// Update notification
	now := time.Now().UTC()
	notification.Status = "sent"
	notification.Attempts = 1
	notification.SentAt = &now
	err = db.UpdateNotification(ctx, notification)
	require.NoError(t, err)

	// Get notifications for subscription
	notifications, err := db.GetNotificationsForSubscription(ctx, sub.ID, 10)
	require.NoError(t, err)
	assert.Len(t, notifications, 1)
	assert.Equal(t, "sent", notifications[0].Status)
	assert.Equal(t, 1, notifications[0].Attempts)
}

func TestPostgresDB_GetStats(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db, cleanup := setupTestPostgres(t)
	defer cleanup()

	ctx := context.Background()

	// Create some data
	sub := &types.Subscription{
		ID:        uuid.New(),
		Name:      "Test Sub",
		Filters:   types.SubscriptionFilter{},
		Status:    types.SubscriptionStatusActive,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
		LastReset: time.Now().UTC(),
	}
	err := db.CreateSubscription(ctx, sub)
	require.NoError(t, err)

	snapshot := &types.Snapshot{
		ID:          uuid.New(),
		Timestamp:   time.Now().UTC(),
		ServerCount: 42,
		Hash:        "hash",
		Servers:     map[string]types.Server{},
	}
	err = db.SaveSnapshot(ctx, snapshot)
	require.NoError(t, err)

	change := &types.Change{
		ID:         uuid.New(),
		SnapshotID: snapshot.ID,
		ServerName: "test",
		ChangeType: types.ChangeTypeNew,
		DetectedAt: time.Now().UTC(),
	}
	err = db.SaveChange(ctx, change)
	require.NoError(t, err)

	// Get stats
	stats, err := db.GetStats(ctx)
	require.NoError(t, err)
	require.NotNil(t, stats)

	assert.Equal(t, 1, stats.TotalSubscriptions)
	assert.Equal(t, 1, stats.ActiveSubscriptions)
	assert.Equal(t, 1, stats.TotalChanges)
	assert.Equal(t, 1, stats.ChangesLast24h)
	assert.Equal(t, 42, stats.ServerCount)
}

func TestPostgresDB_ConcurrentAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db, cleanup := setupTestPostgres(t)
	defer cleanup()

	ctx := context.Background()

	// Create multiple subscriptions concurrently
	const numGoroutines = 10
	errChan := make(chan error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func(idx int) {
			sub := &types.Subscription{
				ID:        uuid.New(),
				Name:      fmt.Sprintf("Sub %d", idx),
				Filters:   types.SubscriptionFilter{},
				Status:    types.SubscriptionStatusActive,
				CreatedAt: time.Now().UTC(),
				UpdatedAt: time.Now().UTC(),
				LastReset: time.Now().UTC(),
			}
			errChan <- db.CreateSubscription(ctx, sub)
		}(i)
	}

	// Collect errors
	for i := 0; i < numGoroutines; i++ {
		err := <-errChan
		assert.NoError(t, err)
	}

	// Verify all were created
	subs, total, err := db.ListSubscriptions(ctx, 100, 0)
	require.NoError(t, err)
	assert.Equal(t, numGoroutines, total)
	assert.Len(t, subs, numGoroutines)
}
