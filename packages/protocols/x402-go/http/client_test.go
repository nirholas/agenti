package http

import (
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/mark3labs/x402-go"
)

// mockSigner implements x402.Signer for testing
type mockSigner struct {
	network      string
	scheme       string
	canSignValue bool
	signError    error
	priority     int
	maxAmount    *big.Int
}

func (m *mockSigner) Network() string                           { return m.network }
func (m *mockSigner) Scheme() string                            { return m.scheme }
func (m *mockSigner) CanSign(req *x402.PaymentRequirement) bool { return m.canSignValue }
func (m *mockSigner) GetPriority() int                          { return m.priority }
func (m *mockSigner) GetTokens() []x402.TokenConfig             { return nil }
func (m *mockSigner) GetMaxAmount() *big.Int                    { return m.maxAmount }

func (m *mockSigner) Sign(req *x402.PaymentRequirement) (*x402.PaymentPayload, error) {
	if m.signError != nil {
		return nil, m.signError
	}
	return &x402.PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     m.network,
		Payload: map[string]interface{}{
			"test": "payload",
		},
	}, nil
}

func TestNewClient(t *testing.T) {
	tests := []struct {
		name    string
		opts    []ClientOption
		wantErr bool
	}{
		{
			name:    "default client",
			opts:    nil,
			wantErr: false,
		},
		{
			name: "client with custom HTTP client",
			opts: []ClientOption{
				WithHTTPClient(&http.Client{
					Timeout: 30 * time.Second,
				}),
			},
			wantErr: false,
		},
		{
			name: "client with signer",
			opts: []ClientOption{
				WithSigner(&mockSigner{
					network:      "base",
					scheme:       "exact",
					canSignValue: true,
				}),
			},
			wantErr: false,
		},
		{
			name: "client with multiple signers",
			opts: []ClientOption{
				WithSigner(&mockSigner{
					network:      "base",
					scheme:       "exact",
					canSignValue: true,
					priority:     1,
				}),
				WithSigner(&mockSigner{
					network:      "solana",
					scheme:       "exact",
					canSignValue: true,
					priority:     2,
				}),
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewClient(tt.opts...)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewClient() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && client == nil {
				t.Error("NewClient() returned nil client")
			}
		})
	}
}

func TestClient_WithSigner(t *testing.T) {
	client, err := NewClient(
		WithSigner(&mockSigner{
			network:      "base",
			scheme:       "exact",
			canSignValue: true,
		}),
	)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	// Verify transport is wrapped
	transport, ok := client.Transport.(*X402Transport)
	if !ok {
		t.Fatal("expected X402Transport")
	}

	if len(transport.Signers) != 1 {
		t.Errorf("expected 1 signer, got %d", len(transport.Signers))
	}
}

func TestClient_WithMultipleSigners(t *testing.T) {
	signer1 := &mockSigner{network: "base", scheme: "exact", canSignValue: true, priority: 1}
	signer2 := &mockSigner{network: "solana", scheme: "exact", canSignValue: true, priority: 2}

	client, err := NewClient(
		WithSigner(signer1),
		WithSigner(signer2),
	)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	transport, ok := client.Transport.(*X402Transport)
	if !ok {
		t.Fatal("expected X402Transport")
	}

	if len(transport.Signers) != 2 {
		t.Errorf("expected 2 signers, got %d", len(transport.Signers))
	}
}

func TestClient_WithCustomHTTPClient(t *testing.T) {
	customClient := &http.Client{
		Timeout: 10 * time.Second,
	}

	client, err := NewClient(
		WithHTTPClient(customClient),
		WithSigner(&mockSigner{
			network:      "base",
			scheme:       "exact",
			canSignValue: true,
		}),
	)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	// Verify the custom timeout is preserved
	if client.Timeout != 10*time.Second {
		t.Errorf("expected timeout 10s, got %v", client.Timeout)
	}
}

func TestClient_WithSelector(t *testing.T) {
	customSelector := x402.NewDefaultPaymentSelector()

	client, err := NewClient(
		WithSelector(customSelector),
		WithSigner(&mockSigner{
			network:      "base",
			scheme:       "exact",
			canSignValue: true,
		}),
	)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	transport, ok := client.Transport.(*X402Transport)
	if !ok {
		t.Fatal("expected X402Transport")
	}

	if transport.Selector == nil {
		t.Error("expected selector to be set")
	}
}

func TestClient_NonPaymentRequest(t *testing.T) {
	// Create a test server that returns 200 OK
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("success"))
	}))
	defer server.Close()

	// Create client without signers
	client, err := NewClient()
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	resp, err := client.Get(server.URL)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}
}

func TestClient_StdlibCompatibility(t *testing.T) {
	// Test that client works like a standard http.Client for non-402 requests
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check that no payment headers are added for non-402 requests
		if r.Header.Get("X-PAYMENT") != "" {
			t.Error("unexpected X-PAYMENT header on non-402 request")
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()

	client, err := NewClient(
		WithSigner(&mockSigner{
			network:      "base",
			scheme:       "exact",
			canSignValue: true,
		}),
	)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	resp, err := client.Get(server.URL)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}
}

