// Package types defines the core domain types for MCP Notify.
package types

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// ChangeType represents the type of change detected.
type ChangeType string

const (
	ChangeTypeNew     ChangeType = "new"
	ChangeTypeUpdated ChangeType = "updated"
	ChangeTypeRemoved ChangeType = "removed"
)

// DigestFrequency represents how often digest emails are sent.
type DigestFrequency string

const (
	DigestImmediate DigestFrequency = "immediate"
	DigestHourly    DigestFrequency = "hourly"
	DigestDaily     DigestFrequency = "daily"
	DigestWeekly    DigestFrequency = "weekly"
)

// ChannelType represents a notification channel type.
type ChannelType string

const (
	ChannelDiscord  ChannelType = "discord"
	ChannelSlack    ChannelType = "slack"
	ChannelEmail    ChannelType = "email"
	ChannelWebhook  ChannelType = "webhook"
	ChannelRSS      ChannelType = "rss"
	ChannelTelegram ChannelType = "telegram"
	ChannelTeams    ChannelType = "teams"
)

// SubscriptionStatus represents the status of a subscription.
type SubscriptionStatus string

const (
	SubscriptionStatusActive  SubscriptionStatus = "active"
	SubscriptionStatusPaused  SubscriptionStatus = "paused"
	SubscriptionStatusExpired SubscriptionStatus = "expired"
)

// -----------------------------------------------------------------------------
// Registry Types (mirroring MCP Registry API)
// -----------------------------------------------------------------------------

// Server represents an MCP server from the registry.
type Server struct {
	Name           string          `json:"name"`
	Description    string          `json:"description"`
	Repository     *Repository     `json:"repository,omitempty"`
	VersionDetail  *VersionDetail  `json:"version_detail,omitempty"`
	Packages       []Package       `json:"packages,omitempty"`
	Remotes        []Remote        `json:"remotes,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

// Repository represents the source repository of a server.
type Repository struct {
	URL    string `json:"url"`
	Source string `json:"source"` // github, gitlab, etc.
}

// VersionDetail contains version information.
type VersionDetail struct {
	Version  string `json:"version"`
	IsLatest bool   `json:"is_latest"`
}

// Package represents a package distribution (npm, pypi, etc.).
type Package struct {
	RegistryType string `json:"registry_type"` // npm, pypi, nuget, etc.
	Name         string `json:"name"`
	Version      string `json:"version,omitempty"`
	URL          string `json:"url,omitempty"`
}

// Remote represents a remote server endpoint.
type Remote struct {
	TransportType string `json:"transport_type"` // sse, streamable-http
	URL           string `json:"url"`
}

// ServerListResponse represents the paginated response from the registry.
type ServerListResponse struct {
	Servers    []Server `json:"servers"`
	NextCursor string   `json:"next_cursor,omitempty"`
	TotalCount int      `json:"total_count,omitempty"`
}

// -----------------------------------------------------------------------------
// Change Detection Types
// -----------------------------------------------------------------------------

// Snapshot represents a point-in-time snapshot of the registry.
type Snapshot struct {
	ID        uuid.UUID         `json:"id" db:"id"`
	Timestamp time.Time         `json:"timestamp" db:"timestamp"`
	Servers   map[string]Server `json:"servers" db:"-"` // name -> server
	ServerCount int             `json:"server_count" db:"server_count"`
	Hash      string            `json:"hash" db:"hash"` // Content hash for quick comparison
}

// Change represents a single detected change in the registry.
type Change struct {
	ID              uuid.UUID       `json:"id" db:"id"`
	SnapshotID      uuid.UUID       `json:"snapshot_id" db:"snapshot_id"`
	ServerName      string          `json:"server_name" db:"server_name"`
	ChangeType      ChangeType      `json:"change_type" db:"change_type"`
	PreviousVersion string          `json:"previous_version,omitempty" db:"previous_version"`
	NewVersion      string          `json:"new_version,omitempty" db:"new_version"`
	FieldChanges    []FieldChange   `json:"field_changes,omitempty" db:"-"`
	Server          *Server         `json:"server,omitempty" db:"-"`
	PreviousServer  *Server         `json:"previous_server,omitempty" db:"-"`
	DetectedAt      time.Time       `json:"detected_at" db:"detected_at"`
}

// FieldChange represents a change to a specific field.
type FieldChange struct {
	Field    string      `json:"field"`
	OldValue interface{} `json:"old_value,omitempty"`
	NewValue interface{} `json:"new_value,omitempty"`
}

// DiffResult represents the result of comparing two snapshots.
type DiffResult struct {
	FromSnapshot  *Snapshot  `json:"from_snapshot"`
	ToSnapshot    *Snapshot  `json:"to_snapshot"`
	NewServers    []Change   `json:"new_servers"`
	UpdatedServers []Change  `json:"updated_servers"`
	RemovedServers []Change  `json:"removed_servers"`
	TotalChanges  int        `json:"total_changes"`
}

// -----------------------------------------------------------------------------
// Subscription Types
// -----------------------------------------------------------------------------

// Subscription represents a user's subscription to registry changes.
type Subscription struct {
	ID          uuid.UUID          `json:"id" db:"id"`
	Name        string             `json:"name" db:"name"`
	Description string             `json:"description,omitempty" db:"description"`
	Filters     SubscriptionFilter `json:"filters" db:"-"`
	Channels    []Channel          `json:"channels" db:"-"`
	Status      SubscriptionStatus `json:"status" db:"status"`
	CreatedAt   time.Time          `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at" db:"updated_at"`
	LastNotified *time.Time        `json:"last_notified,omitempty" db:"last_notified"`
	
	// Authentication (for API access)
	APIKey      string             `json:"-" db:"api_key"` // Hashed
	APIKeyHint  string             `json:"api_key_hint,omitempty" db:"api_key_hint"` // Last 4 chars
	
	// Rate limiting
	NotificationCount int          `json:"notification_count" db:"notification_count"`
	LastReset        time.Time     `json:"last_reset" db:"last_reset"`
}

