// Package email provides email notification sending via SMTP.
package email

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"html/template"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
	"gopkg.in/gomail.v2"

	"github.com/nirholas/mcp-notify/pkg/types"
)

// Config holds email sender configuration.
type Config struct {
	SMTPHost       string
	SMTPPort       int
	SMTPUsername   string
	SMTPPassword   string
	FromAddress    string
	TLS            bool
	RetryAttempts  int
	RetryDelay     time.Duration
	UnsubscribeURL string // Base URL for unsubscribe links
	SecretKey      string // For signing unsubscribe tokens
}

// Sender sends notifications via email.
type Sender struct {
	dialer         *gomail.Dialer
	fromAddress    string
	retryAttempts  int
	retryDelay     time.Duration
	htmlTemplate   *template.Template
	textTemplate   *template.Template
	digestHtmlTmpl *template.Template
	digestTextTmpl *template.Template
	unsubscribeURL string
	secretKey      string
}

// Template function map for proper HTML escaping and utilities
var templateFuncs = template.FuncMap{
	"lower": strings.ToLower,
	"upper": strings.ToUpper,
	"truncate": func(s string, max int) string {
		if len(s) <= max {
			return s
		}
		return s[:max-3] + "..."
	},
	"formatTime": func(t time.Time) string {
		return t.Format("Jan 2, 2006 at 3:04 PM UTC")
	},
}

// NewSender creates a new email sender.
func NewSender(cfg Config) (*Sender, error) {
	dialer := gomail.NewDialer(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUsername, cfg.SMTPPassword)
	
	if cfg.TLS {
		dialer.TLSConfig = &tls.Config{
			ServerName: cfg.SMTPHost,
		}
	}

	// Parse email templates with custom functions
	htmlTmpl, err := template.New("email_html").Funcs(templateFuncs).Parse(htmlEmailTemplate)
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML template: %w", err)
	}

	textTmpl, err := template.New("email_text").Funcs(templateFuncs).Parse(textEmailTemplate)
	if err != nil {
		return nil, fmt.Errorf("failed to parse text template: %w", err)
	}

	digestHtmlTmpl, err := template.New("digest_html").Funcs(templateFuncs).Parse(digestHtmlEmailTemplate)
	if err != nil {
		return nil, fmt.Errorf("failed to parse digest HTML template: %w", err)
	}

	digestTextTmpl, err := template.New("digest_text").Funcs(templateFuncs).Parse(digestTextEmailTemplate)
	if err != nil {
		return nil, fmt.Errorf("failed to parse digest text template: %w", err)
	}

	return &Sender{
		dialer:         dialer,
		fromAddress:    cfg.FromAddress,
		retryAttempts:  cfg.RetryAttempts,
		retryDelay:     cfg.RetryDelay,
		htmlTemplate:   htmlTmpl,
		textTemplate:   textTmpl,
		digestHtmlTmpl: digestHtmlTmpl,
		digestTextTmpl: digestTextTmpl,
		unsubscribeURL: cfg.UnsubscribeURL,
		secretKey:      cfg.SecretKey,
	}, nil
}

// Type returns the channel type.
func (s *Sender) Type() types.ChannelType {
	return types.ChannelEmail
}

// Send sends a notification via email.
func (s *Sender) Send(ctx context.Context, channel *types.Channel, change *types.Change) error {
	toAddress := channel.Config.EmailAddress
	if toAddress == "" {
		return fmt.Errorf("email address not configured")
	}

	// Build email content
	data := s.buildEmailData(change)
	
	// Add unsubscribe URL if configured
	if s.unsubscribeURL != "" {
		data.UnsubscribeURL = s.generateUnsubscribeLink(channel.SubscriptionID.String(), toAddress)
	}

	var htmlBody bytes.Buffer
	if err := s.htmlTemplate.Execute(&htmlBody, data); err != nil {
		return fmt.Errorf("failed to render HTML template: %w", err)
	}

	var textBody bytes.Buffer
	if err := s.textTemplate.Execute(&textBody, data); err != nil {
		return fmt.Errorf("failed to render text template: %w", err)
	}

	// Create message with proper MIME headers
	m := gomail.NewMessage()
	m.SetHeader("From", s.fromAddress)
	m.SetHeader("To", toAddress)
	m.SetHeader("Subject", data.Subject)
	m.SetHeader("X-Mailer", "MCP-Notify/1.0")
	m.SetHeader("List-Unsubscribe-Post", "List-Unsubscribe=One-Click")
	
	if data.UnsubscribeURL != "" {
		m.SetHeader("List-Unsubscribe", fmt.Sprintf("<%s>", data.UnsubscribeURL))
	}
	
	// Set both plain text and HTML parts (multipart/alternative)
	m.SetBody("text/plain", textBody.String())
	m.AddAlternative("text/html", htmlBody.String())

	// Send with retries
	var lastErr error
	for attempt := 0; attempt <= s.retryAttempts; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(s.retryDelay * time.Duration(attempt)):
			}
			log.Debug().Int("attempt", attempt).Msg("Retrying email notification")
		}

		err := s.dialer.DialAndSend(m)
		if err == nil {
			return nil
		}
		lastErr = err
	}

	return lastErr
}

