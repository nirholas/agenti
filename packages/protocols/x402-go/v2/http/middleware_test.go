package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	v2 "github.com/mark3labs/x402-go/v2"
	"github.com/mark3labs/x402-go/v2/encoding"
)

func TestMiddleware_NoPaymentHeader(t *testing.T) {
	// Create a mock facilitator server
	facilitatorServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/supported" {
			response := v2.SupportedResponse{
				Kinds: []v2.SupportedKind{
					{X402Version: 2, Scheme: "exact", Network: "eip155:84532"},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)
			return
		}
		t.Errorf("Unexpected facilitator call: %s %s", r.Method, r.URL.Path)
	}))
	defer facilitatorServer.Close()

	// Create middleware
	config := Config{
		FacilitatorURL: facilitatorServer.URL,
		Resource: v2.ResourceInfo{
			URL:         "https://example.com/api/data",
			Description: "Test API",
		},
		PaymentRequirements: []v2.PaymentRequirements{
			{
				Scheme:            "exact",
				Network:           "eip155:84532",
				Amount:            "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	middleware := NewX402Middleware(config)

	// Create a protected handler
	handler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called without payment")
	}))

	// Make request without payment header
	req := httptest.NewRequest("GET", "/api/data", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	// Should return 402
	if resp.StatusCode != http.StatusPaymentRequired {
		t.Errorf("Expected status 402, got %d", resp.StatusCode)
	}

	// Parse response body
	var paymentReq v2.PaymentRequired
	if err := json.NewDecoder(resp.Body).Decode(&paymentReq); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if paymentReq.X402Version != 2 {
		t.Errorf("Expected X402Version 2, got %d", paymentReq.X402Version)
	}

	if len(paymentReq.Accepts) != 1 {
		t.Errorf("Expected 1 requirement, got %d", len(paymentReq.Accepts))
	}
}

