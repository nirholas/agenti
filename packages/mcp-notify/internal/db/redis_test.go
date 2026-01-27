// Package db provides database access for MCP Notify.
package db

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/nirholas/mcp-notify/internal/config"
	"github.com/nirholas/mcp-notify/pkg/types"
)

// setupTestRedis creates a Redis container for testing.
func setupTestRedis(t *testing.T) (*RedisCache, func()) {
	t.Helper()
	ctx := context.Background()

	req := testcontainers.ContainerRequest{
		Image:        "redis:7-alpine",
		ExposedPorts: []string{"6379/tcp"},
		WaitingFor:   wait.ForLog("Ready to accept connections").WithStartupTimeout(60 * time.Second),
	}

	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	require.NoError(t, err)

	host, err := container.Host(ctx)
	require.NoError(t, err)

	port, err := container.MappedPort(ctx, "6379")
	require.NoError(t, err)

	cfg := config.RedisConfig{
		URL:          fmt.Sprintf("redis://%s:%s", host, port.Port()),
		MaxRetries:   3,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     5,
	}

	cache, err := NewRedisCache(ctx, cfg)
	require.NoError(t, err)

	cleanup := func() {
		cache.Close()
		container.Terminate(ctx)
	}

	return cache, cleanup
}

func TestRedisCache_Ping(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	cache, cleanup := setupTestRedis(t)
	defer cleanup()

	ctx := context.Background()
	err := cache.Ping(ctx)
	assert.NoError(t, err)
}

func TestRedisCache_GetSet(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	cache, cleanup := setupTestRedis(t)
	defer cleanup()

	ctx := context.Background()

	// Test Set and Get
	key := "test:key:1"
	value := []byte("test value")

	err := cache.Set(ctx, key, value, time.Minute)
	require.NoError(t, err)

	retrieved, err := cache.Get(ctx, key)
	require.NoError(t, err)
	assert.Equal(t, value, retrieved)

	// Test Get non-existent key
	nonExistent, err := cache.Get(ctx, "nonexistent")
	require.NoError(t, err)
	assert.Nil(t, nonExistent)

	// Test Delete
	err = cache.Delete(ctx, key)
	require.NoError(t, err)

	deleted, err := cache.Get(ctx, key)
	require.NoError(t, err)
	assert.Nil(t, deleted)
}

func TestRedisCache_TTL(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	cache, cleanup := setupTestRedis(t)
	defer cleanup()

	ctx := context.Background()

	key := "test:ttl:key"
	value := []byte("expires soon")

	// Set with short TTL
	err := cache.Set(ctx, key, value, 100*time.Millisecond)
	require.NoError(t, err)

	// Should exist immediately
	retrieved, err := cache.Get(ctx, key)
	require.NoError(t, err)
	assert.Equal(t, value, retrieved)

	// Wait for expiry
	time.Sleep(150 * time.Millisecond)

	// Should be gone
	expired, err := cache.Get(ctx, key)
	require.NoError(t, err)
	assert.Nil(t, expired)
}

func TestRedisCache_Snapshot(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	cache, cleanup := setupTestRedis(t)
	defer cleanup()

	ctx := context.Background()

	// Test GetCachedSnapshot when empty
	empty, err := cache.GetCachedSnapshot(ctx)
	require.NoError(t, err)
	assert.Nil(t, empty)

	// Create and cache snapshot
	snapshot := &types.Snapshot{
		ID:          uuid.New(),
		Timestamp:   time.Now().UTC().Truncate(time.Millisecond),
		ServerCount: 42,
		Hash:        "snapshot-hash-123",
		Servers: map[string]types.Server{
			"server1": {Name: "server1", Description: "Test server 1"},
			"server2": {Name: "server2", Description: "Test server 2"},
		},
	}

	err = cache.SetCachedSnapshot(ctx, snapshot, time.Minute)
	require.NoError(t, err)

	// Retrieve cached snapshot
	retrieved, err := cache.GetCachedSnapshot(ctx)
	require.NoError(t, err)
	require.NotNil(t, retrieved)

	assert.Equal(t, snapshot.ID, retrieved.ID)
	assert.Equal(t, snapshot.ServerCount, retrieved.ServerCount)
	assert.Equal(t, snapshot.Hash, retrieved.Hash)
	assert.Equal(t, len(snapshot.Servers), len(retrieved.Servers))

	// Verify server data
	assert.Equal(t, "server1", retrieved.Servers["server1"].Name)
	assert.Equal(t, "Test server 1", retrieved.Servers["server1"].Description)
}

func TestRedisCache_SnapshotNil(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	cache, cleanup := setupTestRedis(t)
	defer cleanup()

	ctx := context.Background()

	// Setting nil snapshot should not error
	err := cache.SetCachedSnapshot(ctx, nil, time.Minute)
	require.NoError(t, err)
}

