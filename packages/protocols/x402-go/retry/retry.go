// Package retry provides generic retry logic with exponential backoff for transient failures.
// It uses Go generics for type-safe retry operations and respects context cancellation.
package retry

import (
	"context"
	"fmt"
	"time"
)

// Config holds retry configuration.
type Config struct {
	MaxAttempts  int           // Maximum number of attempts (including initial attempt)
	InitialDelay time.Duration // Initial delay between retries
	MaxDelay     time.Duration // Maximum delay between retries
	Multiplier   float64       // Multiplier for exponential backoff
}

// DefaultConfig provides sensible defaults for retry operations.
var DefaultConfig = Config{
	MaxAttempts:  3,
	InitialDelay: 100 * time.Millisecond,
	MaxDelay:     5 * time.Second,
	Multiplier:   2.0,
}

// IsRetryable determines if an error should trigger a retry.
type IsRetryable func(error) bool

// WithRetry executes a function with retry logic using generics for type safety.
// It applies exponential backoff with configurable parameters and respects context cancellation.
func WithRetry[T any](
	ctx context.Context,
	config Config,
	isRetryable IsRetryable,
	fn func() (T, error),
) (T, error) {
	var zero T
	var lastErr error
	delay := config.InitialDelay

	// Validate configuration
	if config.MaxAttempts <= 0 {
		return zero, fmt.Errorf("invalid retry configuration: MaxAttempts must be at least 1, got %d", config.MaxAttempts)
	}

	for attempt := 0; attempt < config.MaxAttempts; attempt++ {
		// Check context before attempt
		if err := ctx.Err(); err != nil {
			return zero, fmt.Errorf("context cancelled: %w", err)
		}

		result, err := fn()
		if err == nil {
			return result, nil
		}

		lastErr = err

		// Check if error is retryable
		if !isRetryable(err) {
			return zero, err
		}

		// Don't sleep after last attempt
		if attempt < config.MaxAttempts-1 {
			// Apply exponential backoff
			select {
			case <-time.After(delay):
				delay = time.Duration(float64(delay) * config.Multiplier)
				if delay > config.MaxDelay {
					delay = config.MaxDelay
				}
			case <-ctx.Done():
				return zero, ctx.Err()
			}
		}
	}

	return zero, fmt.Errorf("max retries exceeded: %w", lastErr)
}

// WithSimpleRetry uses default configuration for retry operations.
func WithSimpleRetry[T any](
	ctx context.Context,
	fn func() (T, error),
	isRetryable IsRetryable,
) (T, error) {
	return WithRetry(ctx, DefaultConfig, isRetryable, fn)
}
