// Package db provides database access for MCP Notify.
package db

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"

	"github.com/nirholas/mcp-notify/internal/config"
	"github.com/nirholas/mcp-notify/pkg/types"
)

const (
	// Default cache key prefixes
	snapshotCacheKey = "mcp:snapshot:latest"
	rateLimitPrefix  = "mcp:ratelimit:"
)

// RedisCache implements the Cache interface using Redis.
type RedisCache struct {
	client *redis.Client
}

// NewRedisCache creates a new Redis cache connection.
func NewRedisCache(ctx context.Context, cfg config.RedisConfig) (*RedisCache, error) {
	if cfg.URL == "" {
		return nil, fmt.Errorf("redis URL is required")
	}

	opt, err := redis.ParseURL(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	// Apply additional configuration
	if cfg.PoolSize > 0 {
		opt.PoolSize = cfg.PoolSize
	}
	if cfg.MaxRetries > 0 {
		opt.MaxRetries = cfg.MaxRetries
	}
	if cfg.DialTimeout > 0 {
		opt.DialTimeout = cfg.DialTimeout
	}
	if cfg.ReadTimeout > 0 {
		opt.ReadTimeout = cfg.ReadTimeout
	}
	if cfg.WriteTimeout > 0 {
		opt.WriteTimeout = cfg.WriteTimeout
	}

	client := redis.NewClient(opt)

	// Test connection
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Info().Msg("Connected to Redis cache")

	return &RedisCache{client: client}, nil
}

// Close closes the Redis connection.
func (c *RedisCache) Close() error {
	if c.client != nil {
		return c.client.Close()
	}
	return nil
}

// Ping checks if Redis is reachable.
func (c *RedisCache) Ping(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}

// Get retrieves a value from the cache.
func (c *RedisCache) Get(ctx context.Context, key string) ([]byte, error) {
	val, err := c.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil // Key not found
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get key %s: %w", key, err)
	}
	return val, nil
}

// Set stores a value in the cache with a TTL.
func (c *RedisCache) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	if err := c.client.Set(ctx, key, value, ttl).Err(); err != nil {
		return fmt.Errorf("failed to set key %s: %w", key, err)
	}
	return nil
}

// Delete removes a key from the cache.
func (c *RedisCache) Delete(ctx context.Context, key string) error {
	if err := c.client.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("failed to delete key %s: %w", key, err)
	}
	return nil
}

// GetCachedSnapshot retrieves the cached snapshot from Redis.
func (c *RedisCache) GetCachedSnapshot(ctx context.Context) (*types.Snapshot, error) {
	data, err := c.Get(ctx, snapshotCacheKey)
	if err != nil {
		return nil, fmt.Errorf("failed to get cached snapshot: %w", err)
	}
	if data == nil {
		return nil, nil // No cached snapshot
	}

	var snapshot types.Snapshot
	if err := json.Unmarshal(data, &snapshot); err != nil {
		return nil, fmt.Errorf("failed to unmarshal cached snapshot: %w", err)
	}

	return &snapshot, nil
}

// SetCachedSnapshot caches a snapshot in Redis.
func (c *RedisCache) SetCachedSnapshot(ctx context.Context, snapshot *types.Snapshot, ttl time.Duration) error {
	if snapshot == nil {
		return nil
	}

	// Default TTL of 1 minute if not specified
	if ttl == 0 {
		ttl = time.Minute
	}

	data, err := json.Marshal(snapshot)
	if err != nil {
		return fmt.Errorf("failed to marshal snapshot: %w", err)
	}

	if err := c.Set(ctx, snapshotCacheKey, data, ttl); err != nil {
		return fmt.Errorf("failed to cache snapshot: %w", err)
	}

	return nil
}

