// Package main provides the CLI tool for MCP Notify.
package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"regexp"
	"sort"
	"strings"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/spf13/cobra"

	"github.com/nirholas/mcp-notify/cmd/mcp-notify-cli/output"
	"github.com/nirholas/mcp-notify/internal/config"
	"github.com/nirholas/mcp-notify/internal/diff"
	"github.com/nirholas/mcp-notify/pkg/types"
)

var (
	Version   = "dev"
	Commit    = "unknown"
	BuildDate = "unknown"
)

var (
	cfgFile   string
	outputFmt string
	noColor   bool
	cliConfig *config.CLIConfig
)

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

var rootCmd = &cobra.Command{
	Use:   "mcp-notify-cli",
	Short: "CLI tool for MCP Notify",
	Long: `MCP Notify CLI provides tools to monitor the MCP Registry
for changes and manage notification subscriptions.

Examples:
  # Check for changes in the last 24 hours
  mcp-notify-cli changes --since 24h

  # Watch for changes in real-time
  mcp-notify-cli watch --filter "defi,blockchain"

  # Create a subscription
  mcp-notify-cli subscribe --discord-webhook "https://..."

  # List all subscriptions
  mcp-notify-cli subscriptions list`,
	Version: fmt.Sprintf("%s (commit: %s, built: %s)", Version, Commit, BuildDate),
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		var err error
		cliConfig, err = config.LoadCLIConfig()
		if err != nil {
			return fmt.Errorf("failed to load config: %w", err)
		}
		return nil
	},
}

func init() {
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.mcp-notify/config.yaml)")
	rootCmd.PersistentFlags().StringVarP(&outputFmt, "output", "o", "table", "output format (table, json, yaml)")
	rootCmd.PersistentFlags().BoolVar(&noColor, "no-color", false, "disable colored output")

	// Add subcommands
	rootCmd.AddCommand(changesCmd)
	rootCmd.AddCommand(watchCmd)
	rootCmd.AddCommand(subscribeCmd)
	rootCmd.AddCommand(subscriptionsCmd)
	rootCmd.AddCommand(serversCmd)
	rootCmd.AddCommand(diffCmd)
	rootCmd.AddCommand(configCmd)
	rootCmd.AddCommand(completionCmd)
	rootCmd.AddCommand(versionCmd)
}

// versionCmd shows version information
var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version information",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("mcp-notify-cli version %s\n", Version)
		fmt.Printf("  Commit: %s\n", Commit)
		fmt.Printf("  Built:  %s\n", BuildDate)
	},
}

// getFormatter returns the appropriate formatter based on flags.
func getFormatter() output.Formatter {
	format := outputFmt
	if format == "" && cliConfig != nil && cliConfig.DefaultOutput != "" {
		format = cliConfig.DefaultOutput
	}
	f := output.NewFormatter(format)
	f.SetNoColor(noColor || (cliConfig != nil && cliConfig.NoColor))
	return f
}

// getAPIClient returns an HTTP client configured for API requests.
func getAPIClient() *http.Client {
	return &http.Client{
		Timeout: 30 * time.Second,
	}
}

// getAPIEndpoint returns the API endpoint URL.
func getAPIEndpoint() string {
	if cliConfig != nil && cliConfig.APIEndpoint != "" {
		return cliConfig.APIEndpoint
	}
	return "http://localhost:8080"
}

// getRegistryURL returns the registry URL.
func getRegistryURL() string {
	if cliConfig != nil && cliConfig.RegistryURL != "" {
		return cliConfig.RegistryURL
	}
	return "https://registry.modelcontextprotocol.io"
}

// getAPIKey returns the API key from config.
func getAPIKey() string {
	if cliConfig != nil {
		return cliConfig.APIKey
	}
	return ""
}

// parseDuration parses a duration string like "24h", "7d", "1w".
func parseDuration(s string) (time.Duration, error) {
	// Handle special suffixes
	s = strings.TrimSpace(strings.ToLower(s))

	// Check for weeks
	if strings.HasSuffix(s, "w") {
		weeks := strings.TrimSuffix(s, "w")
		var n int
		if _, err := fmt.Sscanf(weeks, "%d", &n); err != nil {
			return 0, fmt.Errorf("invalid week duration: %s", s)
		}
		return time.Duration(n) * 7 * 24 * time.Hour, nil
	}

	// Check for days
	if strings.HasSuffix(s, "d") {
		days := strings.TrimSuffix(s, "d")
		var n int
		if _, err := fmt.Sscanf(days, "%d", &n); err != nil {
			return 0, fmt.Errorf("invalid day duration: %s", s)
		}
		return time.Duration(n) * 24 * time.Hour, nil
	}

	// Use standard Go duration parsing
	return time.ParseDuration(s)
}

// --------------------------------------------------------------------------
// Changes Command
// --------------------------------------------------------------------------

