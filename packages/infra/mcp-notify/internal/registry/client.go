// Package registry provides a client for the MCP Registry API.
package registry

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/nirholas/mcp-notify/internal/config"
	"github.com/nirholas/mcp-notify/pkg/types"
)

var tracer = otel.Tracer("registry-client")

// Client is a client for the MCP Registry API.
type Client struct {
	baseURL       string
	httpClient    *http.Client
	userAgent     string
	retryAttempts int
	retryDelay    time.Duration
}

// NewClient creates a new registry client.
func NewClient(cfg config.RegistryConfig) *Client {
	return &Client{
		baseURL: cfg.URL,
		httpClient: &http.Client{
			Timeout: cfg.Timeout,
		},
		userAgent:     cfg.UserAgent,
		retryAttempts: cfg.RetryAttempts,
		retryDelay:    cfg.RetryDelay,
	}
}

// ListServers fetches all servers from the registry with pagination.
func (c *Client) ListServers(ctx context.Context) ([]types.Server, error) {
	ctx, span := tracer.Start(ctx, "ListServers")
	defer span.End()

	var allServers []types.Server
	var cursor string
	pageCount := 0

	for {
		pageCount++
		span.AddEvent("fetching page", trace.WithAttributes(
			attribute.Int("page", pageCount),
			attribute.String("cursor", cursor),
		))

		servers, nextCursor, err := c.listServersPage(ctx, cursor, 100)
		if err != nil {
			span.RecordError(err)
			return nil, fmt.Errorf("failed to fetch page %d: %w", pageCount, err)
		}

		allServers = append(allServers, servers...)

		if nextCursor == "" {
			break
		}
		cursor = nextCursor

		// Safety limit to prevent infinite loops
		if pageCount > 1000 {
			log.Warn().Msg("Reached maximum page limit")
			break
		}
	}

	span.SetAttributes(attribute.Int("total_servers", len(allServers)))
	log.Debug().Int("server_count", len(allServers)).Int("pages", pageCount).Msg("Fetched all servers")

	return allServers, nil
}

