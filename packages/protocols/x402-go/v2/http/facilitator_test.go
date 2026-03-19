package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	v2 "github.com/mark3labs/x402-go/v2"
)

func TestFacilitatorClient_Verify(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/verify" {
			t.Errorf("Expected path /verify, got %s", r.URL.Path)
		}

		if r.Method != "POST" {
			t.Errorf("Expected POST method, got %s", r.Method)
		}

		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Errorf("Expected Content-Type application/json, got %s", ct)
		}

		response := v2.VerifyResponse{
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
		Timeouts: v2.DefaultTimeouts,
	}

	payload := v2.PaymentPayload{
		X402Version: 2,
		Accepted: v2.PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:84532",
		},
	}

	requirements := v2.PaymentRequirements{
		Scheme:            "exact",
		Network:           "eip155:84532",
		Amount:            "10000",
		Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
		PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
		MaxTimeoutSeconds: 60,
	}

	resp, err := client.Verify(context.Background(), payload, requirements)
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

func TestFacilitatorClient_Verify_Invalid(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := v2.VerifyResponse{
			IsValid:       false,
			InvalidReason: "Insufficient balance",
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Errorf("Failed to encode response: %v", err)
		}
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL: mockServer.URL,
		Client:  &http.Client{},
	}

	resp, err := client.Verify(context.Background(), v2.PaymentPayload{}, v2.PaymentRequirements{})
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}

	if resp.IsValid {
		t.Error("Expected IsValid to be false")
	}

	if resp.InvalidReason != "Insufficient balance" {
		t.Errorf("Expected InvalidReason 'Insufficient balance', got %s", resp.InvalidReason)
	}
}

func TestFacilitatorClient_Verify_ExtractPayer(t *testing.T) {
	// Test that payer is extracted from EVM payload when not in response
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := v2.VerifyResponse{
			IsValid: true,
			// Payer not set in response
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Errorf("Failed to encode response: %v", err)
		}
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL: mockServer.URL,
		Client:  &http.Client{},
	}

	payload := v2.PaymentPayload{
		X402Version: 2,
		Payload: map[string]interface{}{
			"authorization": map[string]interface{}{
				"from": "0xPayerAddress",
			},
		},
	}

	resp, err := client.Verify(context.Background(), payload, v2.PaymentRequirements{})
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}

	if resp.Payer != "0xPayerAddress" {
		t.Errorf("Expected payer 0xPayerAddress, got %s", resp.Payer)
	}
}

func TestFacilitatorClient_Verify_WithStaticAuthorization(t *testing.T) {
	expectedAuth := "Bearer test-api-key"

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader != expectedAuth {
			t.Errorf("Expected Authorization header %q, got %q", expectedAuth, authHeader)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		response := v2.VerifyResponse{
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
		Timeouts:      v2.DefaultTimeouts,
		Authorization: expectedAuth,
	}

	resp, err := client.Verify(context.Background(), v2.PaymentPayload{}, v2.PaymentRequirements{})
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}

	if !resp.IsValid {
		t.Error("Expected IsValid to be true")
	}
}

func TestFacilitatorClient_Verify_WithAuthorizationProvider(t *testing.T) {
	var callCount int32
	provider := func(r *http.Request) string {
		atomic.AddInt32(&callCount, 1)
		return "Bearer dynamic-token"
	}

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "Bearer dynamic-token" {
			t.Errorf("Expected Authorization header 'Bearer dynamic-token', got %q", authHeader)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		response := v2.VerifyResponse{IsValid: true}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL:               mockServer.URL,
		Client:                &http.Client{},
		Authorization:         "Bearer static-should-be-ignored",
		AuthorizationProvider: provider,
	}

	_, err := client.Verify(context.Background(), v2.PaymentPayload{}, v2.PaymentRequirements{})
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}

	if atomic.LoadInt32(&callCount) != 1 {
		t.Errorf("Expected AuthorizationProvider to be called exactly once, got %d calls", callCount)
	}
}

func TestFacilitatorClient_Verify_WithoutAuthorization(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" {
			t.Errorf("Expected no Authorization header, got %q", authHeader)
		}

		response := v2.VerifyResponse{IsValid: true}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL: mockServer.URL,
		Client:  &http.Client{},
	}

	_, err := client.Verify(context.Background(), v2.PaymentPayload{}, v2.PaymentRequirements{})
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}
}

