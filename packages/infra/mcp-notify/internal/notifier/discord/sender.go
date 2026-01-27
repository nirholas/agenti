// Package discord provides Discord webhook notification sending.
package discord

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"
	"golang.org/x/time/rate"

	"github.com/nirholas/mcp-notify/pkg/types"
)

// Config holds Discord sender configuration.
type Config struct {
	RateLimit     string        // e.g., "30/min"
	RetryAttempts int
	RetryDelay    time.Duration
}

// Sender sends notifications via Discord webhooks.
type Sender struct {
	httpClient    *http.Client
	limiter       *rate.Limiter
	retryAttempts int
	retryDelay    time.Duration
}

// NewSender creates a new Discord sender.
func NewSender(cfg Config) *Sender {
	// Parse rate limit (default to 30/min)
	limiter := rate.NewLimiter(rate.Limit(0.5), 1) // 30/min = 0.5/sec

	return &Sender{
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		limiter:       limiter,
		retryAttempts: cfg.RetryAttempts,
		retryDelay:    cfg.RetryDelay,
	}
}

// Type returns the channel type.
func (s *Sender) Type() types.ChannelType {
	return types.ChannelDiscord
}

// Send sends a notification via Discord webhook.
func (s *Sender) Send(ctx context.Context, channel *types.Channel, change *types.Change) error {
	// Wait for rate limiter
	if err := s.limiter.Wait(ctx); err != nil {
		return fmt.Errorf("rate limit wait failed: %w", err)
	}

	webhookURL := channel.Config.DiscordWebhookURL
	if webhookURL == "" {
		return fmt.Errorf("discord webhook URL not configured")
	}

	// Build Discord embed
	embed := s.buildEmbed(change)

	payload := DiscordPayload{
		Username:  channel.Config.DiscordUsername,
		AvatarURL: channel.Config.DiscordAvatarURL,
		Embeds:    []DiscordEmbed{embed},
	}

	if payload.Username == "" {
		payload.Username = "MCP Notify"
	}

	// Send with retries
	var lastErr error
	for attempt := 0; attempt <= s.retryAttempts; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(s.retryDelay * time.Duration(attempt)):
			}
			log.Debug().Int("attempt", attempt).Msg("Retrying Discord notification")
		}

		err := s.sendRequest(ctx, webhookURL, payload)
		if err == nil {
			return nil
		}
		lastErr = err
	}

	return lastErr
}

func (s *Sender) sendRequest(ctx context.Context, webhookURL string, payload DiscordPayload) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, webhookURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Discord returns 204 on success
	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return nil
}

func (s *Sender) buildEmbed(change *types.Change) DiscordEmbed {
	embed := DiscordEmbed{
		Timestamp: change.DetectedAt.Format(time.RFC3339),
	}

	// Set color based on change type
	switch change.ChangeType {
	case types.ChangeTypeNew:
		embed.Color = 0x57F287 // Green
		embed.Title = "🆕 New MCP Server"
	case types.ChangeTypeUpdated:
		embed.Color = 0x5865F2 // Blue
		embed.Title = "📝 Server Updated"
	case types.ChangeTypeRemoved:
		embed.Color = 0xED4245 // Red
		embed.Title = "🗑️ Server Removed"
	}

	embed.Title += fmt.Sprintf(": %s", change.ServerName)

	// Build description
	if change.Server != nil && change.Server.Description != "" {
		desc := change.Server.Description
		if len(desc) > 200 {
			desc = desc[:197] + "..."
		}
		embed.Description = desc
	}

	// Add fields
	var fields []DiscordField

	// Version field
	if change.ChangeType == types.ChangeTypeUpdated && change.PreviousVersion != "" && change.NewVersion != "" {
		fields = append(fields, DiscordField{
			Name:   "Version",
			Value:  fmt.Sprintf("`%s` → `%s`", change.PreviousVersion, change.NewVersion),
			Inline: true,
		})
	} else if change.NewVersion != "" {
		fields = append(fields, DiscordField{
			Name:   "Version",
			Value:  fmt.Sprintf("`%s`", change.NewVersion),
			Inline: true,
		})
	}

	// Package links
	if change.Server != nil && len(change.Server.Packages) > 0 {
		var packageLinks string
		for i, pkg := range change.Server.Packages {
			if i > 0 {
				packageLinks += " • "
			}
			if pkg.URL != "" {
				packageLinks += fmt.Sprintf("[%s](%s)", pkg.RegistryType, pkg.URL)
			} else {
				packageLinks += pkg.RegistryType
			}
		}
		if packageLinks != "" {
			fields = append(fields, DiscordField{
				Name:   "Packages",
				Value:  packageLinks,
				Inline: true,
			})
		}
	}

	// Repository link
	if change.Server != nil && change.Server.Repository != nil && change.Server.Repository.URL != "" {
		fields = append(fields, DiscordField{
			Name:   "Repository",
			Value:  fmt.Sprintf("[View on %s](%s)", change.Server.Repository.Source, change.Server.Repository.URL),
			Inline: true,
		})
	}

	// Field changes for updates
	if change.ChangeType == types.ChangeTypeUpdated && len(change.FieldChanges) > 0 {
		var changedFields string
		for _, fc := range change.FieldChanges {
			if fc.Field == "version" {
				continue // Already shown above
			}
			changedFields += fmt.Sprintf("• %s\n", fc.Field)
		}
		if changedFields != "" {
			fields = append(fields, DiscordField{
				Name:   "Changed Fields",
				Value:  changedFields,
				Inline: false,
			})
		}
	}

	embed.Fields = fields

	// Add footer with registry link
	embed.Footer = &DiscordFooter{
		Text: "MCP Notify",
	}

	return embed
}

// Discord webhook payload types

type DiscordPayload struct {
	Username  string         `json:"username,omitempty"`
	AvatarURL string         `json:"avatar_url,omitempty"`
	Content   string         `json:"content,omitempty"`
	Embeds    []DiscordEmbed `json:"embeds,omitempty"`
}

type DiscordEmbed struct {
	Title       string         `json:"title,omitempty"`
	Description string         `json:"description,omitempty"`
	URL         string         `json:"url,omitempty"`
	Color       int            `json:"color,omitempty"`
	Fields      []DiscordField `json:"fields,omitempty"`
	Footer      *DiscordFooter `json:"footer,omitempty"`
	Timestamp   string         `json:"timestamp,omitempty"`
	Thumbnail   *DiscordImage  `json:"thumbnail,omitempty"`
}

type DiscordField struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Inline bool   `json:"inline,omitempty"`
}

type DiscordFooter struct {
	Text    string `json:"text"`
	IconURL string `json:"icon_url,omitempty"`
}

type DiscordImage struct {
	URL string `json:"url"`
}
