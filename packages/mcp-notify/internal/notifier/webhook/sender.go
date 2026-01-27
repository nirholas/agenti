// Package webhook provides generic HTTP webhook notification sending.
package webhook

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/nirholas/mcp-notify/pkg/types"
)

// Config holds webhook sender configuration.
type Config struct {
	Timeout       time.Duration
	RetryAttempts int
	RetryDelay    time.Duration
	MaxBodySize   int64
}

// Sender sends notifications via generic HTTP webhooks.
type Sender struct {
	httpClient    *http.Client
	retryAttempts int
	retryDelay    time.Duration
	maxBodySize   int64
}

// NewSender creates a new webhook sender.
func NewSender(cfg Config) *Sender {
	return &Sender{
		httpClient: &http.Client{
			Timeout: cfg.Timeout,
		},
		retryAttempts: cfg.RetryAttempts,
		retryDelay:    cfg.RetryDelay,
		maxBodySize:   cfg.MaxBodySize,
	}
}

// Type returns the channel type.
func (s *Sender) Type() types.ChannelType {
	return types.ChannelWebhook
}

// Send sends a notification via HTTP webhook.
func (s *Sender) Send(ctx context.Context, channel *types.Channel, change *types.Change) error {
	webhookURL := channel.Config.WebhookURL
	if webhookURL == "" {
		return fmt.Errorf("webhook URL not configured")
	}

	method := channel.Config.WebhookMethod
	if method == "" {
		method = http.MethodPost
	}

	// Build payload
	payload := s.buildPayload(change)

	var lastErr error
	for attempt := 0; attempt <= s.retryAttempts; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(s.retryDelay * time.Duration(attempt)):
			}
			log.Debug().Int("attempt", attempt).Msg("Retrying webhook notification")
		}

		err := s.sendRequest(ctx, method, webhookURL, payload, channel.Config)
		if err == nil {
			return nil
		}
		lastErr = err
	}

	return lastErr
}

func (s *Sender) sendRequest(ctx context.Context, method, url string, payload WebhookPayload, config types.ChannelConfig) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "MCP-Notify/1.0")

	// Add custom headers
	for k, v := range config.WebhookHeaders {
		req.Header.Set(k, v)
	}

	// Add HMAC signature if secret is configured
	if config.WebhookSecret != "" {
		signature := s.computeSignature(body, config.WebhookSecret)
		req.Header.Set("X-Signature-256", "sha256="+signature)
		req.Header.Set("X-Hub-Signature-256", "sha256="+signature) // GitHub-style
	}

	// Add timestamp for replay protection
	timestamp := time.Now().Unix()
	req.Header.Set("X-Timestamp", fmt.Sprintf("%d", timestamp))

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response body (limited)
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, s.maxBodySize))

	// Check status code
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

func (s *Sender) computeSignature(body []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(body)
	return hex.EncodeToString(h.Sum(nil))
}

func (s *Sender) buildPayload(change *types.Change) WebhookPayload {
	// Determine event type
	var eventType string
	switch change.ChangeType {
	case types.ChangeTypeNew:
		eventType = "server.new"
	case types.ChangeTypeUpdated:
		eventType = "server.updated"
	case types.ChangeTypeRemoved:
		eventType = "server.removed"
	}

	// Build field changes
	var fieldChanges []FieldChange
	for _, fc := range change.FieldChanges {
		fieldChanges = append(fieldChanges, FieldChange{
			Field:    fc.Field,
			OldValue: fc.OldValue,
			NewValue: fc.NewValue,
		})
	}

	return WebhookPayload{
		EventType:   eventType,
		EventID:     change.ID.String(),
		Timestamp:   change.DetectedAt,
		Server:      s.buildServerPayload(change),
		Changes:     fieldChanges,
		RegistryURL: fmt.Sprintf("https://registry.modelcontextprotocol.io/v0/servers/%s", change.ServerName),
	}
}

func (s *Sender) buildServerPayload(change *types.Change) *ServerPayload {
	server := change.Server
	if server == nil {
		server = change.PreviousServer
	}
	if server == nil {
		return &ServerPayload{
			Name: change.ServerName,
		}
	}

	payload := &ServerPayload{
		Name:            server.Name,
		Description:     server.Description,
		Version:         change.NewVersion,
		PreviousVersion: change.PreviousVersion,
	}

	if server.Repository != nil {
		payload.Repository = &RepositoryPayload{
			URL:    server.Repository.URL,
			Source: server.Repository.Source,
		}
	}

	for _, pkg := range server.Packages {
		payload.Packages = append(payload.Packages, PackagePayload{
			RegistryType: pkg.RegistryType,
			Name:         pkg.Name,
			Version:      pkg.Version,
			URL:          pkg.URL,
		})
	}

	for _, remote := range server.Remotes {
		payload.Remotes = append(payload.Remotes, RemotePayload{
			TransportType: remote.TransportType,
			URL:           remote.URL,
		})
	}

	return payload
}

// Webhook payload types

type WebhookPayload struct {
	EventType   string         `json:"event_type"`
	EventID     string         `json:"event_id"`
	Timestamp   time.Time      `json:"timestamp"`
	Server      *ServerPayload `json:"server"`
	Changes     []FieldChange  `json:"changes,omitempty"`
	RegistryURL string         `json:"registry_url"`
}

type ServerPayload struct {
	Name            string            `json:"name"`
	Description     string            `json:"description,omitempty"`
	Version         string            `json:"version,omitempty"`
	PreviousVersion string            `json:"previous_version,omitempty"`
	Repository      *RepositoryPayload `json:"repository,omitempty"`
	Packages        []PackagePayload  `json:"packages,omitempty"`
	Remotes         []RemotePayload   `json:"remotes,omitempty"`
}

type RepositoryPayload struct {
	URL    string `json:"url"`
	Source string `json:"source"`
}

type PackagePayload struct {
	RegistryType string `json:"registry_type"`
	Name         string `json:"name"`
	Version      string `json:"version,omitempty"`
	URL          string `json:"url,omitempty"`
}

type RemotePayload struct {
	TransportType string `json:"transport_type"`
	URL           string `json:"url"`
}

type FieldChange struct {
	Field    string      `json:"field"`
	OldValue interface{} `json:"old_value,omitempty"`
	NewValue interface{} `json:"new_value,omitempty"`
}