func TestGetSettlement_NoHeader(t *testing.T) {
	resp := &http.Response{
		Header: http.Header{},
	}

	settlement := GetSettlement(resp)
	if settlement != nil {
		t.Error("expected nil settlement when header is missing")
	}
}

func TestGetSettlement_InvalidBase64(t *testing.T) {
	resp := &http.Response{
		Header: http.Header{
			"X-Settlement": []string{"invalid base64!!!"},
		},
	}

	settlement := GetSettlement(resp)
	if settlement != nil {
		t.Error("expected nil settlement for invalid base64")
	}
}

func TestGetSettlement_InvalidJSON(t *testing.T) {
	// Valid base64 but invalid JSON
	resp := &http.Response{
		Header: http.Header{
			"X-Settlement": []string{"bm90IGpzb24="}, // "not json" in base64
		},
	}

	settlement := GetSettlement(resp)
	if settlement != nil {
		t.Error("expected nil settlement for invalid JSON")
	}
}

// T066 [P]: Test for stdlib compatibility - non-payment requests unchanged (FR-014)
func TestClient_StdlibCompatibility_NonPaymentRequestsUnchanged(t *testing.T) {
	// Test various HTTP methods and verify requests are unchanged
	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"GET request", "GET", "/api/data"},
		{"POST request", "POST", "/api/submit"},
		{"PUT request", "PUT", "/api/update"},
		{"DELETE request", "DELETE", "/api/delete"},
		{"HEAD request", "HEAD", "/api/check"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Track original request headers to verify they're not modified
			originalHeaders := make(map[string]string)

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Verify no payment headers are added for non-402 responses
				if r.Header.Get("X-PAYMENT") != "" {
					t.Error("FR-014 violation: X-PAYMENT header should not be added to non-payment requests")
				}

				// Verify original headers are preserved
				for key, value := range originalHeaders {
					if r.Header.Get(key) != value {
						t.Errorf("FR-014 violation: header %s changed from %s to %s", key, value, r.Header.Get(key))
					}
				}

				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte("success"))
			}))
			defer server.Close()

			// Create client with signer (but server won't require payment)
			client, err := NewClient(
				WithSigner(&mockSigner{
					network:      "base",
					scheme:       "exact",
					canSignValue: true,
				}),
			)
			if err != nil {
				t.Fatalf("failed to create client: %v", err)
			}

			// Create request with custom headers
			req, err := http.NewRequest(tt.method, server.URL+tt.path, nil)
			if err != nil {
				t.Fatalf("failed to create request: %v", err)
			}

			// Add some custom headers
			req.Header.Set("User-Agent", "TestClient/1.0")
			req.Header.Set("X-Custom-Header", "CustomValue")
			originalHeaders["User-Agent"] = "TestClient/1.0"
			originalHeaders["X-Custom-Header"] = "CustomValue"

			// Make request
			resp, err := client.Do(req)
			if err != nil {
				t.Fatalf("request failed: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("expected status 200, got %d", resp.StatusCode)
			}
		})
	}

	t.Log("FR-014 passed: non-payment requests work identically to stdlib http.Client")
}

// T066 [P]: Test that client behaves exactly like stdlib for various scenarios
func TestClient_StdlibCompatibility_VariousScenarios(t *testing.T) {
	tests := []struct {
		name           string
		statusCode     int
		responseBody   string
		expectedStatus int
	}{
		{"200 OK", http.StatusOK, "success", http.StatusOK},
		{"404 Not Found", http.StatusNotFound, "not found", http.StatusNotFound},
		{"500 Internal Error", http.StatusInternalServerError, "error", http.StatusInternalServerError},
		{"201 Created", http.StatusCreated, "created", http.StatusCreated},
		{"204 No Content", http.StatusNoContent, "", http.StatusNoContent},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create server that returns specified status
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.statusCode)
				_, _ = w.Write([]byte(tt.responseBody))
			}))
			defer server.Close()

			// Create x402 client
			x402Client, err := NewClient(
				WithSigner(&mockSigner{
					network:      "base",
					scheme:       "exact",
					canSignValue: true,
				}),
			)
			if err != nil {
				t.Fatalf("failed to create x402 client: %v", err)
			}

			// Create stdlib client for comparison
			stdlibClient := &http.Client{}

			// Make request with x402 client
			x402Resp, err := x402Client.Get(server.URL)
			if err != nil {
				t.Fatalf("x402 client request failed: %v", err)
			}
			defer x402Resp.Body.Close()

			// Make request with stdlib client
			stdlibResp, err := stdlibClient.Get(server.URL)
			if err != nil {
				t.Fatalf("stdlib client request failed: %v", err)
			}
			defer stdlibResp.Body.Close()

			// Verify both clients got same status code
			if x402Resp.StatusCode != stdlibResp.StatusCode {
				t.Errorf("FR-014 violation: status codes differ - x402: %d, stdlib: %d",
					x402Resp.StatusCode, stdlibResp.StatusCode)
			}

			if x402Resp.StatusCode != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, x402Resp.StatusCode)
			}
		})
	}

	t.Log("FR-014 passed: client maintains stdlib compatibility for all status codes")
}
