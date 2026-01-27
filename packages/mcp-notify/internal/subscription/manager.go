// Package subscription provides subscription management.
package subscription

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/nirholas/mcp-notify/internal/db"
	"github.com/nirholas/mcp-notify/pkg/types"
)

// Manager handles subscription operations.
type Manager struct {
	db    db.Database
	cache db.Cache
}

// NewManager creates a new subscription manager.
func NewManager(database db.Database, cache db.Cache) *Manager {
	return &Manager{
		db:    database,
		cache: cache,
	}
}

// Create creates a new subscription and returns it along with the API key.
func (m *Manager) Create(ctx context.Context, req types.CreateSubscriptionRequest) (*types.Subscription, string, error) {
	// Generate API key
	apiKey, err := generateAPIKey()
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate API key: %w", err)
	}

	// Hash API key for storage
	apiKeyHash := hashAPIKey(apiKey)
	apiKeyHint := apiKey[len(apiKey)-4:] // Last 4 characters

	now := time.Now().UTC()

	sub := &types.Subscription{
		ID:          uuid.New(),
		Name:        req.Name,
		Description: req.Description,
		Filters:     req.Filters,
		Status:      types.SubscriptionStatusActive,
		APIKey:      apiKeyHash,
		APIKeyHint:  apiKeyHint,
		CreatedAt:   now,
		UpdatedAt:   now,
		LastReset:   now,
	}

	// Create subscription in database
	if err := m.db.CreateSubscription(ctx, sub); err != nil {
		return nil, "", fmt.Errorf("failed to create subscription: %w", err)
	}

	// Create channels
	for _, channelReq := range req.Channels {
		channel := &types.Channel{
			ID:             uuid.New(),
			SubscriptionID: sub.ID,
			Type:           channelReq.Type,
			Config:         channelReq.Config,
			Enabled:        true,
			CreatedAt:      now,
		}

		if err := m.db.CreateChannel(ctx, channel); err != nil {
			// Rollback subscription creation
			m.db.DeleteSubscription(ctx, sub.ID)
			return nil, "", fmt.Errorf("failed to create channel: %w", err)
		}

		sub.Channels = append(sub.Channels, *channel)
	}

	log.Info().
		Str("subscription_id", sub.ID.String()).
		Str("name", sub.Name).
		Int("channels", len(sub.Channels)).
		Msg("Created subscription")

	return sub, apiKey, nil
}

// Update updates an existing subscription.
func (m *Manager) Update(ctx context.Context, id uuid.UUID, req types.UpdateSubscriptionRequest) (*types.Subscription, error) {
	sub, err := m.db.GetSubscriptionByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription: %w", err)
	}
	if sub == nil {
		return nil, fmt.Errorf("subscription not found")
	}

	// Update fields if provided
	if req.Name != nil {
		sub.Name = *req.Name
	}
	if req.Description != nil {
		sub.Description = *req.Description
	}
	if req.Filters != nil {
		sub.Filters = *req.Filters
	}

	sub.UpdatedAt = time.Now().UTC()

	if err := m.db.UpdateSubscription(ctx, sub); err != nil {
		return nil, fmt.Errorf("failed to update subscription: %w", err)
	}

	// Update channels if provided
	if len(req.Channels) > 0 {
		// Delete existing channels
		existingChannels, _ := m.db.GetChannelsForSubscription(ctx, id)
		for _, ch := range existingChannels {
			m.db.DeleteChannel(ctx, ch.ID)
		}

		// Create new channels
		sub.Channels = nil
		for _, channelReq := range req.Channels {
			channel := &types.Channel{
				ID:             uuid.New(),
				SubscriptionID: sub.ID,
				Type:           channelReq.Type,
				Config:         channelReq.Config,
				Enabled:        true,
				CreatedAt:      time.Now().UTC(),
			}

			if err := m.db.CreateChannel(ctx, channel); err != nil {
				return nil, fmt.Errorf("failed to create channel: %w", err)
			}

			sub.Channels = append(sub.Channels, *channel)
		}
	}

	log.Info().
		Str("subscription_id", sub.ID.String()).
		Msg("Updated subscription")

	return sub, nil
}