func TestFacilitatorClient_Verify_Hooks(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := v2.VerifyResponse{IsValid: true}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer mockServer.Close()

	var beforeCalled, afterCalled bool
	var capturedPayload v2.PaymentPayload

	client := &FacilitatorClient{
		BaseURL: mockServer.URL,
		Client:  &http.Client{},
		OnBeforeVerify: func(ctx context.Context, p v2.PaymentPayload, r v2.PaymentRequirements) error {
			beforeCalled = true
			capturedPayload = p
			return nil
		},
		OnAfterVerify: func(ctx context.Context, p v2.PaymentPayload, r v2.PaymentRequirements, resp *v2.VerifyResponse, err error) {
			afterCalled = true
			if err != nil {
				t.Errorf("OnAfterVerify received unexpected error: %v", err)
			}
			if resp == nil || !resp.IsValid {
				t.Error("OnAfterVerify did not receive valid response")
			}
		},
	}

	payload := v2.PaymentPayload{
		X402Version: 2,
		Accepted:    v2.PaymentRequirements{Scheme: "exact"},
	}
	requirements := v2.PaymentRequirements{Scheme: "exact"}

	_, err := client.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}

	if !beforeCalled {
		t.Error("OnBeforeVerify was not called")
	}
	if !afterCalled {
		t.Error("OnAfterVerify was not called")
	}
	if capturedPayload.Accepted.Scheme != "exact" {
		t.Error("OnBeforeVerify did not receive correct payload")
	}
}

func TestFacilitatorClient_Verify_OnBeforeAbort(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Server was reached despite OnBeforeVerify error")
	}))
	defer mockServer.Close()

	expectedErr := errors.New("abort verification")

	client := &FacilitatorClient{
		BaseURL: mockServer.URL,
		Client:  &http.Client{},
		OnBeforeVerify: func(ctx context.Context, p v2.PaymentPayload, r v2.PaymentRequirements) error {
			return expectedErr
		},
	}

	_, err := client.Verify(context.Background(), v2.PaymentPayload{}, v2.PaymentRequirements{})
	if err != expectedErr {
		t.Errorf("Expected error %v, got %v", expectedErr, err)
	}
}

func TestFacilitatorClient_Verify_ErrorResponse(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"invalidReason": "Invalid signature",
		})
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL: mockServer.URL,
		Client:  &http.Client{},
	}

	_, err := client.Verify(context.Background(), v2.PaymentPayload{}, v2.PaymentRequirements{})
	if err == nil {
		t.Fatal("Expected error, got nil")
	}

	if !errors.Is(err, v2.ErrVerificationFailed) {
		t.Errorf("Expected ErrVerificationFailed, got %v", err)
	}
}

func TestFacilitatorClient_Verify_Retry(t *testing.T) {
	var attempts int32

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := atomic.AddInt32(&attempts, 1)
		if count < 3 {
			// Simulate connection error by closing connection
			hj, ok := w.(http.Hijacker)
			if ok {
				conn, _, _ := hj.Hijack()
				conn.Close()
				return
			}
			// Fallback: return 503 which should trigger retry
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}

		// Third attempt succeeds
		response := v2.VerifyResponse{IsValid: true}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL:    mockServer.URL,
		Client:     &http.Client{},
		MaxRetries: 3,
		RetryDelay: 10 * time.Millisecond,
	}

	resp, err := client.Verify(context.Background(), v2.PaymentPayload{}, v2.PaymentRequirements{})
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}

	if !resp.IsValid {
		t.Error("Expected IsValid to be true")
	}

	if atomic.LoadInt32(&attempts) < 2 {
		t.Errorf("Expected at least 2 attempts, got %d", attempts)
	}
}

func TestFacilitatorClient_Settle(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/settle" {
			t.Errorf("Expected path /settle, got %s", r.URL.Path)
		}

		if r.Method != "POST" {
			t.Errorf("Expected POST method, got %s", r.Method)
		}

		response := v2.SettleResponse{
			Success:     true,
			Transaction: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			Network:     "eip155:84532",
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
		Timeouts: v2.DefaultTimeouts,
	}

	payload := v2.PaymentPayload{
		X402Version: 2,
		Accepted: v2.PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:84532",
		},
	}

	requirements := v2.PaymentRequirements{
		Scheme:            "exact",
		Network:           "eip155:84532",
		Amount:            "10000",
		Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
		PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
		MaxTimeoutSeconds: 60,
	}

	resp, err := client.Settle(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Settle failed: %v", err)
	}

	if !resp.Success {
		t.Error("Expected Success to be true")
	}

	if resp.Transaction == "" {
		t.Error("Expected transaction hash")
	}

	if resp.Network != "eip155:84532" {
		t.Errorf("Expected network eip155:84532, got %s", resp.Network)
	}
}