var changesCmd = &cobra.Command{
	Use:   "changes",
	Short: "Show recent changes from the MCP Registry",
	Long: `Display recent changes detected in the MCP Registry.
	
Examples:
  # Changes in the last 24 hours
  mcp-notify-cli changes --since 24h
  
  # Changes for a specific namespace
  mcp-notify-cli changes --namespace "io.github.anthropics"
  
  # Changes with specific keywords
  mcp-notify-cli changes --keywords "defi,swap"`,
	RunE: runChanges,
}

var (
	changesSince     string
	changesNamespace string
	changesKeywords  []string
	changesLimit     int
)

func init() {
	changesCmd.Flags().StringVar(&changesSince, "since", "24h", "show changes since duration (e.g., 1h, 24h, 7d, 1w)")
	changesCmd.Flags().StringVar(&changesNamespace, "namespace", "", "filter by namespace pattern")
	changesCmd.Flags().StringSliceVar(&changesKeywords, "keywords", nil, "filter by keywords")
	changesCmd.Flags().IntVar(&changesLimit, "limit", 50, "maximum number of changes to show")
}

func runChanges(cmd *cobra.Command, args []string) error {
	// Parse duration
	duration, err := parseDuration(changesSince)
	if err != nil {
		return fmt.Errorf("invalid --since duration: %w", err)
	}

	since := time.Now().Add(-duration)

	// Try to fetch from API first
	changes, err := fetchChangesFromAPI(since, changesNamespace, changesKeywords, changesLimit)
	if err != nil {
		// Fallback: direct registry polling
		fmt.Fprintf(os.Stderr, "Note: Could not connect to API (%v), using direct registry access.\n", err)
		changes, err = fetchChangesFromRegistry(since, changesNamespace, changesKeywords, changesLimit)
		if err != nil {
			return fmt.Errorf("failed to fetch changes: %w", err)
		}
	}

	// Format and output
	f := getFormatter()
	fmt.Println(f.FormatChanges(changes))

	return nil
}

func fetchChangesFromAPI(since time.Time, namespace string, keywords []string, limit int) ([]types.Change, error) {
	client := getAPIClient()
	endpoint := fmt.Sprintf("%s/api/v1/changes?since=%s&limit=%d",
		getAPIEndpoint(),
		since.Format(time.RFC3339),
		limit)

	if namespace != "" {
		endpoint += "&namespace=" + namespace
	}
	if len(keywords) > 0 {
		endpoint += "&keywords=" + strings.Join(keywords, ",")
	}

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}

	if apiKey := getAPIKey(); apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: %s - %s", resp.Status, string(body))
	}

	var result types.ChangesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Changes, nil
}

func fetchChangesFromRegistry(since time.Time, namespace string, keywords []string, limit int) ([]types.Change, error) {
	// Fetch current registry state
	servers, err := fetchServersFromRegistry()
	if err != nil {
		return nil, err
	}

	// Create diff engine
	engine := diff.NewEngine()
	snapshot := engine.CreateSnapshot(servers)

	// Since we don't have historical data in direct mode, return an empty list
	// with a message that historical changes require the API
	var changes []types.Change

	// Apply filters to show matching servers as "new" for demonstration
	for _, server := range servers {
		if server.CreatedAt.After(since) || server.UpdatedAt.After(since) {
			// Apply namespace filter
			if namespace != "" {
				if !matchesPattern(server.Name, namespace) {
					continue
				}
			}

			// Apply keyword filter
			if len(keywords) > 0 {
				matched := false
				searchText := strings.ToLower(server.Name + " " + server.Description)
				for _, kw := range keywords {
					if strings.Contains(searchText, strings.ToLower(kw)) {
						matched = true
						break
					}
				}
				if !matched {
					continue
				}
			}

			changeType := types.ChangeTypeUpdated
			if server.CreatedAt.After(since) {
				changeType = types.ChangeTypeNew
			}

			serverCopy := server
			changes = append(changes, types.Change{
				ID:         uuid.New(),
				SnapshotID: snapshot.ID,
				ServerName: server.Name,
				ChangeType: changeType,
				NewVersion: getServerVersion(server),
				Server:     &serverCopy,
				DetectedAt: server.UpdatedAt,
			})

			if len(changes) >= limit {
				break
			}
		}
	}

	// Sort by detected time descending
	sort.Slice(changes, func(i, j int) bool {
		return changes[i].DetectedAt.After(changes[j].DetectedAt)
	})

	return changes, nil
}

func fetchServersFromRegistry() ([]types.Server, error) {
	client := getAPIClient()
	registryURL := getRegistryURL()

	var allServers []types.Server
	cursor := ""

	for {
		url := fmt.Sprintf("%s/v0/servers?limit=100", registryURL)
		if cursor != "" {
			url += "&cursor=" + cursor
		}

		resp, err := client.Get(url)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch from registry: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			return nil, fmt.Errorf("registry error: %s - %s", resp.Status, string(body))
		}

		var result types.ServerListResponse
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			return nil, fmt.Errorf("failed to parse registry response: %w", err)
		}

		allServers = append(allServers, result.Servers...)

		if result.NextCursor == "" {
			break
		}
		cursor = result.NextCursor
	}

	return allServers, nil
}

