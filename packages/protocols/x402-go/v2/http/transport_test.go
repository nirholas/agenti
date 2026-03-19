package http

import (
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	v2 "github.com/mark3labs/x402-go/v2"
	"github.com/mark3labs/x402-go/v2/encoding"
)

// mockSigner implements v2.Signer for testing
type mockSigner struct {
	network   string
	scheme    string
	tokens    []v2.TokenConfig
	maxAmount *big.Int
	priority  int
	signFunc  func(*v2.PaymentRequirements) (*v2.PaymentPayload, error)
}

func (m *mockSigner) Network() string             { return m.network }
func (m *mockSigner) Scheme() string              { return m.scheme }
func (m *mockSigner) GetPriority() int            { return m.priority }
func (m *mockSigner) GetTokens() []v2.TokenConfig { return m.tokens }
func (m *mockSigner) GetMaxAmount() *big.Int      { return m.maxAmount }
func (m *mockSigner) CanSign(req *v2.PaymentRequirements) bool {
	return req.Network == m.network && req.Scheme == m.scheme
}
func (m *mockSigner) Sign(req *v2.PaymentRequirements) (*v2.PaymentPayload, error) {
	if m.signFunc != nil {
		return m.signFunc(req)
	}
	return &v2.PaymentPayload{
		X402Version: 2,
		Accepted: v2.PaymentRequirements{
			Scheme:  req.Scheme,
			Network: req.Network,
			Amount:  req.Amount,
		},
		Payload: map[string]interface{}{
			"signature": "0xmocksig",
		},
	}, nil
}

