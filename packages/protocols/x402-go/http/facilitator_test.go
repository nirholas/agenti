package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mark3labs/x402-go"
	"github.com/mark3labs/x402-go/facilitator"
)

func TestFacilitatorClient_Verify(t *testing.T) {
	// Create a mock facilitator server
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/verify" {
			t.Errorf("Expected path /verify, got %s", r.URL.Path)
		}

		response := facilitator.VerifyResponse{
			IsValid: true,
			Payer:   "0x857b06519E91e3A54538791bDbb0E22373e36b66",
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Errorf("Failed to encode response: %v", err)
		}
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL:  mockServer.URL,
		Client:   &http.Client{},
		Timeouts: x402.DefaultTimeouts,
	}

	payload := x402.PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-sepolia",
	}

	requirement := x402.PaymentRequirement{
		Scheme:            "exact",
		Network:           "base-sepolia",
		MaxAmountRequired: "10000",
		Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
		PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
		Resource:          "https://api.example.com/test",
		Description:       "Test resource",
		MaxTimeoutSeconds: 60,
	}

	resp, err := client.Verify(context.Background(), payload, requirement)
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}

	if !resp.IsValid {
		t.Error("Expected IsValid to be true")
	}

	if resp.Payer != "0x857b06519E91e3A54538791bDbb0E22373e36b66" {
		t.Errorf("Expected payer address, got %s", resp.Payer)
	}
}

func TestFacilitatorClient_Verify_WithStaticAuthorization(t *testing.T) {
	expectedAuth := "Bearer test-api-key"

	// Create a mock facilitator server that validates the Authorization header
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check that Authorization header is present
		authHeader := r.Header.Get("Authorization")
		if authHeader != expectedAuth {
			t.Errorf("Expected Authorization header %q, got %q", expectedAuth, authHeader)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		response := facilitator.VerifyResponse{
			IsValid: true,
			Payer:   "0x857b06519E91e3A54538791bDbb0E22373e36b66",
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Errorf("Failed to encode response: %v", err)
		}
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL:       mockServer.URL,
		Client:        &http.Client{},
		Timeouts:      x402.DefaultTimeouts,
		Authorization: expectedAuth,
	}

	payload := x402.PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-sepolia",
	}

	requirement := x402.PaymentRequirement{
		Scheme:            "exact",
		Network:           "base-sepolia",
		MaxAmountRequired: "10000",
	}

	resp, err := client.Verify(context.Background(), payload, requirement)
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}

	if !resp.IsValid {
		t.Error("Expected IsValid to be true")
	}
}

func TestFacilitatorClient_Verify_WithAuthorizationProvider(t *testing.T) {
	callCount := 0
	provider := func(r *http.Request) string {
		callCount++
		return "Bearer dynamic-token-" + string(rune('0'+callCount))
	}

	// Expected token for the first call
	expectedAuth := "Bearer dynamic-token-1"

	// Create a mock facilitator server that validates the Authorization header
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			t.Error("Expected Authorization header to be present")
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		// Verify the dynamic token value is used and static is ignored
		if authHeader != expectedAuth {
			t.Errorf("Expected Authorization header %q, got %q", expectedAuth, authHeader)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		response := facilitator.VerifyResponse{
			IsValid: true,
			Payer:   "0x857b06519E91e3A54538791bDbb0E22373e36b66",
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Errorf("Failed to encode response: %v", err)
		}
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL:               mockServer.URL,
		Client:                &http.Client{},
		Timeouts:              x402.DefaultTimeouts,
		Authorization:         "Bearer static-should-be-ignored",
		AuthorizationProvider: provider,
	}

	payload := x402.PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-sepolia",
	}

	requirement := x402.PaymentRequirement{
		Scheme:            "exact",
		Network:           "base-sepolia",
		MaxAmountRequired: "10000",
	}

	_, err := client.Verify(context.Background(), payload, requirement)
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}

	if callCount != 1 {
		t.Errorf("Expected AuthorizationProvider to be called exactly once, got %d calls", callCount)
	}
}