// SendDigest sends a digest email with multiple changes.
func (s *Sender) SendDigest(ctx context.Context, toAddress string, changes []types.Change, frequency types.DigestFrequency) error {
	if len(changes) == 0 {
		return nil
	}

	data := s.buildDigestData(changes, frequency)

	var htmlBody bytes.Buffer
	if err := s.digestHtmlTmpl.Execute(&htmlBody, data); err != nil {
		return fmt.Errorf("failed to render HTML template: %w", err)
	}

	var textBody bytes.Buffer
	if err := s.digestTextTmpl.Execute(&textBody, data); err != nil {
		return fmt.Errorf("failed to render text template: %w", err)
	}

	m := gomail.NewMessage()
	m.SetHeader("From", s.fromAddress)
	m.SetHeader("To", toAddress)
	m.SetHeader("Subject", data.Subject)
	m.SetHeader("X-Mailer", "MCP-Notify/1.0")
	m.SetBody("text/plain", textBody.String())
	m.AddAlternative("text/html", htmlBody.String())

	// Send with retries
	var lastErr error
	for attempt := 0; attempt <= s.retryAttempts; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(s.retryDelay * time.Duration(attempt)):
			}
			log.Debug().Int("attempt", attempt).Msg("Retrying digest email")
		}

		err := s.dialer.DialAndSend(m)
		if err == nil {
			return nil
		}
		lastErr = err
	}

	return lastErr
}

// generateUnsubscribeLink generates a signed unsubscribe link.
func (s *Sender) generateUnsubscribeLink(subscriptionID, email string) string {
	if s.unsubscribeURL == "" {
		return ""
	}

	// Create a signed token
	token := s.signToken(subscriptionID, email)
	return fmt.Sprintf("%s?sub=%s&token=%s", s.unsubscribeURL, subscriptionID, token)
}

// signToken creates an HMAC signature for the unsubscribe token.
func (s *Sender) signToken(subscriptionID, email string) string {
	if s.secretKey == "" {
		// No secret key, use base64 encoding only (not secure, but functional)
		return base64.URLEncoding.EncodeToString([]byte(subscriptionID + ":" + email))
	}

	mac := hmac.New(sha256.New, []byte(s.secretKey))
	mac.Write([]byte(subscriptionID + ":" + email))
	return base64.URLEncoding.EncodeToString(mac.Sum(nil))
}

// SendDigestToChannel sends a digest to a specific channel.
func (s *Sender) SendDigestToChannel(ctx context.Context, channel *types.Channel, changes []types.Change, frequency types.DigestFrequency) error {
	toAddress := channel.Config.EmailAddress
	if toAddress == "" {
		return fmt.Errorf("email address not configured")
	}
	return s.SendDigest(ctx, toAddress, changes, frequency)
}

// EmailData holds data for email templates.
type EmailData struct {
	Subject       string
	Title         string
	Preheader     string
	Changes       []ChangeData
	TotalChanges  int
	NewCount      int
	UpdatedCount  int
	RemovedCount  int
	DigestPeriod  string
	RegistryURL   string
	UnsubscribeURL string
	Timestamp     string
}

// ChangeData holds data for a single change in email templates.
type ChangeData struct {
	ServerName      string
	Description     string
	ChangeType      string
	ChangeTypeEmoji string
	Version         string
	PreviousVersion string
	VersionChange   string
	Packages        []PackageData
	RepositoryURL   string
	RegistryURL     string
	DetectedAt      string
}

// PackageData holds package data for email templates.
type PackageData struct {
	Type string
	URL  string
}

