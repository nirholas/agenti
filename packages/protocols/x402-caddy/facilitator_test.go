package caddyx402

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFacilitatorClient_Verify(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/verify" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("unexpected method: %s", r.Method)
		}
		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Errorf("content-type = %q", ct)
		}

		var req VerifyRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatal(err)
		}

		resp := VerifyResponse{
			IsValid: true,
			Payer:   "0xPAYER",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := newTestFacilitatorClient(server.URL)
	payload := &PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-sepolia",
	}
	reqs := PaymentRequirements{
		Scheme:            "exact",
		Network:           "base-sepolia",
		MaxAmountRequired: "10000",
	}

	resp, err := client.Verify(context.Background(), payload, reqs)
	if err != nil {
		t.Fatal(err)
	}
	if !resp.IsValid {
		t.Error("expected IsValid=true")
	}
	if resp.Payer != "0xPAYER" {
		t.Errorf("payer = %q", resp.Payer)
	}
}

func TestFacilitatorClient_Verify_Invalid(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := VerifyResponse{
			IsValid:       false,
			InvalidReason: "insufficient_funds",
			Payer:         "0xPAYER",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := newTestFacilitatorClient(server.URL)
	resp, err := client.Verify(context.Background(), &PaymentPayload{}, PaymentRequirements{})
	if err != nil {
		t.Fatal(err)
	}
	if resp.IsValid {
		t.Error("expected IsValid=false")
	}
	if resp.InvalidReason != "insufficient_funds" {
		t.Errorf("invalidReason = %q", resp.InvalidReason)
	}
}

func TestFacilitatorClient_Settle(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/settle" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}

		resp := SettlementResponse{
			Success:     true,
			Transaction: "0xTXHASH",
			Network:     "base-sepolia",
			Payer:       "0xPAYER",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := newTestFacilitatorClient(server.URL)
	resp, err := client.Settle(context.Background(), &PaymentPayload{}, PaymentRequirements{})
	if err != nil {
		t.Fatal(err)
	}
	if !resp.Success {
		t.Error("expected success")
	}
	if resp.Transaction != "0xTXHASH" {
		t.Errorf("transaction = %q", resp.Transaction)
	}
}

func TestFacilitatorClient_WithAPIKey(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if auth != "Bearer test-key" {
			t.Errorf("authorization = %q, want Bearer test-key", auth)
		}
		resp := VerifyResponse{IsValid: true}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewFacilitatorClient(server.URL, "test-key")
	client.httpClient.Timeout = facilitatorTimeout

	_, err := client.Verify(context.Background(), &PaymentPayload{}, PaymentRequirements{})
	if err != nil {
		t.Fatal(err)
	}
}

func TestFacilitatorClient_Verify_HTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal error"))
	}))
	defer server.Close()

	client := newTestFacilitatorClient(server.URL)
	_, err := client.Verify(context.Background(), &PaymentPayload{}, PaymentRequirements{})
	if err == nil {
		t.Fatal("expected error for HTTP 500")
	}
	if !strings.Contains(err.Error(), "HTTP 500") {
		t.Errorf("error = %q, want mention of HTTP 500", err.Error())
	}
}

func TestFacilitatorClient_Settle_HTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer server.Close()

	client := newTestFacilitatorClient(server.URL)
	_, err := client.Settle(context.Background(), &PaymentPayload{}, PaymentRequirements{})
	if err == nil {
		t.Fatal("expected error for HTTP 502")
	}
	if !strings.Contains(err.Error(), "HTTP 502") {
		t.Errorf("error = %q, want mention of HTTP 502", err.Error())
	}
}

func TestFacilitatorClient_Settle_SuccessButEmptyTxHash(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := SettlementResponse{
			Success:     true,
			Transaction: "",
			Network:     "base-sepolia",
			Payer:       "0xPAYER",
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := newTestFacilitatorClient(server.URL)
	_, err := client.Settle(context.Background(), &PaymentPayload{}, PaymentRequirements{})
	if err == nil {
		t.Fatal("expected error for success with empty tx hash")
	}
	if !strings.Contains(err.Error(), "empty transaction hash") {
		t.Errorf("error = %q, want mention of empty transaction hash", err.Error())
	}
}

func TestFacilitatorClient_Verify_InvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("not json"))
	}))
	defer server.Close()

	client := newTestFacilitatorClient(server.URL)
	_, err := client.Verify(context.Background(), &PaymentPayload{}, PaymentRequirements{})
	if err == nil {
		t.Fatal("expected error for invalid JSON response")
	}
}

func TestFacilitatorClient_Verify_ContextCancelled(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Never responds — the context cancel should abort.
		select {}
	}))
	defer server.Close()

	client := newTestFacilitatorClient(server.URL)
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately.

	_, err := client.Verify(ctx, &PaymentPayload{}, PaymentRequirements{})
	if err == nil {
		t.Fatal("expected error for cancelled context")
	}
}
