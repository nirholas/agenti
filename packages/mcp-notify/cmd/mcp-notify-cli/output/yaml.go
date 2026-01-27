package output

import (
	"github.com/nirholas/mcp-notify/pkg/types"
)

// YAMLFormatter formats output as YAML.
type YAMLFormatter struct {
	BaseFormatter
}

// NewYAMLFormatter creates a new YAML formatter.
func NewYAMLFormatter() *YAMLFormatter {
	return &YAMLFormatter{}
}

// FormatChanges formats changes as YAML.
func (f *YAMLFormatter) FormatChanges(changes []types.Change) string {
	if changes == nil {
		changes = []types.Change{}
	}
	out, err := prettyYAML(changes)
	if err != nil {
		return "error: failed to format changes"
	}
	return out
}

// FormatSubscriptions formats subscriptions as YAML.
func (f *YAMLFormatter) FormatSubscriptions(subscriptions []types.Subscription) string {
	if subscriptions == nil {
		subscriptions = []types.Subscription{}
	}
	out, err := prettyYAML(subscriptions)
	if err != nil {
		return "error: failed to format subscriptions"
	}
	return out
}

// FormatSubscription formats a single subscription as YAML.
func (f *YAMLFormatter) FormatSubscription(subscription *types.Subscription) string {
	if subscription == nil {
		return "null"
	}
	out, err := prettyYAML(subscription)
	if err != nil {
		return "error: failed to format subscription"
	}
	return out
}

// FormatServers formats servers as YAML.
func (f *YAMLFormatter) FormatServers(servers []types.Server) string {
	if servers == nil {
		servers = []types.Server{}
	}
	out, err := prettyYAML(servers)
	if err != nil {
		return "error: failed to format servers"
	}
	return out
}

// FormatServer formats a single server as YAML.
func (f *YAMLFormatter) FormatServer(server *types.Server) string {
	if server == nil {
		return "null"
	}
	out, err := prettyYAML(server)
	if err != nil {
		return "error: failed to format server"
	}
	return out
}

// FormatDiff formats a diff result as YAML.
func (f *YAMLFormatter) FormatDiff(diff *types.DiffResult) string {
	if diff == nil {
		return "null"
	}
	out, err := prettyYAML(diff)
	if err != nil {
		return "error: failed to format diff"
	}
	return out
}