// listServersPage fetches a single page of servers.
func (c *Client) listServersPage(ctx context.Context, cursor string, limit int) ([]types.Server, string, error) {
	ctx, span := tracer.Start(ctx, "listServersPage")
	defer span.End()

	// Build URL with query parameters
	u, err := url.Parse(c.baseURL + "/v0/servers")
	if err != nil {
		return nil, "", fmt.Errorf("invalid base URL: %w", err)
	}

	q := u.Query()
	q.Set("limit", strconv.Itoa(limit))
	if cursor != "" {
		q.Set("cursor", cursor)
	}
	u.RawQuery = q.Encode()

	// Make request with retries
	var resp *http.Response
	var lastErr error

	for attempt := 0; attempt <= c.retryAttempts; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, "", ctx.Err()
			case <-time.After(c.retryDelay * time.Duration(attempt)):
			}
			log.Debug().Int("attempt", attempt).Msg("Retrying request")
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
		if err != nil {
			return nil, "", fmt.Errorf("failed to create request: %w", err)
		}

		req.Header.Set("User-Agent", c.userAgent)
		req.Header.Set("Accept", "application/json")

		resp, lastErr = c.httpClient.Do(req)
		if lastErr == nil && resp.StatusCode == http.StatusOK {
			break
		}

		if resp != nil {
			resp.Body.Close()
			if resp.StatusCode >= 400 && resp.StatusCode < 500 {
				// Don't retry client errors
				break
			}
		}
	}

	if lastErr != nil {
		return nil, "", fmt.Errorf("request failed after retries: %w", lastErr)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, "", fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response - the registry API has a nested structure
	var result struct {
		Servers []struct {
			Server struct {
				Name        string `json:"name"`
				Description string `json:"description"`
				Repository  *struct {
					URL    string `json:"url"`
					Source string `json:"source"`
				} `json:"repository"`
				Version  string `json:"version"`
				Packages []struct {
					RegistryType string `json:"registryType"`
					Identifier   string `json:"identifier"`
					Name         string `json:"name"`
					Version      string `json:"version"`
				} `json:"packages"`
			} `json:"server"`
			Meta struct {
				Official struct {
					Status      string `json:"status"`
					PublishedAt string `json:"publishedAt"`
					UpdatedAt   string `json:"updatedAt"`
					IsLatest    bool   `json:"isLatest"`
				} `json:"io.modelcontextprotocol.registry/official"`
			} `json:"_meta"`
		} `json:"servers"`
		Metadata struct {
			NextCursor string `json:"nextCursor"`
			Count      int    `json:"count"`
		} `json:"metadata"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, "", fmt.Errorf("failed to decode response: %w", err)
	}

	// Convert to our Server type
	servers := make([]types.Server, 0, len(result.Servers))
	for _, s := range result.Servers {
		server := types.Server{
			Name:        s.Server.Name,
			Description: s.Server.Description,
		}
		if s.Server.Repository != nil {
			server.Repository = &types.Repository{
				URL:    s.Server.Repository.URL,
				Source: s.Server.Repository.Source,
			}
		}
		if s.Server.Version != "" {
			server.VersionDetail = &types.VersionDetail{
				Version:  s.Server.Version,
				IsLatest: s.Meta.Official.IsLatest,
			}
		}
		// Parse timestamps
		if s.Meta.Official.PublishedAt != "" {
			if t, err := time.Parse(time.RFC3339, s.Meta.Official.PublishedAt); err == nil {
				server.CreatedAt = t
			}
		}
		if s.Meta.Official.UpdatedAt != "" {
			if t, err := time.Parse(time.RFC3339, s.Meta.Official.UpdatedAt); err == nil {
				server.UpdatedAt = t
			}
		}
		// Convert packages
		for _, p := range s.Server.Packages {
			pkg := types.Package{
				RegistryType: p.RegistryType,
				Name:         p.Name,
				Version:      p.Version,
			}
			if pkg.Name == "" {
				pkg.Name = p.Identifier
			}
			server.Packages = append(server.Packages, pkg)
		}
		servers = append(servers, server)
	}

	return servers, result.Metadata.NextCursor, nil
}

// GetServer fetches a single server by name.
func (c *Client) GetServer(ctx context.Context, name string) (*types.Server, error) {
	ctx, span := tracer.Start(ctx, "GetServer", trace.WithAttributes(
		attribute.String("server_name", name),
	))
	defer span.End()

	u, err := url.Parse(c.baseURL + "/v0/servers/" + url.PathEscape(name))
	if err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", c.userAgent)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	var server types.Server
	if err := json.NewDecoder(resp.Body).Decode(&server); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &server, nil
}

// GetServersUpdatedSince fetches servers updated since the given timestamp.
// This is more efficient than fetching all servers when only checking for updates.
func (c *Client) GetServersUpdatedSince(ctx context.Context, since time.Time) ([]types.Server, error) {
	ctx, span := tracer.Start(ctx, "GetServersUpdatedSince", trace.WithAttributes(
		attribute.String("since", since.Format(time.RFC3339)),
	))
	defer span.End()

	var allServers []types.Server
	var cursor string

	for {
		u, err := url.Parse(c.baseURL + "/v0/servers")
		if err != nil {
			return nil, fmt.Errorf("invalid base URL: %w", err)
		}

		q := u.Query()
		q.Set("limit", "100")
		q.Set("updated_since", since.Format(time.RFC3339))
		if cursor != "" {
			q.Set("cursor", cursor)
		}
		u.RawQuery = q.Encode()

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}

		req.Header.Set("User-Agent", c.userAgent)
		req.Header.Set("Accept", "application/json")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			span.RecordError(err)
			return nil, fmt.Errorf("request failed: %w", err)
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
			resp.Body.Close()
			return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
		}

		var result struct {
			Servers    []types.Server `json:"servers"`
			NextCursor string         `json:"next_cursor"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			resp.Body.Close()
			return nil, fmt.Errorf("failed to decode response: %w", err)
		}
		resp.Body.Close()

		allServers = append(allServers, result.Servers...)

		if result.NextCursor == "" {
			break
		}
		cursor = result.NextCursor
	}

	span.SetAttributes(attribute.Int("servers_updated", len(allServers)))
	return allServers, nil
}

// HealthCheck checks if the registry is reachable.
func (c *Client) HealthCheck(ctx context.Context) error {
	ctx, span := tracer.Start(ctx, "HealthCheck")
	defer span.End()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/health", nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", c.userAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		span.RecordError(err)
		return fmt.Errorf("health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unhealthy status: %d", resp.StatusCode)
	}

	return nil
}

// BaseURL returns the client's base URL.
func (c *Client) BaseURL() string {
	return c.baseURL
}