// SubscriptionFilter defines what changes a subscription matches.
type SubscriptionFilter struct {
	// Namespace patterns (glob-style, e.g., "io.github.*")
	Namespaces []string `json:"namespaces,omitempty"`
	
	// Keywords to match in server name or description
	Keywords []string `json:"keywords,omitempty"`
	
	// Specific server names to track
	Servers []string `json:"servers,omitempty"`
	
	// Change types to notify about
	ChangeTypes []ChangeType `json:"change_types,omitempty"`
	
	// Package registry types to filter (npm, pypi, etc.)
	PackageTypes []string `json:"package_types,omitempty"`
}

// Channel represents a notification delivery channel.
type Channel struct {
	ID             uuid.UUID       `json:"id" db:"id"`
	SubscriptionID uuid.UUID       `json:"subscription_id" db:"subscription_id"`
	Type           ChannelType     `json:"type" db:"type"`
	Config         ChannelConfig   `json:"config" db:"-"`
	Enabled        bool            `json:"enabled" db:"enabled"`
	CreatedAt      time.Time       `json:"created_at" db:"created_at"`
	
	// Delivery stats
	SuccessCount   int             `json:"success_count" db:"success_count"`
	FailureCount   int             `json:"failure_count" db:"failure_count"`
	LastSuccess    *time.Time      `json:"last_success,omitempty" db:"last_success"`
	LastFailure    *time.Time      `json:"last_failure,omitempty" db:"last_failure"`
	LastError      string          `json:"last_error,omitempty" db:"last_error"`
}

// ChannelConfig holds channel-specific configuration.
type ChannelConfig struct {
	// Discord
	DiscordWebhookURL string `json:"webhook_url,omitempty"`
	DiscordUsername   string `json:"username,omitempty"`
	DiscordAvatarURL  string `json:"avatar_url,omitempty"`
	
	// Slack
	SlackWebhookURL   string `json:"slack_webhook_url,omitempty"`
	SlackChannel      string `json:"slack_channel,omitempty"`
	
	// Email
	EmailAddress      string          `json:"email,omitempty"`
	EmailDigest       DigestFrequency `json:"digest,omitempty"`
	
	// Generic Webhook
	WebhookURL        string            `json:"url,omitempty"`
	WebhookMethod     string            `json:"method,omitempty"` // POST, PUT
	WebhookHeaders    map[string]string `json:"headers,omitempty"`
	WebhookSecret     string            `json:"secret,omitempty"` // For HMAC signing
	
	// Telegram
	TelegramChatID    string `json:"telegram_chat_id,omitempty"`
	TelegramBotToken  string `json:"telegram_bot_token,omitempty"`
	
	// Microsoft Teams
	TeamsWebhookURL   string `json:"teams_webhook_url,omitempty"`
}