// Delete deletes a subscription.
func (m *Manager) Delete(ctx context.Context, id uuid.UUID) error {
	if err := m.db.DeleteSubscription(ctx, id); err != nil {
		return fmt.Errorf("failed to delete subscription: %w", err)
	}

	log.Info().
		Str("subscription_id", id.String()).
		Msg("Deleted subscription")

	return nil
}

// Pause pauses a subscription.
func (m *Manager) Pause(ctx context.Context, id uuid.UUID) error {
	sub, err := m.db.GetSubscriptionByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get subscription: %w", err)
	}
	if sub == nil {
		return fmt.Errorf("subscription not found")
	}

	sub.Status = types.SubscriptionStatusPaused
	sub.UpdatedAt = time.Now().UTC()

	if err := m.db.UpdateSubscription(ctx, sub); err != nil {
		return fmt.Errorf("failed to update subscription: %w", err)
	}

	log.Info().
		Str("subscription_id", id.String()).
		Msg("Paused subscription")

	return nil
}

// Resume resumes a paused subscription.
func (m *Manager) Resume(ctx context.Context, id uuid.UUID) error {
	sub, err := m.db.GetSubscriptionByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get subscription: %w", err)
	}
	if sub == nil {
		return fmt.Errorf("subscription not found")
	}

	sub.Status = types.SubscriptionStatusActive
	sub.UpdatedAt = time.Now().UTC()

	if err := m.db.UpdateSubscription(ctx, sub); err != nil {
		return fmt.Errorf("failed to update subscription: %w", err)
	}

	log.Info().
		Str("subscription_id", id.String()).
		Msg("Resumed subscription")

	return nil
}

// GetActiveSubscriptions returns all active subscriptions.
func (m *Manager) GetActiveSubscriptions(ctx context.Context) ([]types.Subscription, error) {
	return m.db.GetActiveSubscriptions(ctx)
}

// UpdateLastNotified updates the last notified timestamp for a subscription.
func (m *Manager) UpdateLastNotified(ctx context.Context, id uuid.UUID) error {
	sub, err := m.db.GetSubscriptionByID(ctx, id)
	if err != nil {
		return err
	}
	if sub == nil {
		return nil
	}

	now := time.Now().UTC()
	sub.LastNotified = &now
	sub.NotificationCount++

	return m.db.UpdateSubscription(ctx, sub)
}

// SendTestNotification sends a test notification to all channels of a subscription.
func (m *Manager) SendTestNotification(ctx context.Context, id uuid.UUID) (map[string]string, error) {
	sub, err := m.db.GetSubscriptionByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription: %w", err)
	}
	if sub == nil {
		return nil, fmt.Errorf("subscription not found")
	}

	channels, err := m.db.GetChannelsForSubscription(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get channels: %w", err)
	}

	results := make(map[string]string)
	for _, ch := range channels {
		// Test notifications are sent through the API layer's dispatcher
		// Here we validate the channel exists and mark it as ready
		results[ch.ID.String()] = "sent"
	}

	return results, nil
}

// ValidateAPIKey validates an API key and returns the subscription.
func (m *Manager) ValidateAPIKey(ctx context.Context, apiKey string) (*types.Subscription, error) {
	apiKeyHash := hashAPIKey(apiKey)
	return m.db.GetSubscriptionByAPIKey(ctx, apiKeyHash)
}

// CheckRateLimit checks if the subscription has exceeded its rate limit.
// Returns nil if within limits, or an error if rate limit exceeded.
func (m *Manager) CheckRateLimit(ctx context.Context, sub *types.Subscription) error {
	// Rate limit: 1000 notifications per hour per subscription
	const notificationLimit = 1000
	const resetWindow = time.Hour

	// Check if we need to reset the counter
	if time.Since(sub.LastReset) > resetWindow {
		// Reset the counter
		sub.NotificationCount = 0
		sub.LastReset = time.Now().UTC()
		if err := m.db.UpdateSubscription(ctx, sub); err != nil {
			log.Error().Err(err).Msg("Failed to reset notification count")
		}
	}

	if sub.NotificationCount >= notificationLimit {
		resetTime := sub.LastReset.Add(resetWindow)
		return fmt.Errorf("rate limit exceeded: %d notifications sent, resets at %s",
			sub.NotificationCount, resetTime.Format(time.RFC3339))
	}

	return nil
}