func matchesPattern(name, pattern string) bool {
	// Convert glob pattern to regex
	pattern = strings.ReplaceAll(pattern, ".", "\\.")
	pattern = strings.ReplaceAll(pattern, "*", ".*")
	pattern = "^" + pattern
	matched, _ := regexp.MatchString(pattern, name)
	return matched
}

func getServerVersion(server types.Server) string {
	if server.VersionDetail != nil && server.VersionDetail.Version != "" {
		return server.VersionDetail.Version
	}
	return ""
}

// --------------------------------------------------------------------------
// Watch Command
// --------------------------------------------------------------------------

var watchCmd = &cobra.Command{
	Use:   "watch",
	Short: "Watch for changes in real-time",
	Long: `Monitor the MCP Registry for changes in real-time.
	
Examples:
  # Watch all changes
  mcp-notify-cli watch
  
  # Watch with filters
  mcp-notify-cli watch --filter "defi,ethereum"
  
  # Watch specific namespace
  mcp-notify-cli watch --namespace "io.github.*"`,
	RunE: runWatch,
}

var (
	watchFilter    []string
	watchNamespace string
	watchInterval  string
)

func init() {
	watchCmd.Flags().StringSliceVar(&watchFilter, "filter", nil, "keywords to filter")
	watchCmd.Flags().StringVar(&watchNamespace, "namespace", "", "namespace pattern to watch")
	watchCmd.Flags().StringVar(&watchInterval, "interval", "1m", "polling interval")
}

func runWatch(cmd *cobra.Command, args []string) error {
	// Parse interval
	interval, err := parseDuration(watchInterval)
	if err != nil {
		return fmt.Errorf("invalid --interval duration: %w", err)
	}

	if interval < 30*time.Second {
		return fmt.Errorf("interval must be at least 30 seconds")
	}

	// Setup signal handling
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigCh
		fmt.Fprintln(os.Stderr, "\n\nStopping watch...")
		cancel()
	}()

	fmt.Printf("Watching MCP Registry (interval: %s)\n", interval)
	fmt.Printf("Press Ctrl+C to stop\n\n")

	// Initial fetch
	engine := diff.NewEngine()
	servers, err := fetchServersFromRegistry()
	if err != nil {
		return fmt.Errorf("failed to fetch initial registry state: %w", err)
	}

	lastSnapshot := engine.CreateSnapshot(servers)
	fmt.Printf("Initial state: %d servers\n\n", lastSnapshot.ServerCount)

	// Watch loop
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	f := getFormatter()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			servers, err := fetchServersFromRegistry()
			if err != nil {
				fmt.Fprintf(os.Stderr, "Poll error: %v\n", err)
				continue
			}

			currentSnapshot := engine.CreateSnapshot(servers)

			if engine.HasChanges(lastSnapshot, currentSnapshot) {
				result := engine.Compare(lastSnapshot, currentSnapshot)

				// Apply filters
				filteredChanges := filterChanges(result, watchNamespace, watchFilter)

				if len(filteredChanges) > 0 {
					timestamp := time.Now().Format("15:04:05")
					fmt.Printf("[%s] Detected %d change(s):\n", timestamp, len(filteredChanges))
					fmt.Println(f.FormatChanges(filteredChanges))
				}

				lastSnapshot = currentSnapshot
			}
		}
	}
}

func filterChanges(result *types.DiffResult, namespace string, keywords []string) []types.Change {
	allChanges := make([]types.Change, 0, result.TotalChanges)
	allChanges = append(allChanges, result.NewServers...)
	allChanges = append(allChanges, result.UpdatedServers...)
	allChanges = append(allChanges, result.RemovedServers...)

	if namespace == "" && len(keywords) == 0 {
		return allChanges
	}

	filtered := make([]types.Change, 0)
	for _, change := range allChanges {
		// Apply namespace filter
		if namespace != "" && !matchesPattern(change.ServerName, namespace) {
			continue
		}

		// Apply keyword filter
		if len(keywords) > 0 {
			matched := false
			searchText := strings.ToLower(change.ServerName)
			if change.Server != nil {
				searchText += " " + strings.ToLower(change.Server.Description)
			}
			for _, kw := range keywords {
				if strings.Contains(searchText, strings.ToLower(kw)) {
					matched = true
					break
				}
			}
			if !matched {
				continue
			}
		}

		filtered = append(filtered, change)
	}

	return filtered
}

// --------------------------------------------------------------------------
// Subscribe Command
// --------------------------------------------------------------------------

