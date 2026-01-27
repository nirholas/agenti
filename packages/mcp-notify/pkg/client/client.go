// Package client provides a Go SDK for the MCP Notify API.
package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// Client is the MCP Notify API client.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// Option configures the client.
type Option func(*Client)

// WithHTTPClient sets a custom HTTP client.
func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) {
		c.httpClient = hc
	}
}

// WithAPIKey sets the API key for authenticated requests.
func WithAPIKey(key string) Option {
	return func(c *Client) {
		c.apiKey = key
	}
}

// New creates a new MCP Notify client.
func New(baseURL string, opts ...Option) *Client {
	c := &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// Server represents an MCP server in the registry.
type Server struct {
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Repository  *Repository       `json:"repository,omitempty"`
	Version     *VersionDetail    `json:"version_detail,omitempty"`
	License     string            `json:"license,omitempty"`
	Links       map[string]string `json:"links,omitempty"`
}

// Repository contains repository information.
type Repository struct {
	URL   string `json:"url"`
	Stars int    `json:"stars,omitempty"`
	Forks int    `json:"forks,omitempty"`
}

// VersionDetail contains version information.
type VersionDetail struct {
	Version string `json:"version,omitempty"`
	Tag     string `json:"tag,omitempty"`
}

// Change represents a detected change in the registry.
type Change struct {
	ID              string        `json:"id"`
	ServerName      string        `json:"server_name"`
	ChangeType      string        `json:"change_type"`
	PreviousVersion string        `json:"previous_version,omitempty"`
	NewVersion      string        `json:"new_version,omitempty"`
	FieldChanges    []FieldChange `json:"field_changes,omitempty"`
	Server          *Server       `json:"server,omitempty"`
	DetectedAt      time.Time     `json:"detected_at"`
}

// FieldChange represents a change in a specific field.
type FieldChange struct {
	Field    string      `json:"field"`
	OldValue interface{} `json:"old_value"`
	NewValue interface{} `json:"new_value"`
}

// Subscription represents a notification subscription.
type Subscription struct {
	ID          string             `json:"id"`
	Name        string             `json:"name"`
	Description string             `json:"description,omitempty"`
	Filters     SubscriptionFilter `json:"filters"`
	Channels    []Channel          `json:"channels"`
	Status      string             `json:"status"`
	CreatedAt   time.Time          `json:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at"`
}

// SubscriptionFilter defines filters for a subscription.
type SubscriptionFilter struct {
	Namespaces  []string `json:"namespaces,omitempty"`
	Keywords    []string `json:"keywords,omitempty"`
	ChangeTypes []string `json:"change_types,omitempty"`
}

// Channel represents a notification channel.
type Channel struct {
	Type   string                 `json:"type"`
	Config map[string]interface{} `json:"config"`
}

// CreateSubscriptionRequest is the request to create a subscription.
type CreateSubscriptionRequest struct {
	Name        string             `json:"name"`
	Description string             `json:"description,omitempty"`
	Filters     SubscriptionFilter `json:"filters"`
	Channels    []Channel          `json:"channels"`
}

// CreateSubscriptionResponse is the response from creating a subscription.
type CreateSubscriptionResponse struct {
	Subscription
	APIKey string `json:"api_key"`
}

// UpdateSubscriptionRequest is the request to update a subscription.
type UpdateSubscriptionRequest struct {
	Name        *string             `json:"name,omitempty"`
	Description *string             `json:"description,omitempty"`
	Filters     *SubscriptionFilter `json:"filters,omitempty"`
	Channels    []Channel           `json:"channels,omitempty"`
}

// ListServersResponse is the response for listing servers.
type ListServersResponse struct {
	Servers    []Server `json:"servers"`
	TotalCount int      `json:"total_count"`
}

// ListChangesParams are parameters for listing changes.
type ListChangesParams struct {
	Since  *time.Time
	Server string
	Type   string
	Limit  int
}

// ListChangesResponse is the response for listing changes.
type ListChangesResponse struct {
	Changes    []Change `json:"changes"`
	TotalCount int      `json:"total_count"`
	NextCursor string   `json:"next_cursor,omitempty"`
}

// ListSubscriptionsResponse is the response for listing subscriptions.
type ListSubscriptionsResponse struct {
	Subscriptions []Subscription `json:"subscriptions"`
	TotalCount    int            `json:"total_count"`
}

// Stats contains registry statistics.
type Stats struct {
	TotalServers       int `json:"total_servers"`
	TotalChanges       int `json:"total_changes"`
	TotalSubscriptions int `json:"total_subscriptions"`
	ChangesToday       int `json:"changes_today"`
	ChangesThisWeek    int `json:"changes_this_week"`
}

// Error represents an API error.
type Error struct {
	StatusCode int
	Message    string
}

func (e *Error) Error() string {
	return fmt.Sprintf("API error %d: %s", e.StatusCode, e.Message)
}

// ListServers returns all servers in the registry.
func (c *Client) ListServers(ctx context.Context) (*ListServersResponse, error) {
	var resp ListServersResponse
	if err := c.get(ctx, "/api/v1/servers", nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// SearchServers searches for servers by query.
func (c *Client) SearchServers(ctx context.Context, query string) (*ListServersResponse, error) {
	params := url.Values{"q": {query}}
	var resp ListServersResponse
	if err := c.get(ctx, "/api/v1/servers/search", params, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// GetServer returns a specific server by name.
func (c *Client) GetServer(ctx context.Context, name string) (*Server, error) {
	var resp Server
	if err := c.get(ctx, "/api/v1/servers/"+url.PathEscape(name), nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ListChanges returns changes based on the provided parameters.
func (c *Client) ListChanges(ctx context.Context, params *ListChangesParams) (*ListChangesResponse, error) {
	qp := url.Values{}
	if params != nil {
		if params.Since != nil {
			qp.Set("since", params.Since.Format(time.RFC3339))
		}
		if params.Server != "" {
			qp.Set("server", params.Server)
		}
		if params.Type != "" {
			qp.Set("type", params.Type)
		}
		if params.Limit > 0 {
			qp.Set("limit", fmt.Sprintf("%d", params.Limit))
		}
	}
	var resp ListChangesResponse
	if err := c.get(ctx, "/api/v1/changes", qp, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// GetChange returns a specific change by ID.
func (c *Client) GetChange(ctx context.Context, id string) (*Change, error) {
	var resp Change
	if err := c.get(ctx, "/api/v1/changes/"+url.PathEscape(id), nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// GetStats returns registry statistics.
func (c *Client) GetStats(ctx context.Context) (*Stats, error) {
	var resp Stats
	if err := c.get(ctx, "/api/v1/stats", nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// CreateSubscription creates a new subscription.
func (c *Client) CreateSubscription(ctx context.Context, req *CreateSubscriptionRequest) (*CreateSubscriptionResponse, error) {
	var resp CreateSubscriptionResponse
	if err := c.post(ctx, "/api/v1/subscriptions", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ListSubscriptions returns all subscriptions.
func (c *Client) ListSubscriptions(ctx context.Context) (*ListSubscriptionsResponse, error) {
	var resp ListSubscriptionsResponse
	if err := c.get(ctx, "/api/v1/subscriptions", nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// GetSubscription returns a specific subscription by ID.
func (c *Client) GetSubscription(ctx context.Context, id string) (*Subscription, error) {
	var resp Subscription
	if err := c.get(ctx, "/api/v1/subscriptions/"+url.PathEscape(id), nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// UpdateSubscription updates an existing subscription.
func (c *Client) UpdateSubscription(ctx context.Context, id string, req *UpdateSubscriptionRequest) (*Subscription, error) {
	var resp Subscription
	if err := c.put(ctx, "/api/v1/subscriptions/"+url.PathEscape(id), req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// DeleteSubscription deletes a subscription.
func (c *Client) DeleteSubscription(ctx context.Context, id string) error {
	return c.delete(ctx, "/api/v1/subscriptions/"+url.PathEscape(id))
}

// PauseSubscription pauses a subscription.
func (c *Client) PauseSubscription(ctx context.Context, id string) (*Subscription, error) {
	var resp Subscription
	if err := c.post(ctx, "/api/v1/subscriptions/"+url.PathEscape(id)+"/pause", nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ResumeSubscription resumes a paused subscription.
func (c *Client) ResumeSubscription(ctx context.Context, id string) (*Subscription, error) {
	var resp Subscription
	if err := c.post(ctx, "/api/v1/subscriptions/"+url.PathEscape(id)+"/resume", nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// TestSubscription sends a test notification.
func (c *Client) TestSubscription(ctx context.Context, id string) error {
	return c.post(ctx, "/api/v1/subscriptions/"+url.PathEscape(id)+"/test", nil, nil)
}

// Helper methods

func (c *Client) get(ctx context.Context, path string, params url.Values, result interface{}) error {
	u := c.baseURL + path
	if len(params) > 0 {
		u += "?" + params.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return err
	}
	return c.do(req, result)
}

func (c *Client) post(ctx context.Context, path string, body interface{}, result interface{}) error {
	return c.doWithBody(ctx, http.MethodPost, path, body, result)
}

func (c *Client) put(ctx context.Context, path string, body interface{}, result interface{}) error {
	return c.doWithBody(ctx, http.MethodPut, path, body, result)
}

func (c *Client) delete(ctx context.Context, path string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, c.baseURL+path, nil)
	if err != nil {
		return err
	}
	return c.do(req, nil)
}

func (c *Client) doWithBody(ctx context.Context, method, path string, body interface{}, result interface{}) error {
	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		bodyReader = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.do(req, result)
}

func (c *Client) do(req *http.Request, result interface{}) error {
	if c.apiKey != "" {
		req.Header.Set("X-API-Key", c.apiKey)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		var errResp struct {
			Error string `json:"error"`
		}
		if json.Unmarshal(body, &errResp) == nil && errResp.Error != "" {
			return &Error{StatusCode: resp.StatusCode, Message: errResp.Error}
		}
		return &Error{StatusCode: resp.StatusCode, Message: string(body)}
	}

	if result != nil && resp.StatusCode != http.StatusNoContent {
		return json.NewDecoder(resp.Body).Decode(result)
	}
	return nil
}