func TestMiddleware_ValidPayment(t *testing.T) {
	// Create a mock facilitator server
	facilitatorServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/supported":
			response := v2.SupportedResponse{
				Kinds: []v2.SupportedKind{
					{X402Version: 2, Scheme: "exact", Network: "eip155:84532"},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)

		case "/verify":
			response := v2.VerifyResponse{
				IsValid: true,
				Payer:   "0xPayerAddress",
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)

		case "/settle":
			response := v2.SettleResponse{
				Success:     true,
				Transaction: "0x1234567890abcdef",
				Network:     "eip155:84532",
				Payer:       "0xPayerAddress",
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)

		default:
			t.Errorf("Unexpected facilitator call: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer facilitatorServer.Close()

	// Create middleware
	config := Config{
		FacilitatorURL: facilitatorServer.URL,
		Resource: v2.ResourceInfo{
			URL:         "https://example.com/api/data",
			Description: "Test API",
		},
		PaymentRequirements: []v2.PaymentRequirements{
			{
				Scheme:            "exact",
				Network:           "eip155:84532",
				Amount:            "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	middleware := NewX402Middleware(config)

	var handlerCalled bool
	handler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true

		// Check context has payment info
		paymentInfo := GetPaymentFromContext(r.Context())
		if paymentInfo == nil {
			t.Error("Expected payment info in context")
		} else if paymentInfo.Payer != "0xPayerAddress" {
			t.Errorf("Expected payer 0xPayerAddress, got %s", paymentInfo.Payer)
		}

		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	}))

	// Create valid payment
	payment := v2.PaymentPayload{
		X402Version: 2,
		Accepted: v2.PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:84532",
			Amount:  "10000",
		},
		Payload: map[string]interface{}{
			"signature": "0xsig",
		},
	}
	paymentHeader, _ := encoding.EncodePayment(payment)

	req := httptest.NewRequest("GET", "/api/data", nil)
	req.Header.Set("X-PAYMENT", paymentHeader)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if !handlerCalled {
		t.Error("Expected handler to be called")
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	// Check X-PAYMENT-RESPONSE header
	settlementHeader := resp.Header.Get("X-PAYMENT-RESPONSE")
	if settlementHeader == "" {
		t.Error("Expected X-PAYMENT-RESPONSE header")
	}
}

func TestMiddleware_VerifyOnly(t *testing.T) {
	var settleCalled bool

	// Create a mock facilitator server
	facilitatorServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/supported":
			response := v2.SupportedResponse{
				Kinds: []v2.SupportedKind{
					{X402Version: 2, Scheme: "exact", Network: "eip155:84532"},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)

		case "/verify":
			response := v2.VerifyResponse{
				IsValid: true,
				Payer:   "0xPayerAddress",
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)

		case "/settle":
			settleCalled = true
			t.Error("Settle should not be called in VerifyOnly mode")

		default:
			t.Errorf("Unexpected facilitator call: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer facilitatorServer.Close()

	// Create middleware with VerifyOnly
	config := Config{
		FacilitatorURL: facilitatorServer.URL,
		VerifyOnly:     true,
		PaymentRequirements: []v2.PaymentRequirements{
			{
				Scheme:            "exact",
				Network:           "eip155:84532",
				Amount:            "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	middleware := NewX402Middleware(config)
	handler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Create valid payment
	payment := v2.PaymentPayload{
		X402Version: 2,
		Accepted: v2.PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:84532",
		},
	}
	paymentHeader, _ := encoding.EncodePayment(payment)

	req := httptest.NewRequest("GET", "/api/data", nil)
	req.Header.Set("X-PAYMENT", paymentHeader)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	if settleCalled {
		t.Error("Settle was called despite VerifyOnly mode")
	}
}

func TestMiddleware_InvalidPayment(t *testing.T) {
	// Create a mock facilitator server
	facilitatorServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/supported":
			response := v2.SupportedResponse{
				Kinds: []v2.SupportedKind{
					{X402Version: 2, Scheme: "exact", Network: "eip155:84532"},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)

		case "/verify":
			response := v2.VerifyResponse{
				IsValid:       false,
				InvalidReason: "Insufficient balance",
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)

		default:
			t.Errorf("Unexpected facilitator call: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer facilitatorServer.Close()

	config := Config{
		FacilitatorURL: facilitatorServer.URL,
		PaymentRequirements: []v2.PaymentRequirements{
			{
				Scheme:            "exact",
				Network:           "eip155:84532",
				Amount:            "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	middleware := NewX402Middleware(config)
	handler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called with invalid payment")
	}))

	// Create payment
	payment := v2.PaymentPayload{
		X402Version: 2,
		Accepted: v2.PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:84532",
		},
	}
	paymentHeader, _ := encoding.EncodePayment(payment)

	req := httptest.NewRequest("GET", "/api/data", nil)
	req.Header.Set("X-PAYMENT", paymentHeader)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusPaymentRequired {
		t.Errorf("Expected status 402, got %d", resp.StatusCode)
	}
}

func TestMiddleware_HandlerError_NoSettlement(t *testing.T) {
	var settleCalled bool

	// Create a mock facilitator server
	facilitatorServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/supported":
			response := v2.SupportedResponse{
				Kinds: []v2.SupportedKind{
					{X402Version: 2, Scheme: "exact", Network: "eip155:84532"},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)

		case "/verify":
			response := v2.VerifyResponse{
				IsValid: true,
				Payer:   "0xPayerAddress",
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)

		case "/settle":
			settleCalled = true
			t.Error("Settle should not be called when handler returns error")

		default:
			t.Errorf("Unexpected facilitator call: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer facilitatorServer.Close()

	config := Config{
		FacilitatorURL: facilitatorServer.URL,
		PaymentRequirements: []v2.PaymentRequirements{
			{
				Scheme:            "exact",
				Network:           "eip155:84532",
				Amount:            "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	middleware := NewX402Middleware(config)
	handler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Handler returns 404
		w.WriteHeader(http.StatusNotFound)
	}))

	// Create valid payment
	payment := v2.PaymentPayload{
		X402Version: 2,
		Accepted: v2.PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:84532",
		},
	}
	paymentHeader, _ := encoding.EncodePayment(payment)

	req := httptest.NewRequest("GET", "/api/data", nil)
	req.Header.Set("X-PAYMENT", paymentHeader)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	// Should pass through the 404
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", resp.StatusCode)
	}

	if settleCalled {
		t.Error("Settle was called despite handler returning error")
	}
}

func TestGetPaymentFromContext_NoPayment(t *testing.T) {
	req := httptest.NewRequest("GET", "/test", nil)
	payment := GetPaymentFromContext(req.Context())
	if payment != nil {
		t.Error("Expected nil for context without payment")
	}
}
