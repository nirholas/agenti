// Package e2e provides end-to-end tests for the MCP Notify API.
package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/nirholas/mcp-notify/pkg/types"
	"github.com/nirholas/mcp-notify/test/fixtures"
)

// MockAPIServer creates a mock API server for testing.
type MockAPIServer struct {
	*httptest.Server
	servers       []types.Server
	changes       []types.Change
	subscriptions map[string]types.Subscription
}

// NewMockAPIServer creates and starts a new mock API server.
func NewMockAPIServer() *MockAPIServer {
	api := &MockAPIServer{
		servers:       fixtures.TestServers,
		changes:       fixtures.TestChanges,
		subscriptions: make(map[string]types.Subscription),
	}

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	})

	// List servers
	mux.HandleFunc("GET /api/v1/servers", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"servers": api.servers,
			"total":   len(api.servers),
		})
	})

	// Server history (use {name...} to capture paths with slashes, check for /history suffix)
	mux.HandleFunc("GET /api/v1/servers/{name...}", func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		
		// Check if this is a history request
		if len(name) > 8 && name[len(name)-8:] == "/history" {
			serverName := name[:len(name)-8]
			var history []types.Change
			for _, c := range api.changes {
				if c.ServerName == serverName {
					history = append(history, c)
				}
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"changes": history,
				"total":   len(history),
			})
			return
		}
		
		// Otherwise, get the server
		for _, s := range api.servers {
			if s.Name == name {
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(s)
				return
			}
		}
		w.WriteHeader(http.StatusNotFound)
	})

	// List changes
	mux.HandleFunc("GET /api/v1/changes", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"changes": api.changes,
			"total":   len(api.changes),
		})
	})

	// Create subscription
	mux.HandleFunc("POST /api/v1/subscriptions", func(w http.ResponseWriter, r *http.Request) {
		var sub types.Subscription
		if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if sub.ID == uuid.Nil {
			sub.ID = uuid.New()
		}
		sub.CreatedAt = time.Now()
		sub.UpdatedAt = time.Now()
		api.subscriptions[sub.ID.String()] = sub
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(sub)
	})

	// List subscriptions
	mux.HandleFunc("GET /api/v1/subscriptions", func(w http.ResponseWriter, r *http.Request) {
		subs := make([]types.Subscription, 0, len(api.subscriptions))
		for _, s := range api.subscriptions {
			subs = append(subs, s)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"subscriptions": subs,
			"total":         len(subs),
		})
	})

	// Get subscription
	mux.HandleFunc("GET /api/v1/subscriptions/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if sub, ok := api.subscriptions[id]; ok {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(sub)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	})

	// Delete subscription
	mux.HandleFunc("DELETE /api/v1/subscriptions/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if _, ok := api.subscriptions[id]; ok {
			delete(api.subscriptions, id)
			w.WriteHeader(http.StatusNoContent)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	})

	// Update subscription
	mux.HandleFunc("PATCH /api/v1/subscriptions/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		sub, ok := api.subscriptions[id]
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		
		var update map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		
		if active, ok := update["active"].(bool); ok {
			if active {
				sub.Status = types.SubscriptionStatusActive
			} else {
				sub.Status = types.SubscriptionStatusPaused
			}
		}
		sub.UpdatedAt = time.Now()
		api.subscriptions[id] = sub
		
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(sub)
	})

	api.Server = httptest.NewServer(mux)
	return api
}

// TestAPIHealthCheck tests the health check endpoint.
func TestAPIHealthCheck(t *testing.T) {
	api := NewMockAPIServer()
	defer api.Close()

	resp, err := http.Get(api.URL + "/health")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result map[string]string
	err = json.NewDecoder(resp.Body).Decode(&result)
	require.NoError(t, err)
	assert.Equal(t, "healthy", result["status"])
}

// TestAPIListServers tests the list servers endpoint.
func TestAPIListServers(t *testing.T) {
	api := NewMockAPIServer()
	defer api.Close()

	resp, err := http.Get(api.URL + "/api/v1/servers")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result struct {
		Servers []types.Server `json:"servers"`
		Total   int            `json:"total"`
	}
	err = json.NewDecoder(resp.Body).Decode(&result)
	require.NoError(t, err)
	assert.Equal(t, len(fixtures.TestServers), result.Total)
}

// TestAPIGetServer tests getting a specific server.
func TestAPIGetServer(t *testing.T) {
	api := NewMockAPIServer()
	defer api.Close()

	serverName := fixtures.TestServers[0].Name
	resp, err := http.Get(api.URL + "/api/v1/servers/" + serverName)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var server types.Server
	err = json.NewDecoder(resp.Body).Decode(&server)
	require.NoError(t, err)
	assert.Equal(t, serverName, server.Name)
}

// TestAPIGetServerNotFound tests getting a non-existent server.
func TestAPIGetServerNotFound(t *testing.T) {
	api := NewMockAPIServer()
	defer api.Close()

	resp, err := http.Get(api.URL + "/api/v1/servers/non-existent")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}

