package x402

import (
	"errors"
	"testing"
)

func TestErrorDefinitions(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{"NoValidSigner", ErrNoValidSigner, "x402: no signer can satisfy payment requirements"},
		{"AmountExceeded", ErrAmountExceeded, "x402: payment amount exceeds per-call limit"},
		{"InvalidRequirements", ErrInvalidRequirements, "x402: invalid payment requirements"},
		{"SigningFailed", ErrSigningFailed, "x402: payment signing failed"},
		{"NetworkError", ErrNetworkError, "x402: network error during payment"},
		{"InvalidAmount", ErrInvalidAmount, "x402: invalid amount"},
		{"InvalidKey", ErrInvalidKey, "x402: invalid private key"},
		{"InvalidNetwork", ErrInvalidNetwork, "x402: invalid or unsupported network"},
		{"InvalidToken", ErrInvalidToken, "x402: invalid token configuration"},
		{"InvalidKeystore", ErrInvalidKeystore, "x402: invalid keystore file"},
		{"InvalidMnemonic", ErrInvalidMnemonic, "x402: invalid mnemonic phrase"},
		{"NoTokens", ErrNoTokens, "x402: no tokens configured"},
		{"FacilitatorUnavailable", ErrFacilitatorUnavailable, "x402: facilitator service unavailable"},
		{"VerificationFailed", ErrVerificationFailed, "x402: payment verification failed"},
		{"MalformedHeader", ErrMalformedHeader, "x402: malformed payment header"},
		{"UnsupportedVersion", ErrUnsupportedVersion, "x402: unsupported protocol version"},
		{"UnsupportedScheme", ErrUnsupportedScheme, "x402: unsupported payment scheme"},
		{"SettlementFailed", ErrSettlementFailed, "x402: payment settlement failed"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.err.Error() != tt.want {
				t.Errorf("Error message mismatch: got %q, want %q", tt.err.Error(), tt.want)
			}
		})
	}
}

func TestErrorComparison(t *testing.T) {
	tests := []struct {
		name string
		err1 error
		err2 error
		want bool
	}{
		{
			name: "same error",
			err1: ErrNoValidSigner,
			err2: ErrNoValidSigner,
			want: true,
		},
		{
			name: "different errors",
			err1: ErrNoValidSigner,
			err2: ErrInvalidAmount,
			want: false,
		},
		{
			name: "wrapped error",
			err1: errors.New("wrapped: no valid signer"),
			err2: ErrNoValidSigner,
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := errors.Is(tt.err1, tt.err2)
			if result != tt.want {
				t.Errorf("errors.Is() = %v, want %v", result, tt.want)
			}
		})
	}
}

// T068: Table-driven tests for PaymentError scenarios
func TestPaymentError_Creation(t *testing.T) {
	tests := []struct {
		name    string
		code    ErrorCode
		message string
		err     error
	}{
		{
			name:    "no valid signer error",
			code:    ErrCodeNoValidSigner,
			message: "no signer can satisfy requirements",
			err:     ErrNoValidSigner,
		},
		{
			name:    "amount exceeded error",
			code:    ErrCodeAmountExceeded,
			message: "payment exceeds limit",
			err:     ErrAmountExceeded,
		},
		{
			name:    "invalid requirements error",
			code:    ErrCodeInvalidRequirements,
			message: "server requirements are invalid",
			err:     ErrInvalidRequirements,
		},
		{
			name:    "signing failed error",
			code:    ErrCodeSigningFailed,
			message: "failed to sign payment",
			err:     ErrSigningFailed,
		},
		{
			name:    "network error",
			code:    ErrCodeNetworkError,
			message: "network communication failed",
			err:     ErrNetworkError,
		},
		{
			name:    "error without underlying cause",
			code:    ErrCodeNoValidSigner,
			message: "custom error message",
			err:     nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			paymentErr := NewPaymentError(tt.code, tt.message, tt.err)

			if paymentErr.Code != tt.code {
				t.Errorf("Code = %v, want %v", paymentErr.Code, tt.code)
			}
			if paymentErr.Message != tt.message {
				t.Errorf("Message = %v, want %v", paymentErr.Message, tt.message)
			}
			if paymentErr.Err != tt.err {
				t.Errorf("Err = %v, want %v", paymentErr.Err, tt.err)
			}
			if paymentErr.Details == nil {
				t.Error("Details map should be initialized")
			}
		})
	}
}

