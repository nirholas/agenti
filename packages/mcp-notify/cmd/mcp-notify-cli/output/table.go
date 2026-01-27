package output

import (
	"fmt"
	"io"
	"os"
	"strings"
	"text/tabwriter"

	"github.com/nirholas/mcp-notify/pkg/types"
)

// Color codes for terminal output.
const (
	ColorReset   = "\033[0m"
	ColorRed     = "\033[31m"
	ColorGreen   = "\033[32m"
	ColorYellow  = "\033[33m"
	ColorBlue    = "\033[34m"
	ColorMagenta = "\033[35m"
	ColorCyan    = "\033[36m"
	ColorWhite   = "\033[37m"
	ColorBold    = "\033[1m"
	ColorDim     = "\033[2m"
)

// TableFormatter formats output as aligned tables.
type TableFormatter struct {
	BaseFormatter
}

// NewTableFormatter creates a new table formatter.
func NewTableFormatter() *TableFormatter {
	return &TableFormatter{}
}

// color applies color if not disabled.
func (f *TableFormatter) color(c, text string) string {
	if f.noColor {
		return text
	}
	return c + text + ColorReset
}

// FormatChanges formats changes as a table.
func (f *TableFormatter) FormatChanges(changes []types.Change) string {
	if len(changes) == 0 {
		return f.color(ColorDim, "No changes found.")
	}

	var sb strings.Builder
	w := tabwriter.NewWriter(&sb, 0, 0, 2, ' ', 0)

	// Header
	fmt.Fprintln(w, f.color(ColorBold, "TYPE\tSERVER\tVERSION\tDETECTED"))

	for _, change := range changes {
		typeStr := f.formatChangeType(change.ChangeType)
		serverName := TruncateString(change.ServerName, 50)
		version := f.formatVersion(change)
		detected := HumanDuration(change.DetectedAt)

		fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", typeStr, serverName, version, detected)
	}

	w.Flush()
	return sb.String()
}

func (f *TableFormatter) formatChangeType(ct types.ChangeType) string {
	switch ct {
	case types.ChangeTypeNew:
		return f.color(ColorGreen, "new")
	case types.ChangeTypeUpdated:
		return f.color(ColorYellow, "updated")
	case types.ChangeTypeRemoved:
		return f.color(ColorRed, "removed")
	default:
		return string(ct)
	}
}

func (f *TableFormatter) formatVersion(change types.Change) string {
	if change.ChangeType == types.ChangeTypeNew {
		return change.NewVersion
	}
	if change.ChangeType == types.ChangeTypeRemoved {
		return f.color(ColorDim, change.PreviousVersion)
	}
	if change.PreviousVersion != "" && change.NewVersion != "" {
		return fmt.Sprintf("%s → %s", change.PreviousVersion, change.NewVersion)
	}
	if change.NewVersion != "" {
		return change.NewVersion
	}
	return f.color(ColorDim, "-")
}

// FormatSubscriptions formats subscriptions as a table.
func (f *TableFormatter) FormatSubscriptions(subscriptions []types.Subscription) string {
	if len(subscriptions) == 0 {
		return f.color(ColorDim, "No subscriptions found.")
	}

	var sb strings.Builder
	w := tabwriter.NewWriter(&sb, 0, 0, 2, ' ', 0)

	// Header
	fmt.Fprintln(w, f.color(ColorBold, "STATUS\tID\tNAME\tCHANNELS\tCREATED"))

	for _, sub := range subscriptions {
		status := f.formatStatus(sub.Status)
		idShort := sub.ID.String()[:8] + "..."
		name := TruncateString(sub.Name, 30)
		channels := f.formatChannelCount(sub.Channels)
		created := HumanDuration(sub.CreatedAt)

		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", status, idShort, name, channels, created)
	}

	w.Flush()
	return sb.String()
}

func (f *TableFormatter) formatStatus(status types.SubscriptionStatus) string {
	switch status {
	case types.SubscriptionStatusActive:
		return f.color(ColorGreen, "● active")
	case types.SubscriptionStatusPaused:
		return f.color(ColorYellow, "○ paused")
	case types.SubscriptionStatusExpired:
		return f.color(ColorRed, "× expired")
	default:
		return string(status)
	}
}

