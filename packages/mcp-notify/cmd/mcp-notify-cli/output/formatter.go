// Package output provides formatters for CLI output.
package output

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"gopkg.in/yaml.v3"

	"github.com/nirholas/mcp-notify/pkg/types"
)

// Formatter defines the interface for output formatting.
type Formatter interface {
	// FormatChanges formats a list of changes.
	FormatChanges(changes []types.Change) string

	// FormatSubscriptions formats a list of subscriptions.
	FormatSubscriptions(subscriptions []types.Subscription) string

	// FormatSubscription formats a single subscription with details.
	FormatSubscription(subscription *types.Subscription) string

	// FormatServers formats a list of servers.
	FormatServers(servers []types.Server) string

	// FormatServer formats a single server with details.
	FormatServer(server *types.Server) string

	// FormatDiff formats a diff result.
	FormatDiff(diff *types.DiffResult) string

	// SetWriter sets the output writer.
	SetWriter(w io.Writer)

	// SetNoColor disables color output.
	SetNoColor(noColor bool)
}

// NewFormatter creates a new formatter based on the format string.
func NewFormatter(format string) Formatter {
	switch strings.ToLower(format) {
	case "json":
		return NewJSONFormatter()
	case "yaml", "yml":
		return NewYAMLFormatter()
	default:
		return NewTableFormatter()
	}
}

// BaseFormatter provides common functionality.
type BaseFormatter struct {
	writer  io.Writer
	noColor bool
}

// SetWriter sets the output writer.
func (f *BaseFormatter) SetWriter(w io.Writer) {
	f.writer = w
}

// SetNoColor disables color output.
func (f *BaseFormatter) SetNoColor(noColor bool) {
	f.noColor = noColor
}

// GetWriter returns the writer, defaulting to stdout.
func (f *BaseFormatter) GetWriter() io.Writer {
	if f.writer == nil {
		return os.Stdout
	}
	return f.writer
}

// HumanDuration converts a duration to a human-readable string.
func HumanDuration(t time.Time) string {
	d := time.Since(t)
	if d < 0 {
		d = -d
	}

	switch {
	case d < time.Minute:
		return "just now"
	case d < time.Hour:
		minutes := int(d.Minutes())
		if minutes == 1 {
			return "1 minute ago"
		}
		return fmt.Sprintf("%d minutes ago", minutes)
	case d < 24*time.Hour:
		hours := int(d.Hours())
		if hours == 1 {
			return "1 hour ago"
		}
		return fmt.Sprintf("%d hours ago", hours)
	case d < 7*24*time.Hour:
		days := int(d.Hours() / 24)
		if days == 1 {
			return "1 day ago"
		}
		return fmt.Sprintf("%d days ago", days)
	case d < 30*24*time.Hour:
		weeks := int(d.Hours() / (24 * 7))
		if weeks == 1 {
			return "1 week ago"
		}
		return fmt.Sprintf("%d weeks ago", weeks)
	default:
		months := int(d.Hours() / (24 * 30))
		if months == 1 {
			return "1 month ago"
		}
		return fmt.Sprintf("%d months ago", months)
	}
}

// TruncateString truncates a string to the specified length.
func TruncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	if maxLen <= 3 {
		return s[:maxLen]
	}
	return s[:maxLen-3] + "..."
}

// GetChangeTypeSymbol returns a symbol for a change type.
func GetChangeTypeSymbol(changeType types.ChangeType) string {
	switch changeType {
	case types.ChangeTypeNew:
		return "+"
	case types.ChangeTypeUpdated:
		return "~"
	case types.ChangeTypeRemoved:
		return "-"
	default:
		return "?"
	}
}

// GetStatusSymbol returns a symbol for subscription status.
func GetStatusSymbol(status types.SubscriptionStatus) string {
	switch status {
	case types.SubscriptionStatusActive:
		return "●"
	case types.SubscriptionStatusPaused:
		return "○"
	case types.SubscriptionStatusExpired:
		return "×"
	default:
		return "?"
	}
}

// prettyJSON formats JSON with indentation.
func prettyJSON(v interface{}) (string, error) {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// prettyYAML formats YAML.
func prettyYAML(v interface{}) (string, error) {
	data, err := yaml.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