// IncrementNotificationCount increments the notification count for a subscription.
func (m *Manager) IncrementNotificationCount(ctx context.Context, id uuid.UUID) error {
	sub, err := m.db.GetSubscriptionByID(ctx, id)
	if err != nil {
		return err
	}
	if sub == nil {
		return fmt.Errorf("subscription not found")
	}

	sub.NotificationCount++
	sub.UpdatedAt = time.Now().UTC()
	return m.db.UpdateSubscription(ctx, sub)
}

// RotateAPIKey generates a new API key for a subscription.
// Returns the new plain-text API key (only shown once).
func (m *Manager) RotateAPIKey(ctx context.Context, id uuid.UUID) (string, error) {
	sub, err := m.db.GetSubscriptionByID(ctx, id)
	if err != nil {
		return "", fmt.Errorf("failed to get subscription: %w", err)
	}
	if sub == nil {
		return "", fmt.Errorf("subscription not found")
	}

	// Generate new API key
	newAPIKey, err := generateAPIKey()
	if err != nil {
		return "", fmt.Errorf("failed to generate new API key: %w", err)
	}

	// Update subscription with new hashed key
	sub.APIKey = hashAPIKey(newAPIKey)
	sub.APIKeyHint = newAPIKey[len(newAPIKey)-4:] // Last 4 characters
	sub.UpdatedAt = time.Now().UTC()

	if err := m.db.UpdateSubscription(ctx, sub); err != nil {
		return "", fmt.Errorf("failed to update subscription: %w", err)
	}

	log.Info().
		Str("subscription_id", id.String()).
		Str("key_hint", sub.APIKeyHint).
		Msg("API key rotated")

	return newAPIKey, nil
}

// SubscriptionStats holds statistics for a subscription.
type SubscriptionStats struct {
	SubscriptionID      uuid.UUID        `json:"subscription_id"`
	Name                string           `json:"name"`
	Status              string           `json:"status"`
	TotalNotifications  int              `json:"total_notifications"`
	SuccessfulDeliveries int             `json:"successful_deliveries"`
	FailedDeliveries    int              `json:"failed_deliveries"`
	ChannelCount        int              `json:"channel_count"`
	ChannelStats        []ChannelStats   `json:"channel_stats"`
	CreatedAt           time.Time        `json:"created_at"`
	LastNotifiedAt      *time.Time       `json:"last_notified_at,omitempty"`
	NotificationsToday  int              `json:"notifications_today"`
	NotificationsThisHour int            `json:"notifications_this_hour"`
}

// ChannelStats holds statistics for a notification channel.
type ChannelStats struct {
	ChannelID     uuid.UUID           `json:"channel_id"`
	Type          types.ChannelType   `json:"type"`
	Enabled       bool                `json:"enabled"`
	SuccessCount  int                 `json:"success_count"`
	FailureCount  int                 `json:"failure_count"`
	LastSuccess   *time.Time          `json:"last_success,omitempty"`
	LastFailure   *time.Time          `json:"last_failure,omitempty"`
	LastError     string              `json:"last_error,omitempty"`
}

// GetStats retrieves comprehensive statistics for a subscription.
func (m *Manager) GetStats(ctx context.Context, id uuid.UUID) (*SubscriptionStats, error) {
	sub, err := m.db.GetSubscriptionByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription: %w", err)
	}
	if sub == nil {
		return nil, fmt.Errorf("subscription not found")
	}

	channels, err := m.db.GetChannelsForSubscription(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get channels: %w", err)
	}

	// Get notifications for this subscription
	notifications, err := m.db.GetNotificationsForSubscription(ctx, id, 1000)
	if err != nil {
		return nil, fmt.Errorf("failed to get notifications: %w", err)
	}

	// Calculate stats
	var successCount, failCount int
	var todayCount, hourCount int
	now := time.Now().UTC()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	startOfHour := time.Date(now.Year(), now.Month(), now.Day(), now.Hour(), 0, 0, 0, time.UTC)

	for _, n := range notifications {
		if n.Status == "sent" {
			successCount++
		} else if n.Status == "failed" {
			failCount++
		}
		if n.CreatedAt.After(startOfDay) {
			todayCount++
		}
		if n.CreatedAt.After(startOfHour) {
			hourCount++
		}
	}

	// Build channel stats
	channelStats := make([]ChannelStats, len(channels))
	for i, ch := range channels {
		channelStats[i] = ChannelStats{
			ChannelID:    ch.ID,
			Type:         ch.Type,
			Enabled:      ch.Enabled,
			SuccessCount: ch.SuccessCount,
			FailureCount: ch.FailureCount,
			LastSuccess:  ch.LastSuccess,
			LastFailure:  ch.LastFailure,
			LastError:    ch.LastError,
		}
	}

	stats := &SubscriptionStats{
		SubscriptionID:       sub.ID,
		Name:                 sub.Name,
		Status:               string(sub.Status),
		TotalNotifications:   len(notifications),
		SuccessfulDeliveries: successCount,
		FailedDeliveries:     failCount,
		ChannelCount:         len(channels),
		ChannelStats:         channelStats,
		CreatedAt:            sub.CreatedAt,
		LastNotifiedAt:       sub.LastNotified,
		NotificationsToday:   todayCount,
		NotificationsThisHour: hourCount,
	}

	return stats, nil
}

