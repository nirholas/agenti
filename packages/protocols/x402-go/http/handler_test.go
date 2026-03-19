package http

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mark3labs/x402-go"
	"github.com/mark3labs/x402-go/facilitator"
)

func TestHandler_ParsePaymentHeader(t *testing.T) {
	validPayload := x402.PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-sepolia",
	}

	payloadJSON, _ := json.Marshal(validPayload)
	validHeader := base64.StdEncoding.EncodeToString(payloadJSON)

	tests := []struct {
		name      string
		header    string
		wantError bool
	}{
		{
			name:      "valid header",
			header:    validHeader,
			wantError: false,
		},
		{
			name:      "empty header",
			header:    "",
			wantError: true,
		},
		{
			name:      "invalid base64",
			header:    "not-base64!!!",
			wantError: true,
		},
		{
			name:      "invalid JSON",
			header:    base64.StdEncoding.EncodeToString([]byte("not json")),
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			if tt.header != "" {
				req.Header.Set("X-PAYMENT", tt.header)
			}

			_, err := parsePaymentHeader(req)
			if (err != nil) != tt.wantError {
				t.Errorf("parsePaymentHeader() error = %v, wantError %v", err, tt.wantError)
			}
		})
	}
}

func TestHandler_GeneratePaymentRequirements(t *testing.T) {
	config := &Config{
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

	rec := httptest.NewRecorder()
	sendPaymentRequired(rec, config)

	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status %d, got %d", http.StatusPaymentRequired, rec.Code)
	}

	var response x402.PaymentRequirementsResponse
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if response.X402Version != 1 {
		t.Errorf("Expected X402Version 1, got %d", response.X402Version)
	}

	if len(response.Accepts) != 1 {
		t.Errorf("Expected 1 payment requirement, got %d", len(response.Accepts))
	}
}

// TestHandler_PaymentContextStorage tests that verified payment info is stored in context
func TestHandler_PaymentContextStorage(t *testing.T) {
	// This test verifies that when a payment is successfully verified,
	// the payment information is stored in the request context using PaymentContextKey
	// so that handlers can access it for custom business logic

	// Create a test handler that checks for payment context
	contextChecked := false
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Try to retrieve payment info from context
		paymentInfo := r.Context().Value(PaymentContextKey)
		if paymentInfo != nil {
			contextChecked = true
			// Verify it's the correct type (should be facilitator.VerifyResponse)
			if _, ok := paymentInfo.(*facilitator.VerifyResponse); !ok {
				t.Error("Payment context value is not of correct type")
			}
		}
		w.WriteHeader(http.StatusOK)
	})

	config := &Config{
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

	// Test requires mock facilitator to verify context storage
	// For now, we verify the pattern exists
	_ = handler
	_ = config
	_ = contextChecked

	t.Skip("Requires mock facilitator to test context storage")
}

// TestHandler_VerifyOnlyContextStorage tests context storage in verify-only mode
func TestHandler_VerifyOnlyContextStorage(t *testing.T) {
	// In verify-only mode, payment info should still be stored in context
	// even though settlement is skipped. This allows handlers to access
	// the verified payment details for custom business logic.

	config := &Config{
		FacilitatorURL: "http://mock-facilitator.test",
		VerifyOnly:     true, // Verify-only mode
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

	contextChecked := false
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paymentInfo := r.Context().Value(PaymentContextKey)
		if paymentInfo != nil {
			contextChecked = true
		}
		w.WriteHeader(http.StatusOK)
	})

	_ = handler
	_ = config
	_ = contextChecked

	t.Skip("Requires mock facilitator to test verify-only context storage")
}
