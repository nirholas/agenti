// Package slack provides Slack webhook notification sending.
package slack

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

// Config holds Slack sender configuration.
type Config struct {
	RateLimit     string
	RetryAttempts int
	RetryDelay    time.Duration
}

// Sender sends notifications via Slack webhooks.
type Sender struct {
	httpClient    *http.Client
	limiter       *rate.Limiter
	retryAttempts int
	retryDelay    time.Duration
}

// NewSender creates a new Slack sender.
func NewSender(cfg Config) *Sender {
	limiter := rate.NewLimiter(rate.Limit(0.5), 1) // 30/min

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
	return types.ChannelSlack
}

// Send sends a notification via Slack webhook.
func (s *Sender) Send(ctx context.Context, channel *types.Channel, change *types.Change) error {
	if err := s.limiter.Wait(ctx); err != nil {
		return fmt.Errorf("rate limit wait failed: %w", err)
	}

	webhookURL := channel.Config.SlackWebhookURL
	if webhookURL == "" {
		return fmt.Errorf("slack webhook URL not configured")
	}

	payload := s.buildPayload(change, channel.Config.SlackChannel)

	var lastErr error
	for attempt := 0; attempt <= s.retryAttempts; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(s.retryDelay * time.Duration(attempt)):
			}
			log.Debug().Int("attempt", attempt).Msg("Retrying Slack notification")
		}

		err := s.sendRequest(ctx, webhookURL, payload)
		if err == nil {
			return nil
		}
		lastErr = err
	}

	return lastErr
}

func (s *Sender) sendRequest(ctx context.Context, webhookURL string, payload SlackPayload) error {
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

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return nil
}

func (s *Sender) buildPayload(change *types.Change, channelOverride string) SlackPayload {
	payload := SlackPayload{
		Channel: channelOverride,
	}

	// Build blocks for rich formatting
	var blocks []SlackBlock

	// Header block
	var emoji, title string
	switch change.ChangeType {
	case types.ChangeTypeNew:
		emoji = "🆕"
		title = "New MCP Server"
	case types.ChangeTypeUpdated:
		emoji = "📝"
		title = "Server Updated"
	case types.ChangeTypeRemoved:
		emoji = "🗑️"
		title = "Server Removed"
	}

	blocks = append(blocks, SlackBlock{
		Type: "header",
		Text: &SlackText{
			Type:  "plain_text",
			Text:  fmt.Sprintf("%s %s", emoji, title),
			Emoji: true,
		},
	})

	// Server name section
	serverText := fmt.Sprintf("*%s*", change.ServerName)
	if change.Server != nil && change.Server.Description != "" {
		desc := change.Server.Description
		if len(desc) > 150 {
			desc = desc[:147] + "..."
		}
		serverText += fmt.Sprintf("\n%s", desc)
	}

	blocks = append(blocks, SlackBlock{
		Type: "section",
		Text: &SlackText{
			Type: "mrkdwn",
			Text: serverText,
		},
	})

	// Version and details section
	var fields []SlackText

	if change.ChangeType == types.ChangeTypeUpdated && change.PreviousVersion != "" && change.NewVersion != "" {
		fields = append(fields, SlackText{
			Type: "mrkdwn",
			Text: fmt.Sprintf("*Version*\n`%s` → `%s`", change.PreviousVersion, change.NewVersion),
		})
	} else if change.NewVersion != "" {
		fields = append(fields, SlackText{
			Type: "mrkdwn",
			Text: fmt.Sprintf("*Version*\n`%s`", change.NewVersion),
		})
	}

	if change.Server != nil && len(change.Server.Packages) > 0 {
		var pkgText string
		for _, pkg := range change.Server.Packages {
			if pkg.URL != "" {
				pkgText += fmt.Sprintf("<%s|%s> ", pkg.URL, pkg.RegistryType)
			} else {
				pkgText += pkg.RegistryType + " "
			}
		}
		fields = append(fields, SlackText{
			Type: "mrkdwn",
			Text: fmt.Sprintf("*Packages*\n%s", pkgText),
		})
	}

	if len(fields) > 0 {
		blocks = append(blocks, SlackBlock{
			Type:   "section",
			Fields: fields,
		})
	}

	// Action buttons
	var elements []SlackElement

	if change.Server != nil && change.Server.Repository != nil && change.Server.Repository.URL != "" {
		elements = append(elements, SlackElement{
			Type: "button",
			Text: &SlackText{
				Type:  "plain_text",
				Text:  "View Repository",
				Emoji: true,
			},
			URL: change.Server.Repository.URL,
		})
	}

	// Registry link
	registryURL := fmt.Sprintf("https://registry.modelcontextprotocol.io/servers/%s", change.ServerName)
	elements = append(elements, SlackElement{
		Type: "button",
		Text: &SlackText{
			Type:  "plain_text",
			Text:  "View in Registry",
			Emoji: true,
		},
		URL: registryURL,
	})

	if len(elements) > 0 {
		blocks = append(blocks, SlackBlock{
			Type:     "actions",
			Elements: elements,
		})
	}

	// Context/footer
	blocks = append(blocks, SlackBlock{
		Type: "context",
		Elements: []SlackElement{
			{
				Type: "mrkdwn",
				Text: &SlackText{
					Type: "mrkdwn",
					Text: fmt.Sprintf("Detected at %s • MCP Notify", change.DetectedAt.Format("Jan 2, 2006 3:04 PM")),
				},
			},
		},
	})

	payload.Blocks = blocks

	return payload
}

// Slack payload types

type SlackPayload struct {
	Channel     string       `json:"channel,omitempty"`
	Text        string       `json:"text,omitempty"`
	Blocks      []SlackBlock `json:"blocks,omitempty"`
	Attachments []any        `json:"attachments,omitempty"`
}

type SlackBlock struct {
	Type     string         `json:"type"`
	Text     *SlackText     `json:"text,omitempty"`
	Fields   []SlackText    `json:"fields,omitempty"`
	Elements []SlackElement `json:"elements,omitempty"`
}

type SlackText struct {
	Type  string `json:"type"`
	Text  string `json:"text"`
	Emoji bool   `json:"emoji,omitempty"`
}

type SlackElement struct {
	Type string     `json:"type"`
	Text *SlackText `json:"text,omitempty"`
	URL  string     `json:"url,omitempty"`
}
