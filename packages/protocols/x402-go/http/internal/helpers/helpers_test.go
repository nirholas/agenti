package helpers

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mark3labs/x402-go"
)

// TestParsePaymentHeaderFromRequest tests payment header parsing logic
func TestParsePaymentHeaderFromRequest(t *testing.T) {
	tests := []struct {
		name        string
		header      string
		wantErr     bool
		errContains string
		validate    func(*testing.T, x402.PaymentPayload)
	}{
		{
			name:        "missing header",
			header:      "",
			wantErr:     true,
			errContains: "malformed",
		},
		{
			name:        "invalid base64",
			header:      "not-valid-base64!@#",
			wantErr:     true,
			errContains: "malformed",
		},
		{
			name:        "invalid JSON",
			header:      base64.StdEncoding.EncodeToString([]byte("not json")),
			wantErr:     true,
			errContains: "malformed",
		},
		{
			name: "unsupported version",
			header: base64.StdEncoding.EncodeToString([]byte(`{
				"x402Version": 2,
				"scheme": "exact",
				"network": "base-sepolia"
			}`)),
			wantErr:     true,
			errContains: "unsupported protocol version",
		},
		{
			name: "valid payment header",
			header: base64.StdEncoding.EncodeToString([]byte(`{
				"x402Version": 1,
				"scheme": "exact",
				"network": "base-sepolia",
				"payload": {
					"amount": "10000",
					"token": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
					"signature": "0xabcdef"
				}
			}`)),
			wantErr: false,
			validate: func(t *testing.T, p x402.PaymentPayload) {
				if p.X402Version != 1 {
					t.Errorf("Expected X402Version=1, got %d", p.X402Version)
				}
				if p.Scheme != "exact" {
					t.Errorf("Expected Scheme=exact, got %s", p.Scheme)
				}
				if p.Network != "base-sepolia" {
					t.Errorf("Expected Network=base-sepolia, got %s", p.Network)
				}
				if p.Payload == nil {
					t.Error("Expected Payload to be populated")
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			if tt.header != "" {
				req.Header.Set("X-PAYMENT", tt.header)
			}

			payment, err := ParsePaymentHeaderFromRequest(req)

			if tt.wantErr {
				if err == nil {
					t.Errorf("Expected error containing %q, got nil", tt.errContains)
				} else if !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("Expected error containing %q, got %q", tt.errContains, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if tt.validate != nil {
					tt.validate(t, payment)
				}
			}
		})
	}
}

// TestFindMatchingRequirement tests requirement matching logic
func TestFindMatchingRequirement(t *testing.T) {
	requirements := []x402.PaymentRequirement{
		{
			Scheme:            "exact",
			Network:           "base-sepolia",
			MaxAmountRequired: "10000",
			Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
		},
		{
			Scheme:            "exact",
			Network:           "base",
			MaxAmountRequired: "20000",
			Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		},
		{
			Scheme:            "subscription",
			Network:           "base-sepolia",
			MaxAmountRequired: "5000",
			Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
		},
	}

	tests := []struct {
		name        string
		payment     x402.PaymentPayload
		wantErr     bool
		errContains string
		validate    func(*testing.T, x402.PaymentRequirement)
	}{
		{
			name: "match scheme and network",
			payment: x402.PaymentPayload{
				Scheme:  "exact",
				Network: "base-sepolia",
			},
			wantErr: false,
			validate: func(t *testing.T, req x402.PaymentRequirement) {
				if req.MaxAmountRequired != "10000" {
					t.Errorf("Expected requirement with MaxAmountRequired=10000, got %s", req.MaxAmountRequired)
				}
			},
		},
		{
			name: "match different scheme",
			payment: x402.PaymentPayload{
				Scheme:  "subscription",
				Network: "base-sepolia",
			},
			wantErr: false,
			validate: func(t *testing.T, req x402.PaymentRequirement) {
				if req.MaxAmountRequired != "5000" {
					t.Errorf("Expected requirement with MaxAmountRequired=5000, got %s", req.MaxAmountRequired)
				}
			},
		},
		{
			name: "no matching scheme",
			payment: x402.PaymentPayload{
				Scheme:  "unknown",
				Network: "base-sepolia",
			},
			wantErr:     true,
			errContains: "unsupported payment scheme",
		},
		{
			name: "no matching network",
			payment: x402.PaymentPayload{
				Scheme:  "exact",
				Network: "ethereum",
			},
			wantErr:     true,
			errContains: "unsupported payment scheme",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := FindMatchingRequirement(tt.payment, requirements)

			if tt.wantErr {
				if err == nil {
					t.Errorf("Expected error containing %q, got nil", tt.errContains)
				} else if !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("Expected error containing %q, got %q", tt.errContains, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if tt.validate != nil {
					tt.validate(t, req)
				}
			}
		})
	}
}

// TestSendPaymentRequired tests 402 response generation
func TestSendPaymentRequired(t *testing.T) {
	requirements := []x402.PaymentRequirement{
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
	}

	rec := httptest.NewRecorder()
	SendPaymentRequired(rec, requirements)

	// Check status code
	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status %d, got %d", http.StatusPaymentRequired, rec.Code)
	}

	// Check content type
	contentType := rec.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("Expected Content-Type application/json, got %s", contentType)
	}

	// Parse response body
	var response x402.PaymentRequirementsResponse
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	// Verify response structure
	if response.X402Version != 1 {
		t.Errorf("Expected X402Version=1, got %d", response.X402Version)
	}
	if response.Error == "" {
		t.Error("Expected non-empty error message")
	}
	if len(response.Accepts) != 1 {
		t.Errorf("Expected 1 requirement, got %d", len(response.Accepts))
	}
	if response.Accepts[0].Scheme != "exact" {
		t.Errorf("Expected scheme=exact, got %s", response.Accepts[0].Scheme)
	}
}

// TestAddPaymentResponseHeader tests settlement header generation
func TestAddPaymentResponseHeader(t *testing.T) {
	settlement := &x402.SettlementResponse{
		Success:     true,
		Transaction: "0xabc123",
	}

	rec := httptest.NewRecorder()
	err := AddPaymentResponseHeader(rec, settlement)

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Check header is present
	header := rec.Header().Get("X-PAYMENT-RESPONSE")
	if header == "" {
		t.Fatal("Expected X-PAYMENT-RESPONSE header, got empty string")
	}

	// Decode and verify
	decoded, err := base64.StdEncoding.DecodeString(header)
	if err != nil {
		t.Fatalf("Failed to decode header: %v", err)
	}

	var decodedSettlement x402.SettlementResponse
	if err := json.Unmarshal(decoded, &decodedSettlement); err != nil {
		t.Fatalf("Failed to unmarshal settlement: %v", err)
	}

	if !decodedSettlement.Success {
		t.Error("Expected Success=true")
	}
	if decodedSettlement.Transaction != "0xabc123" {
		t.Errorf("Expected Transaction=0xabc123, got %s", decodedSettlement.Transaction)
	}
}