func (f *TableFormatter) formatChannelCount(channels []types.Channel) string {
	if len(channels) == 0 {
		return f.color(ColorDim, "none")
	}

	types := make([]string, 0, len(channels))
	for _, ch := range channels {
		if ch.Enabled {
			types = append(types, string(ch.Type))
		}
	}

	if len(types) == 0 {
		return f.color(ColorDim, "none enabled")
	}

	return strings.Join(types, ", ")
}

// FormatSubscription formats a single subscription with full details.
func (f *TableFormatter) FormatSubscription(sub *types.Subscription) string {
	if sub == nil {
		return f.color(ColorDim, "Subscription not found.")
	}

	var sb strings.Builder

	sb.WriteString(f.color(ColorBold, "Subscription Details\n"))
	sb.WriteString(strings.Repeat("─", 40) + "\n")

	fmt.Fprintf(&sb, "%-15s %s\n", "ID:", sub.ID.String())
	fmt.Fprintf(&sb, "%-15s %s\n", "Name:", sub.Name)
	fmt.Fprintf(&sb, "%-15s %s\n", "Status:", f.formatStatus(sub.Status))

	if sub.Description != "" {
		fmt.Fprintf(&sb, "%-15s %s\n", "Description:", sub.Description)
	}

	fmt.Fprintf(&sb, "%-15s %s\n", "Created:", sub.CreatedAt.Format("2006-01-02 15:04:05"))
	fmt.Fprintf(&sb, "%-15s %s\n", "Updated:", sub.UpdatedAt.Format("2006-01-02 15:04:05"))

	if sub.LastNotified != nil {
		fmt.Fprintf(&sb, "%-15s %s\n", "Last Notified:", sub.LastNotified.Format("2006-01-02 15:04:05"))
	}

	// Filters
	sb.WriteString("\n" + f.color(ColorBold, "Filters:\n"))
	if len(sub.Filters.Namespaces) > 0 {
		fmt.Fprintf(&sb, "  Namespaces: %s\n", strings.Join(sub.Filters.Namespaces, ", "))
	}
	if len(sub.Filters.Keywords) > 0 {
		fmt.Fprintf(&sb, "  Keywords:   %s\n", strings.Join(sub.Filters.Keywords, ", "))
	}
	if len(sub.Filters.Servers) > 0 {
		fmt.Fprintf(&sb, "  Servers:    %s\n", strings.Join(sub.Filters.Servers, ", "))
	}
	if len(sub.Filters.ChangeTypes) > 0 {
		types := make([]string, len(sub.Filters.ChangeTypes))
		for i, ct := range sub.Filters.ChangeTypes {
			types[i] = string(ct)
		}
		fmt.Fprintf(&sb, "  Changes:    %s\n", strings.Join(types, ", "))
	}

	// Channels
	sb.WriteString("\n" + f.color(ColorBold, "Channels:\n"))
	for i, ch := range sub.Channels {
		status := f.color(ColorGreen, "enabled")
		if !ch.Enabled {
			status = f.color(ColorDim, "disabled")
		}
		fmt.Fprintf(&sb, "  %d. %s (%s)\n", i+1, ch.Type, status)
		if ch.SuccessCount > 0 || ch.FailureCount > 0 {
			fmt.Fprintf(&sb, "     Deliveries: %d success, %d failed\n", ch.SuccessCount, ch.FailureCount)
		}
	}

	return sb.String()
}

// FormatServers formats servers as a table.
func (f *TableFormatter) FormatServers(servers []types.Server) string {
	if len(servers) == 0 {
		return f.color(ColorDim, "No servers found.")
	}

	var sb strings.Builder
	w := tabwriter.NewWriter(&sb, 0, 0, 2, ' ', 0)

	// Header
	fmt.Fprintln(w, f.color(ColorBold, "NAME\tVERSION\tDESCRIPTION"))

	for _, server := range servers {
		name := TruncateString(server.Name, 40)
		version := "-"
		if server.VersionDetail != nil && server.VersionDetail.Version != "" {
			version = server.VersionDetail.Version
		}
		desc := TruncateString(server.Description, 50)

		fmt.Fprintf(w, "%s\t%s\t%s\n", name, version, desc)
	}

	w.Flush()
	return sb.String()
}