func TestFacilitatorClient_Settle_WithStaticAuthorization(t *testing.T) {
	expectedAuth := "Bearer settle-api-key"

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader != expectedAuth {
			t.Errorf("Expected Authorization header %q, got %q", expectedAuth, authHeader)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		response := v2.SettleResponse{
			Success:     true,
			Transaction: "0x1234567890abcdef",
			Network:     "eip155:84532",
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL:       mockServer.URL,
		Client:        &http.Client{},
		Authorization: expectedAuth,
	}

	resp, err := client.Settle(context.Background(), v2.PaymentPayload{}, v2.PaymentRequirements{})
	if err != nil {
		t.Fatalf("Settle failed: %v", err)
	}

	if !resp.Success {
		t.Error("Expected Success to be true")
	}
}

func TestFacilitatorClient_Settle_Hooks(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := v2.SettleResponse{Success: true, Transaction: "0x123"}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer mockServer.Close()

	var beforeCalled, afterCalled bool

	client := &FacilitatorClient{
		BaseURL: mockServer.URL,
		Client:  &http.Client{},
		OnBeforeSettle: func(ctx context.Context, p v2.PaymentPayload, r v2.PaymentRequirements) error {
			beforeCalled = true
			return nil
		},
		OnAfterSettle: func(ctx context.Context, p v2.PaymentPayload, r v2.PaymentRequirements, resp *v2.SettleResponse, err error) {
			afterCalled = true
			if resp == nil || resp.Transaction != "0x123" {
				t.Error("OnAfterSettle did not receive correct response")
			}
		},
	}

	_, err := client.Settle(context.Background(), v2.PaymentPayload{}, v2.PaymentRequirements{})
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

	expectedErr := errors.New("abort settlement")

	client := &FacilitatorClient{
		BaseURL: mockServer.URL,
		Client:  &http.Client{},
		OnBeforeSettle: func(ctx context.Context, p v2.PaymentPayload, r v2.PaymentRequirements) error {
			return expectedErr
		},
	}

	_, err := client.Settle(context.Background(), v2.PaymentPayload{}, v2.PaymentRequirements{})
	if err != expectedErr {
		t.Errorf("Expected error %v, got %v", expectedErr, err)
	}
}

func TestFacilitatorClient_Settle_ErrorResponse(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"errorReason": "Transaction failed",
		})
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL: mockServer.URL,
		Client:  &http.Client{},
	}

	_, err := client.Settle(context.Background(), v2.PaymentPayload{}, v2.PaymentRequirements{})
	if err == nil {
		t.Fatal("Expected error, got nil")
	}

	if !errors.Is(err, v2.ErrSettlementFailed) {
		t.Errorf("Expected ErrSettlementFailed, got %v", err)
	}
}

func TestFacilitatorClient_Supported(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/supported" {
			t.Errorf("Expected path /supported, got %s", r.URL.Path)
		}

		if r.Method != "GET" {
			t.Errorf("Expected GET method, got %s", r.Method)
		}

		response := v2.SupportedResponse{
			Kinds: []v2.SupportedKind{
				{
					X402Version: 2,
					Scheme:      "exact",
					Network:     "eip155:8453",
				},
				{
					X402Version: 2,
					Scheme:      "exact",
					Network:     "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
				},
			},
			Extensions: []string{"budgets", "receipts"},
			Signers: map[string][]string{
				"solana:*": {"3oBdYQbV9bqH7yCBzF5m4mGDWBqCHYx7zLAB7qAMNbkP"},
			},
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			t.Errorf("Failed to encode response: %v", err)
		}
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL: mockServer.URL,
		Client:  &http.Client{},
	}

	resp, err := client.Supported(context.Background())
	if err != nil {
		t.Fatalf("Supported failed: %v", err)
	}

	if len(resp.Kinds) != 2 {
		t.Errorf("Expected 2 kinds, got %d", len(resp.Kinds))
	}

	if resp.Kinds[0].Network != "eip155:8453" {
		t.Errorf("Expected first kind network eip155:8453, got %s", resp.Kinds[0].Network)
	}

	if len(resp.Extensions) != 2 {
		t.Errorf("Expected 2 extensions, got %d", len(resp.Extensions))
	}

	if len(resp.Signers) != 1 {
		t.Errorf("Expected 1 signer entry, got %d", len(resp.Signers))
	}
}

