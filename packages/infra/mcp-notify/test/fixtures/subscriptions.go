package fixtures

import (
	"time"

	"github.com/google/uuid"

	"github.com/nirholas/mcp-notify/pkg/types"
)

// TestSubscriptions provides sample subscription data for testing.
var TestSubscriptions = []types.Subscription{
	{
		ID:          uuid.MustParse("aaaa1111-1111-1111-1111-111111111111"),
		Name:        "test-subscription-discord",
		Description: "Test subscription with Discord channel",
		Filters: types.SubscriptionFilter{
			Keywords:    []string{"defi", "blockchain"},
			Namespaces:  []string{"io.github.defi.*"},
			ChangeTypes: []types.ChangeType{types.ChangeTypeNew, types.ChangeTypeUpdated},
		},
		Channels: []types.Channel{
			{
				ID:             uuid.MustParse("cccc1111-1111-1111-1111-111111111111"),
				SubscriptionID: uuid.MustParse("aaaa1111-1111-1111-1111-111111111111"),
				Type:           types.ChannelDiscord,
				Config: types.ChannelConfig{
					DiscordWebhookURL: "https://discord.com/api/webhooks/123456/abcdef",
				},
				Enabled:      true,
				CreatedAt:    time.Now().Add(-7 * 24 * time.Hour),
				SuccessCount: 15,
				FailureCount: 0,
			},
		},
		Status:            types.SubscriptionStatusActive,
		CreatedAt:         time.Now().Add(-7 * 24 * time.Hour),
		UpdatedAt:         time.Now().Add(-1 * time.Hour),
		NotificationCount: 15,
		LastReset:         time.Now().Add(-7 * 24 * time.Hour),
	},
	{
		ID:          uuid.MustParse("aaaa2222-2222-2222-2222-222222222222"),
		Name:        "test-subscription-slack",
		Description: "Test subscription with Slack channel",
		Filters: types.SubscriptionFilter{
			Keywords: []string{"ai", "llm", "model"},
		},
		Channels: []types.Channel{
			{
				ID:             uuid.MustParse("cccc2222-2222-2222-2222-222222222222"),
				SubscriptionID: uuid.MustParse("aaaa2222-2222-2222-2222-222222222222"),
				Type:           types.ChannelSlack,
				Config: types.ChannelConfig{
					SlackWebhookURL: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX",
				},
				Enabled:      true,
				CreatedAt:    time.Now().Add(-14 * 24 * time.Hour),
				SuccessCount: 8,
				FailureCount: 2,
			},
		},
		Status:            types.SubscriptionStatusActive,
		CreatedAt:         time.Now().Add(-14 * 24 * time.Hour),
		UpdatedAt:         time.Now().Add(-2 * time.Hour),
		NotificationCount: 10,
		LastReset:         time.Now().Add(-14 * 24 * time.Hour),
	},
	{
		ID:          uuid.MustParse("aaaa3333-3333-3333-3333-333333333333"),
		Name:        "test-subscription-webhook",
		Description: "Test subscription with generic webhook",
		Filters: types.SubscriptionFilter{
			Servers: []string{"io.github.test/server-a", "io.github.test/server-b"},
		},
		Channels: []types.Channel{
			{
				ID:             uuid.MustParse("cccc3333-3333-3333-3333-333333333333"),
				SubscriptionID: uuid.MustParse("aaaa3333-3333-3333-3333-333333333333"),
				Type:           types.ChannelWebhook,
				Config: types.ChannelConfig{
					WebhookURL:    "https://example.com/webhook",
					WebhookMethod: "POST",
					WebhookHeaders: map[string]string{
						"X-Custom-Header": "custom-value",
					},
				},
				Enabled:   true,
				CreatedAt: time.Now().Add(-3 * 24 * time.Hour),
			},
		},
		Status:    types.SubscriptionStatusActive,
		CreatedAt: time.Now().Add(-3 * 24 * time.Hour),
		UpdatedAt: time.Now().Add(-3 * 24 * time.Hour),
		LastReset: time.Now().Add(-3 * 24 * time.Hour),
	},
	{
		ID:          uuid.MustParse("aaaa4444-4444-4444-4444-444444444444"),
		Name:        "test-subscription-paused",
		Description: "A paused subscription",
		Filters: types.SubscriptionFilter{
			Keywords: []string{"test"},
		},
		Channels: []types.Channel{
			{
				ID:             uuid.MustParse("cccc4444-4444-4444-4444-444444444444"),
				SubscriptionID: uuid.MustParse("aaaa4444-4444-4444-4444-444444444444"),
				Type:           types.ChannelEmail,
				Config: types.ChannelConfig{
					EmailAddress: "test@example.com",
					EmailDigest:  types.DigestDaily,
				},
				Enabled:   true,
				CreatedAt: time.Now().Add(-30 * 24 * time.Hour),
			},
		},
		Status:    types.SubscriptionStatusPaused,
		CreatedAt: time.Now().Add(-30 * 24 * time.Hour),
		UpdatedAt: time.Now().Add(-5 * 24 * time.Hour),
		LastReset: time.Now().Add(-30 * 24 * time.Hour),
	},
	{
		ID:          uuid.MustParse("aaaa5555-5555-5555-5555-555555555555"),
		Name:        "test-subscription-multi-channel",
		Description: "Subscription with multiple channels",
		Filters: types.SubscriptionFilter{
			ChangeTypes: []types.ChangeType{types.ChangeTypeNew},
		},
		Channels: []types.Channel{
			{
				ID:             uuid.MustParse("cccc5551-5555-5555-5555-555555555555"),
				SubscriptionID: uuid.MustParse("aaaa5555-5555-5555-5555-555555555555"),
				Type:           types.ChannelDiscord,
				Config: types.ChannelConfig{
					DiscordWebhookURL: "https://discord.com/api/webhooks/999999/xyz",
				},
				Enabled:   true,
				CreatedAt: time.Now().Add(-2 * 24 * time.Hour),
			},
			{
				ID:             uuid.MustParse("cccc5552-5555-5555-5555-555555555555"),
				SubscriptionID: uuid.MustParse("aaaa5555-5555-5555-5555-555555555555"),
				Type:           types.ChannelSlack,
				Config: types.ChannelConfig{
					SlackWebhookURL: "https://hooks.slack.com/services/MULTI/CHANNEL/TEST",
				},
				Enabled:   true,
				CreatedAt: time.Now().Add(-2 * 24 * time.Hour),
			},
			{
				ID:             uuid.MustParse("cccc5553-5555-5555-5555-555555555555"),
				SubscriptionID: uuid.MustParse("aaaa5555-5555-5555-5555-555555555555"),
				Type:           types.ChannelEmail,
				Config: types.ChannelConfig{
					EmailAddress: "multi@example.com",
					EmailDigest:  types.DigestImmediate,
				},
				Enabled:   false, // Disabled channel
				CreatedAt: time.Now().Add(-2 * 24 * time.Hour),
			},
		},
		Status:    types.SubscriptionStatusActive,
		CreatedAt: time.Now().Add(-2 * 24 * time.Hour),
		UpdatedAt: time.Now().Add(-1 * time.Hour),
		LastReset: time.Now().Add(-2 * 24 * time.Hour),
	},
}