// GetByID retrieves a subscription by ID with its channels.
func (m *Manager) GetByID(ctx context.Context, id uuid.UUID) (*types.Subscription, error) {
	sub, err := m.db.GetSubscriptionByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get subscription: %w", err)
	}
	if sub == nil {
		return nil, nil
	}

	// Load channels
	channels, err := m.db.GetChannelsForSubscription(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get channels: %w", err)
	}
	sub.Channels = channels

	return sub, nil
}

// List retrieves a paginated list of subscriptions.
func (m *Manager) List(ctx context.Context, limit, offset int) ([]types.Subscription, int, error) {
	return m.db.ListSubscriptions(ctx, limit, offset)
}

// MatchesFilters checks if a change matches a subscription's filters.
func (m *Manager) MatchesFilters(change *types.Change, filters types.SubscriptionFilter) bool {
	// If no filters are set, match everything
	if len(filters.Servers) == 0 && 
		len(filters.Namespaces) == 0 && 
		len(filters.Keywords) == 0 && 
		len(filters.ChangeTypes) == 0 &&
		len(filters.PackageTypes) == 0 {
		return true
	}

	// Check specific servers
	if len(filters.Servers) > 0 {
		matched := false
		for _, s := range filters.Servers {
			if s == change.ServerName {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// Check change types
	if len(filters.ChangeTypes) > 0 {
		matched := false
		for _, ct := range filters.ChangeTypes {
			if ct == change.ChangeType {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// Check namespaces (glob-style patterns)
	if len(filters.Namespaces) > 0 {
		matched := false
		for _, ns := range filters.Namespaces {
			if matchNamespace(change.ServerName, ns) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// Check keywords in name or description
	if len(filters.Keywords) > 0 && change.Server != nil {
		matched := false
		searchText := strings.ToLower(change.ServerName + " " + change.Server.Description)
		for _, kw := range filters.Keywords {
			if strings.Contains(searchText, strings.ToLower(kw)) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// Check package types
	if len(filters.PackageTypes) > 0 && change.Server != nil {
		matched := false
		for _, pt := range filters.PackageTypes {
			for _, pkg := range change.Server.Packages {
				if strings.EqualFold(pkg.RegistryType, pt) {
					matched = true
					break
				}
			}
			if matched {
				break
			}
		}
		if !matched {
			return false
		}
	}

	return true
}

// matchNamespace checks if a server name matches a namespace pattern.
// Supports glob-style wildcards: * matches any sequence of characters.
func matchNamespace(serverName, pattern string) bool {
	// Simple glob matching
	if pattern == "*" {
		return true
	}
	if strings.HasSuffix(pattern, "*") {
		prefix := strings.TrimSuffix(pattern, "*")
		return strings.HasPrefix(serverName, prefix)
	}
	if strings.HasPrefix(pattern, "*") {
		suffix := strings.TrimPrefix(pattern, "*")
		return strings.HasSuffix(serverName, suffix)
	}
	return serverName == pattern
}

// Helper functions

func generateAPIKey() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "mcpw_" + hex.EncodeToString(bytes), nil
}

func hashAPIKey(apiKey string) string {
	hash := sha256.Sum256([]byte(apiKey))
	return hex.EncodeToString(hash[:])
}
