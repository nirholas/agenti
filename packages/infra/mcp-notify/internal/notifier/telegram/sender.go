// Package telegram provides Telegram Bot API notification sending.
package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
	"golang.org/x/time/rate"

	"github.com/nirholas/mcp-notify/pkg/types"
)

// Config holds Telegram sender configuration.
type Config struct {
	BotToken      string
	RetryAttempts int
	RetryDelay    time.Duration
}

// Sender sends notifications via Telegram Bot API.
type Sender struct {
	httpClient    *http.Client
	botToken      string
	limiter       *rate.Limiter
	retryAttempts int
	retryDelay    time.Duration
}

// NewSender creates a new Telegram sender.
func NewSender(cfg Config) *Sender {
	// Telegram allows 30 messages per second per bot
	limiter := rate.NewLimiter(rate.Limit(30), 5)

	return &Sender{
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		botToken:      cfg.BotToken,
		limiter:       limiter,
		retryAttempts: cfg.RetryAttempts,
		retryDelay:    cfg.RetryDelay,
	}
}

// Type returns the channel type.
func (s *Sender) Type() types.ChannelType {
	return types.ChannelTelegram
}

// Send sends a notification via Telegram Bot API.
func (s *Sender) Send(ctx context.Context, channel *types.Channel, change *types.Change) error {
	// Wait for rate limiter
	if err := s.limiter.Wait(ctx); err != nil {
		return fmt.Errorf("rate limit wait failed: %w", err)
	}

	chatID := channel.Config.TelegramChatID
	if chatID == "" {
		return fmt.Errorf("telegram chat ID not configured")
	}

	// Use channel-specific bot token if provided, otherwise use global
	botToken := channel.Config.TelegramBotToken
	if botToken == "" {
		botToken = s.botToken
	}
	if botToken == "" {
		return fmt.Errorf("telegram bot token not configured")
	}

	// Build message
	message := s.buildMessage(change)

	// Build payload
	payload := TelegramPayload{
		ChatID:    chatID,
		Text:      message,
		ParseMode: "MarkdownV2",
		DisableWebPagePreview: false,
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
			log.Debug().Int("attempt", attempt).Msg("Retrying Telegram notification")
		}

		err := s.sendRequest(ctx, botToken, payload)
		if err == nil {
			return nil
		}
		lastErr = err
	}

	return lastErr
}

func (s *Sender) sendRequest(ctx context.Context, botToken string, payload TelegramPayload) error {
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
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
		var errResp TelegramErrorResponse
		if err := json.NewDecoder(resp.Body).Decode(&errResp); err == nil {
			return fmt.Errorf("telegram API error: %s (code: %d)", errResp.Description, errResp.ErrorCode)
		}
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return nil
}

func (s *Sender) buildMessage(change *types.Change) string {
	var sb strings.Builder

	// Title with emoji
	var emoji, changeTypeText string
	switch change.ChangeType {
	case types.ChangeTypeNew:
		emoji = "🆕"
		changeTypeText = "New"
	case types.ChangeTypeUpdated:
		emoji = "📝"
		changeTypeText = "Updated"
	case types.ChangeTypeRemoved:
		emoji = "🗑️"
		changeTypeText = "Removed"
	}

	// Build message in MarkdownV2 format
	// Note: MarkdownV2 requires escaping special characters
	sb.WriteString(fmt.Sprintf("%s *%s MCP Server*\n\n", emoji, changeTypeText))
	sb.WriteString(fmt.Sprintf("*Server:* `%s`\n", escapeMarkdownV2(change.ServerName)))

	// Description
	if change.Server != nil && change.Server.Description != "" {
		desc := change.Server.Description
		if len(desc) > 200 {
			desc = desc[:197] + "..."
		}
		sb.WriteString(fmt.Sprintf("\n_%s_\n", escapeMarkdownV2(desc)))
	}

	// Version info
	if change.ChangeType == types.ChangeTypeUpdated && change.PreviousVersion != "" && change.NewVersion != "" {
		sb.WriteString(fmt.Sprintf("\n*Version:* `%s` → `%s`\n",
			escapeMarkdownV2(change.PreviousVersion),
			escapeMarkdownV2(change.NewVersion)))
	} else if change.NewVersion != "" {
		sb.WriteString(fmt.Sprintf("\n*Version:* `%s`\n", escapeMarkdownV2(change.NewVersion)))
	}

	// Packages
	if change.Server != nil && len(change.Server.Packages) > 0 {
		sb.WriteString("\n*Packages:* ")
		for i, pkg := range change.Server.Packages {
			if i > 0 {
				sb.WriteString(", ")
			}
			if pkg.URL != "" {
				sb.WriteString(fmt.Sprintf("[%s](%s)", pkg.RegistryType, escapeMarkdownV2URL(pkg.URL)))
			} else {
				sb.WriteString(pkg.RegistryType)
			}
		}
		sb.WriteString("\n")
	}

	// Repository link
	if change.Server != nil && change.Server.Repository != nil && change.Server.Repository.URL != "" {
		sb.WriteString(fmt.Sprintf("\n[View Repository](%s)\n", escapeMarkdownV2URL(change.Server.Repository.URL)))
	}

	// Registry link
	registryURL := fmt.Sprintf("https://registry.modelcontextprotocol.io/servers/%s", change.ServerName)
	sb.WriteString(fmt.Sprintf("[View in Registry](%s)\n", escapeMarkdownV2URL(registryURL)))

	// Footer
	sb.WriteString(fmt.Sprintf("\n_Detected at %s_", escapeMarkdownV2(change.DetectedAt.Format("Jan 2, 2006 15:04 UTC"))))

	return sb.String()
}

