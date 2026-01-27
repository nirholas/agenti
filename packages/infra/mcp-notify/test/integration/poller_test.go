// Package integration provides integration tests for the MCP Notify service.
package integration

import (
	"context"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/nirholas/mcp-notify/internal/config"
	"github.com/nirholas/mcp-notify/internal/diff"
	"github.com/nirholas/mcp-notify/internal/poller"
	"github.com/nirholas/mcp-notify/internal/registry"
	"github.com/nirholas/mcp-notify/pkg/types"
	"github.com/nirholas/mcp-notify/test/fixtures"
	"github.com/nirholas/mcp-notify/test/mocks"
)

func TestPollerDetectsNewServers(t *testing.T) {
	// Setup mock registry
	mockRegistry := mocks.NewMockRegistry(fixtures.TestServers[:2])
	defer mockRegistry.Close()

	// Create registry client
	client := registry.NewClient(config.RegistryConfig{
		URL:           mockRegistry.URL(),
		PollInterval:  1 * time.Second,
		Timeout:       5 * time.Second,
		RetryAttempts: 1,
	})

	// Create diff engine
	engine := diff.NewEngine()

	// Get initial snapshot
	ctx := context.Background()
	servers, err := client.ListServers(ctx)
	require.NoError(t, err)
	initialSnapshot := engine.CreateSnapshot(servers)

	// Add a new server to the registry
	mockRegistry.AddServer(fixtures.TestServers[2])

	// Get new snapshot
	servers, err = client.ListServers(ctx)
	require.NoError(t, err)
	newSnapshot := engine.CreateSnapshot(servers)

	// Compare snapshots
	result := engine.Compare(initialSnapshot, newSnapshot)

	// Assert
	assert.Equal(t, 1, len(result.NewServers))
	assert.Equal(t, 0, len(result.UpdatedServers))
	assert.Equal(t, 0, len(result.RemovedServers))
	assert.Equal(t, fixtures.TestServers[2].Name, result.NewServers[0].ServerName)
}

func TestPollerDetectsUpdatedServers(t *testing.T) {
	// Setup mock registry with initial servers
	mockRegistry := mocks.NewMockRegistry(fixtures.TestServers[:2])
	defer mockRegistry.Close()

	// Create registry client
	client := registry.NewClient(config.RegistryConfig{
		URL:           mockRegistry.URL(),
		PollInterval:  1 * time.Second,
		Timeout:       5 * time.Second,
		RetryAttempts: 1,
	})

	// Create diff engine
	engine := diff.NewEngine()

	// Get initial snapshot
	ctx := context.Background()
	servers, err := client.ListServers(ctx)
	require.NoError(t, err)
	initialSnapshot := engine.CreateSnapshot(servers)

	// Update a server
	updatedServer := fixtures.TestServers[0]
	updatedServer.Description = "Updated description for testing"
	updatedServer.VersionDetail = &types.VersionDetail{
		Version:  "2.0.0",
		IsLatest: true,
	}
	mockRegistry.UpdateServer(updatedServer.Name, updatedServer)

	// Get new snapshot
	servers, err = client.ListServers(ctx)
	require.NoError(t, err)
	newSnapshot := engine.CreateSnapshot(servers)

	// Compare snapshots
	result := engine.Compare(initialSnapshot, newSnapshot)

	// Assert
	assert.Equal(t, 0, len(result.NewServers))
	assert.Equal(t, 1, len(result.UpdatedServers))
	assert.Equal(t, 0, len(result.RemovedServers))
	assert.Equal(t, fixtures.TestServers[0].Name, result.UpdatedServers[0].ServerName)
}

func TestPollerDetectsRemovedServers(t *testing.T) {
	// Setup mock registry
	mockRegistry := mocks.NewMockRegistry(fixtures.TestServers[:3])
	defer mockRegistry.Close()

	// Create registry client
	client := registry.NewClient(config.RegistryConfig{
		URL:           mockRegistry.URL(),
		PollInterval:  1 * time.Second,
		Timeout:       5 * time.Second,
		RetryAttempts: 1,
	})

	// Create diff engine
	engine := diff.NewEngine()

	// Get initial snapshot
	ctx := context.Background()
	servers, err := client.ListServers(ctx)
	require.NoError(t, err)
	initialSnapshot := engine.CreateSnapshot(servers)

	// Remove a server
	mockRegistry.RemoveServer(fixtures.TestServers[1].Name)

	// Get new snapshot
	servers, err = client.ListServers(ctx)
	require.NoError(t, err)
	newSnapshot := engine.CreateSnapshot(servers)

	// Compare snapshots
	result := engine.Compare(initialSnapshot, newSnapshot)

	// Assert
	assert.Equal(t, 0, len(result.NewServers))
	assert.Equal(t, 0, len(result.UpdatedServers))
	assert.Equal(t, 1, len(result.RemovedServers))
	assert.Equal(t, fixtures.TestServers[1].Name, result.RemovedServers[0].ServerName)
}

