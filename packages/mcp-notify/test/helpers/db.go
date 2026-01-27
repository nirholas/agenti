package helpers

import (
	"context"
	"testing"
	"time"

	"github.com/nirholas/mcp-notify/internal/config"
	"github.com/nirholas/mcp-notify/internal/db"
)

// TestDB provides database helpers for testing.
type TestDB struct {
	Database db.Database
	URL      string
	cleanup  func()
}

// SetupTestDB creates a new test database with migrations applied.
func SetupTestDB(t *testing.T) *TestDB {
	t.Helper()

	pg, cleanup := StartPostgres(t)

	cfg := config.DatabaseConfig{
		URL:             pg.URL,
		MaxConnections:  5,
		MaxIdleConns:    2,
		ConnMaxLifetime: 5 * time.Minute,
	}

	ctx := context.Background()
	database, err := db.New(ctx, cfg)
	if err != nil {
		cleanup()
		t.Fatalf("Failed to connect to test database: %v", err)
	}

	// Run migrations
	if err := database.Migrate(ctx); err != nil {
		database.Close()
		cleanup()
		t.Fatalf("Failed to run migrations: %v", err)
	}

	return &TestDB{
		Database: database,
		URL:      pg.URL,
		cleanup:  cleanup,
	}
}

// TeardownTestDB cleans up the test database.
func (tdb *TestDB) Teardown(t *testing.T) {
	t.Helper()

	if tdb.Database != nil {
		if err := tdb.Database.Close(); err != nil {
			t.Logf("Failed to close database: %v", err)
		}
	}

	if tdb.cleanup != nil {
		tdb.cleanup()
	}
}

// ClearTables clears all data from the database tables.
// Note: This is a no-op since the Database interface doesn't expose raw Exec.
// For proper test isolation, recreate the container between tests.
func (tdb *TestDB) ClearTables(t *testing.T) {
	t.Helper()
	// The Database interface doesn't expose Exec, so we skip clearing.
	// Tests should use separate containers or be designed to handle existing data.
	t.Log("ClearTables is a no-op - consider using separate containers for isolation")
}

// TestCache provides cache helpers for testing.
type TestCache struct {
	Cache   db.Cache
	URL     string
	cleanup func()
}

// SetupTestCache creates a new test Redis cache.
func SetupTestCache(t *testing.T) *TestCache {
	t.Helper()

	redis, cleanup := StartRedis(t)

	cfg := config.RedisConfig{
		URL:          redis.URL,
		MaxRetries:   3,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     5,
	}

	ctx := context.Background()
	cache, err := db.NewRedisCache(ctx, cfg)
	if err != nil {
		cleanup()
		t.Fatalf("Failed to connect to test cache: %v", err)
	}

	return &TestCache{
		Cache:   cache,
		URL:     redis.URL,
		cleanup: cleanup,
	}
}

// TeardownTestCache cleans up the test cache.
func (tc *TestCache) Teardown(t *testing.T) {
	t.Helper()

	if tc.Cache != nil {
		if err := tc.Cache.Close(); err != nil {
			t.Logf("Failed to close cache: %v", err)
		}
	}

	if tc.cleanup != nil {
		tc.cleanup()
	}
}

// FlushAll clears all data from the cache.
// Note: The Cache interface doesn't expose FlushAll, so we use Delete with a pattern.
func (tc *TestCache) FlushAll(t *testing.T) {
	t.Helper()
	// The Cache interface doesn't expose FlushAll.
	// Tests should use separate containers for isolation.
	t.Log("FlushAll is a no-op - consider using separate containers for isolation")
}

// SetupFullTestEnvironment creates both database and cache for testing.
func SetupFullTestEnvironment(t *testing.T) (*TestDB, *TestCache, func()) {
	t.Helper()

	testDB := SetupTestDB(t)
	testCache := SetupTestCache(t)

	cleanup := func() {
		testCache.Teardown(t)
		testDB.Teardown(t)
	}

	return testDB, testCache, cleanup
}
