// Package integration provides integration tests for subscription management.
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

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/nirholas/mcp-notify/pkg/types"
	"github.com/nirholas/mcp-notify/test/fixtures"
)

// MockSubscriptionStore simulates a subscription storage backend.
type MockSubscriptionStore struct {
	mu            sync.RWMutex
	subscriptions map[uuid.UUID]types.Subscription
}

// NewMockSubscriptionStore creates a new mock subscription store.
func NewMockSubscriptionStore() *MockSubscriptionStore {
	return &MockSubscriptionStore{
		subscriptions: make(map[uuid.UUID]types.Subscription),
	}
}

// Create adds a new subscription.
func (s *MockSubscriptionStore) Create(sub types.Subscription) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.subscriptions[sub.ID] = sub
	return nil
}

// Get retrieves a subscription by ID.
func (s *MockSubscriptionStore) Get(id uuid.UUID) (types.Subscription, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sub, ok := s.subscriptions[id]
	return sub, ok
}

// Update modifies an existing subscription.
func (s *MockSubscriptionStore) Update(sub types.Subscription) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.subscriptions[sub.ID] = sub
	return nil
}

// Delete removes a subscription.
func (s *MockSubscriptionStore) Delete(id uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.subscriptions, id)
	return nil
}

// List returns all subscriptions.
func (s *MockSubscriptionStore) List() []types.Subscription {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]types.Subscription, 0, len(s.subscriptions))
	for _, sub := range s.subscriptions {
		result = append(result, sub)
	}
	return result
}

// Count returns the number of subscriptions.
func (s *MockSubscriptionStore) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.subscriptions)
}

func TestSubscriptionLifecycle(t *testing.T) {
	store := NewMockSubscriptionStore()

	// Create a subscription
	sub := fixtures.CreateTestSubscription("test-lifecycle", types.ChannelWebhook, nil)
	err := store.Create(sub)
	require.NoError(t, err)

	// Verify it was created
	retrieved, ok := store.Get(sub.ID)
	require.True(t, ok)
	assert.Equal(t, sub.Name, retrieved.Name)
	assert.Equal(t, types.SubscriptionStatusActive, retrieved.Status)

	// Update the subscription
	retrieved.Status = types.SubscriptionStatusPaused
	err = store.Update(retrieved)
	require.NoError(t, err)

	// Verify update
	updated, ok := store.Get(sub.ID)
	require.True(t, ok)
	assert.Equal(t, types.SubscriptionStatusPaused, updated.Status)

	// Delete the subscription
	err = store.Delete(sub.ID)
	require.NoError(t, err)

	// Verify deletion
	_, ok = store.Get(sub.ID)
	assert.False(t, ok)
}

func TestSubscriptionFiltering(t *testing.T) {
	store := NewMockSubscriptionStore()

	// Create subscriptions with different filters
	subNew := fixtures.CreateTestSubscription("new-only", types.ChannelWebhook, nil)
	subNew.Filters = types.SubscriptionFilter{
		ChangeTypes: []types.ChangeType{types.ChangeTypeNew},
	}
	store.Create(subNew)

	subUpdated := fixtures.CreateTestSubscription("updated-only", types.ChannelWebhook, nil)
	subUpdated.Filters = types.SubscriptionFilter{
		ChangeTypes: []types.ChangeType{types.ChangeTypeUpdated},
	}
	store.Create(subUpdated)

	subAll := fixtures.CreateTestSubscription("all-changes", types.ChannelWebhook, nil)
	subAll.Filters = types.SubscriptionFilter{
		ChangeTypes: []types.ChangeType{types.ChangeTypeNew, types.ChangeTypeUpdated, types.ChangeTypeRemoved},
	}
	store.Create(subAll)

	// Test filtering logic
	changes := []types.Change{
		{ChangeType: types.ChangeTypeNew, ServerName: "new-server"},
		{ChangeType: types.ChangeTypeUpdated, ServerName: "updated-server"},
		{ChangeType: types.ChangeTypeRemoved, ServerName: "removed-server"},
	}

	// Find subscriptions that match each change type
	for _, change := range changes {
		var matchingSubs []types.Subscription
		for _, sub := range store.List() {
			if matchesFilter(sub.Filters, change) {
				matchingSubs = append(matchingSubs, sub)
			}
		}

		switch change.ChangeType {
		case types.ChangeTypeNew:
			assert.Equal(t, 2, len(matchingSubs), "new changes should match 2 subscriptions")
		case types.ChangeTypeUpdated:
			assert.Equal(t, 2, len(matchingSubs), "updated changes should match 2 subscriptions")
		case types.ChangeTypeRemoved:
			assert.Equal(t, 1, len(matchingSubs), "removed changes should match 1 subscription")
		}
	}
}

// matchesFilter checks if a change matches a subscription filter.
func matchesFilter(filter types.SubscriptionFilter, change types.Change) bool {
	if len(filter.ChangeTypes) == 0 {
		return true // No filter means match all
	}
	for _, ct := range filter.ChangeTypes {
		if ct == change.ChangeType {
			return true
		}
	}
	return false
}

func TestSubscriptionChannelTypes(t *testing.T) {
	store := NewMockSubscriptionStore()

	// Create subscriptions for each channel type
	channelTypes := []types.ChannelType{
		types.ChannelWebhook,
		types.ChannelEmail,
		types.ChannelSlack,
		types.ChannelDiscord,
		types.ChannelTelegram,
		types.ChannelTeams,
		types.ChannelRSS,
	}

	for _, ct := range channelTypes {
		sub := fixtures.CreateTestSubscription("test-"+string(ct), ct, nil)
		err := store.Create(sub)
		require.NoError(t, err)
	}

	// Verify all were created
	assert.Equal(t, len(channelTypes), store.Count())
}