// MarshalJSON implements custom JSON marshaling for ChannelConfig.
func (c ChannelConfig) MarshalJSON() ([]byte, error) {
	// Redact sensitive fields
	type Alias ChannelConfig
	alias := Alias(c)
	
	// Mask webhook URLs and secrets
	if alias.DiscordWebhookURL != "" {
		alias.DiscordWebhookURL = maskURL(alias.DiscordWebhookURL)
	}
	if alias.SlackWebhookURL != "" {
		alias.SlackWebhookURL = maskURL(alias.SlackWebhookURL)
	}
	if alias.WebhookURL != "" {
		alias.WebhookURL = maskURL(alias.WebhookURL)
	}
	if alias.WebhookSecret != "" {
		alias.WebhookSecret = "***"
	}
	if alias.TelegramBotToken != "" {
		alias.TelegramBotToken = "***"
	}
	if alias.TeamsWebhookURL != "" {
		alias.TeamsWebhookURL = maskURL(alias.TeamsWebhookURL)
	}
	
	return json.Marshal(alias)
}

func maskURL(url string) string {
	if len(url) <= 20 {
		return "***"
	}
	return url[:15] + "..." + url[len(url)-5:]
}

// -----------------------------------------------------------------------------
// Notification Types
// -----------------------------------------------------------------------------

// Notification represents a notification to be sent.
type Notification struct {
	ID             uuid.UUID      `json:"id" db:"id"`
	SubscriptionID uuid.UUID      `json:"subscription_id" db:"subscription_id"`
	ChannelID      uuid.UUID      `json:"channel_id" db:"channel_id"`
	ChangeID       uuid.UUID      `json:"change_id" db:"change_id"`
	Status         string         `json:"status" db:"status"` // pending, sent, failed
	Attempts       int            `json:"attempts" db:"attempts"`
	NextRetry      *time.Time     `json:"next_retry,omitempty" db:"next_retry"`
	SentAt         *time.Time     `json:"sent_at,omitempty" db:"sent_at"`
	Error          string         `json:"error,omitempty" db:"error"`
	CreatedAt      time.Time      `json:"created_at" db:"created_at"`
}

// NotificationPayload is the data sent to notification channels.
type NotificationPayload struct {
	EventType   string    `json:"event_type"` // server.new, server.updated, server.removed
	Timestamp   time.Time `json:"timestamp"`
	Server      *Server   `json:"server"`
	Changes     []FieldChange `json:"changes,omitempty"`
	RegistryURL string    `json:"registry_url"`
	WatchURL    string    `json:"watch_url"` // Link back to this service
}

// -----------------------------------------------------------------------------
// API Types
// -----------------------------------------------------------------------------

// CreateSubscriptionRequest is the request body for creating a subscription.
type CreateSubscriptionRequest struct {
	Name        string             `json:"name" validate:"required,min=1,max=255"`
	Description string             `json:"description,omitempty" validate:"max=1000"`
	Filters     SubscriptionFilter `json:"filters" validate:"required"`
	Channels    []ChannelRequest   `json:"channels" validate:"required,min=1,max=10,dive"`
}

// ChannelRequest is the request body for a notification channel.
type ChannelRequest struct {
	Type   ChannelType   `json:"type" validate:"required,oneof=discord slack email webhook telegram teams"`
	Config ChannelConfig `json:"config" validate:"required"`
}

// UpdateSubscriptionRequest is the request body for updating a subscription.
type UpdateSubscriptionRequest struct {
	Name        *string             `json:"name,omitempty" validate:"omitempty,min=1,max=255"`
	Description *string             `json:"description,omitempty" validate:"omitempty,max=1000"`
	Filters     *SubscriptionFilter `json:"filters,omitempty"`
	Channels    []ChannelRequest    `json:"channels,omitempty" validate:"omitempty,max=10,dive"`
}

// SubscriptionResponse is the API response for a subscription.
type SubscriptionResponse struct {
	Subscription
	APIKey string `json:"api_key,omitempty"` // Only on creation
}

// ChangesResponse is the API response for listing changes.
type ChangesResponse struct {
	Changes    []Change `json:"changes"`
	NextCursor string   `json:"next_cursor,omitempty"`
	TotalCount int      `json:"total_count"`
}

// ErrorResponse is the standard error response format.
type ErrorResponse struct {
	Error   string            `json:"error"`
	Code    string            `json:"code,omitempty"`
	Details map[string]string `json:"details,omitempty"`
}

// HealthResponse is the health check response.
type HealthResponse struct {
	Status    string            `json:"status"`
	Version   string            `json:"version"`
	Timestamp time.Time         `json:"timestamp"`
	Checks    map[string]string `json:"checks"`
}

// StatsResponse contains service statistics.
type StatsResponse struct {
	TotalSubscriptions int       `json:"total_subscriptions"`
	ActiveSubscriptions int      `json:"active_subscriptions"`
	TotalChanges       int       `json:"total_changes"`
	ChangesLast24h     int       `json:"changes_last_24h"`
	TotalNotifications int       `json:"total_notifications"`
	LastPollTime       time.Time `json:"last_poll_time"`
	ServerCount        int       `json:"server_count"`
}