// CreateTestSubscription creates a new subscription with given parameters.
func CreateTestSubscription(name string, channelType types.ChannelType, keywords []string) types.Subscription {
	subID := uuid.New()
	channelID := uuid.New()
	now := time.Now()

	var channelConfig types.ChannelConfig
	switch channelType {
	case types.ChannelDiscord:
		channelConfig.DiscordWebhookURL = "https://discord.com/api/webhooks/test/test"
	case types.ChannelSlack:
		channelConfig.SlackWebhookURL = "https://hooks.slack.com/services/TEST/TEST/TEST"
	case types.ChannelWebhook:
		channelConfig.WebhookURL = "https://example.com/webhook"
		channelConfig.WebhookMethod = "POST"
	case types.ChannelEmail:
		channelConfig.EmailAddress = "test@example.com"
	case types.ChannelTelegram:
		channelConfig.TelegramChatID = "123456789"
	case types.ChannelTeams:
		channelConfig.TeamsWebhookURL = "https://outlook.office.com/webhook/test"
	}

	return types.Subscription{
		ID:          subID,
		Name:        name,
		Description: "Test subscription: " + name,
		Filters: types.SubscriptionFilter{
			Keywords: keywords,
		},
		Channels: []types.Channel{
			{
				ID:             channelID,
				SubscriptionID: subID,
				Type:           channelType,
				Config:         channelConfig,
				Enabled:        true,
				CreatedAt:      now,
			},
		},
		Status:    types.SubscriptionStatusActive,
		CreatedAt: now,
		UpdatedAt: now,
		LastReset: now,
	}
}