// FormatServer formats a single server with full details.
func (f *TableFormatter) FormatServer(server *types.Server) string {
	if server == nil {
		return f.color(ColorDim, "Server not found.")
	}

	var sb strings.Builder

	sb.WriteString(f.color(ColorBold, "Server Details\n"))
	sb.WriteString(strings.Repeat("─", 40) + "\n")

	fmt.Fprintf(&sb, "%-15s %s\n", "Name:", server.Name)
	fmt.Fprintf(&sb, "%-15s %s\n", "Description:", server.Description)

	if server.VersionDetail != nil {
		fmt.Fprintf(&sb, "%-15s %s\n", "Version:", server.VersionDetail.Version)
	}

	if server.Repository != nil {
		fmt.Fprintf(&sb, "%-15s %s\n", "Repository:", server.Repository.URL)
		fmt.Fprintf(&sb, "%-15s %s\n", "Source:", server.Repository.Source)
	}

	fmt.Fprintf(&sb, "%-15s %s\n", "Created:", server.CreatedAt.Format("2006-01-02 15:04:05"))
	fmt.Fprintf(&sb, "%-15s %s\n", "Updated:", server.UpdatedAt.Format("2006-01-02 15:04:05"))

	// Packages
	if len(server.Packages) > 0 {
		sb.WriteString("\n" + f.color(ColorBold, "Packages:\n"))
		for _, pkg := range server.Packages {
			fmt.Fprintf(&sb, "  • %s: %s", pkg.RegistryType, pkg.Name)
			if pkg.Version != "" {
				fmt.Fprintf(&sb, "@%s", pkg.Version)
			}
			sb.WriteString("\n")
		}
	}

	// Remotes
	if len(server.Remotes) > 0 {
		sb.WriteString("\n" + f.color(ColorBold, "Remote Endpoints:\n"))
		for _, remote := range server.Remotes {
			fmt.Fprintf(&sb, "  • %s: %s\n", remote.TransportType, remote.URL)
		}
	}

	return sb.String()
}

// FormatDiff formats a diff result as a table.
func (f *TableFormatter) FormatDiff(diff *types.DiffResult) string {
	if diff == nil {
		return f.color(ColorDim, "No diff available.")
	}

	if diff.TotalChanges == 0 {
		return f.color(ColorDim, "No changes between snapshots.")
	}

	var sb strings.Builder

	// Summary
	sb.WriteString(f.color(ColorBold, "Diff Summary\n"))
	sb.WriteString(strings.Repeat("─", 40) + "\n")

	if diff.FromSnapshot != nil {
		fmt.Fprintf(&sb, "From: %s (%d servers)\n",
			diff.FromSnapshot.Timestamp.Format("2006-01-02 15:04:05"),
			diff.FromSnapshot.ServerCount)
	} else {
		sb.WriteString("From: (none)\n")
	}

	if diff.ToSnapshot != nil {
		fmt.Fprintf(&sb, "To:   %s (%d servers)\n",
			diff.ToSnapshot.Timestamp.Format("2006-01-02 15:04:05"),
			diff.ToSnapshot.ServerCount)
	}

	sb.WriteString("\n")
	fmt.Fprintf(&sb, "Total Changes: %d\n", diff.TotalChanges)
	fmt.Fprintf(&sb, "  %s New:     %d\n", f.color(ColorGreen, "+"), len(diff.NewServers))
	fmt.Fprintf(&sb, "  %s Updated: %d\n", f.color(ColorYellow, "~"), len(diff.UpdatedServers))
	fmt.Fprintf(&sb, "  %s Removed: %d\n", f.color(ColorRed, "-"), len(diff.RemovedServers))

	// Combine all changes for display
	allChanges := make([]types.Change, 0, diff.TotalChanges)
	allChanges = append(allChanges, diff.NewServers...)
	allChanges = append(allChanges, diff.UpdatedServers...)
	allChanges = append(allChanges, diff.RemovedServers...)

	if len(allChanges) > 0 {
		sb.WriteString("\n" + f.color(ColorBold, "Changes:\n"))
		sb.WriteString(f.FormatChanges(allChanges))
	}

	return sb.String()
}

// Print prints the formatted output to the writer.
func (f *TableFormatter) Print(w io.Writer, s string) {
	if w == nil {
		w = os.Stdout
	}
	fmt.Fprint(w, s)
}