var subscribeCmd = &cobra.Command{
	Use:   "subscribe",
	Short: "Create a notification subscription",
	Long: `Create a new subscription to receive notifications about registry changes.
	
Examples:
  # Discord webhook subscription
  mcp-notify-cli subscribe --discord-webhook "https://discord.com/api/webhooks/..."
  
  # Slack webhook subscription
  mcp-notify-cli subscribe --slack-webhook "https://hooks.slack.com/..."
  
  # Generic webhook
  mcp-notify-cli subscribe --webhook "https://your-server.com/webhook"`,
	RunE: runSubscribe,
}

var (
	subscribeDiscord   string
	subscribeSlack     string
	subscribeWebhook   string
	subscribeEmail     string
	subscribeTelegram  string
	subscribeTeams     string
	subscribeName      string
	subscribeFilter    []string
	subscribeNamespace string
	subscribeSave      bool
)

func init() {
	subscribeCmd.Flags().StringVar(&subscribeDiscord, "discord-webhook", "", "Discord webhook URL")
	subscribeCmd.Flags().StringVar(&subscribeSlack, "slack-webhook", "", "Slack webhook URL")
	subscribeCmd.Flags().StringVar(&subscribeWebhook, "webhook", "", "Generic webhook URL")
	subscribeCmd.Flags().StringVar(&subscribeEmail, "email", "", "Email address for notifications")
	subscribeCmd.Flags().StringVar(&subscribeTelegram, "telegram", "", "Telegram chat ID (requires bot token in config)")
	subscribeCmd.Flags().StringVar(&subscribeTeams, "teams-webhook", "", "Microsoft Teams webhook URL")
	subscribeCmd.Flags().StringVar(&subscribeName, "name", "", "subscription name")
	subscribeCmd.Flags().StringSliceVar(&subscribeFilter, "filter", nil, "keywords to filter")
	subscribeCmd.Flags().StringVar(&subscribeNamespace, "namespace", "", "namespace pattern")
	subscribeCmd.Flags().BoolVar(&subscribeSave, "save", false, "save subscription to local config")
}

func runSubscribe(cmd *cobra.Command, args []string) error {
	// Validate at least one channel
	channels := []types.ChannelRequest{}

	if subscribeDiscord != "" {
		channels = append(channels, types.ChannelRequest{
			Type: types.ChannelDiscord,
			Config: types.ChannelConfig{
				DiscordWebhookURL: subscribeDiscord,
			},
		})
	}

	if subscribeSlack != "" {
		channels = append(channels, types.ChannelRequest{
			Type: types.ChannelSlack,
			Config: types.ChannelConfig{
				SlackWebhookURL: subscribeSlack,
			},
		})
	}

	if subscribeWebhook != "" {
		channels = append(channels, types.ChannelRequest{
			Type: types.ChannelWebhook,
			Config: types.ChannelConfig{
				WebhookURL:    subscribeWebhook,
				WebhookMethod: "POST",
			},
		})
	}

	if subscribeEmail != "" {
		channels = append(channels, types.ChannelRequest{
			Type: types.ChannelEmail,
			Config: types.ChannelConfig{
				EmailAddress: subscribeEmail,
			},
		})
	}

	if subscribeTelegram != "" {
		channels = append(channels, types.ChannelRequest{
			Type: types.ChannelTelegram,
			Config: types.ChannelConfig{
				TelegramChatID: subscribeTelegram,
			},
		})
	}

	if subscribeTeams != "" {
		channels = append(channels, types.ChannelRequest{
			Type: types.ChannelTeams,
			Config: types.ChannelConfig{
				TeamsWebhookURL: subscribeTeams,
			},
		})
	}

	if len(channels) == 0 {
		return fmt.Errorf("at least one notification channel is required (--discord-webhook, --slack-webhook, --webhook, --email, --telegram, --teams-webhook)")
	}

	// Generate name if not provided
	name := subscribeName
	if name == "" {
		name = fmt.Sprintf("cli-subscription-%s", time.Now().Format("20060102-150405"))
	}

	// Build request
	req := types.CreateSubscriptionRequest{
		Name:     name,
		Channels: channels,
		Filters: types.SubscriptionFilter{
			Keywords: subscribeFilter,
		},
	}

	if subscribeNamespace != "" {
		req.Filters.Namespaces = []string{subscribeNamespace}
	}

	// Create subscription via API
	result, apiKey, err := createSubscriptionViaAPI(req)
	if err != nil {
		return fmt.Errorf("failed to create subscription: %w", err)
	}

	// Display result
	fmt.Println("✓ Subscription created successfully!")
	fmt.Println()
	fmt.Printf("  ID:   %s\n", result.ID)
	fmt.Printf("  Name: %s\n", result.Name)
	fmt.Println()
	fmt.Println("  ⚠️  IMPORTANT: Save your API key! It won't be shown again.")
	fmt.Printf("  API Key: %s\n", apiKey)
	fmt.Println()

	// Save to config if requested
	if subscribeSave && cliConfig != nil {
		if err := cliConfig.SaveSubscription(name, result.ID.String()); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: Failed to save subscription to config: %v\n", err)
		} else {
			fmt.Printf("  Saved as '%s' in local config.\n", name)
		}
	}

	return nil
}

