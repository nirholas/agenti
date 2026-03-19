package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mark3labs/x402-go"
)

func TestMiddleware_NoPaymentReturns402(t *testing.T) {
	// Create middleware config
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

	// Create middleware
	middleware := NewX402Middleware(config)

	// Create a test handler
	handler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		if _, err := w.Write([]byte("success")); err != nil {
			t.Errorf("Failed to write response: %v", err)
		}
	}))

	// Make request without payment
	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	// Expect 402 Payment Required
	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status %d, got %d", http.StatusPaymentRequired, rec.Code)
	}

	// Check response is JSON
	contentType := rec.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("Expected Content-Type application/json, got %s", contentType)
	}
}

func TestMiddleware_ValidPaymentSucceeds(t *testing.T) {
	// This test will fail until we implement the middleware
	// It requires a mock facilitator
	t.Skip("Requires mock facilitator implementation")
}

func TestMiddleware_Integration_FullPaymentFlow(t *testing.T) {
	// Integration test for complete payment flow
	// This will be implemented after the basic middleware works
	t.Skip("Integration test - implement after basic flow works")
}

// TestMiddleware_VerifyOnlyMode tests verification-only mode without settlement
func TestMiddleware_VerifyOnlyMode(t *testing.T) {
	// Create middleware config with VerifyOnly flag
	config := &Config{
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
	middleware := NewX402Middleware(config)

	// Create a test handler
	handler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		if _, err := w.Write([]byte("success")); err != nil {
			t.Errorf("Failed to write response: %v", err)
		}
	}))

	// Make request without payment - should return 402
	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	// Expect 402 Payment Required
	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status %d, got %d", http.StatusPaymentRequired, rec.Code)
	}

	// Verify X-PAYMENT-RESPONSE header is NOT present in 402 response
	if rec.Header().Get("X-PAYMENT-RESPONSE") != "" {
		t.Error("Expected no X-PAYMENT-RESPONSE header on 402 response")
	}
}

// TestMiddleware_VerifyOnlyNoSettlement tests that VerifyOnly mode skips settlement
func TestMiddleware_VerifyOnlyNoSettlement(t *testing.T) {
	config := &Config{
		FacilitatorURL: "http://mock-facilitator.test",
		VerifyOnly:     true,
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

	_ = NewX402Middleware(config)

	// In verify-only mode, we expect:
	// 1. Payment header is parsed
	// 2. Payment is verified with facilitator
	// 3. Settlement is SKIPPED
	// 4. X-PAYMENT-RESPONSE header is NOT added
	// This test would require a mock facilitator to fully test
	t.Skip("Requires mock facilitator to verify settlement is skipped")
}

// TestMiddleware_Integration_VerifyWithoutSettle tests verify-only mode end-to-end
func TestMiddleware_Integration_VerifyWithoutSettle(t *testing.T) {
	// Integration test for verify-only flow
	// This test would verify the complete flow:
	// 1. Request without payment → 402
	// 2. Request with payment → verify with facilitator
	// 3. Settlement is NOT called
	// 4. Handler receives request with payment context
	// 5. No X-PAYMENT-RESPONSE header in response

	config := &Config{
		FacilitatorURL: "http://mock-facilitator.test",
		VerifyOnly:     true,
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

	_ = config

	t.Skip("Integration test - requires mock facilitator implementation")
}
