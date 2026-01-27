// Package db provides database access for MCP Notify.
package db

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/nirholas/mcp-notify/pkg/types"
)

// Database defines the interface for database operations.
type Database interface {
	// Connection management
	Close() error
	Ping(ctx context.Context) error
	Migrate(ctx context.Context) error

	// Snapshots
	SaveSnapshot(ctx context.Context, snapshot *types.Snapshot) error
	GetLatestSnapshot(ctx context.Context) (*types.Snapshot, error)
	GetSnapshotByID(ctx context.Context, id uuid.UUID) (*types.Snapshot, error)
	GetSnapshotAt(ctx context.Context, timestamp time.Time) (*types.Snapshot, error)
	DeleteOldSnapshots(ctx context.Context, olderThan time.Time) error

	// Changes
	SaveChange(ctx context.Context, change *types.Change) error
	GetChangeByID(ctx context.Context, id uuid.UUID) (*types.Change, error)
	GetChangesSince(ctx context.Context, since time.Time, limit int) ([]types.Change, error)
	GetChangesForServer(ctx context.Context, serverName string, limit int) ([]types.Change, error)
	GetChangeCountSince(ctx context.Context, since time.Time) (int, error)

	// Subscriptions
	CreateSubscription(ctx context.Context, sub *types.Subscription) error
	GetSubscriptionByID(ctx context.Context, id uuid.UUID) (*types.Subscription, error)
	GetSubscriptionByAPIKey(ctx context.Context, apiKeyHash string) (*types.Subscription, error)
	GetActiveSubscriptions(ctx context.Context) ([]types.Subscription, error)
	UpdateSubscription(ctx context.Context, sub *types.Subscription) error
	DeleteSubscription(ctx context.Context, id uuid.UUID) error
	ListSubscriptions(ctx context.Context, limit, offset int) ([]types.Subscription, int, error)

	// Channels
	CreateChannel(ctx context.Context, channel *types.Channel) error
	GetChannelByID(ctx context.Context, id uuid.UUID) (*types.Channel, error)
	GetChannelsForSubscription(ctx context.Context, subscriptionID uuid.UUID) ([]types.Channel, error)
	UpdateChannel(ctx context.Context, channel *types.Channel) error
	DeleteChannel(ctx context.Context, id uuid.UUID) error

	// Notifications
	SaveNotification(ctx context.Context, notification *types.Notification) error
	UpdateNotification(ctx context.Context, notification *types.Notification) error
	GetPendingNotifications(ctx context.Context, limit int) ([]types.Notification, error)
	GetNotificationsForSubscription(ctx context.Context, subscriptionID uuid.UUID, limit int) ([]types.Notification, error)

	// Stats
	GetStats(ctx context.Context) (*types.StatsResponse, error)
}

// Cache defines the interface for caching operations.
type Cache interface {
	Close() error
	Ping(ctx context.Context) error

	// Generic key-value operations
	Get(ctx context.Context, key string) ([]byte, error)
	Set(ctx context.Context, key string, value []byte, ttl time.Duration) error
	Delete(ctx context.Context, key string) error

	// Snapshot caching
	GetCachedSnapshot(ctx context.Context) (*types.Snapshot, error)
	SetCachedSnapshot(ctx context.Context, snapshot *types.Snapshot, ttl time.Duration) error

	// Rate limiting
	IncrementRateLimit(ctx context.Context, key string, window time.Duration) (int64, error)
}