func createSubscriptionViaAPI(req types.CreateSubscriptionRequest) (*types.Subscription, string, error) {
	client := getAPIClient()
	endpoint := fmt.Sprintf("%s/api/v1/subscriptions", getAPIEndpoint())

	body, err := json.Marshal(req)
	if err != nil {
		return nil, "", err
	}

	httpReq, err := http.NewRequest("POST", endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, "", err
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if apiKey := getAPIKey(); apiKey != "" {
		httpReq.Header.Set("X-API-Key", apiKey)
	}

	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, "", fmt.Errorf("API error: %s - %s", resp.Status, string(respBody))
	}

	var result types.SubscriptionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, "", err
	}

	return &result.Subscription, result.APIKey, nil
}

// --------------------------------------------------------------------------
// Subscriptions Commands
// --------------------------------------------------------------------------

var subscriptionsCmd = &cobra.Command{
	Use:   "subscriptions",
	Short: "Manage notification subscriptions",
	Long:  `List, view, pause, resume, or delete notification subscriptions.`,
}

func init() {
	subscriptionsCmd.AddCommand(subscriptionsListCmd)
	subscriptionsCmd.AddCommand(subscriptionsShowCmd)
	subscriptionsCmd.AddCommand(subscriptionsPauseCmd)
	subscriptionsCmd.AddCommand(subscriptionsResumeCmd)
	subscriptionsCmd.AddCommand(subscriptionsDeleteCmd)
	subscriptionsCmd.AddCommand(subscriptionsLogsCmd)
}

var subscriptionsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all subscriptions",
	RunE: func(cmd *cobra.Command, args []string) error {
		subs, err := fetchSubscriptionsFromAPI()
		if err != nil {
			return fmt.Errorf("failed to list subscriptions: %w", err)
		}

		f := getFormatter()
		fmt.Println(f.FormatSubscriptions(subs))
		return nil
	},
}

func fetchSubscriptionsFromAPI() ([]types.Subscription, error) {
	client := getAPIClient()
	endpoint := fmt.Sprintf("%s/api/v1/subscriptions", getAPIEndpoint())

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}

	if apiKey := getAPIKey(); apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: %s - %s", resp.Status, string(body))
	}

	var result struct {
		Subscriptions []types.Subscription `json:"subscriptions"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Subscriptions, nil
}

var subscriptionsShowCmd = &cobra.Command{
	Use:   "show [subscription-id]",
	Short: "Show subscription details",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		// Resolve name to ID if saved
		subID := args[0]
		if cliConfig != nil {
			subID = cliConfig.GetSubscriptionID(subID)
		}

		sub, err := fetchSubscriptionFromAPI(subID)
		if err != nil {
			return fmt.Errorf("failed to get subscription: %w", err)
		}

		f := getFormatter()
		fmt.Println(f.FormatSubscription(sub))
		return nil
	},
}

func fetchSubscriptionFromAPI(id string) (*types.Subscription, error) {
	client := getAPIClient()
	endpoint := fmt.Sprintf("%s/api/v1/subscriptions/%s", getAPIEndpoint(), id)

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}

	if apiKey := getAPIKey(); apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("subscription not found")
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: %s - %s", resp.Status, string(body))
	}

	var sub types.Subscription
	if err := json.NewDecoder(resp.Body).Decode(&sub); err != nil {
		return nil, err
	}

	return &sub, nil
}

var subscriptionsPauseCmd = &cobra.Command{
	Use:   "pause [subscription-id]",
	Short: "Pause a subscription",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		subID := args[0]
		if cliConfig != nil {
			subID = cliConfig.GetSubscriptionID(subID)
		}

		if err := updateSubscriptionStatus(subID, "paused"); err != nil {
			return err
		}

		fmt.Printf("✓ Subscription %s paused\n", subID)
		return nil
	},
}

var subscriptionsResumeCmd = &cobra.Command{
	Use:   "resume [subscription-id]",
	Short: "Resume a paused subscription",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		subID := args[0]
		if cliConfig != nil {
			subID = cliConfig.GetSubscriptionID(subID)
		}

		if err := updateSubscriptionStatus(subID, "active"); err != nil {
			return err
		}

		fmt.Printf("✓ Subscription %s resumed\n", subID)
		return nil
	},
}

func updateSubscriptionStatus(id, status string) error {
	client := getAPIClient()
	endpoint := fmt.Sprintf("%s/api/v1/subscriptions/%s/status", getAPIEndpoint(), id)

	body, _ := json.Marshal(map[string]string{"status": status})
	req, err := http.NewRequest("PATCH", endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	if apiKey := getAPIKey(); apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error: %s - %s", resp.Status, string(respBody))
	}

	return nil
}

var (
	deleteConfirm bool
)

func init() {
	subscriptionsDeleteCmd.Flags().BoolVarP(&deleteConfirm, "yes", "y", false, "skip confirmation prompt")
}

var subscriptionsDeleteCmd = &cobra.Command{
	Use:   "delete [subscription-id]",
	Short: "Delete a subscription",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		subID := args[0]
		if cliConfig != nil {
			subID = cliConfig.GetSubscriptionID(subID)
		}

		// Confirm deletion
		if !deleteConfirm {
			fmt.Printf("Are you sure you want to delete subscription %s? [y/N]: ", subID)
			reader := bufio.NewReader(os.Stdin)
			response, _ := reader.ReadString('\n')
			response = strings.TrimSpace(strings.ToLower(response))
			if response != "y" && response != "yes" {
				fmt.Println("Cancelled.")
				return nil
			}
		}

		if err := deleteSubscriptionViaAPI(subID); err != nil {
			return err
		}

		// Remove from local config
		if cliConfig != nil {
			for name, id := range cliConfig.Subscriptions {
				if id == subID {
					_ = cliConfig.RemoveSubscription(name)
					break
				}
			}
		}

		fmt.Printf("✓ Subscription %s deleted\n", subID)
		return nil
	},
}

func deleteSubscriptionViaAPI(id string) error {
	client := getAPIClient()
	endpoint := fmt.Sprintf("%s/api/v1/subscriptions/%s", getAPIEndpoint(), id)

	req, err := http.NewRequest("DELETE", endpoint, nil)
	if err != nil {
		return err
	}

	if apiKey := getAPIKey(); apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error: %s - %s", resp.Status, string(body))
	}

	return nil
}

var subscriptionsLogsCmd = &cobra.Command{
	Use:   "logs [subscription-id]",
	Short: "Show recent notification logs for a subscription",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		subID := args[0]
		if cliConfig != nil {
			subID = cliConfig.GetSubscriptionID(subID)
		}

		logs, err := fetchSubscriptionLogs(subID)
		if err != nil {
			return fmt.Errorf("failed to get logs: %w", err)
		}

		if len(logs) == 0 {
			fmt.Println("No notification logs found.")
			return nil
		}

		// Format logs
		fmt.Printf("Recent notifications for subscription %s:\n\n", subID[:8]+"...")
		for _, log := range logs {
			status := "✓"
			if log.Status == "failed" {
				status = "✗"
			}
			fmt.Printf("%s [%s] %s - %s\n",
				status,
				log.CreatedAt.Format("2006-01-02 15:04:05"),
				log.Status,
				log.Error)
		}

		return nil
	},
}

func fetchSubscriptionLogs(id string) ([]types.Notification, error) {
	client := getAPIClient()
	endpoint := fmt.Sprintf("%s/api/v1/subscriptions/%s/logs", getAPIEndpoint(), id)

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}

	if apiKey := getAPIKey(); apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: %s - %s", resp.Status, string(body))
	}

	var result struct {
		Logs []types.Notification `json:"logs"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Logs, nil
}