func TestPaymentError_ErrorMessage(t *testing.T) {
	tests := []struct {
		name         string
		paymentError *PaymentError
		wantContains []string
	}{
		{
			name: "error with underlying cause",
			paymentError: NewPaymentError(
				ErrCodeSigningFailed,
				"signature generation failed",
				errors.New("invalid key"),
			),
			wantContains: []string{"signature generation failed", "invalid key"},
		},
		{
			name: "error without underlying cause",
			paymentError: NewPaymentError(
				ErrCodeNoValidSigner,
				"no suitable signer found",
				nil,
			),
			wantContains: []string{"no suitable signer found"},
		},
		{
			name: "error with details",
			paymentError: NewPaymentError(
				ErrCodeAmountExceeded,
				"payment too large",
				ErrAmountExceeded,
			).WithDetails("requested", "1000000").WithDetails("limit", "500000"),
			wantContains: []string{"payment too large"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errMsg := tt.paymentError.Error()
			for _, want := range tt.wantContains {
				if !containsString(errMsg, want) {
					t.Errorf("Error() = %q, want to contain %q", errMsg, want)
				}
			}
		})
	}
}

func TestPaymentError_Unwrap(t *testing.T) {
	tests := []struct {
		name         string
		paymentError *PaymentError
		wantErr      error
	}{
		{
			name: "unwrap with underlying error",
			paymentError: NewPaymentError(
				ErrCodeNetworkError,
				"connection failed",
				ErrNetworkError,
			),
			wantErr: ErrNetworkError,
		},
		{
			name: "unwrap without underlying error",
			paymentError: NewPaymentError(
				ErrCodeNoValidSigner,
				"no signer available",
				nil,
			),
			wantErr: nil,
		},
		{
			name: "unwrap with custom error",
			paymentError: NewPaymentError(
				ErrCodeSigningFailed,
				"signing error",
				errors.New("custom error"),
			),
			wantErr: errors.New("custom error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			unwrapped := tt.paymentError.Unwrap()
			if tt.wantErr == nil {
				if unwrapped != nil {
					t.Errorf("Unwrap() = %v, want nil", unwrapped)
				}
			} else {
				if unwrapped == nil {
					t.Error("Unwrap() = nil, want non-nil error")
				} else if unwrapped.Error() != tt.wantErr.Error() {
					t.Errorf("Unwrap() = %v, want %v", unwrapped, tt.wantErr)
				}
			}
		})
	}
}