func TestTransport_NonPaymentRequired(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	}))
	defer server.Close()

	transport := &X402Transport{
		Base:     http.DefaultTransport,
		Signers:  []v2.Signer{},
		Selector: v2.NewDefaultPaymentSelector(),
	}

	req, _ := http.NewRequest("GET", server.URL+"/api/data", nil)
	resp, err := transport.RoundTrip(req)
	if err != nil {
		t.Fatalf("RoundTrip failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}
}

func TestTransport_PaymentRequired_AutoPay(t *testing.T) {
	var attemptCount int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := atomic.AddInt32(&attemptCount, 1)

		// First request - return 402
		if count == 1 {
			paymentReq := v2.PaymentRequired{
				X402Version: 2,
				Error:       "Payment required",
				Resource: &v2.ResourceInfo{
					URL: r.URL.String(),
				},
				Accepts: []v2.PaymentRequirements{
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
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusPaymentRequired)
			_ = json.NewEncoder(w).Encode(paymentReq)
			return
		}

		// Second request - should have payment header
		paymentHeader := r.Header.Get("X-PAYMENT")
		if paymentHeader == "" {
			t.Error("Expected X-PAYMENT header on retry")
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		// Verify the payment
		payment, err := encoding.DecodePayment(paymentHeader)
		if err != nil {
			t.Errorf("Failed to decode payment: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		if payment.X402Version != 2 {
			t.Errorf("Expected X402Version 2, got %d", payment.X402Version)
		}

		// Add settlement response header
		settlement := v2.SettleResponse{
			Success:     true,
			Transaction: "0x1234567890abcdef",
			Network:     "eip155:84532",
			Payer:       "0xPayerAddress",
		}
		encoded, _ := encoding.EncodeSettlement(settlement)
		w.Header().Set("X-PAYMENT-RESPONSE", encoded)

		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("Protected content"))
	}))
	defer server.Close()

	signer := &mockSigner{
		network:  "eip155:84532",
		scheme:   "exact",
		priority: 1,
		tokens: []v2.TokenConfig{
			{Address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", Symbol: "USDC", Decimals: 6},
		},
	}

	transport := &X402Transport{
		Base:     http.DefaultTransport,
		Signers:  []v2.Signer{signer},
		Selector: v2.NewDefaultPaymentSelector(),
	}

	req, _ := http.NewRequest("GET", server.URL+"/api/data", nil)
	resp, err := transport.RoundTrip(req)
	if err != nil {
		t.Fatalf("RoundTrip failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	if atomic.LoadInt32(&attemptCount) != 2 {
		t.Errorf("Expected 2 requests, got %d", attemptCount)
	}
}

func TestTransport_PaymentCallbacks(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-PAYMENT") == "" {
			paymentReq := v2.PaymentRequired{
				X402Version: 2,
				Accepts: []v2.PaymentRequirements{
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
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusPaymentRequired)
			_ = json.NewEncoder(w).Encode(paymentReq)
			return
		}

		settlement := v2.SettleResponse{
			Success:     true,
			Transaction: "0x1234567890abcdef",
			Network:     "eip155:84532",
		}
		encoded, _ := encoding.EncodeSettlement(settlement)
		w.Header().Set("X-PAYMENT-RESPONSE", encoded)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	signer := &mockSigner{
		network:  "eip155:84532",
		scheme:   "exact",
		priority: 1,
		tokens: []v2.TokenConfig{
			{Address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", Symbol: "USDC", Decimals: 6},
		},
	}

	var attemptCalled, successCalled bool
	var attemptEvent, successEvent v2.PaymentEvent

	transport := &X402Transport{
		Base:     http.DefaultTransport,
		Signers:  []v2.Signer{signer},
		Selector: v2.NewDefaultPaymentSelector(),
		OnPaymentAttempt: func(event v2.PaymentEvent) {
			attemptCalled = true
			attemptEvent = event
		},
		OnPaymentSuccess: func(event v2.PaymentEvent) {
			successCalled = true
			successEvent = event
		},
	}

	req, _ := http.NewRequest("GET", server.URL+"/api/data", nil)
	resp, err := transport.RoundTrip(req)
	if err != nil {
		t.Fatalf("RoundTrip failed: %v", err)
	}
	resp.Body.Close()

	if !attemptCalled {
		t.Error("OnPaymentAttempt was not called")
	}
	if attemptEvent.Type != v2.PaymentEventAttempt {
		t.Errorf("Expected attempt event type, got %s", attemptEvent.Type)
	}
	if attemptEvent.Amount != "10000" {
		t.Errorf("Expected amount 10000, got %s", attemptEvent.Amount)
	}

	if !successCalled {
		t.Error("OnPaymentSuccess was not called")
	}
	if successEvent.Type != v2.PaymentEventSuccess {
		t.Errorf("Expected success event type, got %s", successEvent.Type)
	}
	if successEvent.Transaction != "0x1234567890abcdef" {
		t.Errorf("Expected transaction hash, got %s", successEvent.Transaction)
	}
}

func TestTransport_NoMatchingSigner(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paymentReq := v2.PaymentRequired{
			X402Version: 2,
			Accepts: []v2.PaymentRequirements{
				{
					Scheme:  "exact",
					Network: "eip155:84532", // Base Sepolia
					Amount:  "10000",
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusPaymentRequired)
		_ = json.NewEncoder(w).Encode(paymentReq)
	}))
	defer server.Close()

	// Signer for a different network
	signer := &mockSigner{
		network:  "eip155:1", // Ethereum mainnet
		scheme:   "exact",
		priority: 1,
	}

	transport := &X402Transport{
		Base:     http.DefaultTransport,
		Signers:  []v2.Signer{signer},
		Selector: v2.NewDefaultPaymentSelector(),
	}

	req, _ := http.NewRequest("GET", server.URL+"/api/data", nil)
	_, err := transport.RoundTrip(req)
	if err == nil {
		t.Error("Expected error for no matching signer")
	}
}

func TestTransport_FailureCallback(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paymentReq := v2.PaymentRequired{
			X402Version: 2,
			Accepts: []v2.PaymentRequirements{
				{
					Scheme:  "exact",
					Network: "eip155:84532",
					Amount:  "10000",
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusPaymentRequired)
		_ = json.NewEncoder(w).Encode(paymentReq)
	}))
	defer server.Close()

	// No signer configured
	transport := &X402Transport{
		Base:     http.DefaultTransport,
		Signers:  []v2.Signer{},
		Selector: v2.NewDefaultPaymentSelector(),
	}

	req, _ := http.NewRequest("GET", server.URL+"/api/data", nil)
	_, err := transport.RoundTrip(req)

	// This should fail because no signers are configured
	if err == nil {
		t.Error("Expected error for no signers")
	}
}