func TestPollerHandlesRegistryErrors(t *testing.T) {
	// Create a server that will return errors
	errorCount := 0
	server := httptest.NewServer(nil)
	server.Close() // Close immediately to simulate errors

	// Create registry client
	client := registry.NewClient(config.RegistryConfig{
		URL:           server.URL,
		PollInterval:  1 * time.Second,
		Timeout:       1 * time.Second,
		RetryAttempts: 2,
		RetryDelay:    100 * time.Millisecond,
	})

	// Attempt to list servers
	ctx := context.Background()
	_, err := client.ListServers(ctx)

	// Assert error is returned
	assert.Error(t, err)
	_ = errorCount // Acknowledge unused variable
}

func TestPollerHandlesPagination(t *testing.T) {
	// Generate a larger list of servers
	servers := fixtures.GenerateLargeServerList(250)

	// Setup mock registry with small page size
	mockRegistry := mocks.NewMockRegistry(servers)
	mockRegistry.SetPageSize(50) // Force pagination
	defer mockRegistry.Close()

	// Create registry client
	client := registry.NewClient(config.RegistryConfig{
		URL:           mockRegistry.URL(),
		PollInterval:  1 * time.Second,
		Timeout:       10 * time.Second,
		RetryAttempts: 1,
	})

	// Fetch all servers
	ctx := context.Background()
	result, err := client.ListServers(ctx)
	require.NoError(t, err)

	// Assert all servers were fetched
	assert.Equal(t, 250, len(result))

	// Verify multiple requests were made (pagination)
	// Client uses limit=100 by default, so 250 servers = 3 pages
	assert.GreaterOrEqual(t, mockRegistry.RequestCount, 3, "should have made multiple paginated requests")
}

func TestPollerRunsPollingLoop(t *testing.T) {
	// Skip this test - it requires a full database and dispatcher setup
	// which is tested in e2e tests instead
	t.Skip("skipping polling loop test - requires full infrastructure")

	if testing.Short() {
		t.Skip("skipping polling loop test in short mode")
	}

	// Setup mock registry
	mockRegistry := mocks.NewMockRegistry(fixtures.TestServers[:2])
	defer mockRegistry.Close()

	// Create registry client
	client := registry.NewClient(config.RegistryConfig{
		URL:           mockRegistry.URL(),
		PollInterval:  100 * time.Millisecond,
		Timeout:       5 * time.Second,
		RetryAttempts: 1,
	})

	// Create poller config (simplified - no dispatcher for this test)
	cfg := poller.Config{
		Client:       client,
		PollInterval: 100 * time.Millisecond,
	}

	p := poller.New(cfg)

	// Run poller for a short time
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	err := p.Run(ctx)

	// Should return context error (canceled/deadline exceeded)
	assert.ErrorIs(t, err, context.DeadlineExceeded)

	// Should have made multiple polls
	assert.GreaterOrEqual(t, mockRegistry.RequestCount, 2, "should have polled at least twice")
}

func TestPollerQuickHashComparison(t *testing.T) {
	engine := diff.NewEngine()

	// Create two identical snapshots
	snapshot1 := engine.CreateSnapshot(fixtures.TestServers)
	snapshot2 := engine.CreateSnapshot(fixtures.TestServers)

	// Hash comparison should be quick and return no changes
	assert.False(t, engine.HasChanges(snapshot1, snapshot2))

	// Create a different snapshot
	modifiedServers := append([]types.Server{}, fixtures.TestServers...)
	modifiedServers[0].Description = "Modified"
	snapshot3 := engine.CreateSnapshot(modifiedServers)

	// Should detect changes
	assert.True(t, engine.HasChanges(snapshot1, snapshot3))
}
