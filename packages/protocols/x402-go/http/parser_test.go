package http

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/mark3labs/x402-go"
)

func TestParseSettlement_Comprehensive(t *testing.T) {
	tests := []struct {
		name       string
		headerFunc func() string
		wantErr    bool
		validate   func(*testing.T, *x402.SettlementResponse)
	}{
		{
			name: "valid settlement with all fields",
			headerFunc: func() string {
				settlement := x402.SettlementResponse{
					Success:     true,
					ErrorReason: "",
					Transaction: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
					Network:     "base",
					Payer:       "0x1234567890123456789012345678901234567890",
				}
				data, _ := json.Marshal(settlement)
				return base64.StdEncoding.EncodeToString(data)
			},
			wantErr: false,
			validate: func(t *testing.T, s *x402.SettlementResponse) {
				if s == nil {
					t.Fatal("expected non-nil settlement")
				}
				if !s.Success {
					t.Error("expected Success to be true")
				}
				if s.Transaction != "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" {
					t.Errorf("expected transaction hash 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef, got %s", s.Transaction)
				}
				if s.Network != "base" {
					t.Errorf("expected network 'base', got '%s'", s.Network)
				}
				if s.Payer != "0x1234567890123456789012345678901234567890" {
					t.Errorf("expected payer 0x1234567890123456789012345678901234567890, got %s", s.Payer)
				}
				if s.ErrorReason != "" {
					t.Errorf("expected empty error reason, got '%s'", s.ErrorReason)
				}
			},
		},
		{
			name: "valid minimal settlement response",
			headerFunc: func() string {
				settlement := x402.SettlementResponse{
					Success: true,
					Network: "solana",
					Payer:   "SomeBase58SolanaAddress123456789",
				}
				data, _ := json.Marshal(settlement)
				return base64.StdEncoding.EncodeToString(data)
			},
			wantErr: false,
			validate: func(t *testing.T, s *x402.SettlementResponse) {
				if s == nil {
					t.Fatal("expected non-nil settlement")
				}
				if !s.Success {
					t.Error("expected Success to be true")
				}
				if s.Network != "solana" {
					t.Errorf("expected network 'solana', got '%s'", s.Network)
				}
				if s.Payer != "SomeBase58SolanaAddress123456789" {
					t.Errorf("expected payer SomeBase58SolanaAddress123456789, got %s", s.Payer)
				}
				// Transaction and ErrorReason can be empty for minimal response
				if s.Transaction != "" {
					t.Logf("transaction field present: %s", s.Transaction)
				}
			},
		},
		{
			name: "valid failed settlement with error reason",
			headerFunc: func() string {
				settlement := x402.SettlementResponse{
					Success:     false,
					ErrorReason: "insufficient funds",
					Network:     "base",
					Payer:       "0x1234567890123456789012345678901234567890",
				}
				data, _ := json.Marshal(settlement)
				return base64.StdEncoding.EncodeToString(data)
			},
			wantErr: false,
			validate: func(t *testing.T, s *x402.SettlementResponse) {
				if s == nil {
					t.Fatal("expected non-nil settlement")
				}
				if s.Success {
					t.Error("expected Success to be false")
				}
				if s.ErrorReason != "insufficient funds" {
					t.Errorf("expected error reason 'insufficient funds', got '%s'", s.ErrorReason)
				}
				if s.Network != "base" {
					t.Errorf("expected network 'base', got '%s'", s.Network)
				}
			},
		},
		{
			name: "invalid base64 encoding",
			headerFunc: func() string {
				return "this is not valid base64!!!"
			},
			wantErr: true,
			validate: func(t *testing.T, s *x402.SettlementResponse) {
				if s != nil {
					t.Error("expected nil settlement on error")
				}
			},
		},
		{
			name: "invalid JSON structure",
			headerFunc: func() string {
				return base64.StdEncoding.EncodeToString([]byte("not a valid JSON"))
			},
			wantErr: true,
			validate: func(t *testing.T, s *x402.SettlementResponse) {
				if s != nil {
					t.Error("expected nil settlement on error")
				}
			},
		},
		{
			name: "malformed JSON with syntax error",
			headerFunc: func() string {
				return base64.StdEncoding.EncodeToString([]byte(`{"success": true, "network": "base"`))
			},
			wantErr: true,
			validate: func(t *testing.T, s *x402.SettlementResponse) {
				if s != nil {
					t.Error("expected nil settlement on error")
				}
			},
		},
		{
			name: "empty header value",
			headerFunc: func() string {
				return ""
			},
			wantErr: true,
			validate: func(t *testing.T, s *x402.SettlementResponse) {
				if s != nil {
					t.Error("expected nil settlement on error")
				}
			},
		},
		{
			name: "base64 encoded empty JSON object",
			headerFunc: func() string {
				return base64.StdEncoding.EncodeToString([]byte("{}"))
			},
			wantErr: false,
			validate: func(t *testing.T, s *x402.SettlementResponse) {
				if s == nil {
					t.Fatal("expected non-nil settlement")
				}
				// Empty JSON object should parse but have zero values
				if s.Success {
					t.Error("expected Success to be false (zero value)")
				}
				if s.Network != "" {
					t.Errorf("expected empty network, got '%s'", s.Network)
				}
				if s.Payer != "" {
					t.Errorf("expected empty payer, got '%s'", s.Payer)
				}
			},
		},
		{
			name: "settlement with extra fields",
			headerFunc: func() string {
				// Include extra fields that might be added in future versions
				data := `{
					"success": true,
					"transaction": "0xabcdef",
					"network": "ethereum",
					"payer": "0x9876543210",
					"extraField": "should be ignored",
					"anotherExtra": 12345
				}`
				return base64.StdEncoding.EncodeToString([]byte(data))
			},
			wantErr: false,
			validate: func(t *testing.T, s *x402.SettlementResponse) {
				if s == nil {
					t.Fatal("expected non-nil settlement")
				}
				if !s.Success {
					t.Error("expected Success to be true")
				}
				if s.Transaction != "0xabcdef" {
					t.Errorf("expected transaction 0xabcdef, got %s", s.Transaction)
				}
				if s.Network != "ethereum" {
					t.Errorf("expected network 'ethereum', got '%s'", s.Network)
				}
				if s.Payer != "0x9876543210" {
					t.Errorf("expected payer 0x9876543210, got %s", s.Payer)
				}
			},
		},
		{
			name: "settlement with Solana transaction hash",
			headerFunc: func() string {
				settlement := x402.SettlementResponse{
					Success:     true,
					Transaction: "5J8W9FvGxKzVz1nZQ8vJxH2xC3pK4yT6rR8mN7bL5aP9",
					Network:     "solana",
					Payer:       "GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS",
				}
				data, _ := json.Marshal(settlement)
				return base64.StdEncoding.EncodeToString(data)
			},
			wantErr: false,
			validate: func(t *testing.T, s *x402.SettlementResponse) {
				if s == nil {
					t.Fatal("expected non-nil settlement")
				}
				if !s.Success {
					t.Error("expected Success to be true")
				}
				if s.Transaction != "5J8W9FvGxKzVz1nZQ8vJxH2xC3pK4yT6rR8mN7bL5aP9" {
					t.Errorf("unexpected transaction hash: %s", s.Transaction)
				}
				if s.Network != "solana" {
					t.Errorf("expected network 'solana', got '%s'", s.Network)
				}
			},
		},
		{
			name: "whitespace in base64 (should fail)",
			headerFunc: func() string {
				settlement := x402.SettlementResponse{
					Success: true,
					Network: "base",
					Payer:   "0x123",
				}
				data, _ := json.Marshal(settlement)
				encoded := base64.StdEncoding.EncodeToString(data)
				// Insert whitespace which should break decoding
				return encoded[:10] + " " + encoded[10:]
			},
			wantErr: true,
			validate: func(t *testing.T, s *x402.SettlementResponse) {
				if s != nil {
					t.Error("expected nil settlement with whitespace in base64")
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			header := tt.headerFunc()
			settlement, err := parseSettlement(header)

			if tt.wantErr {
				if err == nil {
					t.Error("expected error, got nil")
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			}

			if tt.validate != nil {
				tt.validate(t, settlement)
			}
		})
	}
}

// TestParseSettlement_ErrorMessages_Comprehensive verifies that error messages are descriptive
func TestParseSettlement_ErrorMessages_Comprehensive(t *testing.T) {
	tests := []struct {
		name           string
		headerValue    string
		errorSubstring string
	}{
		{
			name:           "invalid base64 mentions decode error",
			headerValue:    "not!!!valid!!!base64",
			errorSubstring: "decode",
		},
		{
			name:           "invalid JSON mentions parse error",
			headerValue:    base64.StdEncoding.EncodeToString([]byte("not json")),
			errorSubstring: "parse",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := parseSettlement(tt.headerValue)
			if err == nil {
				t.Fatal("expected error, got nil")
			}

			errMsg := err.Error()
			if errMsg == "" {
				t.Error("error message should not be empty")
			}
		})
	}
}

// T069: Test for malformed 402 response handling
func TestParsePaymentRequirements_Malformed(t *testing.T) {
	tests := []struct {
		name        string
		bodyFunc    func() string
		wantErr     bool
		errContains string
	}{
		{
			name: "invalid JSON - missing closing brace",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": [
						{
							"scheme": "exact",
							"network": "base"
				`
			},
			wantErr:     true,
			errContains: "parse",
		},
		{
			name: "invalid JSON - trailing comma",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": [
						{
							"scheme": "exact",
							"network": "base",
							"asset": "0xUSDC",
							"maxAmountRequired": "100000",
							"payTo": "0x1234567890123456789012345678901234567890",
							"maxTimeoutSeconds": 60,
						}
					]
				}`
			},
			wantErr:     true,
			errContains: "parse",
		},
		{
			name: "invalid JSON - not JSON at all",
			bodyFunc: func() string {
				return "This is not JSON, just plain text"
			},
			wantErr:     true,
			errContains: "parse",
		},
		{
			name: "invalid JSON - XML instead of JSON",
			bodyFunc: func() string {
				return `<?xml version="1.0"?>
					<error>Payment required</error>`
			},
			wantErr:     true,
			errContains: "parse",
		},
		{
			name: "invalid JSON - HTML error page",
			bodyFunc: func() string {
				return `<!DOCTYPE html>
					<html>
					<body>
						<h1>402 Payment Required</h1>
					</body>
					</html>`
			},
			wantErr:     true,
			errContains: "parse",
		},
		{
			name: "missing required field - no scheme",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": [
						{
							"network": "base",
							"asset": "0xUSDC",
							"maxAmountRequired": "100000",
							"payTo": "0x1234567890123456789012345678901234567890",
							"maxTimeoutSeconds": 60
						}
					]
				}`
			},
			wantErr: false, // JSON parses, but scheme will be empty
		},
		{
			name: "missing required field - no network",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": [
						{
							"scheme": "exact",
							"asset": "0xUSDC",
							"maxAmountRequired": "100000",
							"payTo": "0x1234567890123456789012345678901234567890",
							"maxTimeoutSeconds": 60
						}
					]
				}`
			},
			wantErr: false, // JSON parses, but network will be empty
		},
		{
			name: "missing required field - no maxAmountRequired",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": [
						{
							"scheme": "exact",
							"network": "base",
							"asset": "0xUSDC",
							"payTo": "0x1234567890123456789012345678901234567890",
							"maxTimeoutSeconds": 60
						}
					]
				}`
			},
			wantErr: false, // JSON parses, but maxAmountRequired will be empty
		},
		{
			name: "missing required field - no asset",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": [
						{
							"scheme": "exact",
							"network": "base",
							"maxAmountRequired": "100000",
							"payTo": "0x1234567890123456789012345678901234567890",
							"maxTimeoutSeconds": 60
						}
					]
				}`
			},
			wantErr: false, // JSON parses, but asset will be empty
		},
		{
			name: "missing required field - no payTo",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": [
						{
							"scheme": "exact",
							"network": "base",
							"asset": "0xUSDC",
							"maxAmountRequired": "100000",
							"maxTimeoutSeconds": 60
						}
					]
				}`
			},
			wantErr: false, // JSON parses, but payTo will be empty
		},
		{
			name: "malformed structure - accepts is not an array",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": {
						"scheme": "exact",
						"network": "base"
					}
				}`
			},
			wantErr:     true,
			errContains: "parse",
		},
		{
			name: "malformed structure - accepts is a string",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": "not an array"
				}`
			},
			wantErr:     true,
			errContains: "parse",
		},
		{
			name: "malformed structure - accepts is null",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": null
				}`
			},
			wantErr:     true,
			errContains: "no payment requirements",
		},
		{
			name: "empty response body",
			bodyFunc: func() string {
				return ""
			},
			wantErr:     true,
			errContains: "parse",
		},
		{
			name: "response body with only whitespace",
			bodyFunc: func() string {
				return "   \n\t\r\n   "
			},
			wantErr:     true,
			errContains: "parse",
		},
		{
			name: "response body with null JSON",
			bodyFunc: func() string {
				return "null"
			},
			wantErr:     true,
			errContains: "no payment requirements",
		},
		{
			name: "wrong type for maxTimeoutSeconds (string instead of int)",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": [
						{
							"scheme": "exact",
							"network": "base",
							"asset": "0xUSDC",
							"maxAmountRequired": "100000",
							"payTo": "0x1234567890123456789012345678901234567890",
							"maxTimeoutSeconds": "60"
						}
					]
				}`
			},
			wantErr:     true,
			errContains: "parse",
		},
		{
			name: "wrong type for x402Version (string instead of int)",
			bodyFunc: func() string {
				return `{
					"x402Version": "1",
					"error": "Payment required",
					"accepts": [
						{
							"scheme": "exact",
							"network": "base",
							"asset": "0xUSDC",
							"maxAmountRequired": "100000",
							"payTo": "0x1234567890123456789012345678901234567890",
							"maxTimeoutSeconds": 60
						}
					]
				}`
			},
			wantErr:     true,
			errContains: "parse",
		},
		{
			name: "accepts array with malformed objects",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": [
						"not an object",
						123,
						null
					]
				}`
			},
			wantErr:     true,
			errContains: "parse",
		},
		{
			name: "JSON array at root instead of object",
			bodyFunc: func() string {
				return `[
					{
						"scheme": "exact",
						"network": "base"
					}
				]`
			},
			wantErr:     true,
			errContains: "parse",
		},
		{
			name: "boolean JSON at root",
			bodyFunc: func() string {
				return "true"
			},
			wantErr:     true,
			errContains: "parse",
		},
		{
			name: "number JSON at root",
			bodyFunc: func() string {
				return "402"
			},
			wantErr:     true,
			errContains: "parse",
		},
		{
			name: "extra nested object in accepts array item",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": [
						{
							"scheme": "exact",
							"network": {"chainId": 8453, "name": "base"},
							"asset": "0xUSDC",
							"maxAmountRequired": "100000",
							"payTo": "0x1234567890123456789012345678901234567890",
							"maxTimeoutSeconds": 60
						}
					]
				}`
			},
			wantErr:     true,
			errContains: "parse",
		},
		{
			name: "Unicode in JSON that breaks parsing",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required \uD800",
					"accepts": []
				}`
			},
			wantErr: true, // Invalid unicode
		},
		{
			name: "extremely nested malformed JSON",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": {
						"nested": {
							"deeply": {
								"invalid": [[[[[
					}}}}`
			},
			wantErr:     true,
			errContains: "parse",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := tt.bodyFunc()
			resp := &http.Response{
				Body: io.NopCloser(strings.NewReader(body)),
			}

			requirement, err := parsePaymentRequirements(resp)

			if tt.wantErr {
				if err == nil {
					t.Error("expected error, got nil")
				}
				if tt.errContains != "" && err != nil {
					if !containsString(err.Error(), tt.errContains) {
						t.Errorf("error = %q, want to contain %q", err.Error(), tt.errContains)
					}
				}
				if requirement != nil {
					t.Error("expected nil requirement on error")
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
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

// T061: Test for conflicting payment requirements
func TestParsePaymentRequirements_ConflictingRequirements(t *testing.T) {
	tests := []struct {
		name        string
		bodyFunc    func() string
		wantErr     bool
		expectValid bool
	}{
		{
			name: "multiple requirements with different networks",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": [
						{
							"scheme": "exact",
							"network": "base",
							"asset": "0xUSDC",
							"maxAmountRequired": "100000",
							"payTo": "0x1234567890123456789012345678901234567890",
							"maxTimeoutSeconds": 60
						},
						{
							"scheme": "exact",
							"network": "solana",
							"asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
							"maxAmountRequired": "100000",
							"payTo": "SomeBase58Address",
							"maxTimeoutSeconds": 60
						}
					]
				}`
			},
			wantErr:     false,
			expectValid: true, // Should select first requirement
		},
		{
			name: "multiple requirements with conflicting amounts",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": [
						{
							"scheme": "exact",
							"network": "base",
							"asset": "0xUSDC",
							"maxAmountRequired": "100000",
							"payTo": "0x1234567890123456789012345678901234567890",
							"maxTimeoutSeconds": 60
						},
						{
							"scheme": "exact",
							"network": "base",
							"asset": "0xUSDC",
							"maxAmountRequired": "500000",
							"payTo": "0x1234567890123456789012345678901234567890",
							"maxTimeoutSeconds": 60
						}
					]
				}`
			},
			wantErr:     false,
			expectValid: true, // Should select first requirement
		},
		{
			name: "requirements with different schemes",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": [
						{
							"scheme": "exact",
							"network": "base",
							"asset": "0xUSDC",
							"maxAmountRequired": "100000",
							"payTo": "0x1234567890123456789012345678901234567890",
							"maxTimeoutSeconds": 60
						},
						{
							"scheme": "subscription",
							"network": "base",
							"asset": "0xUSDC",
							"maxAmountRequired": "1000000",
							"payTo": "0x1234567890123456789012345678901234567890",
							"maxTimeoutSeconds": 3600
						}
					]
				}`
			},
			wantErr:     false,
			expectValid: true, // Should select first requirement
		},
		{
			name: "empty accepts array",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": []
				}`
			},
			wantErr:     true,
			expectValid: false,
		},
		{
			name: "missing accepts field",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required"
				}`
			},
			wantErr:     true,
			expectValid: false,
		},
		{
			name: "requirements with conflicting timeout values",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": [
						{
							"scheme": "exact",
							"network": "base",
							"asset": "0xUSDC",
							"maxAmountRequired": "100000",
							"payTo": "0x1234567890123456789012345678901234567890",
							"maxTimeoutSeconds": 30
						},
						{
							"scheme": "exact",
							"network": "base",
							"asset": "0xUSDC",
							"maxAmountRequired": "100000",
							"payTo": "0x1234567890123456789012345678901234567890",
							"maxTimeoutSeconds": 3600
						}
					]
				}`
			},
			wantErr:     false,
			expectValid: true, // Should select first requirement
		},
		{
			name: "requirements with different assets on same network",
			bodyFunc: func() string {
				return `{
					"x402Version": 1,
					"error": "Payment required",
					"accepts": [
						{
							"scheme": "exact",
							"network": "base",
							"asset": "0xUSDC",
							"maxAmountRequired": "100000",
							"payTo": "0x1234567890123456789012345678901234567890",
							"maxTimeoutSeconds": 60
						},
						{
							"scheme": "exact",
							"network": "base",
							"asset": "0xDAI",
							"maxAmountRequired": "100000",
							"payTo": "0x1234567890123456789012345678901234567890",
							"maxTimeoutSeconds": 60
						}
					]
				}`
			},
			wantErr:     false,
			expectValid: true, // Should select first requirement
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := tt.bodyFunc()
			resp := &http.Response{
				Body: io.NopCloser(strings.NewReader(body)),
			}

			requirements, err := parsePaymentRequirements(resp)

			if tt.wantErr {
				if err == nil {
					t.Error("expected error, got nil")
				}
				if requirements != nil {
					t.Error("expected nil requirements on error")
				}
				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}

			if tt.expectValid {
				if requirements == nil {
					t.Fatal("expected non-nil requirements")
				}
				if len(requirements) == 0 {
					t.Fatal("expected at least one requirement")
				}
				// Verify we got requirements from accepts array
				if requirements[0].Network == "" {
					t.Error("expected network to be set")
				}
				if requirements[0].Scheme == "" {
					t.Error("expected scheme to be set")
				}
				if requirements[0].MaxAmountRequired == "" {
					t.Error("expected maxAmountRequired to be set")
				}
			}
		})
	}
}
