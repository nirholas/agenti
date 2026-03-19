package v2

import (
	"fmt"
	"time"
)

// TimeoutConfig holds timeout configuration for payment operations.
type TimeoutConfig struct {
	// VerifyTimeout is the maximum time to wait for payment verification.
	VerifyTimeout time.Duration

	// SettleTimeout is the maximum time to wait for payment settlement.
	SettleTimeout time.Duration

	// RequestTimeout is the overall timeout for HTTP requests.
	RequestTimeout time.Duration
}

// DefaultTimeouts provides sensible defaults for payment operations.
var DefaultTimeouts = TimeoutConfig{
	VerifyTimeout:  5 * time.Second,
	SettleTimeout:  60 * time.Second,
	RequestTimeout: 120 * time.Second,
}

// WithVerifyTimeout returns a new TimeoutConfig with updated verify timeout.
func (tc TimeoutConfig) WithVerifyTimeout(d time.Duration) TimeoutConfig {
	tc.VerifyTimeout = d
	return tc
}

// WithSettleTimeout returns a new TimeoutConfig with updated settle timeout.
func (tc TimeoutConfig) WithSettleTimeout(d time.Duration) TimeoutConfig {
	tc.SettleTimeout = d
	return tc
}

// WithRequestTimeout returns a new TimeoutConfig with updated request timeout.
func (tc TimeoutConfig) WithRequestTimeout(d time.Duration) TimeoutConfig {
	tc.RequestTimeout = d
	return tc
}

// Validate ensures timeout values are reasonable.
func (tc TimeoutConfig) Validate() error {
	if tc.VerifyTimeout <= 0 {
		return fmt.Errorf("verify timeout must be positive, got %v", tc.VerifyTimeout)
	}
	if tc.SettleTimeout <= 0 {
		return fmt.Errorf("settle timeout must be positive, got %v", tc.SettleTimeout)
	}
	if tc.RequestTimeout <= 0 {
		return fmt.Errorf("request timeout must be positive, got %v", tc.RequestTimeout)
	}
	if tc.SettleTimeout < tc.VerifyTimeout {
		return fmt.Errorf("settle timeout (%v) should be >= verify timeout (%v)",
			tc.SettleTimeout, tc.VerifyTimeout)
	}
	return nil
}