func TestRedisCache_RateLimit(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	cache, cleanup := setupTestRedis(t)
	defer cleanup()

	ctx := context.Background()

	key := "user:123:api"
	window := time.Second

	// First increment
	count, err := cache.IncrementRateLimit(ctx, key, window)
	require.NoError(t, err)
	assert.Equal(t, int64(1), count)

	// Second increment
	count, err = cache.IncrementRateLimit(ctx, key, window)
	require.NoError(t, err)
	assert.Equal(t, int64(2), count)

	// Third increment
	count, err = cache.IncrementRateLimit(ctx, key, window)
	require.NoError(t, err)
	assert.Equal(t, int64(3), count)

	// Wait for window to expire
	time.Sleep(1100 * time.Millisecond)

	// Should reset
	count, err = cache.IncrementRateLimit(ctx, key, window)
	require.NoError(t, err)
	assert.Equal(t, int64(1), count)
}

func TestRedisCache_RateLimitConcurrent(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	cache, cleanup := setupTestRedis(t)
	defer cleanup()

	ctx := context.Background()

	key := "concurrent:test"
	window := 10 * time.Second
	numGoroutines := 100

	var wg sync.WaitGroup
	counts := make(chan int64, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			count, err := cache.IncrementRateLimit(ctx, key, window)
			require.NoError(t, err)
			counts <- count
		}()
	}

	wg.Wait()
	close(counts)

	// Verify all counts are unique and sequential
	countSet := make(map[int64]bool)
	for count := range counts {
		countSet[count] = true
	}

	// All counts should be unique (1-100)
	assert.Len(t, countSet, numGoroutines)
	for i := int64(1); i <= int64(numGoroutines); i++ {
		assert.True(t, countSet[i], "missing count %d", i)
	}
}

func TestRedisCache_GetRateLimitCount(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	cache, cleanup := setupTestRedis(t)
	defer cleanup()

	ctx := context.Background()

	key := "count:test"
	window := time.Minute

	// Initially should be 0
	count, err := cache.GetRateLimitCount(ctx, key)
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)

	// Increment a few times
	for i := 0; i < 5; i++ {
		_, err = cache.IncrementRateLimit(ctx, key, window)
		require.NoError(t, err)
	}

	// Check count
	count, err = cache.GetRateLimitCount(ctx, key)
	require.NoError(t, err)
	assert.Equal(t, int64(5), count)

	// Reset
	err = cache.ResetRateLimit(ctx, key)
	require.NoError(t, err)

	// Should be 0 again
	count, err = cache.GetRateLimitCount(ctx, key)
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)
}

func TestRedisCache_SetWithNX(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	cache, cleanup := setupTestRedis(t)
	defer cleanup()

	ctx := context.Background()

	key := "lock:test"
	value := []byte("lock-holder-1")

	// First set should succeed
	ok, err := cache.SetWithNX(ctx, key, value, time.Minute)
	require.NoError(t, err)
	assert.True(t, ok)

	// Second set should fail (key exists)
	ok, err = cache.SetWithNX(ctx, key, []byte("lock-holder-2"), time.Minute)
	require.NoError(t, err)
	assert.False(t, ok)

	// Value should still be the first one
	retrieved, err := cache.Get(ctx, key)
	require.NoError(t, err)
	assert.Equal(t, value, retrieved)
}

func TestRedisCache_Exists(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	cache, cleanup := setupTestRedis(t)
	defer cleanup()

	ctx := context.Background()

	key := "exists:test"

	// Should not exist initially
	exists, err := cache.Exists(ctx, key)
	require.NoError(t, err)
	assert.False(t, exists)

	// Set the key
	err = cache.Set(ctx, key, []byte("value"), time.Minute)
	require.NoError(t, err)

	// Should exist now
	exists, err = cache.Exists(ctx, key)
	require.NoError(t, err)
	assert.True(t, exists)
}

func TestRedisCache_Expire(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	cache, cleanup := setupTestRedis(t)
	defer cleanup()

	ctx := context.Background()

	key := "expire:test"

	// Set key with long TTL
	err := cache.Set(ctx, key, []byte("value"), time.Hour)
	require.NoError(t, err)

	// Change TTL to short (minimum 1s for Redis)
	err = cache.Expire(ctx, key, 1*time.Second)
	require.NoError(t, err)

	// Should still exist
	exists, err := cache.Exists(ctx, key)
	require.NoError(t, err)
	assert.True(t, exists)

	// Wait for expiry (with buffer for timing variability)
	time.Sleep(1500 * time.Millisecond)

	// Should be gone
	exists, err = cache.Exists(ctx, key)
	require.NoError(t, err)
	assert.False(t, exists)
}

func TestNullCache(t *testing.T) {
	cache := NewNullCache()
	ctx := context.Background()

	// All operations should succeed but be no-ops
	assert.NoError(t, cache.Ping(ctx))
	assert.NoError(t, cache.Close())

	// Get should always return nil
	val, err := cache.Get(ctx, "any-key")
	assert.NoError(t, err)
	assert.Nil(t, val)

	// Set should succeed
	assert.NoError(t, cache.Set(ctx, "key", []byte("value"), time.Minute))

	// Delete should succeed
	assert.NoError(t, cache.Delete(ctx, "key"))

	// Snapshot operations
	snapshot, err := cache.GetCachedSnapshot(ctx)
	assert.NoError(t, err)
	assert.Nil(t, snapshot)

	assert.NoError(t, cache.SetCachedSnapshot(ctx, &types.Snapshot{}, time.Minute))

	// Rate limit always returns 0
	count, err := cache.IncrementRateLimit(ctx, "key", time.Minute)
	assert.NoError(t, err)
	assert.Equal(t, int64(0), count)
}
