package x402

import (
	"testing"
	"time"
)

func TestDefaultTimeouts(t *testing.T) {
	if DefaultTimeouts.VerifyTimeout != 5*time.Second {
		t.Errorf("expected VerifyTimeout to be 5s, got %v", DefaultTimeouts.VerifyTimeout)
	}
	if DefaultTimeouts.SettleTimeout != 60*time.Second {
		t.Errorf("expected SettleTimeout to be 60s, got %v", DefaultTimeouts.SettleTimeout)
	}
	if DefaultTimeouts.RequestTimeout != 120*time.Second {
		t.Errorf("expected RequestTimeout to be 120s, got %v", DefaultTimeouts.RequestTimeout)
	}
}

func TestTimeoutConfigValidate(t *testing.T) {
	tests := []struct {
		name    string
		config  TimeoutConfig
		wantErr bool
	}{
		{
			name:    "valid config",
			config:  DefaultTimeouts,
			wantErr: false,
		},
		{
			name: "valid custom config",
			config: TimeoutConfig{
				VerifyTimeout:  10 * time.Second,
				SettleTimeout:  120 * time.Second,
				RequestTimeout: 240 * time.Second,
			},
			wantErr: false,
		},
		{
			name: "zero verify timeout",
			config: TimeoutConfig{
				VerifyTimeout: 0,
				SettleTimeout: 60 * time.Second,
			},
			wantErr: true,
		},
		{
			name: "negative verify timeout",
			config: TimeoutConfig{
				VerifyTimeout: -1 * time.Second,
				SettleTimeout: 60 * time.Second,
			},
			wantErr: true,
		},
		{
			name: "zero settle timeout",
			config: TimeoutConfig{
				VerifyTimeout: 5 * time.Second,
				SettleTimeout: 0,
			},
			wantErr: true,
		},
		{
			name: "negative settle timeout",
			config: TimeoutConfig{
				VerifyTimeout: 5 * time.Second,
				SettleTimeout: -1 * time.Second,
			},
			wantErr: true,
		},
		{
			name: "settle timeout less than verify timeout",
			config: TimeoutConfig{
				VerifyTimeout: 60 * time.Second,
				SettleTimeout: 5 * time.Second,
			},
			wantErr: true,
		},
		{
			name: "settle timeout equal to verify timeout is valid",
			config: TimeoutConfig{
				VerifyTimeout: 30 * time.Second,
				SettleTimeout: 30 * time.Second,
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestTimeoutConfigBuilders(t *testing.T) {
	t.Run("WithVerifyTimeout", func(t *testing.T) {
		config := DefaultTimeouts.WithVerifyTimeout(10 * time.Second)
		if config.VerifyTimeout != 10*time.Second {
			t.Errorf("expected VerifyTimeout to be 10s, got %v", config.VerifyTimeout)
		}
		// Verify other fields unchanged
		if config.SettleTimeout != DefaultTimeouts.SettleTimeout {
			t.Errorf("expected SettleTimeout to remain %v, got %v", DefaultTimeouts.SettleTimeout, config.SettleTimeout)
		}
		if config.RequestTimeout != DefaultTimeouts.RequestTimeout {
			t.Errorf("expected RequestTimeout to remain %v, got %v", DefaultTimeouts.RequestTimeout, config.RequestTimeout)
		}
	})

	t.Run("WithSettleTimeout", func(t *testing.T) {
		config := DefaultTimeouts.WithSettleTimeout(120 * time.Second)
		if config.SettleTimeout != 120*time.Second {
			t.Errorf("expected SettleTimeout to be 120s, got %v", config.SettleTimeout)
		}
		// Verify other fields unchanged
		if config.VerifyTimeout != DefaultTimeouts.VerifyTimeout {
			t.Errorf("expected VerifyTimeout to remain %v, got %v", DefaultTimeouts.VerifyTimeout, config.VerifyTimeout)
		}
		if config.RequestTimeout != DefaultTimeouts.RequestTimeout {
			t.Errorf("expected RequestTimeout to remain %v, got %v", DefaultTimeouts.RequestTimeout, config.RequestTimeout)
		}
	})

	t.Run("WithRequestTimeout", func(t *testing.T) {
		config := DefaultTimeouts.WithRequestTimeout(300 * time.Second)
		if config.RequestTimeout != 300*time.Second {
			t.Errorf("expected RequestTimeout to be 300s, got %v", config.RequestTimeout)
		}
		// Verify other fields unchanged
		if config.VerifyTimeout != DefaultTimeouts.VerifyTimeout {
			t.Errorf("expected VerifyTimeout to remain %v, got %v", DefaultTimeouts.VerifyTimeout, config.VerifyTimeout)
		}
		if config.SettleTimeout != DefaultTimeouts.SettleTimeout {
			t.Errorf("expected SettleTimeout to remain %v, got %v", DefaultTimeouts.SettleTimeout, config.SettleTimeout)
		}
	})

	t.Run("chained builders", func(t *testing.T) {
		config := DefaultTimeouts.
			WithVerifyTimeout(10 * time.Second).
			WithSettleTimeout(120 * time.Second).
			WithRequestTimeout(240 * time.Second)

		if config.VerifyTimeout != 10*time.Second {
			t.Errorf("expected VerifyTimeout to be 10s, got %v", config.VerifyTimeout)
		}
		if config.SettleTimeout != 120*time.Second {
			t.Errorf("expected SettleTimeout to be 120s, got %v", config.SettleTimeout)
		}
		if config.RequestTimeout != 240*time.Second {
			t.Errorf("expected RequestTimeout to be 240s, got %v", config.RequestTimeout)
		}

		// Validate that chained config is valid
		if err := config.Validate(); err != nil {
			t.Errorf("expected chained config to be valid, got error: %v", err)
		}
	})

	t.Run("builders don't mutate original", func(t *testing.T) {
		original := DefaultTimeouts
		modified := original.WithVerifyTimeout(10 * time.Second)

		if original.VerifyTimeout == modified.VerifyTimeout {
			t.Error("builder mutated original config")
		}
		if DefaultTimeouts.VerifyTimeout != 5*time.Second {
			t.Error("DefaultTimeouts was mutated")
		}
	})
}