func TestSubscriptionWebhookValidation(t *testing.T) {
	testCases := []struct {
		name        string
		webhookURL  string
		shouldError bool
	}{
		{"valid https", "https://example.com/webhook", false},
		{"valid http localhost", "http://localhost:8080/hook", false},
		{"missing scheme", "example.com/webhook", true},
		{"empty url", "", true},
		{"invalid url", "not-a-url", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			sub := types.Subscription{
				ID:     uuid.New(),
				Name:   "test",
				Status: types.SubscriptionStatusActive,
				Channels: []types.Channel{
					{
						Type: types.ChannelWebhook,
						Config: types.ChannelConfig{
							WebhookURL: tc.webhookURL,
						},
					},
				},
			}

			err := validateWebhookURL(sub)
			if tc.shouldError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// validateWebhookURL validates the webhook URL in a subscription.
func validateWebhookURL(sub types.Subscription) error {
	if len(sub.Channels) == 0 {
		return nil
	}

	for _, ch := range sub.Channels {
		if ch.Type != types.ChannelWebhook {
			continue
		}

		url := ch.Config.WebhookURL
		if url == "" {
			return assert.AnError
		}

		if len(url) < 7 || (url[:7] != "http://" && (len(url) < 8 || url[:8] != "https://")) {
			return assert.AnError
		}
	}

	return nil
}

func TestSubscriptionDeliveryTracking(t *testing.T) {
	store := NewMockSubscriptionStore()
	deliveryLog := make(map[string][]time.Time)
	var mu sync.Mutex

	// Create webhook receiver
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		subID := r.Header.Get("X-Subscription-ID")
		mu.Lock()
		deliveryLog[subID] = append(deliveryLog[subID], time.Now())
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Create subscriptions
	for i := 0; i < 3; i++ {
		sub := fixtures.CreateTestSubscription("tracking", types.ChannelWebhook, nil)
		if len(sub.Channels) > 0 {
			sub.Channels[0].Config.WebhookURL = server.URL
		}
		store.Create(sub)
	}

	// Simulate deliveries
	for _, sub := range store.List() {
		req, _ := http.NewRequest("POST", server.URL, nil)
		req.Header.Set("X-Subscription-ID", sub.ID.String())
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		resp.Body.Close()
	}

	// Verify deliveries were tracked
	mu.Lock()
	defer mu.Unlock()
	assert.Equal(t, 3, len(deliveryLog))
	for _, times := range deliveryLog {
		assert.Len(t, times, 1)
	}
}

func TestSubscriptionConcurrentAccess(t *testing.T) {
	store := NewMockSubscriptionStore()
	var wg sync.WaitGroup

	// Create initial subscriptions
	for i := 0; i < 10; i++ {
		sub := fixtures.CreateTestSubscription("concurrent", types.ChannelWebhook, nil)
		store.Create(sub)
	}

	// Concurrent reads
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = store.List()
			_ = store.Count()
		}()
	}

	// Concurrent writes
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sub := fixtures.CreateTestSubscription("concurrent-new", types.ChannelWebhook, nil)
			store.Create(sub)
		}()
	}

	wg.Wait()

	// Should have 30 subscriptions (10 initial + 20 added)
	assert.Equal(t, 30, store.Count())
}

func TestSubscriptionAPIEndpoints(t *testing.T) {
	store := NewMockSubscriptionStore()

	// Create a simple API handler
	mux := http.NewServeMux()

	// List subscriptions
	mux.HandleFunc("GET /subscriptions", func(w http.ResponseWriter, r *http.Request) {
		subs := store.List()
		json.NewEncoder(w).Encode(subs)
	})

	// Create subscription
	mux.HandleFunc("POST /subscriptions", func(w http.ResponseWriter, r *http.Request) {
		var sub types.Subscription
		if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		store.Create(sub)
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(sub)
	})

	// Get subscription
	mux.HandleFunc("GET /subscriptions/{id}", func(w http.ResponseWriter, r *http.Request) {
		idStr := r.PathValue("id")
		id, err := uuid.Parse(idStr)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		sub, ok := store.Get(id)
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(sub)
	})

	// Delete subscription
	mux.HandleFunc("DELETE /subscriptions/{id}", func(w http.ResponseWriter, r *http.Request) {
		idStr := r.PathValue("id")
		id, err := uuid.Parse(idStr)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		store.Delete(id)
		w.WriteHeader(http.StatusNoContent)
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	ctx := context.Background()

	// Test POST
	sub := fixtures.CreateTestSubscription("api-test", types.ChannelWebhook, nil)
	body, _ := json.Marshal(sub)
	req, _ := http.NewRequestWithContext(ctx, "POST", server.URL+"/subscriptions",
		bytes.NewReader(body))
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	// Test GET list
	req, _ = http.NewRequestWithContext(ctx, "GET", server.URL+"/subscriptions", nil)
	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	var subs []types.Subscription
	json.NewDecoder(resp.Body).Decode(&subs)
	resp.Body.Close()
	assert.Len(t, subs, 1)

	// Test GET single
	req, _ = http.NewRequestWithContext(ctx, "GET", server.URL+"/subscriptions/"+sub.ID.String(), nil)
	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// Test DELETE
	req, _ = http.NewRequestWithContext(ctx, "DELETE", server.URL+"/subscriptions/"+sub.ID.String(), nil)
	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)

	// Verify deleted
	req, _ = http.NewRequestWithContext(ctx, "GET", server.URL+"/subscriptions/"+sub.ID.String(), nil)
	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}
