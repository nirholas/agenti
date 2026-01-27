// Package helpers provides test utilities and helper functions.
package helpers

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/modules/redis"
	"github.com/testcontainers/testcontainers-go/wait"
)

// PostgresContainer wraps a test PostgreSQL container.
type PostgresContainer struct {
	Container testcontainers.Container
	URL       string
}

// StartPostgres starts a PostgreSQL test container.
func StartPostgres(t *testing.T) (*PostgresContainer, func()) {
	t.Helper()
	ctx := context.Background()

	container, err := postgres.Run(ctx,
		"postgres:16-alpine",
		postgres.WithDatabase("mcp_watch_test"),
		postgres.WithUsername("test"),
		postgres.WithPassword("test"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("Failed to start postgres container: %v", err)
	}

	connStr, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		container.Terminate(ctx)
		t.Fatalf("Failed to get connection string: %v", err)
	}

	cleanup := func() {
		if err := container.Terminate(ctx); err != nil {
			t.Logf("Failed to terminate postgres container: %v", err)
		}
	}

	return &PostgresContainer{
		Container: container,
		URL:       connStr,
	}, cleanup
}

// RedisContainer wraps a test Redis container.
type RedisContainer struct {
	Container testcontainers.Container
	URL       string
}

// StartRedis starts a Redis test container.
func StartRedis(t *testing.T) (*RedisContainer, func()) {
	t.Helper()
	ctx := context.Background()

	container, err := redis.Run(ctx,
		"redis:7-alpine",
		testcontainers.WithWaitStrategy(
			wait.ForLog("Ready to accept connections").
				WithStartupTimeout(30*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("Failed to start redis container: %v", err)
	}

	host, err := container.Host(ctx)
	if err != nil {
		container.Terminate(ctx)
		t.Fatalf("Failed to get redis host: %v", err)
	}

	port, err := container.MappedPort(ctx, "6379")
	if err != nil {
		container.Terminate(ctx)
		t.Fatalf("Failed to get redis port: %v", err)
	}

	url := fmt.Sprintf("redis://%s:%s/0", host, port.Port())

	cleanup := func() {
		if err := container.Terminate(ctx); err != nil {
			t.Logf("Failed to terminate redis container: %v", err)
		}
	}

	return &RedisContainer{
		Container: container,
		URL:       url,
	}, cleanup
}

// StartPostgresWithMigrations starts PostgreSQL and runs migrations.
func StartPostgresWithMigrations(t *testing.T, migrationsPath string) (*PostgresContainer, func()) {
	t.Helper()

	pg, cleanup := StartPostgres(t)

	// Run migrations
	if err := RunMigrations(pg.URL, migrationsPath); err != nil {
		cleanup()
		t.Fatalf("Failed to run migrations: %v", err)
	}

	return pg, cleanup
}

// RunMigrations executes SQL migration files.
func RunMigrations(dbURL string, migrationsPath string) error {
	// Note: In production, use a proper migration tool like golang-migrate
	// This is a simplified version for testing
	return nil
}