func TestFacilitatorClient_Verify_WithoutAuthorization(t *testing.T) {
	// Create a mock facilitator server that checks no Authorization header is sent
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" {
			t.Errorf("Expected no Authorization header, got %q", authHeader)
		}

		response := facilitator.VerifyResponse{
			IsValid: true,
			Payer:   "0x857b06519E91e3A54538791bDbb0E22373e36b66",
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Errorf("Failed to encode response: %v", err)
		}
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL:  mockServer.URL,
		Client:   &http.Client{},
		Timeouts: x402.DefaultTimeouts,
		// No Authorization or AuthorizationProvider set
	}

	payload := x402.PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-sepolia",
	}

	requirement := x402.PaymentRequirement{
		Scheme:            "exact",
		Network:           "base-sepolia",
		MaxAmountRequired: "10000",
	}

	_, err := client.Verify(context.Background(), payload, requirement)
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}
}

func TestFacilitatorClient_Verify_Hooks(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := facilitator.VerifyResponse{IsValid: true}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Errorf("Failed to encode response: %v", err)
		}
	}))
	defer mockServer.Close()

	var beforeCalled, afterCalled bool
	var capturedPayload x402.PaymentPayload

	client := &FacilitatorClient{
		BaseURL:  mockServer.URL,
		Client:   &http.Client{},
		Timeouts: x402.DefaultTimeouts,
		OnBeforeVerify: func(ctx context.Context, p x402.PaymentPayload, r x402.PaymentRequirement) error {
			beforeCalled = true
			capturedPayload = p
			return nil
		},
		OnAfterVerify: func(ctx context.Context, p x402.PaymentPayload, r x402.PaymentRequirement, resp *facilitator.VerifyResponse, err error) {
			afterCalled = true
			if err != nil {
				t.Errorf("OnAfterVerify received unexpected error: %v", err)
			}
			if resp == nil || !resp.IsValid {
				t.Error("OnAfterVerify did not receive valid response")
			}
		},
	}

	payload := x402.PaymentPayload{X402Version: 1, Scheme: "exact"}
	requirement := x402.PaymentRequirement{Scheme: "exact"}

	_, err := client.Verify(context.Background(), payload, requirement)
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}

	if !beforeCalled {
		t.Error("OnBeforeVerify was not called")
	}
	if !afterCalled {
		t.Error("OnAfterVerify was not called")
	}
	if capturedPayload.Scheme != "exact" {
		t.Error("OnBeforeVerify did not receive correct payload")
	}
}

func TestFacilitatorClient_Verify_OnBeforeAbort(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Server was reached despite OnBeforeVerify error")
	}))
	defer mockServer.Close()

	expectedErr := x402.ErrVerificationFailed

	client := &FacilitatorClient{
		BaseURL: mockServer.URL,
		Client:  &http.Client{},
		OnBeforeVerify: func(ctx context.Context, pp x402.PaymentPayload, pr x402.PaymentRequirement) error {
			return expectedErr
		},
	}

	_, err := client.Verify(context.Background(), x402.PaymentPayload{}, x402.PaymentRequirement{})
	if err != expectedErr {
		t.Errorf("Expected error %v, got %v", expectedErr, err)
	}
}

func TestFacilitatorClient_Settle_WithStaticAuthorization(t *testing.T) {
	expectedAuth := "Bearer settle-api-key"

	// Create a mock facilitator server that validates the Authorization header
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader != expectedAuth {
			t.Errorf("Expected Authorization header %q, got %q", expectedAuth, authHeader)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		response := x402.SettlementResponse{
			Success:     true,
			Transaction: "0x1234567890abcdef",
			Network:     "base-sepolia",
			Payer:       "0x857b06519E91e3A54538791bDbb0E22373e36b66",
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Errorf("Failed to encode response: %v", err)
		}
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL:       mockServer.URL,
		Client:        &http.Client{},
		Timeouts:      x402.DefaultTimeouts,
		Authorization: expectedAuth,
	}

	payload := x402.PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-sepolia",
	}

	requirement := x402.PaymentRequirement{
		Scheme:            "exact",
		Network:           "base-sepolia",
		MaxAmountRequired: "10000",
	}

	resp, err := client.Settle(context.Background(), payload, requirement)
	if err != nil {
		t.Fatalf("Settle failed: %v", err)
	}

	if !resp.Success {
		t.Error("Expected Success to be true")
	}
}