// IncrementRateLimit increments a rate limit counter and returns the new count.
// The counter will expire after the given window duration.
// Uses a sliding window approach with Redis INCR and EXPIRE.
func (c *RedisCache) IncrementRateLimit(ctx context.Context, key string, window time.Duration) (int64, error) {
	fullKey := rateLimitPrefix + key

	// Use a Lua script to atomically increment and set expiry
	// This ensures the key expires after the window, even if it's a new key
	script := redis.NewScript(`
		local count = redis.call('INCR', KEYS[1])
		if count == 1 then
			redis.call('PEXPIRE', KEYS[1], ARGV[1])
		end
		return count
	`)

	result, err := script.Run(ctx, c.client, []string{fullKey}, window.Milliseconds()).Int64()
	if err != nil {
		return 0, fmt.Errorf("failed to increment rate limit for %s: %w", key, err)
	}

	return result, nil
}

// GetRateLimitCount returns the current count for a rate limit key without incrementing.
func (c *RedisCache) GetRateLimitCount(ctx context.Context, key string) (int64, error) {
	fullKey := rateLimitPrefix + key

	val, err := c.client.Get(ctx, fullKey).Int64()
	if err == redis.Nil {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("failed to get rate limit count for %s: %w", key, err)
	}

	return val, nil
}

// ResetRateLimit resets the rate limit counter for a key.
func (c *RedisCache) ResetRateLimit(ctx context.Context, key string) error {
	fullKey := rateLimitPrefix + key
	return c.Delete(ctx, fullKey)
}

// SetWithNX sets a value only if the key doesn't exist (for distributed locking).
func (c *RedisCache) SetWithNX(ctx context.Context, key string, value []byte, ttl time.Duration) (bool, error) {
	result, err := c.client.SetNX(ctx, key, value, ttl).Result()
	if err != nil {
		return false, fmt.Errorf("failed to setnx key %s: %w", key, err)
	}
	return result, nil
}

// Exists checks if a key exists in the cache.
func (c *RedisCache) Exists(ctx context.Context, key string) (bool, error) {
	result, err := c.client.Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("failed to check existence of key %s: %w", key, err)
	}
	return result > 0, nil
}

// Expire sets the TTL on an existing key.
func (c *RedisCache) Expire(ctx context.Context, key string, ttl time.Duration) error {
	if err := c.client.Expire(ctx, key, ttl).Err(); err != nil {
		return fmt.Errorf("failed to set expiry on key %s: %w", key, err)
	}
	return nil
}

// FlushAll removes all keys from the cache (use with caution!).
func (c *RedisCache) FlushAll(ctx context.Context) error {
	return c.client.FlushAll(ctx).Err()
}

// NullCache is a no-op cache implementation for when Redis is not available.
type NullCache struct{}

// NewNullCache creates a new null cache that does nothing.
func NewNullCache() *NullCache {
	log.Warn().Msg("Using null cache - no caching will be performed")
	return &NullCache{}
}

// Close does nothing.
func (c *NullCache) Close() error {
	return nil
}

// Ping always succeeds.
func (c *NullCache) Ping(ctx context.Context) error {
	return nil
}

// Get always returns nil (cache miss).
func (c *NullCache) Get(ctx context.Context, key string) ([]byte, error) {
	return nil, nil
}

// Set does nothing.
func (c *NullCache) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	return nil
}

// Delete does nothing.
func (c *NullCache) Delete(ctx context.Context, key string) error {
	return nil
}

// GetCachedSnapshot always returns nil (cache miss).
func (c *NullCache) GetCachedSnapshot(ctx context.Context) (*types.Snapshot, error) {
	return nil, nil
}

// SetCachedSnapshot does nothing.
func (c *NullCache) SetCachedSnapshot(ctx context.Context, snapshot *types.Snapshot, ttl time.Duration) error {
	return nil
}

// IncrementRateLimit always returns 0 (no rate limiting).
func (c *NullCache) IncrementRateLimit(ctx context.Context, key string, window time.Duration) (int64, error) {
	return 0, nil
}
