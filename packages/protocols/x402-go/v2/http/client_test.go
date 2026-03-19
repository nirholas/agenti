package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	v2 "github.com/mark3labs/x402-go/v2"
	"github.com/mark3labs/x402-go/v2/encoding"
)

func TestNewClient(t *testing.T) {
	client, err := NewClient()
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	if client == nil {
		t.Fatal("Expected non-nil client")
	}

	if client.Client == nil {
		t.Error("Expected non-nil underlying HTTP client")
	}
}

func TestClient_WithSigner(t *testing.T) {
	signer := &mockSigner{
		network:  "eip155:84532",
		scheme:   "exact",
		priority: 1,
	}

	client, err := NewClient(WithSigner(signer))
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	transport, ok := client.Transport.(*X402Transport)
	if !ok {
		t.Fatal("Expected X402Transport")
	}

	if len(transport.Signers) != 1 {
		t.Errorf("Expected 1 signer, got %d", len(transport.Signers))
	}
}

func TestClient_WithMultipleSigners(t *testing.T) {
	signer1 := &mockSigner{
		network:  "eip155:84532",
		scheme:   "exact",
		priority: 1,
	}
	signer2 := &mockSigner{
		network:  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
		scheme:   "exact",
		priority: 2,
	}

	client, err := NewClient(
		WithSigner(signer1),
		WithSigner(signer2),
	)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	transport, ok := client.Transport.(*X402Transport)
	if !ok {
		t.Fatal("Expected X402Transport")
	}

	if len(transport.Signers) != 2 {
		t.Errorf("Expected 2 signers, got %d", len(transport.Signers))
	}
}

func TestClient_WithSelector(t *testing.T) {
	selector := v2.NewDefaultPaymentSelector()

	client, err := NewClient(WithSelector(selector))
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	transport, ok := client.Transport.(*X402Transport)
	if !ok {
		t.Fatal("Expected X402Transport")
	}

	if transport.Selector != selector {
		t.Error("Expected custom selector to be set")
	}
}

func TestClient_WithPaymentCallback(t *testing.T) {
	var callbackCalled bool
	callback := func(event v2.PaymentEvent) {
		callbackCalled = true
	}

	client, err := NewClient(
		WithPaymentCallback(v2.PaymentEventAttempt, callback),
	)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	transport, ok := client.Transport.(*X402Transport)
	if !ok {
		t.Fatal("Expected X402Transport")
	}

	if transport.OnPaymentAttempt == nil {
		t.Error("Expected OnPaymentAttempt to be set")
	}

	// Verify it's the same callback (by calling it and checking the flag)
	transport.OnPaymentAttempt(v2.PaymentEvent{})
	if !callbackCalled {
		t.Error("Callback was not called")
	}
}

func TestClient_WithPaymentCallbacks(t *testing.T) {
	var attemptCalled, successCalled, failureCalled bool

	client, err := NewClient(
		WithPaymentCallbacks(
			func(event v2.PaymentEvent) { attemptCalled = true },
			func(event v2.PaymentEvent) { successCalled = true },
			func(event v2.PaymentEvent) { failureCalled = true },
		),
	)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	transport, ok := client.Transport.(*X402Transport)
	if !ok {
		t.Fatal("Expected X402Transport")
	}

	// Call each callback to verify they're set
	transport.OnPaymentAttempt(v2.PaymentEvent{})
	transport.OnPaymentSuccess(v2.PaymentEvent{})
	transport.OnPaymentFailure(v2.PaymentEvent{})

	if !attemptCalled || !successCalled || !failureCalled {
		t.Error("Not all callbacks were set correctly")
	}
}

func TestClient_WithHTTPClient(t *testing.T) {
	customClient := &http.Client{
		Timeout: 30 * time.Second,
	}

	client, err := NewClient(WithHTTPClient(customClient))
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	if client.Client != customClient {
		t.Error("Expected custom HTTP client to be used")
	}
}

func TestClient_InvalidCallbackType(t *testing.T) {
	_, err := NewClient(
		WithPaymentCallback("invalid-type", func(event v2.PaymentEvent) {}),
	)
	if err == nil {
		t.Error("Expected error for invalid callback type")
	}
}

func TestClient_AutomaticPayment(t *testing.T) {
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

	client, err := NewClient(WithSigner(signer))
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	resp, err := client.Get(server.URL + "/api/data")
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	// Check settlement was returned
	settlement := GetSettlement(resp)
	if settlement == nil {
		t.Error("Expected settlement in response")
	} else {
		if settlement.Transaction != "0x1234567890abcdef" {
			t.Errorf("Expected transaction hash, got %s", settlement.Transaction)
		}
	}
}

func TestGetSettlement_NoHeader(t *testing.T) {
	resp := &http.Response{
		Header: http.Header{},
	}

	settlement := GetSettlement(resp)
	if settlement != nil {
		t.Error("Expected nil for missing header")
	}
}

func TestGetSettlement_ValidHeader(t *testing.T) {
	settlement := v2.SettleResponse{
		Success:     true,
		Transaction: "0x1234567890abcdef",
		Network:     "eip155:84532",
	}
	encoded, _ := encoding.EncodeSettlement(settlement)

	resp := &http.Response{
		Header: http.Header{
			"X-Payment-Response": []string{encoded},
		},
	}

	parsed := GetSettlement(resp)
	if parsed == nil {
		t.Fatal("Expected settlement, got nil")
	}

	if parsed.Transaction != "0x1234567890abcdef" {
		t.Errorf("Expected transaction hash, got %s", parsed.Transaction)
	}
}