func TestFacilitatorClient_Supported_WithStaticAuthorization(t *testing.T) {
	expectedAuth := "Bearer supported-api-key"

	// Create a mock facilitator server that validates the Authorization header
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/supported" {
			t.Errorf("Expected path /supported, got %s", r.URL.Path)
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader != expectedAuth {
			t.Errorf("Expected Authorization header %q, got %q", expectedAuth, authHeader)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		response := facilitator.SupportedResponse{
			Kinds: []facilitator.SupportedKind{
				{
					X402Version: 1,
					Scheme:      "exact",
					Network:     "base-sepolia",
				},
			},
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Errorf("Failed to encode response: %v", err)
		}
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL:       mockServer.URL,
		Client:        &http.Client{},
		Timeouts:      x402.DefaultTimeouts,
		Authorization: expectedAuth,
	}

	resp, err := client.Supported(context.Background())
	if err != nil {
		t.Fatalf("Supported failed: %v", err)
	}

	if len(resp.Kinds) != 1 {
		t.Errorf("Expected 1 kind, got %d", len(resp.Kinds))
	}
}

func TestFacilitatorClient_Settle(t *testing.T) {
	// Create a mock facilitator server
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/settle" {
			t.Errorf("Expected path /settle, got %s", r.URL.Path)
		}

		response := x402.SettlementResponse{
			Success:     true,
			Transaction: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			Network:     "base-sepolia",
			Payer:       "0x857b06519E91e3A54538791bDbb0E22373e36b66",
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Errorf("Failed to encode response: %v", err)
		}
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL:  mockServer.URL,
		Client:   &http.Client{},
		Timeouts: x402.DefaultTimeouts,
	}

	payload := x402.PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-sepolia",
	}

	requirement := x402.PaymentRequirement{
		Scheme:            "exact",
		Network:           "base-sepolia",
		MaxAmountRequired: "10000",
		Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
		PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
		Resource:          "https://api.example.com/test",
		Description:       "Test resource",
		MaxTimeoutSeconds: 60,
	}

	resp, err := client.Settle(context.Background(), payload, requirement)
	if err != nil {
		t.Fatalf("Settle failed: %v", err)
	}

	if !resp.Success {
		t.Error("Expected Success to be true")
	}

	if resp.Transaction == "" {
		t.Error("Expected transaction hash")
	}
}

func TestFacilitatorClient_Settle_Hooks(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := x402.SettlementResponse{Success: true, Transaction: "0x123"}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Errorf("Failed to encode response: %v", err)
		}
	}))
	defer mockServer.Close()

	var beforeCalled, afterCalled bool

	client := &FacilitatorClient{
		BaseURL:  mockServer.URL,
		Client:   &http.Client{},
		Timeouts: x402.DefaultTimeouts,
		OnBeforeSettle: func(ctx context.Context, p x402.PaymentPayload, r x402.PaymentRequirement) error {
			beforeCalled = true
			return nil
		},
		OnAfterSettle: func(ctx context.Context, p x402.PaymentPayload, r x402.PaymentRequirement, resp *x402.SettlementResponse, err error) {
			afterCalled = true
			if resp == nil || resp.Transaction != "0x123" {
				t.Error("OnAfterSettle did not receive correct response")
			}
		},
	}

	_, err := client.Settle(context.Background(), x402.PaymentPayload{}, x402.PaymentRequirement{})
	if err != nil {
		t.Fatalf("Settle failed: %v", err)
	}

	if !beforeCalled {
		t.Error("OnBeforeSettle was not called")
	}
	if !afterCalled {
		t.Error("OnAfterSettle was not called")
	}
}

func TestFacilitatorClient_Settle_OnBeforeAbort(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Server was reached despite OnBeforeSettle error")
	}))
	defer mockServer.Close()

	expectedErr := x402.ErrSettlementFailed

	client := &FacilitatorClient{
		BaseURL: mockServer.URL,
		Client:  &http.Client{},
		OnBeforeSettle: func(ctx context.Context, p x402.PaymentPayload, r x402.PaymentRequirement) error {
			return expectedErr
		},
	}

	_, err := client.Settle(context.Background(), x402.PaymentPayload{}, x402.PaymentRequirement{})
	if err != expectedErr {
		t.Errorf("Expected error %v, got %v", expectedErr, err)
	}
}