// --------------------------------------------------------------------------
// Servers Commands
// --------------------------------------------------------------------------

var serversCmd = &cobra.Command{
	Use:   "servers",
	Short: "Query servers from the MCP Registry",
	Long: `List and search servers in the MCP Registry.
	
Examples:
  # List all servers
  mcp-notify-cli servers list
  
  # Search servers
  mcp-notify-cli servers search "filesystem"
  
  # Show server details
  mcp-notify-cli servers show "io.github.example/my-server"`,
}

var (
	serversLimit int
)

func init() {
	serversCmd.AddCommand(serversListCmd)
	serversCmd.AddCommand(serversSearchCmd)
	serversCmd.AddCommand(serversShowCmd)
	serversCmd.AddCommand(serversHistoryCmd)

	serversListCmd.Flags().IntVar(&serversLimit, "limit", 50, "maximum number of servers to show")
}

var serversListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all servers",
	RunE: func(cmd *cobra.Command, args []string) error {
		servers, err := fetchServersFromRegistry()
		if err != nil {
			return fmt.Errorf("failed to list servers: %w", err)
		}

		// Apply limit
		if serversLimit > 0 && len(servers) > serversLimit {
			servers = servers[:serversLimit]
		}

		f := getFormatter()
		fmt.Println(f.FormatServers(servers))

		return nil
	},
}

var serversSearchCmd = &cobra.Command{
	Use:   "search [query]",
	Short: "Search servers",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		query := strings.ToLower(args[0])

		servers, err := fetchServersFromRegistry()
		if err != nil {
			return fmt.Errorf("failed to fetch servers: %w", err)
		}

		// Filter by query
		var matched []types.Server
		for _, server := range servers {
			searchText := strings.ToLower(server.Name + " " + server.Description)
			if strings.Contains(searchText, query) {
				matched = append(matched, server)
			}
		}

		if len(matched) == 0 {
			fmt.Printf("No servers found matching '%s'\n", query)
			return nil
		}

		f := getFormatter()
		fmt.Println(f.FormatServers(matched))

		return nil
	},
}

