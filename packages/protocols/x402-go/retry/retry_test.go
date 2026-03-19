package retry

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestWithRetry(t *testing.T) {
	t.Run("succeeds on first attempt", func(t *testing.T) {
		calls := 0
		result, err := WithSimpleRetry(context.Background(),
			func() (string, error) {
				calls++
				return "success", nil
			},
			func(error) bool { return true },
		)

		if err != nil {
			t.Errorf("expected no error, got %v", err)
		}
		if result != "success" {
			t.Errorf("expected 'success', got %s", result)
		}
		if calls != 1 {
			t.Errorf("expected 1 call, got %d", calls)
		}
	})

	t.Run("retries on retryable error", func(t *testing.T) {
		calls := 0
		result, err := WithSimpleRetry(context.Background(),
			func() (string, error) {
				calls++
				if calls < 3 {
					return "", errors.New("temporary error")
				}
				return "success", nil
			},
			func(error) bool { return true },
		)

		if err != nil {
			t.Errorf("expected no error, got %v", err)
		}
		if result != "success" {
			t.Errorf("expected 'success', got %s", result)
		}
		if calls != 3 {
			t.Errorf("expected 3 calls, got %d", calls)
		}
	})

	t.Run("respects max retries", func(t *testing.T) {
		calls := 0
		config := Config{
			MaxAttempts:  2,
			InitialDelay: 1 * time.Millisecond,
			MaxDelay:     10 * time.Millisecond,
			Multiplier:   2.0,
		}

		_, err := WithRetry(context.Background(), config,
			func(error) bool { return true },
			func() (string, error) {
				calls++
				return "", errors.New("persistent error")
			},
		)

		if err == nil {
			t.Error("expected error, got nil")
		}
		if calls != 2 {
			t.Errorf("expected 2 calls, got %d", calls)
		}
	})

	t.Run("does not retry non-retryable errors", func(t *testing.T) {
		calls := 0
		nonRetryableErr := errors.New("non-retryable error")

		_, err := WithSimpleRetry(context.Background(),
			func() (string, error) {
				calls++
				return "", nonRetryableErr
			},
			func(err error) bool {
				return !errors.Is(err, nonRetryableErr)
			},
		)

		if err == nil {
			t.Error("expected error, got nil")
		}
		if calls != 1 {
			t.Errorf("expected 1 call (no retries), got %d", calls)
		}
	})

	t.Run("respects context cancellation before attempt", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel() // Cancel immediately

		calls := 0
		_, err := WithSimpleRetry(ctx,
			func() (string, error) {
				calls++
				return "", errors.New("error")
			},
			func(error) bool { return true },
		)

		if err == nil {
			t.Error("expected error, got nil")
		}
		if !errors.Is(err, context.Canceled) {
			t.Errorf("expected context.Canceled, got %v", err)
		}
		if calls != 0 {
			t.Errorf("expected 0 calls (canceled before first attempt), got %d", calls)
		}
	})

	t.Run("respects context cancellation during retry delay", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
		defer cancel()

		calls := 0
		config := Config{
			MaxAttempts:  10,
			InitialDelay: 100 * time.Millisecond, // Longer than context timeout
			MaxDelay:     1 * time.Second,
			Multiplier:   2.0,
		}

		_, err := WithRetry(ctx, config,
			func(error) bool { return true },
			func() (string, error) {
				calls++
				return "", errors.New("error")
			},
		)

		if err == nil {
			t.Error("expected error, got nil")
		}
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Errorf("expected context.DeadlineExceeded, got %v", err)
		}
		if calls == 0 {
			t.Error("expected at least 1 call")
		}
		if calls >= 10 {
			t.Errorf("expected fewer than 10 calls due to context timeout, got %d", calls)
		}
	})

	t.Run("exponential backoff increases delay", func(t *testing.T) {
		calls := 0
		config := Config{
			MaxAttempts:  3,
			InitialDelay: 10 * time.Millisecond,
			MaxDelay:     100 * time.Millisecond,
			Multiplier:   2.0,
		}

		start := time.Now()
		_, err := WithRetry(context.Background(), config,
			func(error) bool { return true },
			func() (string, error) {
				calls++
				return "", errors.New("error")
			},
		)
		elapsed := time.Since(start)

		if err == nil {
			t.Error("expected error, got nil")
		}
		if calls != 3 {
			t.Errorf("expected 3 calls, got %d", calls)
		}

		// Expected delays: 10ms + 20ms = 30ms minimum
		// Allow some tolerance for execution time
		expectedMin := 30 * time.Millisecond
		if elapsed < expectedMin {
			t.Errorf("expected at least %v elapsed time for exponential backoff, got %v", expectedMin, elapsed)
		}
	})

	t.Run("respects max delay cap", func(t *testing.T) {
		calls := 0
		config := Config{
			MaxAttempts:  5,
			InitialDelay: 10 * time.Millisecond,
			MaxDelay:     15 * time.Millisecond, // Cap at 15ms
			Multiplier:   2.0,                   // Would normally go: 10, 20, 40, 80...
		}

		start := time.Now()
		_, err := WithRetry(context.Background(), config,
			func(error) bool { return true },
			func() (string, error) {
				calls++
				return "", errors.New("error")
			},
		)
		elapsed := time.Since(start)

		if err == nil {
			t.Error("expected error, got nil")
		}

		// Expected delays: 10ms, 15ms (capped), 15ms (capped), 15ms (capped) = 55ms
		// With some tolerance: should be < 100ms
		expectedMax := 100 * time.Millisecond
		if elapsed > expectedMax {
			t.Errorf("expected less than %v elapsed time (max delay should cap), got %v", expectedMax, elapsed)
		}
	})

	t.Run("validates MaxAttempts configuration", func(t *testing.T) {
		calls := 0
		config := Config{
			MaxAttempts:  0, // Invalid
			InitialDelay: 10 * time.Millisecond,
			MaxDelay:     100 * time.Millisecond,
			Multiplier:   2.0,
		}

		_, err := WithRetry(context.Background(), config,
			func(error) bool { return true },
			func() (string, error) {
				calls++
				return "success", nil
			},
		)

		if err == nil {
			t.Error("expected error for MaxAttempts=0, got nil")
		}
		if calls != 0 {
			t.Errorf("expected 0 calls when MaxAttempts is invalid, got %d", calls)
		}

		// Test negative MaxAttempts
		config.MaxAttempts = -1
		_, err = WithRetry(context.Background(), config,
			func(error) bool { return true },
			func() (string, error) {
				calls++
				return "success", nil
			},
		)

		if err == nil {
			t.Error("expected error for MaxAttempts=-1, got nil")
		}
	})

	t.Run("works with different return types", func(t *testing.T) {
		// Test with int
		intResult, err := WithSimpleRetry(context.Background(),
			func() (int, error) {
				return 42, nil
			},
			func(error) bool { return true },
		)
		if err != nil {
			t.Errorf("expected no error, got %v", err)
		}
		if intResult != 42 {
			t.Errorf("expected 42, got %d", intResult)
		}

		// Test with struct
		type testStruct struct {
			Value string
		}
		structResult, err := WithSimpleRetry(context.Background(),
			func() (testStruct, error) {
				return testStruct{Value: "test"}, nil
			},
			func(error) bool { return true },
		)
		if err != nil {
			t.Errorf("expected no error, got %v", err)
		}
		if structResult.Value != "test" {
			t.Errorf("expected 'test', got %s", structResult.Value)
		}

		// Test with pointer
		pointerResult, err := WithSimpleRetry(context.Background(),
			func() (*testStruct, error) {
				return &testStruct{Value: "pointer"}, nil
			},
			func(error) bool { return true },
		)
		if err != nil {
			t.Errorf("expected no error, got %v", err)
		}
		if pointerResult.Value != "pointer" {
			t.Errorf("expected 'pointer', got %s", pointerResult.Value)
		}
	})
}

func BenchmarkWithRetry(b *testing.B) {
	config := DefaultConfig

	b.Run("no retries", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			_, _ = WithRetry(context.Background(), config,
				func(error) bool { return true },
				func() (string, error) {
					return "success", nil
				},
			)
		}
	})

	b.Run("one retry", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			calls := 0
			_, _ = WithRetry(context.Background(), config,
				func(error) bool { return true },
				func() (string, error) {
					calls++
					if calls == 1 {
						return "", errors.New("temporary error")
					}
					return "success", nil
				},
			)
		}
	})
}
