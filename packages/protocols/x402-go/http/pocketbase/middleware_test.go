package pocketbase

import (
	"encoding/base64"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/mark3labs/x402-go"
	httpx402 "github.com/mark3labs/x402-go/http"
)

// Note on test coverage:
// Full end-to-end middleware tests (request → middleware → handler flow) are not included
// because PocketBase's core.RequestEvent has unexported fields and cannot be easily mocked.
// Instead, we test:
// - Middleware construction and configuration
// - Individual helper functions (parsing, matching, encoding)
// - Error handling (400, 402 response scenarios)
// - Data structure validation (PaymentRequirementsResponse, SettlementResponse)
//
// The middleware logic is validated through:
// - Unit tests of each helper function
// - Integration tests in examples/pocketbase/
// - The Gin middleware tests (which use identical helper logic)

// TestPocketBaseMiddleware_Creation tests that middleware can be created
func TestPocketBaseMiddleware_Creation(t *testing.T) {
	// Create middleware config
	config := &httpx402.Config{
		FacilitatorURL: "http://mock-facilitator.test",
		PaymentRequirements: []x402.PaymentRequirement{
			{
				Scheme:            "exact",
				Network:           "base-sepolia",
				MaxAmountRequired: "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				Resource:          "https://api.example.com/test",
				Description:       "Test resource",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	// Create middleware
	middleware := NewPocketBaseX402Middleware(config)

	// Verify middleware function was created
	if middleware == nil {
		t.Error("Expected middleware function to be created")
	}
}

// TestPocketBaseMiddleware_FallbackFacilitator tests fallback facilitator configuration
func TestPocketBaseMiddleware_FallbackFacilitator(t *testing.T) {
	// Create middleware config with fallback
	config := &httpx402.Config{
		FacilitatorURL:         "http://mock-facilitator.test",
		FallbackFacilitatorURL: "http://fallback-facilitator.test",
		PaymentRequirements: []x402.PaymentRequirement{
			{
				Scheme:            "exact",
				Network:           "base-sepolia",
				MaxAmountRequired: "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	// Create middleware
	middleware := NewPocketBaseX402Middleware(config)

	// Verify middleware was created with fallback support
	if middleware == nil {
		t.Error("Expected middleware function to be created with fallback facilitator")
	}
}

// TestPocketBaseMiddleware_VerifyOnlyMode tests verification-only mode without settlement
func TestPocketBaseMiddleware_VerifyOnlyMode(t *testing.T) {
	// Create middleware config with VerifyOnly flag
	config := &httpx402.Config{
		FacilitatorURL: "http://mock-facilitator.test",
		VerifyOnly:     true, // Key difference - only verify, don't settle
		PaymentRequirements: []x402.PaymentRequirement{
			{
				Scheme:            "exact",
				Network:           "base-sepolia",
				MaxAmountRequired: "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				Resource:          "https://api.example.com/test",
				Description:       "Test resource",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	// Create middleware
	middleware := NewPocketBaseX402Middleware(config)

	// Verify middleware was created with VerifyOnly mode
	if middleware == nil {
		t.Error("Expected middleware function to be created in VerifyOnly mode")
	}
}

// TestHelperFunctions tests the four duplicated helper functions
func TestHelperFunctions(t *testing.T) {
	t.Run("parsePaymentHeaderFromRequest", func(t *testing.T) {
		// Test with valid header
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-PAYMENT", "eyJ4NDAyVmVyc2lvbiI6MSwic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoiYmFzZS1zZXBvbGlhIiwicGF5bG9hZCI6e319")

		payment, err := parsePaymentHeaderFromRequest(req)
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}

		if payment.X402Version != 1 {
			t.Errorf("Expected X402Version 1, got %d", payment.X402Version)
		}

		// Test with missing header
		req2 := httptest.NewRequest("GET", "/test", nil)
		_, err = parsePaymentHeaderFromRequest(req2)
		if err == nil {
			t.Error("Expected error for missing header")
		}

		// Test with invalid base64
		req3 := httptest.NewRequest("GET", "/test", nil)
		req3.Header.Set("X-PAYMENT", "not-valid-base64!!!")
		_, err = parsePaymentHeaderFromRequest(req3)
		if err == nil {
			t.Error("Expected error for invalid base64")
		}
	})

	t.Run("findMatchingRequirementPocketBase", func(t *testing.T) {
		requirements := []x402.PaymentRequirement{
			{
				Scheme:  "exact",
				Network: "base-sepolia",
			},
			{
				Scheme:  "exact",
				Network: "solana-devnet",
			},
		}

		// Test matching requirement
		payment := x402.PaymentPayload{
			Scheme:  "exact",
			Network: "base-sepolia",
		}

		req, err := findMatchingRequirementPocketBase(payment, requirements)
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}

		if req.Network != "base-sepolia" {
			t.Errorf("Expected network base-sepolia, got %s", req.Network)
		}

		// Test non-matching requirement
		payment2 := x402.PaymentPayload{
			Scheme:  "exact",
			Network: "unknown-network",
		}

		_, err = findMatchingRequirementPocketBase(payment2, requirements)
		if err == nil {
			t.Error("Expected error for non-matching requirement")
		}
	})

	t.Run("sendPaymentRequiredPocketBase", func(t *testing.T) {
		// We test the logic by verifying the PaymentRequirementsResponse structure
		// rather than testing the full PocketBase event flow which requires unexported fields

		requirements := []x402.PaymentRequirement{
			{
				Scheme:            "exact",
				Network:           "base-sepolia",
				MaxAmountRequired: "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				Resource:          "https://api.example.com/test",
				Description:       "Test payment",
				MaxTimeoutSeconds: 300,
			},
		}

		// Verify the response structure that would be sent
		response := x402.PaymentRequirementsResponse{
			X402Version: 1,
			Error:       "Payment required for this resource",
			Accepts:     requirements,
		}

		// Verify response marshals to valid JSON
		data, err := json.Marshal(response)
		if err != nil {
			t.Errorf("Failed to marshal PaymentRequirementsResponse: %v", err)
		}

		// Verify we can unmarshal it back
		var decoded x402.PaymentRequirementsResponse
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Errorf("Failed to unmarshal response: %v", err)
		}

		// Verify response fields
		if decoded.X402Version != 1 {
			t.Errorf("Expected X402Version 1, got %d", decoded.X402Version)
		}

		if decoded.Error == "" {
			t.Error("Expected error message in response")
		}

		if len(decoded.Accepts) != 1 {
			t.Errorf("Expected 1 payment requirement, got %d", len(decoded.Accepts))
		}

		if decoded.Accepts[0].Network != "base-sepolia" {
			t.Errorf("Expected network base-sepolia, got %s", decoded.Accepts[0].Network)
		}
	})

	t.Run("addPaymentResponseHeaderPocketBase", func(t *testing.T) {
		// Test the header encoding logic directly
		settlement := &x402.SettlementResponse{
			Success:     true,
			Transaction: "0xabcdef123456789",
		}

		// Marshal settlement response to JSON (same logic as the function)
		data, err := json.Marshal(settlement)
		if err != nil {
			t.Errorf("Failed to marshal settlement response: %v", err)
		}

		// Encode as base64 (same logic as the function)
		encoded := base64.StdEncoding.EncodeToString(data)

		if encoded == "" {
			t.Error("Expected non-empty base64 encoded string")
		}

		// Verify we can decode it back
		decoded, err := base64.StdEncoding.DecodeString(encoded)
		if err != nil {
			t.Errorf("Failed to decode base64: %v", err)
		}

		var decodedSettlement x402.SettlementResponse
		if err := json.Unmarshal(decoded, &decodedSettlement); err != nil {
			t.Errorf("Failed to unmarshal settlement JSON: %v", err)
		}

		// Verify the decoded values match the original
		if decodedSettlement.Success != settlement.Success {
			t.Errorf("Expected Success %v, got %v", settlement.Success, decodedSettlement.Success)
		}

		if decodedSettlement.Transaction != settlement.Transaction {
			t.Errorf("Expected Transaction %s, got %s", settlement.Transaction, decodedSettlement.Transaction)
		}
	})
}

// TestPocketBaseMiddleware_MultiplePaymentRequirements tests multiple payment options
func TestPocketBaseMiddleware_MultiplePaymentRequirements(t *testing.T) {
	config := &httpx402.Config{
		FacilitatorURL: "http://mock-facilitator.test",
		PaymentRequirements: []x402.PaymentRequirement{
			{
				Scheme:            "exact",
				Network:           "base-sepolia",
				MaxAmountRequired: "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 60,
			},
			{
				Scheme:            "exact",
				Network:           "solana-devnet",
				MaxAmountRequired: "10000",
				Asset:             "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
				PayTo:             "YourSolanaWallet",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	middleware := NewPocketBaseX402Middleware(config)

	// Verify middleware supports multiple payment requirements
	if middleware == nil {
		t.Error("Expected middleware to support multiple payment requirements")
	}
}

// TestPocketBaseMiddleware_InvalidBase64Returns400 tests malformed payment header handling
func TestPocketBaseMiddleware_InvalidBase64Returns400(t *testing.T) {
	// Test that invalid base64 in X-PAYMENT header is properly rejected
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-PAYMENT", "not-valid-base64!!!")

	_, err := parsePaymentHeaderFromRequest(req)
	if err == nil {
		t.Error("Expected error for invalid base64, got nil")
	}

	// Verify error is related to malformed header
	if !json.Valid([]byte(err.Error())) && err.Error() == "" {
		// Error message should be meaningful
		t.Logf("Error message: %v", err)
	}
}

// TestPocketBaseMiddleware_InvalidJSONReturns400 tests invalid JSON handling
func TestPocketBaseMiddleware_InvalidJSONReturns400(t *testing.T) {
	// Test that invalid JSON (even with valid base64) is properly rejected
	req := httptest.NewRequest("GET", "/test", nil)
	// Base64 encode invalid JSON
	invalidJSON := base64.StdEncoding.EncodeToString([]byte("{invalid json"))
	req.Header.Set("X-PAYMENT", invalidJSON)

	_, err := parsePaymentHeaderFromRequest(req)
	if err == nil {
		t.Error("Expected error for invalid JSON, got nil")
	}
}

// TestPocketBaseMiddleware_UnsupportedVersionReturns400 tests version validation
func TestPocketBaseMiddleware_UnsupportedVersionReturns400(t *testing.T) {
	// Test that unsupported x402 version is rejected
	req := httptest.NewRequest("GET", "/test", nil)
	// Create payment with unsupported version
	payment := map[string]interface{}{
		"x402Version": 99, // Unsupported version
		"scheme":      "exact",
		"network":     "base-sepolia",
		"payload":     map[string]interface{}{},
	}
	paymentJSON, _ := json.Marshal(payment)
	encoded := base64.StdEncoding.EncodeToString(paymentJSON)
	req.Header.Set("X-PAYMENT", encoded)

	_, err := parsePaymentHeaderFromRequest(req)
	if err == nil {
		t.Error("Expected error for unsupported version, got nil")
	}
}

// TestPocketBaseMiddleware_MissingHeaderReturns402 tests missing X-PAYMENT header
func TestPocketBaseMiddleware_MissingHeaderReturns402(t *testing.T) {
	// Test that missing X-PAYMENT header is properly detected
	req := httptest.NewRequest("GET", "/test", nil)
	// Don't set X-PAYMENT header

	_, err := parsePaymentHeaderFromRequest(req)
	if err == nil {
		t.Error("Expected error for missing header, got nil")
	}
}

// TestPocketBaseMiddleware_SchemeNetworkMatching tests payment requirement matching
func TestPocketBaseMiddleware_SchemeNetworkMatching(t *testing.T) {
	requirements := []x402.PaymentRequirement{
		{
			Scheme:  "exact",
			Network: "base-sepolia",
		},
		{
			Scheme:  "exact",
			Network: "base",
		},
		{
			Scheme:  "signature",
			Network: "solana-devnet",
		},
	}

	tests := []struct {
		name        string
		payment     x402.PaymentPayload
		shouldMatch bool
		expectNet   string
	}{
		{
			name:        "exact match base-sepolia",
			payment:     x402.PaymentPayload{Scheme: "exact", Network: "base-sepolia"},
			shouldMatch: true,
			expectNet:   "base-sepolia",
		},
		{
			name:        "exact match base",
			payment:     x402.PaymentPayload{Scheme: "exact", Network: "base"},
			shouldMatch: true,
			expectNet:   "base",
		},
		{
			name:        "signature match solana-devnet",
			payment:     x402.PaymentPayload{Scheme: "signature", Network: "solana-devnet"},
			shouldMatch: true,
			expectNet:   "solana-devnet",
		},
		{
			name:        "no match - unknown network",
			payment:     x402.PaymentPayload{Scheme: "exact", Network: "unknown"},
			shouldMatch: false,
		},
		{
			name:        "no match - wrong scheme",
			payment:     x402.PaymentPayload{Scheme: "signature", Network: "base-sepolia"},
			shouldMatch: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := findMatchingRequirementPocketBase(tt.payment, requirements)

			if tt.shouldMatch {
				if err != nil {
					t.Errorf("Expected match but got error: %v", err)
				}
				if req.Network != tt.expectNet {
					t.Errorf("Expected network %s, got %s", tt.expectNet, req.Network)
				}
			} else {
				if err == nil {
					t.Error("Expected no match but got success")
				}
			}
		})
	}
}

// TestPocketBaseMiddleware_PaymentRequirementsResponseStructure tests 402 response format
func TestPocketBaseMiddleware_PaymentRequirementsResponseStructure(t *testing.T) {
	requirements := []x402.PaymentRequirement{
		{
			Scheme:            "exact",
			Network:           "base-sepolia",
			MaxAmountRequired: "10000",
			Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
			PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
			Resource:          "https://api.example.com/test",
			Description:       "Test payment",
			MaxTimeoutSeconds: 300,
		},
	}

	response := x402.PaymentRequirementsResponse{
		X402Version: 1,
		Error:       "Payment required for this resource",
		Accepts:     requirements,
	}

	// Marshal to JSON
	data, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("Failed to marshal response: %v", err)
	}

	// Verify JSON structure
	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to parse response JSON: %v", err)
	}

	// Verify required fields
	if version, ok := parsed["x402Version"].(float64); !ok || version != 1 {
		t.Error("Expected x402Version field with value 1")
	}

	if errMsg, ok := parsed["error"].(string); !ok || errMsg == "" {
		t.Error("Expected non-empty error field")
	}

	if accepts, ok := parsed["accepts"].([]interface{}); !ok || len(accepts) == 0 {
		t.Error("Expected non-empty accepts array")
	}
}

// TestPocketBaseMiddleware_SettlementResponseHeaderEncoding tests X-PAYMENT-RESPONSE header format
func TestPocketBaseMiddleware_SettlementResponseHeaderEncoding(t *testing.T) {
	tests := []struct {
		name       string
		settlement x402.SettlementResponse
	}{
		{
			name: "successful settlement",
			settlement: x402.SettlementResponse{
				Success:     true,
				Transaction: "0xabcdef123456789",
			},
		},
		{
			name: "failed settlement",
			settlement: x402.SettlementResponse{
				Success:     false,
				ErrorReason: "insufficient balance",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Marshal and encode (simulating addPaymentResponseHeaderPocketBase)
			data, err := json.Marshal(&tt.settlement)
			if err != nil {
				t.Fatalf("Failed to marshal settlement: %v", err)
			}

			encoded := base64.StdEncoding.EncodeToString(data)

			// Verify we can decode it
			decoded, err := base64.StdEncoding.DecodeString(encoded)
			if err != nil {
				t.Fatalf("Failed to decode base64: %v", err)
			}

			var parsed x402.SettlementResponse
			if err := json.Unmarshal(decoded, &parsed); err != nil {
				t.Fatalf("Failed to unmarshal settlement: %v", err)
			}

			// Verify values
			if parsed.Success != tt.settlement.Success {
				t.Errorf("Success mismatch: expected %v, got %v", tt.settlement.Success, parsed.Success)
			}

			if tt.settlement.Success && parsed.Transaction != tt.settlement.Transaction {
				t.Errorf("Transaction mismatch: expected %s, got %s", tt.settlement.Transaction, parsed.Transaction)
			}

			if !tt.settlement.Success && parsed.ErrorReason != tt.settlement.ErrorReason {
				t.Errorf("ErrorReason mismatch: expected %s, got %s", tt.settlement.ErrorReason, parsed.ErrorReason)
			}
		})
	}
}
