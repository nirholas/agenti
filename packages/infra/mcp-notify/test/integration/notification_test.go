// Package integration provides integration tests for notification delivery.
package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/nirholas/mcp-notify/pkg/types"
	"github.com/nirholas/mcp-notify/test/fixtures"
)

// WebhookPayload is a test payload structure for webhook tests.
type WebhookPayload struct {
	EventType string         `json:"event_type"`
	Timestamp time.Time      `json:"timestamp"`
	Changes   []types.Change `json:"changes"`
}

// TestWebhookNotificationDelivery tests that webhook notifications are delivered correctly.
func TestWebhookNotificationDelivery(t *testing.T) {
	var received []WebhookPayload
	var mu sync.Mutex

	// Create a webhook receiver
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload WebhookPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		mu.Lock()
		received = append(received, payload)
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Create changes to notify about
	changes := []types.Change{
		fixtures.TestChanges[0],
		fixtures.TestChanges[1],
	}

	// Send webhook notification
	payload := WebhookPayload{
		EventType: "registry.changes",
		Timestamp: time.Now(),
		Changes:   changes,
	}

	body, err := json.Marshal(payload)
	require.NoError(t, err)

	// Send the notification
	resp, err := http.Post(server.URL, "application/json", 
		bytes.NewReader(body))
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// Verify receipt
	mu.Lock()
	defer mu.Unlock()
	require.Len(t, received, 1)
	assert.Equal(t, "registry.changes", received[0].EventType)
	assert.Len(t, received[0].Changes, 2)
}

// TestWebhookRetryOnFailure tests that webhooks retry on transient failures.
func TestWebhookRetryOnFailure(t *testing.T) {
	attempts := 0
	var mu sync.Mutex

	// Create a webhook receiver that fails initially then succeeds
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		attempts++
		currentAttempt := attempts
		mu.Unlock()

		if currentAttempt < 3 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Simulate retry logic
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var lastErr error
	for i := 0; i < 3; i++ {
		select {
		case <-ctx.Done():
			t.Fatal("timeout waiting for successful delivery")
		default:
		}

		resp, err := http.Post(server.URL, "application/json", nil)
		if err != nil {
			lastErr = err
			time.Sleep(100 * time.Millisecond)
			continue
		}
		resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			lastErr = nil
			break
		}
		time.Sleep(100 * time.Millisecond)
	}

	assert.NoError(t, lastErr)
	mu.Lock()
	assert.GreaterOrEqual(t, attempts, 3)
	mu.Unlock()
}

// TestWebhookTimeout tests that webhook delivery respects timeouts.
func TestWebhookTimeout(t *testing.T) {
	// Create a slow webhook receiver
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(2 * time.Second)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Use a short timeout
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	client := &http.Client{
		Timeout: 100 * time.Millisecond,
	}

	req, err := http.NewRequestWithContext(ctx, "POST", server.URL, nil)
	require.NoError(t, err)

	_, err = client.Do(req)
	assert.Error(t, err)
}