var serversShowCmd = &cobra.Command{
	Use:   "show [server-name]",
	Short: "Show server details",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		serverName := args[0]

		servers, err := fetchServersFromRegistry()
		if err != nil {
			return fmt.Errorf("failed to fetch servers: %w", err)
		}

		// Find the server
		var found *types.Server
		for i := range servers {
			if servers[i].Name == serverName {
				found = &servers[i]
				break
			}
		}

		if found == nil {
			return fmt.Errorf("server '%s' not found", serverName)
		}

		f := getFormatter()
		fmt.Println(f.FormatServer(found))

		return nil
	},
}

var serversHistoryCmd = &cobra.Command{
	Use:   "history [server-name]",
	Short: "Show change history for a server",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		serverName := args[0]

		// Fetch from API
		changes, err := fetchServerHistory(serverName)
		if err != nil {
			return fmt.Errorf("failed to fetch history: %w", err)
		}

		if len(changes) == 0 {
			fmt.Printf("No change history found for '%s'\n", serverName)
			return nil
		}

		f := getFormatter()
		fmt.Println(f.FormatChanges(changes))

		return nil
	},
}

func fetchServerHistory(serverName string) ([]types.Change, error) {
	client := getAPIClient()
	endpoint := fmt.Sprintf("%s/api/v1/changes?server=%s", getAPIEndpoint(), serverName)

	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}

	if apiKey := getAPIKey(); apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: %s - %s", resp.Status, string(body))
	}

	var result types.ChangesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Changes, nil
}

// --------------------------------------------------------------------------
// Diff Command
// --------------------------------------------------------------------------

var diffCmd = &cobra.Command{
	Use:   "diff",
	Short: "Compute diff between registry snapshots",
	Long: `Compare two registry snapshots and show the differences.
	
Examples:
  # Diff between two timestamps
  mcp-notify-cli diff --from "2025-01-01T00:00:00Z" --to "2025-01-02T00:00:00Z"
  
  # Diff from a saved snapshot file
  mcp-notify-cli diff --from snapshot-old.json --to snapshot-new.json
  
  # Save current snapshot
  mcp-notify-cli diff --save-snapshot current.json`,
	RunE: runDiff,
}

var (
	diffFrom         string
	diffTo           string
	diffSaveSnapshot string
)

func init() {
	diffCmd.Flags().StringVar(&diffFrom, "from", "", "start point (timestamp or file)")
	diffCmd.Flags().StringVar(&diffTo, "to", "", "end point (timestamp or file, default: now)")
	diffCmd.Flags().StringVar(&diffSaveSnapshot, "save-snapshot", "", "save current snapshot to file")
}

func runDiff(cmd *cobra.Command, args []string) error {
	engine := diff.NewEngine()

	// If saving snapshot
	if diffSaveSnapshot != "" {
		servers, err := fetchServersFromRegistry()
		if err != nil {
			return fmt.Errorf("failed to fetch servers: %w", err)
		}

		snapshot := engine.CreateSnapshot(servers)
		data, err := json.MarshalIndent(snapshot, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal snapshot: %w", err)
		}

		if err := os.WriteFile(diffSaveSnapshot, data, 0644); err != nil {
			return fmt.Errorf("failed to save snapshot: %w", err)
		}

		fmt.Printf("✓ Snapshot saved to %s (%d servers)\n", diffSaveSnapshot, snapshot.ServerCount)
		return nil
	}

	// Load snapshots
	var fromSnapshot, toSnapshot *types.Snapshot

	if diffFrom != "" {
		var err error
		fromSnapshot, err = loadSnapshot(diffFrom)
		if err != nil {
			return fmt.Errorf("failed to load --from snapshot: %w", err)
		}
	}

	if diffTo != "" {
		var err error
		toSnapshot, err = loadSnapshot(diffTo)
		if err != nil {
			return fmt.Errorf("failed to load --to snapshot: %w", err)
		}
	} else {
		// Default: current state
		servers, err := fetchServersFromRegistry()
		if err != nil {
			return fmt.Errorf("failed to fetch current registry state: %w", err)
		}
		toSnapshot = engine.CreateSnapshot(servers)
	}

	// Compute diff
	result := engine.Compare(fromSnapshot, toSnapshot)

	f := getFormatter()
	fmt.Println(f.FormatDiff(result))

	return nil
}

func loadSnapshot(path string) (*types.Snapshot, error) {
	// Check if it's a file
	if _, err := os.Stat(path); err == nil {
		data, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}

		var snapshot types.Snapshot
		if err := json.Unmarshal(data, &snapshot); err != nil {
			return nil, err
		}
		return &snapshot, nil
	}

	// Try parsing as timestamp and fetch from API
	// This would require API support for historical snapshots
	return nil, fmt.Errorf("file not found: %s (timestamp-based lookups require API support)", path)
}

