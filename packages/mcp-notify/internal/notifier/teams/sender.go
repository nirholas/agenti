// Package teams provides Microsoft Teams webhook notification sending.
package teams

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

// Config holds Teams sender configuration.
type Config struct {
	RetryAttempts int
	RetryDelay    time.Duration
}

// Sender sends notifications via Microsoft Teams webhooks.
type Sender struct {
	httpClient    *http.Client
	limiter       *rate.Limiter
	retryAttempts int
	retryDelay    time.Duration
}

// NewSender creates a new Teams sender.
func NewSender(cfg Config) *Sender {
	// Teams rate limit is typically generous, but we'll be conservative
	limiter := rate.NewLimiter(rate.Limit(1), 2)

	return &Sender{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		limiter:       limiter,
		retryAttempts: cfg.RetryAttempts,
		retryDelay:    cfg.RetryDelay,
	}
}

// Type returns the channel type.
func (s *Sender) Type() types.ChannelType {
	return types.ChannelTeams
}

// Send sends a notification via Teams webhook.
func (s *Sender) Send(ctx context.Context, channel *types.Channel, change *types.Change) error {
	// Wait for rate limiter
	if err := s.limiter.Wait(ctx); err != nil {
		return fmt.Errorf("rate limit wait failed: %w", err)
	}

	webhookURL := channel.Config.TeamsWebhookURL
	if webhookURL == "" {
		return fmt.Errorf("teams webhook URL not configured")
	}

	// Build Adaptive Card
	card := s.buildAdaptiveCard(change)

	// Send with retries
	var lastErr error
	for attempt := 0; attempt <= s.retryAttempts; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(s.retryDelay * time.Duration(attempt)):
			}
			log.Debug().Int("attempt", attempt).Msg("Retrying Teams notification")
		}

		err := s.sendRequest(ctx, webhookURL, card)
		if err == nil {
			return nil
		}
		lastErr = err
	}

	return lastErr
}

func (s *Sender) sendRequest(ctx context.Context, webhookURL string, card AdaptiveCard) error {
	body, err := json.Marshal(card)
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

	// Teams returns 200 OK on success
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return nil
}

func (s *Sender) buildAdaptiveCard(change *types.Change) AdaptiveCard {
	// Determine title and color based on change type
	var title, color, emoji string
	switch change.ChangeType {
	case types.ChangeTypeNew:
		title = "New MCP Server Added"
		color = "good" // Green
		emoji = "🆕"
	case types.ChangeTypeUpdated:
		title = "MCP Server Updated"
		color = "accent" // Blue
		emoji = "📝"
	case types.ChangeTypeRemoved:
		title = "MCP Server Removed"
		color = "attention" // Red
		emoji = "🗑️"
	}

	// Build card body
	body := []AdaptiveElement{
		{
			Type: "TextBlock",
			Text: fmt.Sprintf("%s %s", emoji, title),
			Size: "Large",
			Weight: "Bolder",
			Wrap: true,
		},
		{
			Type: "TextBlock",
			Text: change.ServerName,
			Size: "Medium",
			Weight: "Bolder",
			Color: color,
			Wrap: true,
		},
	}

	// Add description
	if change.Server != nil && change.Server.Description != "" {
		desc := change.Server.Description
		if len(desc) > 300 {
			desc = desc[:297] + "..."
		}
		body = append(body, AdaptiveElement{
			Type: "TextBlock",
			Text: desc,
			Wrap: true,
		})
	}

	// Build fact set for details
	var facts []AdaptiveFact

	// Version info
	if change.ChangeType == types.ChangeTypeUpdated && change.PreviousVersion != "" && change.NewVersion != "" {
		facts = append(facts, AdaptiveFact{
			Title: "Version",
			Value: fmt.Sprintf("%s → %s", change.PreviousVersion, change.NewVersion),
		})
	} else if change.NewVersion != "" {
		facts = append(facts, AdaptiveFact{
			Title: "Version",
			Value: change.NewVersion,
		})
	}

	// Packages
	if change.Server != nil && len(change.Server.Packages) > 0 {
		var packages string
		for i, pkg := range change.Server.Packages {
			if i > 0 {
				packages += ", "
			}
			packages += pkg.RegistryType
		}
		facts = append(facts, AdaptiveFact{
			Title: "Packages",
			Value: packages,
		})
	}

	// Detected at
	facts = append(facts, AdaptiveFact{
		Title: "Detected At",
		Value: change.DetectedAt.Format("Jan 2, 2006 3:04 PM UTC"),
	})

	if len(facts) > 0 {
		body = append(body, AdaptiveElement{
			Type:  "FactSet",
			Facts: facts,
		})
	}

	// Build actions
	var actions []AdaptiveAction

	// View in Registry
	registryURL := fmt.Sprintf("https://registry.modelcontextprotocol.io/servers/%s", change.ServerName)
	actions = append(actions, AdaptiveAction{
		Type:  "Action.OpenUrl",
		Title: "View in Registry",
		URL:   registryURL,
	})

	// View Repository
	if change.Server != nil && change.Server.Repository != nil && change.Server.Repository.URL != "" {
		actions = append(actions, AdaptiveAction{
			Type:  "Action.OpenUrl",
			Title: "View Repository",
			URL:   change.Server.Repository.URL,
		})
	}

	// Package links
	if change.Server != nil && len(change.Server.Packages) > 0 {
		for _, pkg := range change.Server.Packages {
			if pkg.URL != "" {
				actions = append(actions, AdaptiveAction{
					Type:  "Action.OpenUrl",
					Title: fmt.Sprintf("View on %s", pkg.RegistryType),
					URL:   pkg.URL,
				})
			}
		}
	}

	return AdaptiveCard{
		Type:    "message",
		Attachments: []AdaptiveAttachment{
			{
				ContentType: "application/vnd.microsoft.card.adaptive",
				ContentURL:  nil,
				Content: AdaptiveCardContent{
					Schema:  "http://adaptivecards.io/schemas/adaptive-card.json",
					Type:    "AdaptiveCard",
					Version: "1.4",
					Body:    body,
					Actions: actions,
				},
			},
		},
	}
}