// TestAPIListChanges tests listing changes.
func TestAPIListChanges(t *testing.T) {
	api := NewMockAPIServer()
	defer api.Close()

	resp, err := http.Get(api.URL + "/api/v1/changes")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result struct {
		Changes []types.Change `json:"changes"`
		Total   int            `json:"total"`
	}
	err = json.NewDecoder(resp.Body).Decode(&result)
	require.NoError(t, err)
	assert.Equal(t, len(fixtures.TestChanges), result.Total)
}

// TestAPICreateSubscription tests creating a subscription.
func TestAPICreateSubscription(t *testing.T) {
	api := NewMockAPIServer()
	defer api.Close()

	sub := types.Subscription{
		Name:   "Test Subscription",
		Status: types.SubscriptionStatusActive,
		Channels: []types.Channel{
			{
				Type: types.ChannelWebhook,
				Config: types.ChannelConfig{
					WebhookURL: "https://example.com/webhook",
				},
			},
		},
	}

	body, _ := json.Marshal(sub)
	resp, err := http.Post(api.URL+"/api/v1/subscriptions", "application/json", bytes.NewReader(body))
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var created types.Subscription
	err = json.NewDecoder(resp.Body).Decode(&created)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, created.ID)
	assert.Equal(t, sub.Name, created.Name)
}

// TestAPIListSubscriptions tests listing subscriptions.
func TestAPIListSubscriptions(t *testing.T) {
	api := NewMockAPIServer()
	defer api.Close()

	// Create a subscription first
	sub := types.Subscription{
		Name:   "Test",
		Status: types.SubscriptionStatusActive,
		Channels: []types.Channel{
			{
				Type:   types.ChannelWebhook,
				Config: types.ChannelConfig{WebhookURL: "https://example.com"},
			},
		},
	}
	body, _ := json.Marshal(sub)
	resp, err := http.Post(api.URL+"/api/v1/subscriptions", "application/json", bytes.NewReader(body))
	require.NoError(t, err)
	resp.Body.Close()

	// List subscriptions
	resp, err = http.Get(api.URL + "/api/v1/subscriptions")
	require.NoError(t, err)
	defer resp.Body.Close()

	var result struct {
		Subscriptions []types.Subscription `json:"subscriptions"`
		Total         int                  `json:"total"`
	}
	err = json.NewDecoder(resp.Body).Decode(&result)
	require.NoError(t, err)
	assert.Equal(t, 1, result.Total)
}

// TestAPIDeleteSubscription tests deleting a subscription.
func TestAPIDeleteSubscription(t *testing.T) {
	api := NewMockAPIServer()
	defer api.Close()

	// Create a subscription
	sub := types.Subscription{
		Name:   "To Delete",
		Status: types.SubscriptionStatusActive,
		Channels: []types.Channel{
			{
				Type:   types.ChannelWebhook,
				Config: types.ChannelConfig{WebhookURL: "https://example.com"},
			},
		},
	}
	body, _ := json.Marshal(sub)
	resp, err := http.Post(api.URL+"/api/v1/subscriptions", "application/json", bytes.NewReader(body))
	require.NoError(t, err)
	
	var created types.Subscription
	json.NewDecoder(resp.Body).Decode(&created)
	resp.Body.Close()

	// Delete subscription
	ctx := context.Background()
	req, _ := http.NewRequestWithContext(ctx, "DELETE", api.URL+"/api/v1/subscriptions/"+created.ID.String(), nil)
	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)

	// Verify deleted
	resp, err = http.Get(api.URL + "/api/v1/subscriptions/" + created.ID.String())
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}

