// Package main provides an MCP server for querying the MCP Registry.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/nirholas/mcp-notify/internal/config"
	"github.com/nirholas/mcp-notify/internal/registry"
	"github.com/nirholas/mcp-notify/pkg/types"
)

// Tool argument types
type SearchServersArgs struct {
	Query string `json:"query" jsonschema:"description=Search query to find MCP servers by name or description"`
	Limit int    `json:"limit,omitempty" jsonschema:"description=Maximum number of results (default 20)"`
}

type GetServerArgs struct {
	Name string `json:"name" jsonschema:"description=The exact name of the MCP server to get details for"`
}

type ListCategoriesArgs struct{}

type ListByTagArgs struct {
	Tag   string `json:"tag" jsonschema:"description=Tag to filter servers by (e.g. database, ai, productivity)"`
	Limit int    `json:"limit,omitempty" jsonschema:"description=Maximum number of results (default 20)"`
}

type GetStatsArgs struct{}

var client *registry.Client

func main() {
	// Initialize registry client
	cfg, err := config.Load()
	if err != nil {
		// Use defaults if no config
		cfg = &config.Config{
			Registry: config.RegistryConfig{
				URL:     "https://api.mcpregistry.dev",
				Timeout: 30 * time.Second,
			},
		}
	}
	client = registry.NewClient(cfg.Registry)

	// Create MCP server
	server := mcp.NewServer(&mcp.Implementation{
		Name:    "mcp-notify",
		Version: "1.0.0",
	}, nil)

	// Add tools
	mcp.AddTool(server, &mcp.Tool{
		Name:        "search_servers",
		Description: "Search for MCP servers in the registry by name, description, or keywords. Use this to discover MCP servers that provide specific capabilities.",
	}, searchServers)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_server",
		Description: "Get detailed information about a specific MCP server by its exact name, including description, version, repository, and capabilities.",
	}, getServer)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "list_servers",
		Description: "List all available MCP servers in the registry with basic information.",
	}, listServers)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "get_stats",
		Description: "Get statistics about the MCP Registry, including total server count and recent activity.",
	}, getStats)

	// Run the server on stdio
	if err := server.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func searchServers(ctx context.Context, req *mcp.CallToolRequest, args SearchServersArgs) (*mcp.CallToolResult, any, error) {
	if args.Query == "" {
		return &mcp.CallToolResult{
			Content: []mcp.Content{
				&mcp.TextContent{Text: "Please provide a search query"},
			},
			IsError: true,
		}, nil, nil
	}

	limit := args.Limit
	if limit <= 0 {
		limit = 20
	}

	servers, err := client.ListServers(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch servers: %w", err)
	}

	// Simple search - match query against name and description
	query := strings.ToLower(args.Query)
	var matches []types.Server
	for _, s := range servers {
		if strings.Contains(strings.ToLower(s.Name), query) ||
			strings.Contains(strings.ToLower(s.Description), query) {
			matches = append(matches, s)
			if len(matches) >= limit {
				break
			}
		}
	}

	if len(matches) == 0 {
		return &mcp.CallToolResult{
			Content: []mcp.Content{
				&mcp.TextContent{Text: fmt.Sprintf("No servers found matching '%s'", args.Query)},
			},
		}, nil, nil
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Found %d servers matching '%s':\n\n", len(matches), args.Query))
	for _, s := range matches {
		sb.WriteString(fmt.Sprintf("**%s**\n", s.Name))
		if s.Description != "" {
			sb.WriteString(fmt.Sprintf("  %s\n", truncate(s.Description, 100)))
		}
		if s.Repository != nil && s.Repository.URL != "" {
			sb.WriteString(fmt.Sprintf("  Repository: %s\n", s.Repository.URL))
		}
		sb.WriteString("\n")
	}

	return &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{Text: sb.String()},
		},
	}, nil, nil
}

func getServer(ctx context.Context, req *mcp.CallToolRequest, args GetServerArgs) (*mcp.CallToolResult, any, error) {
	if args.Name == "" {
		return &mcp.CallToolResult{
			Content: []mcp.Content{
				&mcp.TextContent{Text: "Please provide a server name"},
			},
			IsError: true,
		}, nil, nil
	}

	servers, err := client.ListServers(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch servers: %w", err)
	}

	// Find exact match (case-insensitive)
	var found *types.Server
	nameLower := strings.ToLower(args.Name)
	for _, s := range servers {
		if strings.ToLower(s.Name) == nameLower {
			found = &s
			break
		}
	}

	if found == nil {
		return &mcp.CallToolResult{
			Content: []mcp.Content{
				&mcp.TextContent{Text: fmt.Sprintf("Server '%s' not found in the registry", args.Name)},
			},
		}, nil, nil
	}

	// Format detailed output
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# %s\n\n", found.Name))
	if found.Description != "" {
		sb.WriteString(fmt.Sprintf("%s\n\n", found.Description))
	}
	if found.VersionDetail != nil && found.VersionDetail.Version != "" {
		sb.WriteString(fmt.Sprintf("**Version:** %s\n", found.VersionDetail.Version))
	}
	if found.Repository != nil && found.Repository.URL != "" {
		sb.WriteString(fmt.Sprintf("**Repository:** %s\n", found.Repository.URL))
		if found.Repository.Source != "" {
			sb.WriteString(fmt.Sprintf("**Source:** %s\n", found.Repository.Source))
		}
	}

	return &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{Text: sb.String()},
		},
	}, nil, nil
}

type ListServersArgs struct {
	Limit int `json:"limit,omitempty" jsonschema:"description=Maximum number of results (default 50)"`
}

func listServers(ctx context.Context, req *mcp.CallToolRequest, args ListServersArgs) (*mcp.CallToolResult, any, error) {
	limit := args.Limit
	if limit <= 0 {
		limit = 50
	}

	servers, err := client.ListServers(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch servers: %w", err)
	}

	if len(servers) > limit {
		servers = servers[:limit]
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("MCP Registry - %d servers (showing %d):\n\n", len(servers), len(servers)))

	for _, s := range servers {
		if s.Description != "" {
			sb.WriteString(fmt.Sprintf("- **%s**: %s\n", s.Name, truncate(s.Description, 80)))
		} else {
			sb.WriteString(fmt.Sprintf("- **%s**\n", s.Name))
		}
	}

	return &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{Text: sb.String()},
		},
	}, nil, nil
}

func getStats(ctx context.Context, req *mcp.CallToolRequest, args GetStatsArgs) (*mcp.CallToolResult, any, error) {
	servers, err := client.ListServers(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to fetch servers: %w", err)
	}

	// Count servers with various attributes
	withDesc := 0
	withRepo := 0
	withVersion := 0
	for _, s := range servers {
		if s.Description != "" {
			withDesc++
		}
		if s.Repository != nil && s.Repository.URL != "" {
			withRepo++
		}
		if s.VersionDetail != nil && s.VersionDetail.Version != "" {
			withVersion++
		}
	}

	stats := map[string]any{
		"total_servers":    len(servers),
		"with_description": withDesc,
		"with_repository":  withRepo,
		"with_version":     withVersion,
		"registry_url":     "https://mcpregistry.dev",
		"last_checked":     time.Now().UTC().Format(time.RFC3339),
	}

	jsonData, _ := json.MarshalIndent(stats, "", "  ")

	return &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{Text: string(jsonData)},
		},
	}, nil, nil
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