// --------------------------------------------------------------------------
// Config Command
// --------------------------------------------------------------------------

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage CLI configuration",
	Long:  `View and modify CLI configuration settings.`,
}

func init() {
	configCmd.AddCommand(configShowCmd)
	configCmd.AddCommand(configSetCmd)
	configCmd.AddCommand(configPathCmd)
}

var configShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Show current configuration",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.LoadCLIConfig()
		if err != nil {
			return err
		}

		// Mask API key
		displayCfg := *cfg
		if displayCfg.APIKey != "" {
			keyLen := len(displayCfg.APIKey)
			if keyLen > 4 {
				displayCfg.APIKey = "***" + displayCfg.APIKey[keyLen-4:]
			} else {
				displayCfg.APIKey = "***"
			}
		}

		if outputFmt == "json" {
			data, _ := json.MarshalIndent(displayCfg, "", "  ")
			fmt.Println(string(data))
		} else {
			fmt.Println("CLI Configuration:")
			fmt.Println()
			fmt.Printf("  API Endpoint:  %s\n", displayCfg.APIEndpoint)
			fmt.Printf("  API Key:       %s\n", displayCfg.APIKey)
			fmt.Printf("  Registry URL:  %s\n", displayCfg.RegistryURL)
			fmt.Printf("  Default Output: %s\n", displayCfg.DefaultOutput)
			fmt.Printf("  No Color:      %v\n", displayCfg.NoColor)
			fmt.Printf("  Watch Interval: %s\n", displayCfg.DefaultWatchInterval)
			fmt.Println()
			if len(displayCfg.Subscriptions) > 0 {
				fmt.Println("  Saved Subscriptions:")
				for name, id := range displayCfg.Subscriptions {
					fmt.Printf("    %s: %s\n", name, id)
				}
			}
		}
		return nil
	},
}

var configSetCmd = &cobra.Command{
	Use:   "set [key] [value]",
	Short: "Set a configuration value",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		key := args[0]
		value := args[1]

		cfg, err := config.LoadCLIConfig()
		if err != nil {
			return err
		}

		switch strings.ToLower(key) {
		case "api_endpoint", "api-endpoint", "endpoint":
			cfg.APIEndpoint = value
		case "api_key", "api-key", "key":
			cfg.APIKey = value
		case "registry_url", "registry-url", "registry":
			cfg.RegistryURL = value
		case "default_output", "default-output", "output":
			cfg.DefaultOutput = value
		case "no_color", "no-color":
			cfg.NoColor = value == "true" || value == "1"
		case "watch_interval", "watch-interval", "interval":
			cfg.DefaultWatchInterval = value
		default:
			return fmt.Errorf("unknown config key: %s", key)
		}

		if err := config.SaveCLIConfig(cfg); err != nil {
			return err
		}

		fmt.Printf("✓ Set %s = %s\n", key, value)
		return nil
	},
}

var configPathCmd = &cobra.Command{
	Use:   "path",
	Short: "Show config file path",
	RunE: func(cmd *cobra.Command, args []string) error {
		path, err := config.GetCLIConfigPath()
		if err != nil {
			return err
		}
		fmt.Println(path)
		return nil
	},
}

// --------------------------------------------------------------------------
// Completion Command
// --------------------------------------------------------------------------

var completionCmd = &cobra.Command{
	Use:   "completion [bash|zsh|fish|powershell]",
	Short: "Generate shell completion scripts",
	Long: `Generate shell completion scripts for the CLI.

To load completions:

Bash:
  $ source <(mcp-notify-cli completion bash)

  # To load completions for each session, execute once:
  # Linux:
  $ mcp-notify-cli completion bash > /etc/bash_completion.d/mcp-notify-cli
  # macOS:
  $ mcp-notify-cli completion bash > /usr/local/etc/bash_completion.d/mcp-notify-cli

Zsh:
  # If shell completion is not already enabled in your environment,
  # you will need to enable it. You can execute the following once:
  $ echo "autoload -U compinit; compinit" >> ~/.zshrc

  # To load completions for each session, execute once:
  $ mcp-notify-cli completion zsh > "${fpath[1]}/_mcp-notify-cli"

Fish:
  $ mcp-notify-cli completion fish > ~/.config/fish/completions/mcp-notify-cli.fish

PowerShell:
  PS> mcp-notify-cli completion powershell | Out-String | Invoke-Expression
`,
	ValidArgs:             []string{"bash", "zsh", "fish", "powershell"},
	Args:                  cobra.ExactArgs(1),
	DisableFlagsInUseLine: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		switch args[0] {
		case "bash":
			return rootCmd.GenBashCompletion(os.Stdout)
		case "zsh":
			return rootCmd.GenZshCompletion(os.Stdout)
		case "fish":
			return rootCmd.GenFishCompletion(os.Stdout, true)
		case "powershell":
			return rootCmd.GenPowerShellCompletionWithDesc(os.Stdout)
		default:
			return fmt.Errorf("unsupported shell: %s", args[0])
		}
	},
}