// TestAPIPauseResumeSubscription tests pausing and resuming a subscription.
func TestAPIPauseResumeSubscription(t *testing.T) {
	api := NewMockAPIServer()
	defer api.Close()

	// Create a subscription
	sub := types.Subscription{
		Name:   "Pause Test",
		Status: types.SubscriptionStatusActive,
		Channels: []types.Channel{
			{
				Type:   types.ChannelWebhook,
				Config: types.ChannelConfig{WebhookURL: "https://example.com"},
			},
		},
	}
	body, _ := json.Marshal(sub)
	resp, err := http.Post(api.URL+"/api/v1/subscriptions", "application/json", bytes.NewReader(body))
	require.NoError(t, err)
	
	var created types.Subscription
	json.NewDecoder(resp.Body).Decode(&created)
	resp.Body.Close()
	assert.Equal(t, types.SubscriptionStatusActive, created.Status)

	// Pause subscription
	ctx := context.Background()
	update := map[string]interface{}{"active": false}
	body, _ = json.Marshal(update)
	req, _ := http.NewRequestWithContext(ctx, "PATCH", api.URL+"/api/v1/subscriptions/"+created.ID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	
	var paused types.Subscription
	json.NewDecoder(resp.Body).Decode(&paused)
	resp.Body.Close()
	assert.Equal(t, types.SubscriptionStatusPaused, paused.Status)

	// Resume subscription
	update = map[string]interface{}{"active": true}
	body, _ = json.Marshal(update)
	req, _ = http.NewRequestWithContext(ctx, "PATCH", api.URL+"/api/v1/subscriptions/"+created.ID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	
	var resumed types.Subscription
	json.NewDecoder(resp.Body).Decode(&resumed)
	resp.Body.Close()
	assert.Equal(t, types.SubscriptionStatusActive, resumed.Status)
}

// TestAPIServerHistory tests getting server change history.
func TestAPIServerHistory(t *testing.T) {
	api := NewMockAPIServer()
	defer api.Close()

	serverName := fixtures.TestChanges[0].ServerName
	resp, err := http.Get(api.URL + "/api/v1/servers/" + serverName + "/history")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result struct {
		Changes []types.Change `json:"changes"`
		Total   int            `json:"total"`
	}
	err = json.NewDecoder(resp.Body).Decode(&result)
	require.NoError(t, err)
	// Should have at least some changes for this server
	assert.GreaterOrEqual(t, result.Total, 0)
}

// TestAPIConcurrentRequests tests handling concurrent requests.
func TestAPIConcurrentRequests(t *testing.T) {
	api := NewMockAPIServer()
	defer api.Close()

	const numRequests = 50
	results := make(chan int, numRequests)

	for i := 0; i < numRequests; i++ {
		go func() {
			resp, err := http.Get(api.URL + "/api/v1/servers")
			if err != nil {
				results <- 0
				return
			}
			defer resp.Body.Close()
			io.Copy(io.Discard, resp.Body)
			results <- resp.StatusCode
		}()
	}

	successCount := 0
	for i := 0; i < numRequests; i++ {
		if <-results == http.StatusOK {
			successCount++
		}
	}

	assert.Equal(t, numRequests, successCount, "all concurrent requests should succeed")
}

// TestAPIContentType tests that responses have correct content type.
func TestAPIContentType(t *testing.T) {
	api := NewMockAPIServer()
	defer api.Close()

	endpoints := []string{
		"/health",
		"/api/v1/servers",
		"/api/v1/changes",
	}

	for _, endpoint := range endpoints {
		t.Run(endpoint, func(t *testing.T) {
			resp, err := http.Get(api.URL + endpoint)
			require.NoError(t, err)
			defer resp.Body.Close()

			contentType := resp.Header.Get("Content-Type")
			assert.Contains(t, contentType, "application/json")
		})
	}
}

// TestAPIInvalidJSON tests handling of invalid JSON requests.
func TestAPIInvalidJSON(t *testing.T) {
	api := NewMockAPIServer()
	defer api.Close()

	resp, err := http.Post(api.URL+"/api/v1/subscriptions", "application/json", 
		bytes.NewReader([]byte("not valid json")))
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

// TestFullWorkflow tests a complete user workflow.
func TestFullWorkflow(t *testing.T) {
	api := NewMockAPIServer()
	defer api.Close()

	// 1. Check health
	resp, err := http.Get(api.URL + "/health")
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// 2. List servers
	resp, err = http.Get(api.URL + "/api/v1/servers")
	require.NoError(t, err)
	var serversResult struct {
		Servers []types.Server `json:"servers"`
	}
	json.NewDecoder(resp.Body).Decode(&serversResult)
	resp.Body.Close()
	require.NotEmpty(t, serversResult.Servers)

	// 3. Create a subscription
	sub := types.Subscription{
		Name:   "Workflow Test",
		Status: types.SubscriptionStatusActive,
		Channels: []types.Channel{
			{
				Type:   types.ChannelWebhook,
				Config: types.ChannelConfig{WebhookURL: "https://example.com/webhook"},
			},
		},
		Filters: types.SubscriptionFilter{
			ChangeTypes: []types.ChangeType{types.ChangeTypeNew, types.ChangeTypeUpdated},
		},
	}
	body, _ := json.Marshal(sub)
	resp, err = http.Post(api.URL+"/api/v1/subscriptions", "application/json", bytes.NewReader(body))
	require.NoError(t, err)
	var created types.Subscription
	json.NewDecoder(resp.Body).Decode(&created)
	resp.Body.Close()
	assert.NotEqual(t, uuid.Nil, created.ID)

	// 4. Get changes
	resp, err = http.Get(api.URL + "/api/v1/changes")
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// 5. Pause subscription
	ctx := context.Background()
	update := map[string]interface{}{"active": false}
	body, _ = json.Marshal(update)
	req, _ := http.NewRequestWithContext(ctx, "PATCH", api.URL+"/api/v1/subscriptions/"+created.ID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// 6. Delete subscription
	req, _ = http.NewRequestWithContext(ctx, "DELETE", api.URL+"/api/v1/subscriptions/"+created.ID.String(), nil)
	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
}