func TestPaymentError_WithDetails(t *testing.T) {
	tests := []struct {
		name         string
		code         ErrorCode
		message      string
		err          error
		detailsToAdd map[string]interface{}
		validateFunc func(*testing.T, *PaymentError)
	}{
		{
			name:    "single detail",
			code:    ErrCodeAmountExceeded,
			message: "amount too high",
			err:     ErrAmountExceeded,
			detailsToAdd: map[string]interface{}{
				"amount": "1000000",
			},
			validateFunc: func(t *testing.T, pe *PaymentError) {
				if len(pe.Details) != 1 {
					t.Errorf("Details length = %d, want 1", len(pe.Details))
				}
				if pe.Details["amount"] != "1000000" {
					t.Errorf("Details[amount] = %v, want 1000000", pe.Details["amount"])
				}
			},
		},
		{
			name:    "multiple details",
			code:    ErrCodeInvalidRequirements,
			message: "invalid payment requirements",
			err:     nil,
			detailsToAdd: map[string]interface{}{
				"network": "ethereum",
				"asset":   "0xUSDC",
				"amount":  "500",
			},
			validateFunc: func(t *testing.T, pe *PaymentError) {
				if len(pe.Details) != 3 {
					t.Errorf("Details length = %d, want 3", len(pe.Details))
				}
				if pe.Details["network"] != "ethereum" {
					t.Errorf("Details[network] = %v, want ethereum", pe.Details["network"])
				}
				if pe.Details["asset"] != "0xUSDC" {
					t.Errorf("Details[asset] = %v, want 0xUSDC", pe.Details["asset"])
				}
				if pe.Details["amount"] != "500" {
					t.Errorf("Details[amount] = %v, want 500", pe.Details["amount"])
				}
			},
		},
		{
			name:    "mixed type details",
			code:    ErrCodeSigningFailed,
			message: "signing failed",
			err:     ErrSigningFailed,
			detailsToAdd: map[string]interface{}{
				"retries":   3,
				"timeout":   true,
				"signer":    "EVMSigner",
				"timestamp": int64(1234567890),
			},
			validateFunc: func(t *testing.T, pe *PaymentError) {
				if len(pe.Details) != 4 {
					t.Errorf("Details length = %d, want 4", len(pe.Details))
				}
				if pe.Details["retries"] != 3 {
					t.Errorf("Details[retries] = %v, want 3", pe.Details["retries"])
				}
				if pe.Details["timeout"] != true {
					t.Errorf("Details[timeout] = %v, want true", pe.Details["timeout"])
				}
			},
		},
		{
			name:         "chaining WithDetails",
			code:         ErrCodeNetworkError,
			message:      "connection timeout",
			err:          ErrNetworkError,
			detailsToAdd: map[string]interface{}{},
			validateFunc: func(t *testing.T, pe *PaymentError) {
				// Add details via chaining
				result := pe.WithDetails("host", "api.example.com").
					WithDetails("port", 443).
					WithDetails("retryAfter", "60s")

				if len(result.Details) != 3 {
					t.Errorf("Details length = %d, want 3", len(result.Details))
				}
				if result.Details["host"] != "api.example.com" {
					t.Errorf("Details[host] = %v, want api.example.com", result.Details["host"])
				}
			},
		},
		{
			name:    "overwrite existing detail",
			code:    ErrCodeNoValidSigner,
			message: "no signer available",
			err:     nil,
			detailsToAdd: map[string]interface{}{
				"reason": "initial reason",
			},
			validateFunc: func(t *testing.T, pe *PaymentError) {
				// Overwrite the detail
				_ = pe.WithDetails("reason", "updated reason")
				if pe.Details["reason"] != "updated reason" {
					t.Errorf("Details[reason] = %v, want updated reason", pe.Details["reason"])
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			paymentErr := NewPaymentError(tt.code, tt.message, tt.err)

			// Add all details
			for key, value := range tt.detailsToAdd {
				paymentErr = paymentErr.WithDetails(key, value)
			}

			if tt.validateFunc != nil {
				tt.validateFunc(t, paymentErr)
			}

			// Verify the error still returns the same error message
			if !containsString(paymentErr.Error(), tt.message) {
				t.Errorf("Error() = %q, want to contain %q", paymentErr.Error(), tt.message)
			}
		})
	}
}

func TestPaymentError_ErrorWrapping(t *testing.T) {
	tests := []struct {
		name        string
		setupFunc   func() *PaymentError
		targetErr   error
		shouldMatch bool
	}{
		{
			name: "errors.Is matches wrapped error",
			setupFunc: func() *PaymentError {
				return NewPaymentError(
					ErrCodeSigningFailed,
					"failed to sign",
					ErrSigningFailed,
				)
			},
			targetErr:   ErrSigningFailed,
			shouldMatch: true,
		},
		{
			name: "errors.Is does not match different error",
			setupFunc: func() *PaymentError {
				return NewPaymentError(
					ErrCodeSigningFailed,
					"failed to sign",
					ErrSigningFailed,
				)
			},
			targetErr:   ErrNetworkError,
			shouldMatch: false,
		},
		{
			name: "errors.Is with nil underlying error",
			setupFunc: func() *PaymentError {
				return NewPaymentError(
					ErrCodeNoValidSigner,
					"no signer",
					nil,
				)
			},
			targetErr:   ErrNoValidSigner,
			shouldMatch: false,
		},
		{
			name: "errors.Is with nested custom error",
			setupFunc: func() *PaymentError {
				innerErr := errors.New("inner error")
				return NewPaymentError(
					ErrCodeNetworkError,
					"network failed",
					innerErr,
				)
			},
			targetErr:   errors.New("inner error"),
			shouldMatch: false, // Different error instances
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			paymentErr := tt.setupFunc()
			result := errors.Is(paymentErr, tt.targetErr)
			if result != tt.shouldMatch {
				t.Errorf("errors.Is() = %v, want %v", result, tt.shouldMatch)
			}
		})
	}
}

func TestPaymentError_AllErrorCodes(t *testing.T) {
	tests := []struct {
		name string
		code ErrorCode
	}{
		{"NoValidSigner", ErrCodeNoValidSigner},
		{"AmountExceeded", ErrCodeAmountExceeded},
		{"InvalidRequirements", ErrCodeInvalidRequirements},
		{"SigningFailed", ErrCodeSigningFailed},
		{"NetworkError", ErrCodeNetworkError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := NewPaymentError(tt.code, "test message", nil)
			if err.Code != tt.code {
				t.Errorf("Code = %v, want %v", err.Code, tt.code)
			}
			if string(err.Code) == "" {
				t.Error("ErrorCode should not be empty string")
			}
		})
	}
}

// Helper function for string containment checks
func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		func() bool {
			for i := 0; i <= len(s)-len(substr); i++ {
				if s[i:i+len(substr)] == substr {
					return true
				}
			}
			return false
		}())
}