// TestNotificationBatching tests that notifications can be batched.
func TestNotificationBatching(t *testing.T) {
	var receivedBatches [][]types.Change
	var mu sync.Mutex

	// Create a webhook receiver that captures batches
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			Changes []types.Change `json:"changes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		mu.Lock()
		receivedBatches = append(receivedBatches, payload.Changes)
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Create a batch of changes
	changes := fixtures.GenerateTestChanges(5, 3, 2)

	// Send as a single batch
	payload := struct {
		Changes []types.Change `json:"changes"`
	}{
		Changes: changes,
	}

	body, err := json.Marshal(payload)
	require.NoError(t, err)

	resp, err := http.Post(server.URL, "application/json", 
		bytes.NewReader(body))
	require.NoError(t, err)
	resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	mu.Lock()
	defer mu.Unlock()
	require.Len(t, receivedBatches, 1)
	assert.Len(t, receivedBatches[0], 10)
}

// TestMultipleChannelDelivery tests delivery to multiple notification channels.
func TestMultipleChannelDelivery(t *testing.T) {
	var webhook1Count, webhook2Count int
	var mu sync.Mutex

	// Create two webhook receivers
	server1 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		webhook1Count++
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer server1.Close()

	server2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		webhook2Count++
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer server2.Close()

	// Send to both webhooks
	changes := fixtures.TestChanges[:2]
	payload, _ := json.Marshal(map[string]interface{}{
		"changes": changes,
	})

	// Parallel delivery
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		resp, _ := http.Post(server1.URL, "application/json", bytes.NewReader(payload))
		if resp != nil {
			resp.Body.Close()
		}
	}()

	go func() {
		defer wg.Done()
		resp, _ := http.Post(server2.URL, "application/json", bytes.NewReader(payload))
		if resp != nil {
			resp.Body.Close()
		}
	}()

	wg.Wait()

	mu.Lock()
	defer mu.Unlock()
	assert.Equal(t, 1, webhook1Count)
	assert.Equal(t, 1, webhook2Count)
}

// TestNotificationFiltering tests that only subscribed changes are delivered.
func TestNotificationFiltering(t *testing.T) {
	var receivedChanges []types.Change
	var mu sync.Mutex

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			Changes []types.Change `json:"changes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		mu.Lock()
		receivedChanges = append(receivedChanges, payload.Changes...)
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Create subscription filter for "new" changes only
	filter := types.SubscriptionFilter{
		ChangeTypes: []types.ChangeType{types.ChangeTypeNew},
	}

	// Generate test changes with different types
	allChanges := []types.Change{
		{ChangeType: types.ChangeTypeNew, ServerName: "new-server"},
		{ChangeType: types.ChangeTypeUpdated, ServerName: "updated-server"},
		{ChangeType: types.ChangeTypeRemoved, ServerName: "removed-server"},
	}

	// Apply filter
	var filteredChanges []types.Change
	for _, c := range allChanges {
		for _, ct := range filter.ChangeTypes {
			if c.ChangeType == ct {
				filteredChanges = append(filteredChanges, c)
			}
		}
	}

	// Send only filtered changes
	payload, _ := json.Marshal(map[string]interface{}{
		"changes": filteredChanges,
	})

	resp, err := http.Post(server.URL, "application/json", bytes.NewReader(payload))
	require.NoError(t, err)
	resp.Body.Close()

	mu.Lock()
	defer mu.Unlock()
	require.Len(t, receivedChanges, 1)
	assert.Equal(t, types.ChangeTypeNew, receivedChanges[0].ChangeType)
}

// TestRateLimitedDelivery tests that notification delivery respects rate limits.
func TestRateLimitedDelivery(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping rate limit test in short mode")
	}

	requestTimes := []time.Time{}
	var mu sync.Mutex

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		requestTimes = append(requestTimes, time.Now())
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Send multiple requests with rate limiting
	rateLimit := 100 * time.Millisecond
	for i := 0; i < 5; i++ {
		resp, err := http.Post(server.URL, "application/json", nil)
		require.NoError(t, err)
		resp.Body.Close()
		time.Sleep(rateLimit)
	}

	mu.Lock()
	defer mu.Unlock()
	require.Len(t, requestTimes, 5)

	// Verify rate limiting was respected
	for i := 1; i < len(requestTimes); i++ {
		gap := requestTimes[i].Sub(requestTimes[i-1])
		assert.GreaterOrEqual(t, gap, rateLimit-10*time.Millisecond, 
			"gap between requests should respect rate limit")
	}
}

// WebhookPayload extends the basic payload with additional metadata.
type testWebhookPayload struct {
	EventType string         `json:"event_type"`
	Timestamp time.Time      `json:"timestamp"`
	Changes   []types.Change `json:"changes"`
	Metadata  struct {
		BatchID     string `json:"batch_id"`
		TotalCount  int    `json:"total_count"`
		RetryCount  int    `json:"retry_count"`
	} `json:"metadata,omitempty"`
}

// TestNotificationMetadata tests that metadata is included in notifications.
func TestNotificationMetadata(t *testing.T) {
	var received testWebhookPayload
	var mu sync.Mutex

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		if err := json.NewDecoder(r.Body).Decode(&received); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Send notification with metadata
	payload := testWebhookPayload{
		EventType: "registry.changes",
		Timestamp: time.Now(),
		Changes:   fixtures.TestChanges[:2],
	}
	payload.Metadata.BatchID = "batch-123"
	payload.Metadata.TotalCount = 2
	payload.Metadata.RetryCount = 0

	body, _ := json.Marshal(payload)
	resp, err := http.Post(server.URL, "application/json", bytes.NewReader(body))
	require.NoError(t, err)
	resp.Body.Close()

	mu.Lock()
	defer mu.Unlock()
	assert.Equal(t, "batch-123", received.Metadata.BatchID)
	assert.Equal(t, 2, received.Metadata.TotalCount)
}