// escapeMarkdownV2 escapes special characters for Telegram MarkdownV2.
func escapeMarkdownV2(text string) string {
	// Characters that need escaping in MarkdownV2
	specialChars := []string{"_", "*", "[", "]", "(", ")", "~", "`", ">", "#", "+", "-", "=", "|", "{", "}", ".", "!"}
	result := text
	for _, char := range specialChars {
		result = strings.ReplaceAll(result, char, "\\"+char)
	}
	return result
}

// escapeMarkdownV2URL escapes special characters in URLs for MarkdownV2.
func escapeMarkdownV2URL(url string) string {
	// Only escape ) and \ in URLs
	result := strings.ReplaceAll(url, "\\", "\\\\")
	result = strings.ReplaceAll(result, ")", "\\)")
	return result
}

// SendDigest sends a digest of multiple changes.
func (s *Sender) SendDigest(ctx context.Context, chatID, botToken string, changes []types.Change) error {
	if len(changes) == 0 {
		return nil
	}

	if botToken == "" {
		botToken = s.botToken
	}

	message := s.buildDigestMessage(changes)

	payload := TelegramPayload{
		ChatID:    chatID,
		Text:      message,
		ParseMode: "MarkdownV2",
	}

	return s.sendRequest(ctx, botToken, payload)
}

func (s *Sender) buildDigestMessage(changes []types.Change) string {
	var sb strings.Builder

	sb.WriteString("📋 *MCP Registry Digest*\n\n")
	sb.WriteString(fmt.Sprintf("*%d changes detected*\n\n", len(changes)))

	// Group by type
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

	if newCount > 0 {
		sb.WriteString(fmt.Sprintf("🆕 New: %d\n", newCount))
	}
	if updatedCount > 0 {
		sb.WriteString(fmt.Sprintf("📝 Updated: %d\n", updatedCount))
	}
	if removedCount > 0 {
		sb.WriteString(fmt.Sprintf("🗑️ Removed: %d\n", removedCount))
	}

	sb.WriteString("\n*Changes:*\n")

	// List changes (limit to first 10)
	limit := 10
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
		sb.WriteString(fmt.Sprintf("• %s `%s`\n", emoji, escapeMarkdownV2(change.ServerName)))
	}

	if len(changes) > limit {
		sb.WriteString(fmt.Sprintf("\n_\\.\\.\\. and %d more_\n", len(changes)-limit))
	}

	sb.WriteString(fmt.Sprintf("\n_Generated at %s_", escapeMarkdownV2(time.Now().Format("Jan 2, 2006 15:04 UTC"))))

	return sb.String()
}

// Telegram API types

// TelegramPayload is the request body for sendMessage.
type TelegramPayload struct {
	ChatID                string `json:"chat_id"`
	Text                  string `json:"text"`
	ParseMode             string `json:"parse_mode,omitempty"`
	DisableWebPagePreview bool   `json:"disable_web_page_preview,omitempty"`
	DisableNotification   bool   `json:"disable_notification,omitempty"`
	ReplyToMessageID      int    `json:"reply_to_message_id,omitempty"`
}

// TelegramErrorResponse is the error response from Telegram API.
type TelegramErrorResponse struct {
	OK          bool   `json:"ok"`
	ErrorCode   int    `json:"error_code"`
	Description string `json:"description"`
}