func (s *Sender) buildEmailData(change *types.Change) EmailData {
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

	changeData := ChangeData{
		ServerName:      change.ServerName,
		ChangeType:      changeTypeText,
		ChangeTypeEmoji: emoji,
		Version:         change.NewVersion,
		PreviousVersion: change.PreviousVersion,
		RegistryURL:     fmt.Sprintf("https://registry.modelcontextprotocol.io/servers/%s", change.ServerName),
		DetectedAt:      change.DetectedAt.Format("Jan 2, 2006 at 3:04 PM UTC"),
	}

	if change.PreviousVersion != "" && change.NewVersion != "" {
		changeData.VersionChange = fmt.Sprintf("%s → %s", change.PreviousVersion, change.NewVersion)
	}

	if change.Server != nil {
		changeData.Description = change.Server.Description
		if change.Server.Repository != nil {
			changeData.RepositoryURL = change.Server.Repository.URL
		}
		for _, pkg := range change.Server.Packages {
			changeData.Packages = append(changeData.Packages, PackageData{
				Type: pkg.RegistryType,
				URL:  pkg.URL,
			})
		}
	}

	return EmailData{
		Subject:      fmt.Sprintf("%s MCP Server %s: %s", emoji, changeTypeText, change.ServerName),
		Title:        fmt.Sprintf("MCP Server %s", changeTypeText),
		Preheader:    fmt.Sprintf("%s has been %s in the MCP Registry", change.ServerName, changeTypeText),
		Changes:      []ChangeData{changeData},
		TotalChanges: 1,
		RegistryURL:  "https://registry.modelcontextprotocol.io",
		Timestamp:    time.Now().Format("Jan 2, 2006 at 3:04 PM UTC"),
	}
}

func (s *Sender) buildDigestData(changes []types.Change, frequency types.DigestFrequency) EmailData {
	var newCount, updatedCount, removedCount int
	var changeDataList []ChangeData

	for _, change := range changes {
		switch change.ChangeType {
		case types.ChangeTypeNew:
			newCount++
		case types.ChangeTypeUpdated:
			updatedCount++
		case types.ChangeTypeRemoved:
			removedCount++
		}

		changeData := ChangeData{
			ServerName: change.ServerName,
			ChangeType: string(change.ChangeType),
		}

		if change.Server != nil {
			changeData.Description = change.Server.Description
		}

		changeDataList = append(changeDataList, changeData)
	}

	var period string
	switch frequency {
	case types.DigestHourly:
		period = "Last Hour"
	case types.DigestDaily:
		period = "Today"
	case types.DigestWeekly:
		period = "This Week"
	}

	return EmailData{
		Subject:      fmt.Sprintf("MCP Registry Digest: %d changes (%s)", len(changes), period),
		Title:        "MCP Registry Digest",
		Preheader:    fmt.Sprintf("%d changes detected in the MCP Registry", len(changes)),
		Changes:      changeDataList,
		TotalChanges: len(changes),
		NewCount:     newCount,
		UpdatedCount: updatedCount,
		RemovedCount: removedCount,
		DigestPeriod: period,
		RegistryURL:  "https://registry.modelcontextprotocol.io",
		Timestamp:    time.Now().Format("Jan 2, 2006 at 3:04 PM UTC"),
	}
}

// Email templates

const htmlEmailTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{.Title}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: white; border-radius: 8px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px 8px 0 0; padding: 24px; margin: -24px -24px 24px -24px; }
    .title { font-size: 24px; font-weight: bold; margin: 0; }
    .change-type { display: inline-block; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .change-type-new { background: #d4edda; color: #155724; }
    .change-type-updated { background: #cce5ff; color: #004085; }
    .change-type-removed { background: #f8d7da; color: #721c24; }
    .server-name { font-size: 18px; font-weight: 600; color: #333; margin: 12px 0; }
    .description { color: #666; margin: 8px 0; }
    .version { font-family: monospace; background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }
    .btn { display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1 class="title">{{.Title}}</h1>
      </div>
      
      {{range .Changes}}
      <div style="margin-bottom: 24px;">
        <span class="change-type change-type-{{.ChangeType | lower}}">{{.ChangeTypeEmoji}} {{.ChangeType}}</span>
        <div class="server-name">{{.ServerName}}</div>
        {{if .Description}}<p class="description">{{.Description}}</p>{{end}}
        {{if .VersionChange}}<p>Version: <span class="version">{{.VersionChange}}</span></p>{{end}}
        {{if .Version}}<p>Version: <span class="version">{{.Version}}</span></p>{{end}}
        <a href="{{.RegistryURL}}" class="btn">View in Registry</a>
      </div>
      {{end}}
    </div>
    
    <div class="footer">
      <p>You're receiving this because you subscribed to MCP Notify.</p>
      <p>Generated at {{.Timestamp}}</p>
    </div>
  </div>
</body>
</html>`

const textEmailTemplate = `{{.Title}}

{{range .Changes}}
{{.ChangeTypeEmoji}} {{.ChangeType}}: {{.ServerName}}
{{if .Description}}{{.Description}}{{end}}
{{if .VersionChange}}Version: {{.VersionChange}}{{end}}
{{if .Version}}Version: {{.Version}}{{end}}
View in Registry: {{.RegistryURL}}

{{end}}
---
You're receiving this because you subscribed to MCP Notify.
Generated at {{.Timestamp}}
{{if .UnsubscribeURL}}
To unsubscribe, visit: {{.UnsubscribeURL}}
{{end}}`

// Digest-specific templates for batch notifications

const digestHtmlEmailTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{.Title}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: white; border-radius: 8px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px 8px 0 0; padding: 24px; margin: -24px -24px 24px -24px; }
    .title { font-size: 24px; font-weight: bold; margin: 0; }
    .subtitle { font-size: 14px; opacity: 0.9; margin-top: 8px; }
    .stats { display: flex; gap: 16px; margin: 16px 0; padding: 16px; background: #f8f9fa; border-radius: 8px; }
    .stat { text-align: center; flex: 1; }
    .stat-value { font-size: 24px; font-weight: bold; color: #333; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .change-item { padding: 12px 0; border-bottom: 1px solid #eee; }
    .change-item:last-child { border-bottom: none; }
    .change-type { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-right: 8px; }
    .change-type-new { background: #d4edda; color: #155724; }
    .change-type-updated { background: #cce5ff; color: #004085; }
    .change-type-removed { background: #f8d7da; color: #721c24; }
    .server-name { font-weight: 600; color: #333; }
    .btn { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; margin-top: 16px; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 24px; }
    .unsubscribe { color: #667eea; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1 class="title">📋 {{.Title}}</h1>
        <p class="subtitle">{{.DigestPeriod}} - {{.TotalChanges}} changes detected</p>
      </div>
      
      <div class="stats">
        {{if gt .NewCount 0}}
        <div class="stat">
          <div class="stat-value">{{.NewCount}}</div>
          <div class="stat-label">🆕 New</div>
        </div>
        {{end}}
        {{if gt .UpdatedCount 0}}
        <div class="stat">
          <div class="stat-value">{{.UpdatedCount}}</div>
          <div class="stat-label">📝 Updated</div>
        </div>
        {{end}}
        {{if gt .RemovedCount 0}}
        <div class="stat">
          <div class="stat-value">{{.RemovedCount}}</div>
          <div class="stat-label">🗑️ Removed</div>
        </div>
        {{end}}
      </div>

      <h2 style="font-size: 16px; color: #333; margin-bottom: 12px;">Changes</h2>
      
      {{range .Changes}}
      <div class="change-item">
        <span class="change-type change-type-{{.ChangeType | lower}}">{{.ChangeType}}</span>
        <span class="server-name">{{.ServerName}}</span>
        {{if .Description}}<p style="margin: 4px 0 0; font-size: 13px; color: #666;">{{.Description | truncate 100}}</p>{{end}}
      </div>
      {{end}}

      <a href="{{.RegistryURL}}" class="btn">View All in Registry</a>
    </div>
    
    <div class="footer">
      <p>You're receiving this digest because you subscribed to MCP Notify.</p>
      <p>Generated at {{.Timestamp}}</p>
      {{if .UnsubscribeURL}}<p><a href="{{.UnsubscribeURL}}" class="unsubscribe">Unsubscribe</a></p>{{end}}
    </div>
  </div>
</body>
</html>`

const digestTextEmailTemplate = `{{.Title}}
{{.DigestPeriod}} - {{.TotalChanges}} changes detected

Summary:
{{if gt .NewCount 0}}- New: {{.NewCount}} servers{{end}}
{{if gt .UpdatedCount 0}}- Updated: {{.UpdatedCount}} servers{{end}}
{{if gt .RemovedCount 0}}- Removed: {{.RemovedCount}} servers{{end}}

Changes:
{{range .Changes}}
• {{.ChangeType}}: {{.ServerName}}
{{end}}

View all changes: {{.RegistryURL}}

---
You're receiving this digest because you subscribed to MCP Notify.
Generated at {{.Timestamp}}
{{if .UnsubscribeURL}}
To unsubscribe, visit: {{.UnsubscribeURL}}
{{end}}`