func TestFacilitatorClient_Supported_WithStaticAuthorization(t *testing.T) {
	expectedAuth := "Bearer supported-api-key"

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader != expectedAuth {
			t.Errorf("Expected Authorization header %q, got %q", expectedAuth, authHeader)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		response := v2.SupportedResponse{
			Kinds: []v2.SupportedKind{
				{X402Version: 2, Scheme: "exact", Network: "eip155:8453"},
			},
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL:       mockServer.URL,
		Client:        &http.Client{},
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

func TestFacilitatorClient_EnrichRequirements(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := v2.SupportedResponse{
			Kinds: []v2.SupportedKind{
				{
					X402Version: 2,
					Scheme:      "exact",
					Network:     "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
					Extra: map[string]interface{}{
						"feePayer": "3oBdYQbV9bqH7yCBzF5m4mGDWBqCHYx7zLAB7qAMNbkP",
					},
				},
			},
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL: mockServer.URL,
		Client:  &http.Client{},
	}

	requirements := []v2.PaymentRequirements{
		{
			Scheme:  "exact",
			Network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
			Amount:  "1000000",
		},
	}

	enriched, err := client.EnrichRequirements(context.Background(), requirements)
	if err != nil {
		t.Fatalf("EnrichRequirements failed: %v", err)
	}

	if len(enriched) != 1 {
		t.Fatalf("Expected 1 enriched requirement, got %d", len(enriched))
	}

	feePayer, ok := enriched[0].Extra["feePayer"].(string)
	if !ok || feePayer != "3oBdYQbV9bqH7yCBzF5m4mGDWBqCHYx7zLAB7qAMNbkP" {
		t.Errorf("Expected feePayer to be set, got %v", enriched[0].Extra)
	}
}

func TestFacilitatorClient_EnrichRequirements_PreservesUserValues(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := v2.SupportedResponse{
			Kinds: []v2.SupportedKind{
				{
					X402Version: 2,
					Scheme:      "exact",
					Network:     "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
					Extra: map[string]interface{}{
						"feePayer": "facilitator-address",
						"custom":   "facilitator-value",
					},
				},
			},
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL: mockServer.URL,
		Client:  &http.Client{},
	}

	requirements := []v2.PaymentRequirements{
		{
			Scheme:  "exact",
			Network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
			Amount:  "1000000",
			Extra: map[string]interface{}{
				"feePayer": "user-specified-address",
			},
		},
	}

	enriched, err := client.EnrichRequirements(context.Background(), requirements)
	if err != nil {
		t.Fatalf("EnrichRequirements failed: %v", err)
	}

	// User-specified feePayer should be preserved
	feePayer, _ := enriched[0].Extra["feePayer"].(string)
	if feePayer != "user-specified-address" {
		t.Errorf("Expected user-specified feePayer to be preserved, got %s", feePayer)
	}

	// Facilitator's custom value should be added
	custom, _ := enriched[0].Extra["custom"].(string)
	if custom != "facilitator-value" {
		t.Errorf("Expected facilitator's custom value to be added, got %s", custom)
	}
}

func TestFacilitatorClient_DefaultClient(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := v2.VerifyResponse{IsValid: true}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer mockServer.Close()

	// Client field is nil - should use http.DefaultClient
	client := &FacilitatorClient{
		BaseURL: mockServer.URL,
	}

	resp, err := client.Verify(context.Background(), v2.PaymentPayload{}, v2.PaymentRequirements{})
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}

	if !resp.IsValid {
		t.Error("Expected IsValid to be true")
	}
}

func TestFacilitatorClient_Timeout(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		response := v2.VerifyResponse{IsValid: true}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer mockServer.Close()

	client := &FacilitatorClient{
		BaseURL: mockServer.URL,
		Client:  &http.Client{},
		Timeouts: v2.TimeoutConfig{
			VerifyTimeout: 50 * time.Millisecond,
		},
	}

	_, err := client.Verify(context.Background(), v2.PaymentPayload{}, v2.PaymentRequirements{})
	if err == nil {
		t.Fatal("Expected timeout error, got nil")
	}

	if !errors.Is(err, v2.ErrFacilitatorUnavailable) {
		t.Errorf("Expected ErrFacilitatorUnavailable due to timeout, got %v", err)
	}
}