// SendDigest sends a digest of multiple changes.
func (s *Sender) SendDigest(ctx context.Context, webhookURL string, changes []types.Change) error {
	if len(changes) == 0 {
		return nil
	}

	card := s.buildDigestCard(changes)
	return s.sendRequest(ctx, webhookURL, card)
}

func (s *Sender) buildDigestCard(changes []types.Change) AdaptiveCard {
	// Count by type
	var newCount, updatedCount, removedCount int
	for _, change := range changes {
		switch change.ChangeType {
		case types.ChangeTypeNew:
			newCount++
		case types.ChangeTypeUpdated:
			updatedCount++
		case types.ChangeTypeRemoved:
			removedCount++
		}
	}

	body := []AdaptiveElement{
		{
			Type:   "TextBlock",
			Text:   "📋 MCP Registry Digest",
			Size:   "Large",
			Weight: "Bolder",
			Wrap:   true,
		},
		{
			Type:   "TextBlock",
			Text:   fmt.Sprintf("%d changes detected", len(changes)),
			Size:   "Medium",
			Wrap:   true,
		},
	}

	// Summary facts
	facts := []AdaptiveFact{}
	if newCount > 0 {
		facts = append(facts, AdaptiveFact{Title: "🆕 New", Value: fmt.Sprintf("%d servers", newCount)})
	}
	if updatedCount > 0 {
		facts = append(facts, AdaptiveFact{Title: "📝 Updated", Value: fmt.Sprintf("%d servers", updatedCount)})
	}
	if removedCount > 0 {
		facts = append(facts, AdaptiveFact{Title: "🗑️ Removed", Value: fmt.Sprintf("%d servers", removedCount)})
	}

	if len(facts) > 0 {
		body = append(body, AdaptiveElement{
			Type:  "FactSet",
			Facts: facts,
		})
	}

	// List recent changes (limit to 5)
	body = append(body, AdaptiveElement{
		Type:      "TextBlock",
		Text:      "Recent Changes",
		Weight:    "Bolder",
		Separator: true,
		Wrap:      true,
	})

	limit := 5
	if len(changes) < limit {
		limit = len(changes)
	}

	for i := 0; i < limit; i++ {
		change := changes[i]
		var emoji string
		switch change.ChangeType {
		case types.ChangeTypeNew:
			emoji = "🆕"
		case types.ChangeTypeUpdated:
			emoji = "📝"
		case types.ChangeTypeRemoved:
			emoji = "🗑️"
		}
		body = append(body, AdaptiveElement{
			Type: "TextBlock",
			Text: fmt.Sprintf("%s %s", emoji, change.ServerName),
			Wrap: true,
		})
	}

	if len(changes) > limit {
		body = append(body, AdaptiveElement{
			Type:   "TextBlock",
			Text:   fmt.Sprintf("... and %d more changes", len(changes)-limit),
			IsSubtle: true,
			Wrap:   true,
		})
	}

	actions := []AdaptiveAction{
		{
			Type:  "Action.OpenUrl",
			Title: "View All Changes",
			URL:   "https://registry.modelcontextprotocol.io",
		},
	}

	return AdaptiveCard{
		Type: "message",
		Attachments: []AdaptiveAttachment{
			{
				ContentType: "application/vnd.microsoft.card.adaptive",
				Content: AdaptiveCardContent{
					Schema:  "http://adaptivecards.io/schemas/adaptive-card.json",
					Type:    "AdaptiveCard",
					Version: "1.4",
					Body:    body,
					Actions: actions,
				},
			},
		},
	}
}

// Adaptive Card types

// AdaptiveCard is the top-level message format for Teams.
type AdaptiveCard struct {
	Type        string              `json:"type"`
	Attachments []AdaptiveAttachment `json:"attachments"`
}

// AdaptiveAttachment wraps the card content.
type AdaptiveAttachment struct {
	ContentType string              `json:"contentType"`
	ContentURL  *string             `json:"contentUrl,omitempty"`
	Content     AdaptiveCardContent `json:"content"`
}

// AdaptiveCardContent is the actual card content.
type AdaptiveCardContent struct {
	Schema  string           `json:"$schema"`
	Type    string           `json:"type"`
	Version string           `json:"version"`
	Body    []AdaptiveElement `json:"body"`
	Actions []AdaptiveAction `json:"actions,omitempty"`
}

// AdaptiveElement represents an element in the card body.
type AdaptiveElement struct {
	Type      string         `json:"type"`
	Text      string         `json:"text,omitempty"`
	Size      string         `json:"size,omitempty"`
	Weight    string         `json:"weight,omitempty"`
	Color     string         `json:"color,omitempty"`
	Wrap      bool           `json:"wrap,omitempty"`
	Separator bool           `json:"separator,omitempty"`
	IsSubtle  bool           `json:"isSubtle,omitempty"`
	Facts     []AdaptiveFact `json:"facts,omitempty"`
}

// AdaptiveFact represents a key-value pair in a FactSet.
type AdaptiveFact struct {
	Title string `json:"title"`
	Value string `json:"value"`
}

// AdaptiveAction represents an action button.
type AdaptiveAction struct {
	Type  string `json:"type"`
	Title string `json:"title"`
	URL   string `json:"url,omitempty"`
}
