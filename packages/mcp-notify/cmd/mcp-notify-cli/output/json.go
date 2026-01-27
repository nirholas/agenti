package output

import (
	"github.com/nirholas/mcp-notify/pkg/types"
)

// JSONFormatter formats output as JSON.
type JSONFormatter struct {
	BaseFormatter
}

// NewJSONFormatter creates a new JSON formatter.
func NewJSONFormatter() *JSONFormatter {
	return &JSONFormatter{}
}

// FormatChanges formats changes as JSON.
func (f *JSONFormatter) FormatChanges(changes []types.Change) string {
	if changes == nil {
		changes = []types.Change{}
	}
	out, err := prettyJSON(changes)
	if err != nil {
		return `{"error": "failed to format changes"}`
	}
	return out
}

// FormatSubscriptions formats subscriptions as JSON.
func (f *JSONFormatter) FormatSubscriptions(subscriptions []types.Subscription) string {
	if subscriptions == nil {
		subscriptions = []types.Subscription{}
	}
	out, err := prettyJSON(subscriptions)
	if err != nil {
		return `{"error": "failed to format subscriptions"}`
	}
	return out
}

// FormatSubscription formats a single subscription as JSON.
func (f *JSONFormatter) FormatSubscription(subscription *types.Subscription) string {
	if subscription == nil {
		return `null`
	}
	out, err := prettyJSON(subscription)
	if err != nil {
		return `{"error": "failed to format subscription"}`
	}
	return out
}

// FormatServers formats servers as JSON.
func (f *JSONFormatter) FormatServers(servers []types.Server) string {
	if servers == nil {
		servers = []types.Server{}
	}
	out, err := prettyJSON(servers)
	if err != nil {
		return `{"error": "failed to format servers"}`
	}
	return out
}

// FormatServer formats a single server as JSON.
func (f *JSONFormatter) FormatServer(server *types.Server) string {
	if server == nil {
		return `null`
	}
	out, err := prettyJSON(server)
	if err != nil {
		return `{"error": "failed to format server"}`
	}
	return out
}

// FormatDiff formats a diff result as JSON.
func (f *JSONFormatter) FormatDiff(diff *types.DiffResult) string {
	if diff == nil {
		return `null`
	}
	out, err := prettyJSON(diff)
	if err != nil {
		return `{"error": "failed to format diff"}`
	}
	return out
}
