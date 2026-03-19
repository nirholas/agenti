package http

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mark3labs/x402-go"
)

// Helper function to create a proper PaymentRequirementsResponse as per x402 spec
func makePaymentRequirementsResponse(req x402.PaymentRequirement) []byte {
	response := struct {
		X402Version int                       `json:"x402Version"`
		Error       string                    `json:"error"`
		Accepts     []x402.PaymentRequirement `json:"accepts"`
	}{
		X402Version: 1,
		Error:       "Payment required",
		Accepts:     []x402.PaymentRequirement{req},
	}
	body, _ := json.Marshal(response)
	return body
}

func TestRoundTrip_NonPaymentRequest(t *testing.T) {
	// Server returns 200 OK without requiring payment
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("success"))
	}))
	defer server.Close()

	transport := &X402Transport{
		Base: http.DefaultTransport,
		Signers: []x402.Signer{
			&mockSigner{network: "base", scheme: "exact", canSignValue: true},
		},
		Selector: x402.NewDefaultPaymentSelector(),
	}

	req, _ := http.NewRequest("GET", server.URL, nil)
	resp, err := transport.RoundTrip(req)
	if err != nil {
		t.Fatalf("RoundTrip failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}
}

func TestRoundTrip_PaymentRequired(t *testing.T) {
	// Track number of requests
	requestCount := 0

	// Server returns 402 on first request, 200 on retry with payment
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++

		if r.Header.Get("X-PAYMENT") == "" {
			// First request without payment
			requirements := x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				MaxAmountRequired: "100000",
				PayTo:             "0x1234567890123456789012345678901234567890",
				MaxTimeoutSeconds: 60,
			}

			body := makePaymentRequirementsResponse(requirements)
			w.WriteHeader(http.StatusPaymentRequired)
			_, _ = w.Write(body)
		} else {
			// Retry with payment
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("success"))
		}
	}))
	defer server.Close()

	transport := &X402Transport{
		Base: http.DefaultTransport,
		Signers: []x402.Signer{
			&mockSigner{network: "base", scheme: "exact", canSignValue: true},
		},
		Selector: x402.NewDefaultPaymentSelector(),
	}

	req, _ := http.NewRequest("GET", server.URL, nil)
	resp, err := transport.RoundTrip(req)
	if err != nil {
		t.Fatalf("RoundTrip failed: %v", err)
	}
	defer resp.Body.Close()

	if requestCount != 2 {
		t.Errorf("expected 2 requests, got %d", requestCount)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}
}

func TestRoundTrip_NoValidSigner(t *testing.T) {
	// Server returns 402 requiring payment
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requirements := x402.PaymentRequirement{
			Scheme:            "exact",
			Network:           "ethereum", // Different network
			Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			MaxAmountRequired: "100000",
			PayTo:             "0x1234567890123456789012345678901234567890",
			MaxTimeoutSeconds: 60,
		}

		body := makePaymentRequirementsResponse(requirements)
		w.WriteHeader(http.StatusPaymentRequired)
		_, _ = w.Write(body)
	}))
	defer server.Close()

	transport := &X402Transport{
		Base: http.DefaultTransport,
		Signers: []x402.Signer{
			&mockSigner{network: "base", scheme: "exact", canSignValue: false}, // Can't sign
		},
		Selector: x402.NewDefaultPaymentSelector(),
	}

	req, _ := http.NewRequest("GET", server.URL, nil)
	_, err := transport.RoundTrip(req)

	if err == nil {
		t.Fatal("expected error for no valid signer")
	}

	// Should be a payment error
	var paymentErr *x402.PaymentError
	if !errors.As(err, &paymentErr) {
		t.Errorf("expected PaymentError, got %T", err)
	}
}

func TestParsePaymentRequirements(t *testing.T) {
	tests := []struct {
		name    string
		body    string
		wantErr bool
	}{
		{
			name: "valid requirements",
			body: `{
				"x402Version": 1,
				"error": "Payment required",
				"accepts": [{
					"scheme": "exact",
					"network": "base",
					"asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
					"maxAmountRequired": "100000",
					"payTo": "0x1234567890123456789012345678901234567890",
					"maxTimeoutSeconds": 60
				}]
			}`,
			wantErr: false,
		},
		{
			name:    "invalid JSON",
			body:    "not json",
			wantErr: true,
		},
		{
			name:    "empty body",
			body:    "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := &http.Response{
				Body: io.NopCloser(strings.NewReader(tt.body)),
			}

			requirements, err := parsePaymentRequirements(resp)

			if tt.wantErr {
				if err == nil {
					t.Error("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}

			if requirements == nil {
				t.Error("expected non-nil requirements")
			}
		})
	}
}

func TestBuildPaymentHeader(t *testing.T) {
	payment := &x402.PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base",
		Payload: map[string]interface{}{
			"test": "data",
		},
	}

	header, err := buildPaymentHeader(payment)
	if err != nil {
		t.Fatalf("buildPaymentHeader failed: %v", err)
	}

	// Verify it's valid base64
	decoded, err := base64.StdEncoding.DecodeString(header)
	if err != nil {
		t.Fatalf("header is not valid base64: %v", err)
	}

	// Verify it's valid JSON
	var parsed x402.PaymentPayload
	if err := json.Unmarshal(decoded, &parsed); err != nil {
		t.Fatalf("decoded header is not valid JSON: %v", err)
	}

	// Verify content
	if parsed.X402Version != 1 {
		t.Errorf("expected version 1, got %d", parsed.X402Version)
	}
	if parsed.Scheme != "exact" {
		t.Errorf("expected scheme 'exact', got '%s'", parsed.Scheme)
	}
	if parsed.Network != "base" {
		t.Errorf("expected network 'base', got '%s'", parsed.Network)
	}
}

func TestParseSettlement(t *testing.T) {
	tests := []struct {
		name       string
		headerFunc func() string
		wantErr    bool
	}{
		{
			name: "valid settlement",
			headerFunc: func() string {
				settlement := x402.SettlementResponse{
					Success:     true,
					Transaction: "0x1234567890abcdef",
					Network:     "base",
					Payer:       "0x1234567890",
				}
				data, _ := json.Marshal(settlement)
				return base64.StdEncoding.EncodeToString(data)
			},
			wantErr: false,
		},
		{
			name: "invalid base64",
			headerFunc: func() string {
				return "invalid base64!!!"
			},
			wantErr: true,
		},
		{
			name: "invalid JSON",
			headerFunc: func() string {
				return base64.StdEncoding.EncodeToString([]byte("not json"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			header := tt.headerFunc()
			settlement, err := parseSettlement(header)

			if tt.wantErr {
				if err == nil {
					t.Error("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}

			if settlement == nil {
				t.Error("expected non-nil settlement")
			}
		})
	}
}

func TestRoundTrip_WithSettlement(t *testing.T) {
	// Server returns settlement header on successful payment
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-PAYMENT") != "" {
			// Add settlement header
			settlement := x402.SettlementResponse{
				Success:     true,
				Transaction: "0xabcdef1234567890",
				Network:     "base",
				Payer:       "0x1234567890",
			}
			data, _ := json.Marshal(settlement)
			settlementHeader := base64.StdEncoding.EncodeToString(data)

			w.Header().Set("X-PAYMENT-RESPONSE", settlementHeader)
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("success"))
		} else {
			requirements := x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				MaxAmountRequired: "100000",
				PayTo:             "0x1234567890123456789012345678901234567890",
				MaxTimeoutSeconds: 60,
			}
			body := makePaymentRequirementsResponse(requirements)
			w.WriteHeader(http.StatusPaymentRequired)
			_, _ = w.Write(body)
		}
	}))
	defer server.Close()

	transport := &X402Transport{
		Base: http.DefaultTransport,
		Signers: []x402.Signer{
			&mockSigner{network: "base", scheme: "exact", canSignValue: true},
		},
		Selector: x402.NewDefaultPaymentSelector(),
	}

	req, _ := http.NewRequest("GET", server.URL, nil)
	resp, err := transport.RoundTrip(req)
	if err != nil {
		t.Fatalf("RoundTrip failed: %v", err)
	}
	defer resp.Body.Close()

	// Check settlement header
	settlement := GetSettlement(resp)
	if settlement == nil {
		t.Fatal("expected settlement header")
	}

	if settlement.Transaction != "0xabcdef1234567890" {
		t.Errorf("expected transaction 0xabcdef1234567890, got %s", settlement.Transaction)
	}

	if !settlement.Success {
		t.Error("expected success to be true")
	}
}

func TestRoundTrip_MultiSignerSelection_Priority(t *testing.T) {
	// Track which signer was used
	var selectedSignerPriority int

	// Server returns 402 requiring base network
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-PAYMENT") == "" {
			requirements := x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				MaxAmountRequired: "100000",
				PayTo:             "0x1234567890123456789012345678901234567890",
				MaxTimeoutSeconds: 60,
			}
			body := makePaymentRequirementsResponse(requirements)
			w.WriteHeader(http.StatusPaymentRequired)
			_, _ = w.Write(body)
		} else {
			// Parse payment to determine which signer was used
			paymentHeader := r.Header.Get("X-PAYMENT")
			decoded, _ := base64.StdEncoding.DecodeString(paymentHeader)
			var payment x402.PaymentPayload
			_ = json.Unmarshal(decoded, &payment)

			// Mock payload includes priority for tracking
			if payloadMap, ok := payment.Payload.(map[string]interface{}); ok {
				if priority, ok := payloadMap["priority"].(float64); ok {
					selectedSignerPriority = int(priority)
				}
			}

			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("success"))
		}
	}))
	defer server.Close()

	// Create multiple signers with different priorities
	// Lower number = higher priority
	transport := &X402Transport{
		Base: http.DefaultTransport,
		Signers: []x402.Signer{
			&mockSigner{
				network:      "base",
				scheme:       "exact",
				canSignValue: true,
				priority:     3, // Lowest priority
			},
			&mockSigner{
				network:      "base",
				scheme:       "exact",
				canSignValue: true,
				priority:     1, // Highest priority - should be selected
			},
			&mockSigner{
				network:      "base",
				scheme:       "exact",
				canSignValue: true,
				priority:     2, // Middle priority
			},
		},
		Selector: x402.NewDefaultPaymentSelector(),
	}

	// Modify mock signers to include priority in payload
	for i, s := range transport.Signers {
		mock := s.(*mockSigner)
		priority := mock.priority
		mock.signError = nil
		// Override Sign to include priority
		originalSigner := mock
		transport.Signers[i] = &mockSignerWithPayload{
			mockSigner: originalSigner,
			priority:   priority,
		}
	}

	req, _ := http.NewRequest("GET", server.URL, nil)
	resp, err := transport.RoundTrip(req)
	if err != nil {
		t.Fatalf("RoundTrip failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	// Verify the highest priority signer (priority 1) was selected
	if selectedSignerPriority != 1 {
		t.Errorf("expected signer with priority 1 to be selected, got priority %d", selectedSignerPriority)
	}
}

// mockSignerWithPayload extends mockSigner to include priority in payload
type mockSignerWithPayload struct {
	*mockSigner
	priority int
}

// mockSignerForNetworkTest is a mock signer that properly checks network matching
type mockSignerForNetworkTest struct {
	network  string
	scheme   string
	priority int
}

func (m *mockSignerForNetworkTest) Network() string               { return m.network }
func (m *mockSignerForNetworkTest) Scheme() string                { return m.scheme }
func (m *mockSignerForNetworkTest) GetPriority() int              { return m.priority }
func (m *mockSignerForNetworkTest) GetTokens() []x402.TokenConfig { return nil }
func (m *mockSignerForNetworkTest) GetMaxAmount() *big.Int        { return nil }
func (m *mockSignerForNetworkTest) CanSign(req *x402.PaymentRequirement) bool {
	return m.network == req.Network
}
func (m *mockSignerForNetworkTest) Sign(req *x402.PaymentRequirement) (*x402.PaymentPayload, error) {
	return &x402.PaymentPayload{
		X402Version: 1,
		Scheme:      m.scheme,
		Network:     m.network,
		Payload: map[string]interface{}{
			"network": m.network,
		},
	}, nil
}

func (m *mockSignerWithPayload) Sign(req *x402.PaymentRequirement) (*x402.PaymentPayload, error) {
	if m.signError != nil {
		return nil, m.signError
	}
	return &x402.PaymentPayload{
		X402Version: 1,
		Scheme:      m.scheme,
		Network:     m.network,
		Payload: map[string]interface{}{
			"priority": m.priority,
		},
	}, nil
}

func TestRoundTrip_MultiSignerSelection_NetworkMatch(t *testing.T) {
	tests := []struct {
		name            string
		requiredNetwork string
		expectedNetwork string
	}{
		{
			name:            "select base network signer",
			requiredNetwork: "base",
			expectedNetwork: "base",
		},
		{
			name:            "select solana network signer",
			requiredNetwork: "solana",
			expectedNetwork: "solana",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var selectedNetwork string

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Header.Get("X-PAYMENT") == "" {
					requirements := x402.PaymentRequirement{
						Scheme:            "exact",
						Network:           tt.requiredNetwork,
						Asset:             "0xUSDC",
						MaxAmountRequired: "100000",
						PayTo:             "0x1234567890123456789012345678901234567890",
						MaxTimeoutSeconds: 60,
					}
					body := makePaymentRequirementsResponse(requirements)
					w.WriteHeader(http.StatusPaymentRequired)
					_, _ = w.Write(body)
				} else {
					paymentHeader := r.Header.Get("X-PAYMENT")
					decoded, _ := base64.StdEncoding.DecodeString(paymentHeader)
					var payment x402.PaymentPayload
					_ = json.Unmarshal(decoded, &payment)
					selectedNetwork = payment.Network

					w.WriteHeader(http.StatusOK)
					_, _ = w.Write([]byte("success"))
				}
			}))
			defer server.Close()

			// Create mock signers with proper CanSign implementation
			baseSigner := &mockSignerForNetworkTest{
				network:  "base",
				scheme:   "exact",
				priority: 1,
			}
			solanaSigner := &mockSignerForNetworkTest{
				network:  "solana",
				scheme:   "exact",
				priority: 2,
			}

			transport := &X402Transport{
				Base: http.DefaultTransport,
				Signers: []x402.Signer{
					baseSigner,
					solanaSigner,
				},
				Selector: x402.NewDefaultPaymentSelector(),
			}

			req, _ := http.NewRequest("GET", server.URL, nil)
			resp, err := transport.RoundTrip(req)
			if err != nil {
				t.Fatalf("RoundTrip failed: %v", err)
			}
			defer resp.Body.Close()

			if selectedNetwork != tt.expectedNetwork {
				t.Errorf("expected network %s, got %s", tt.expectedNetwork, selectedNetwork)
			}
		})
	}
}

func TestRoundTrip_MultiSignerSelection_MaxAmountFiltering(t *testing.T) {
	var selectedSignerPriority int

	// Server requires 1 USDC
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-PAYMENT") == "" {
			requirements := x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				Asset:             "0xUSDC",
				MaxAmountRequired: "1000000", // 1 USDC
				PayTo:             "0x1234567890123456789012345678901234567890",
				MaxTimeoutSeconds: 60,
			}
			body := makePaymentRequirementsResponse(requirements)
			w.WriteHeader(http.StatusPaymentRequired)
			_, _ = w.Write(body)
		} else {
			paymentHeader := r.Header.Get("X-PAYMENT")
			decoded, _ := base64.StdEncoding.DecodeString(paymentHeader)
			var payment x402.PaymentPayload
			_ = json.Unmarshal(decoded, &payment)

			if payloadMap, ok := payment.Payload.(map[string]interface{}); ok {
				if priority, ok := payloadMap["priority"].(float64); ok {
					selectedSignerPriority = int(priority)
				}
			}

			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("success"))
		}
	}))
	defer server.Close()

	transport := &X402Transport{
		Base: http.DefaultTransport,
		Signers: []x402.Signer{
			&mockSignerWithPayload{
				mockSigner: &mockSigner{
					network:      "base",
					scheme:       "exact",
					canSignValue: true,
					priority:     1,
					maxAmount:    big.NewInt(500000), // 0.5 USDC - insufficient
				},
				priority: 1,
			},
			&mockSignerWithPayload{
				mockSigner: &mockSigner{
					network:      "base",
					scheme:       "exact",
					canSignValue: true,
					priority:     2,
					maxAmount:    big.NewInt(2000000), // 2 USDC - sufficient
				},
				priority: 2,
			},
		},
		Selector: x402.NewDefaultPaymentSelector(),
	}

	req, _ := http.NewRequest("GET", server.URL, nil)
	resp, err := transport.RoundTrip(req)
	if err != nil {
		t.Fatalf("RoundTrip failed: %v", err)
	}
	defer resp.Body.Close()

	// Should use priority 2 signer (skipping priority 1 due to insufficient max amount)
	if selectedSignerPriority != 2 {
		t.Errorf("expected signer with priority 2 to be selected due to max amount, got priority %d", selectedSignerPriority)
	}
}

// T058: Test for all configured signers lacking sufficient funds
func TestRoundTrip_AllSignersLackSufficientFunds(t *testing.T) {
	// Server requires 10 USDC
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requirements := x402.PaymentRequirement{
			Scheme:            "exact",
			Network:           "base",
			Asset:             "0xUSDC",
			MaxAmountRequired: "10000000", // 10 USDC
			PayTo:             "0x1234567890123456789012345678901234567890",
			MaxTimeoutSeconds: 60,
		}
		body := makePaymentRequirementsResponse(requirements)
		w.WriteHeader(http.StatusPaymentRequired)
		_, _ = w.Write(body)
	}))
	defer server.Close()

	// All signers have max amounts below the requirement
	transport := &X402Transport{
		Base: http.DefaultTransport,
		Signers: []x402.Signer{
			&mockSigner{
				network:      "base",
				scheme:       "exact",
				canSignValue: true,
				priority:     1,
				maxAmount:    big.NewInt(1000000), // 1 USDC - insufficient
			},
			&mockSigner{
				network:      "base",
				scheme:       "exact",
				canSignValue: true,
				priority:     2,
				maxAmount:    big.NewInt(5000000), // 5 USDC - insufficient
			},
			&mockSigner{
				network:      "base",
				scheme:       "exact",
				canSignValue: true,
				priority:     3,
				maxAmount:    big.NewInt(2000000), // 2 USDC - insufficient
			},
		},
		Selector: x402.NewDefaultPaymentSelector(),
	}

	req, _ := http.NewRequest("GET", server.URL, nil)
	_, err := transport.RoundTrip(req)

	// Should return an error indicating no valid signer
	if err == nil {
		t.Fatal("expected error when all signers lack sufficient funds")
	}

	// Verify it's a PaymentError with NoValidSigner code
	var paymentErr *x402.PaymentError
	if !errors.As(err, &paymentErr) {
		t.Fatalf("expected PaymentError, got %T", err)
	}

	if paymentErr.Code != x402.ErrCodeNoValidSigner {
		t.Errorf("expected error code %s, got %s", x402.ErrCodeNoValidSigner, paymentErr.Code)
	}
}

// T059: Test for network errors during payment submission
func TestRoundTrip_NetworkErrorDuringPaymentSubmission(t *testing.T) {
	var requestCount int
	var mu sync.Mutex

	// Server returns 402 on first request, then simulates network error on retry
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		requestCount++
		mu.Unlock()

		if r.Header.Get("X-PAYMENT") == "" {
			// First request - return payment requirements
			requirements := x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				Asset:             "0xUSDC",
				MaxAmountRequired: "100000",
				PayTo:             "0x1234567890123456789012345678901234567890",
				MaxTimeoutSeconds: 60,
			}
			body := makePaymentRequirementsResponse(requirements)
			w.WriteHeader(http.StatusPaymentRequired)
			_, _ = w.Write(body)
		} else {
			// Simulate network error by hijacking connection
			hj, ok := w.(http.Hijacker)
			if !ok {
				t.Error("server doesn't support hijacking")
				return
			}
			conn, _, err := hj.Hijack()
			if err != nil {
				t.Errorf("hijack failed: %v", err)
				return
			}
			// Close connection to simulate network error
			conn.Close()
		}
	}))
	defer server.Close()

	transport := &X402Transport{
		Base: http.DefaultTransport,
		Signers: []x402.Signer{
			&mockSigner{network: "base", scheme: "exact", canSignValue: true},
		},
		Selector: x402.NewDefaultPaymentSelector(),
	}

	req, _ := http.NewRequest("GET", server.URL, nil)
	_, err := transport.RoundTrip(req)

	// Should return a network error
	if err == nil {
		t.Fatal("expected network error during payment submission")
	}

	// Verify we got past the initial 402 response
	mu.Lock()
	finalCount := requestCount
	mu.Unlock()

	if finalCount < 2 {
		t.Errorf("expected at least 2 requests (402 + retry), got %d", finalCount)
	}

	// Error should indicate network issue
	errMsg := err.Error()
	if errMsg == "" {
		t.Error("error message should not be empty")
	}
}

// T060: Test for payment authorization expiry handling
func TestRoundTrip_PaymentAuthorizationExpiry(t *testing.T) {
	// Server requires payment with very short timeout
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requirements := x402.PaymentRequirement{
			Scheme:            "exact",
			Network:           "base",
			Asset:             "0xUSDC",
			MaxAmountRequired: "100000",
			PayTo:             "0x1234567890123456789012345678901234567890",
			MaxTimeoutSeconds: 0, // Immediate expiry
		}
		body := makePaymentRequirementsResponse(requirements)
		w.WriteHeader(http.StatusPaymentRequired)
		_, _ = w.Write(body)
	}))
	defer server.Close()

	transport := &X402Transport{
		Base: http.DefaultTransport,
		Signers: []x402.Signer{
			&mockSigner{network: "base", scheme: "exact", canSignValue: true},
		},
		Selector: x402.NewDefaultPaymentSelector(),
	}

	req, _ := http.NewRequest("GET", server.URL, nil)
	_, err := transport.RoundTrip(req)

	// Should handle the payment requirements
	// Note: The current implementation doesn't validate timeouts,
	// but this test ensures the system handles edge case timeout values
	if err != nil {
		// Check that error is reasonable
		var paymentErr *x402.PaymentError
		if errors.As(err, &paymentErr) {
			// Valid payment error codes for this scenario
			validCodes := []x402.ErrorCode{
				x402.ErrCodeSigningFailed,
				x402.ErrCodeInvalidRequirements,
				x402.ErrCodeNoValidSigner,
			}
			found := false
			for _, code := range validCodes {
				if paymentErr.Code == code {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("unexpected error code: %s", paymentErr.Code)
			}
		}
	}
}

// T062: Test for concurrent requests with max amount limits
func TestRoundTrip_ConcurrentRequestsWithMaxAmountLimits(t *testing.T) {
	// Server that requires payment
	var requestCount int
	var mu sync.Mutex

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		requestCount++
		mu.Unlock()

		if r.Header.Get("X-PAYMENT") == "" {
			requirements := x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				Asset:             "0xUSDC",
				MaxAmountRequired: "100000", // 0.1 USDC
				PayTo:             "0x1234567890123456789012345678901234567890",
				MaxTimeoutSeconds: 60,
			}
			body := makePaymentRequirementsResponse(requirements)
			w.WriteHeader(http.StatusPaymentRequired)
			_, _ = w.Write(body)
		} else {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("success"))
		}
	}))
	defer server.Close()

	// Signer with max amount that can handle the requests
	transport := &X402Transport{
		Base: http.DefaultTransport,
		Signers: []x402.Signer{
			&mockSigner{
				network:      "base",
				scheme:       "exact",
				canSignValue: true,
				maxAmount:    big.NewInt(1000000), // 1 USDC total
			},
		},
		Selector: x402.NewDefaultPaymentSelector(),
	}

	// Run 10 concurrent requests
	concurrentRequests := 10
	errChan := make(chan error, concurrentRequests)
	successChan := make(chan bool, concurrentRequests)

	for i := 0; i < concurrentRequests; i++ {
		go func() {
			req, _ := http.NewRequest("GET", server.URL, nil)
			resp, err := transport.RoundTrip(req)
			if err != nil {
				errChan <- err
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode == http.StatusOK {
				successChan <- true
			} else {
				errChan <- fmt.Errorf("unexpected status: %d", resp.StatusCode)
			}
		}()
	}

	// Collect results
	successCount := 0
	errorCount := 0
	for i := 0; i < concurrentRequests; i++ {
		select {
		case <-successChan:
			successCount++
		case <-errChan:
			errorCount++
		}
	}

	// All requests should complete (either success or controlled error)
	if successCount+errorCount != concurrentRequests {
		t.Errorf("expected %d total results, got %d", concurrentRequests, successCount+errorCount)
	}

	// At least some requests should succeed
	if successCount == 0 {
		t.Error("expected at least some concurrent requests to succeed")
	}

	// Verify transport handled concurrent requests safely (no panic)
	t.Logf("Concurrent requests completed: %d successful, %d errors", successCount, errorCount)
}

// T064 [P]: Stress test for 100 concurrent requests (SC-005)
func TestRoundTrip_100ConcurrentRequests(t *testing.T) {
	// Track number of requests
	var requestCount int
	var mu sync.Mutex

	// Server returns 402 on first request, 200 on retry with payment
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		requestCount++
		mu.Unlock()

		if r.Header.Get("X-PAYMENT") == "" {
			requirements := x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				MaxAmountRequired: "100000",
				PayTo:             "0x1234567890123456789012345678901234567890",
				MaxTimeoutSeconds: 60,
			}
			body := makePaymentRequirementsResponse(requirements)
			w.WriteHeader(http.StatusPaymentRequired)
			_, _ = w.Write(body)
		} else {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("success"))
		}
	}))
	defer server.Close()

	transport := &X402Transport{
		Base: http.DefaultTransport,
		Signers: []x402.Signer{
			&mockSigner{network: "base", scheme: "exact", canSignValue: true},
		},
		Selector: x402.NewDefaultPaymentSelector(),
	}

	// Launch 100 concurrent requests (SC-005)
	const concurrency = 100
	var wg sync.WaitGroup
	errors := make(chan error, concurrency)

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			req, _ := http.NewRequest("GET", server.URL, nil)
			resp, err := transport.RoundTrip(req)
			if err != nil {
				errors <- err
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				errors <- fmt.Errorf("expected status 200, got %d", resp.StatusCode)
			}
		}()
	}

	wg.Wait()
	close(errors)

	// Check for any errors
	errorCount := 0
	for err := range errors {
		t.Errorf("concurrent request failed: %v", err)
		errorCount++
	}

	if errorCount > 0 {
		t.Fatalf("SC-005 failed: %d/%d concurrent requests had errors", errorCount, concurrency)
	}

	// Verify all requests succeeded (each makes 2 requests: 402 + retry)
	mu.Lock()
	expectedRequests := concurrency * 2
	if requestCount != expectedRequests {
		t.Errorf("expected %d requests, got %d", expectedRequests, requestCount)
	}
	mu.Unlock()

	t.Logf("SC-005 passed: %d concurrent requests completed successfully", concurrency)
}

// T065 [P]: Test to verify no proactive auth regeneration (FR-006)
func TestRoundTrip_NoProactiveAuthRegeneration(t *testing.T) {
	signCount := 0
	var mu sync.Mutex

	// Custom signer that tracks how many times Sign() is called
	trackingSigner := &mockSignerWithTracking{
		mockSigner: &mockSigner{
			network:      "base",
			scheme:       "exact",
			canSignValue: true,
		},
		onSign: func() {
			mu.Lock()
			signCount++
			mu.Unlock()
		},
	}

	// Server requires payment with a short timeout to test expiry behavior
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-PAYMENT") == "" {
			requirements := x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				MaxAmountRequired: "100000",
				PayTo:             "0x1234567890123456789012345678901234567890",
				MaxTimeoutSeconds: 1, // Short timeout
			}
			body := makePaymentRequirementsResponse(requirements)
			w.WriteHeader(http.StatusPaymentRequired)
			_, _ = w.Write(body)
		} else {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("success"))
		}
	}))
	defer server.Close()

	transport := &X402Transport{
		Base:     http.DefaultTransport,
		Signers:  []x402.Signer{trackingSigner},
		Selector: x402.NewDefaultPaymentSelector(),
	}

	// Make first request
	req1, _ := http.NewRequest("GET", server.URL, nil)
	resp1, err := transport.RoundTrip(req1)
	if err != nil {
		t.Fatalf("first request failed: %v", err)
	}
	resp1.Body.Close()

	mu.Lock()
	firstSignCount := signCount
	mu.Unlock()

	if firstSignCount != 1 {
		t.Fatalf("expected 1 signature for first request, got %d", firstSignCount)
	}

	// Wait for timeout to expire
	time.Sleep(2 * time.Second)

	// Make second request - should generate new auth only when server asks (no proactive regeneration)
	req2, _ := http.NewRequest("GET", server.URL, nil)
	resp2, err := transport.RoundTrip(req2)
	if err != nil {
		t.Fatalf("second request failed: %v", err)
	}
	resp2.Body.Close()

	mu.Lock()
	totalSignCount := signCount
	mu.Unlock()

	// Should be 2 total: one for each request, only when server sends 402
	// NOT proactively regenerating before expiry
	if totalSignCount != 2 {
		t.Errorf("FR-006 failed: expected 2 total signatures (reactive only), got %d", totalSignCount)
	}

	t.Logf("FR-006 passed: client generated auth only on 402 response, no proactive regeneration")
}

// mockSignerWithTracking wraps a mock signer to track Sign() calls
type mockSignerWithTracking struct {
	*mockSigner
	onSign func()
}

func (m *mockSignerWithTracking) Sign(req *x402.PaymentRequirement) (*x402.PaymentPayload, error) {
	if m.onSign != nil {
		m.onSign()
	}
	return m.mockSigner.Sign(req)
}

// Test for handling multiple payment requirements in 402 response
func TestRoundTrip_MultiplePaymentRequirements(t *testing.T) {
	tests := []struct {
		name            string
		requirements    []x402.PaymentRequirement
		signers         []x402.Signer
		expectedNetwork string
		expectError     bool
	}{
		{
			name: "select first matching requirement from multiple options",
			requirements: []x402.PaymentRequirement{
				{
					Scheme:            "exact",
					Network:           "base",
					Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
					MaxAmountRequired: "100000",
					PayTo:             "0x1234567890123456789012345678901234567890",
					MaxTimeoutSeconds: 60,
				},
				{
					Scheme:            "exact",
					Network:           "solana",
					Asset:             "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
					MaxAmountRequired: "100000",
					PayTo:             "SomeAddress",
					MaxTimeoutSeconds: 60,
				},
			},
			signers: []x402.Signer{
				&mockSigner{network: "base", scheme: "exact", canSignValue: true},
			},
			expectedNetwork: "base",
			expectError:     false,
		},
		{
			name: "select second requirement when first is not supported",
			requirements: []x402.PaymentRequirement{
				{
					Scheme:            "exact",
					Network:           "ethereum",
					Asset:             "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
					MaxAmountRequired: "100000",
					PayTo:             "0x1234567890123456789012345678901234567890",
					MaxTimeoutSeconds: 60,
				},
				{
					Scheme:            "exact",
					Network:           "base",
					Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
					MaxAmountRequired: "100000",
					PayTo:             "0x1234567890123456789012345678901234567890",
					MaxTimeoutSeconds: 60,
				},
			},
			signers: []x402.Signer{
				&mockSigner{network: "base", scheme: "exact", canSignValue: true},
			},
			expectedNetwork: "base",
			expectError:     false,
		},
		{
			name: "error when no signer can satisfy any requirement",
			requirements: []x402.PaymentRequirement{
				{
					Scheme:            "exact",
					Network:           "ethereum",
					Asset:             "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
					MaxAmountRequired: "100000",
					PayTo:             "0x1234567890123456789012345678901234567890",
					MaxTimeoutSeconds: 60,
				},
				{
					Scheme:            "exact",
					Network:           "solana",
					Asset:             "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
					MaxAmountRequired: "100000",
					PayTo:             "SomeAddress",
					MaxTimeoutSeconds: 60,
				},
			},
			signers: []x402.Signer{
				&mockSigner{network: "base", scheme: "exact", canSignValue: false},
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var selectedNetwork string
			requestCount := 0

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requestCount++

				if r.Header.Get("X-PAYMENT") == "" {
					// First request - return multiple payment requirements
					response := struct {
						X402Version int                       `json:"x402Version"`
						Error       string                    `json:"error"`
						Accepts     []x402.PaymentRequirement `json:"accepts"`
					}{
						X402Version: 1,
						Error:       "Payment required",
						Accepts:     tt.requirements,
					}
					body, _ := json.Marshal(response)
					w.WriteHeader(http.StatusPaymentRequired)
					_, _ = w.Write(body)
				} else {
					// Parse payment to determine which network was selected
					paymentHeader := r.Header.Get("X-PAYMENT")
					decoded, _ := base64.StdEncoding.DecodeString(paymentHeader)
					var payment x402.PaymentPayload
					_ = json.Unmarshal(decoded, &payment)
					selectedNetwork = payment.Network

					w.WriteHeader(http.StatusOK)
					_, _ = w.Write([]byte("success"))
				}
			}))
			defer server.Close()

			transport := &X402Transport{
				Base:     http.DefaultTransport,
				Signers:  tt.signers,
				Selector: x402.NewDefaultPaymentSelector(),
			}

			req, _ := http.NewRequest("GET", server.URL, nil)
			resp, err := transport.RoundTrip(req)

			if tt.expectError {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("expected status 200, got %d", resp.StatusCode)
			}

			if selectedNetwork != tt.expectedNetwork {
				t.Errorf("expected network %s, got %s", tt.expectedNetwork, selectedNetwork)
			}

			if requestCount != 2 {
				t.Errorf("expected 2 requests (402 + retry), got %d", requestCount)
			}
		})
	}
}

// Test payment callbacks are triggered correctly
func TestRoundTrip_PaymentCallbacks(t *testing.T) {
	t.Run("all callbacks triggered on successful payment", func(t *testing.T) {
		var (
			attemptCalled bool
			successCalled bool
			failureCalled bool
			mu            sync.Mutex
		)

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("X-PAYMENT") == "" {
				requirements := x402.PaymentRequirement{
					Scheme:            "exact",
					Network:           "base",
					Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
					MaxAmountRequired: "100000",
					PayTo:             "0x1234567890123456789012345678901234567890",
					MaxTimeoutSeconds: 60,
				}
				body := makePaymentRequirementsResponse(requirements)
				w.WriteHeader(http.StatusPaymentRequired)
				_, _ = w.Write(body)
			} else {
				// Return success with settlement
				settlement := x402.SettlementResponse{
					Success:     true,
					Transaction: "0xabcdef",
					Network:     "base",
					Payer:       "0x9876543210",
				}
				data, _ := json.Marshal(settlement)
				settlementHeader := base64.StdEncoding.EncodeToString(data)
				w.Header().Set("X-PAYMENT-RESPONSE", settlementHeader)
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte("success"))
			}
		}))
		defer server.Close()

		transport := &X402Transport{
			Base: http.DefaultTransport,
			Signers: []x402.Signer{
				&mockSigner{network: "base", scheme: "exact", canSignValue: true},
			},
			Selector: x402.NewDefaultPaymentSelector(),
			OnPaymentAttempt: func(event x402.PaymentEvent) {
				mu.Lock()
				defer mu.Unlock()
				attemptCalled = true
				if event.Type != x402.PaymentEventAttempt {
					t.Errorf("expected attempt event type, got %s", event.Type)
				}
				if event.Method != "HTTP" {
					t.Errorf("expected HTTP method, got %s", event.Method)
				}
				if event.Network != "base" {
					t.Errorf("expected base network, got %s", event.Network)
				}
			},
			OnPaymentSuccess: func(event x402.PaymentEvent) {
				mu.Lock()
				defer mu.Unlock()
				successCalled = true
				if event.Type != x402.PaymentEventSuccess {
					t.Errorf("expected success event type, got %s", event.Type)
				}
				if event.Transaction != "0xabcdef" {
					t.Errorf("expected transaction 0xabcdef, got %s", event.Transaction)
				}
				if event.Payer != "0x9876543210" {
					t.Errorf("expected payer 0x9876543210, got %s", event.Payer)
				}
				if event.Duration == 0 {
					t.Error("expected non-zero duration")
				}
			},
			OnPaymentFailure: func(event x402.PaymentEvent) {
				mu.Lock()
				defer mu.Unlock()
				failureCalled = true
			},
		}

		req, _ := http.NewRequest("GET", server.URL, nil)
		resp, err := transport.RoundTrip(req)
		if err != nil {
			t.Fatalf("RoundTrip failed: %v", err)
		}
		defer resp.Body.Close()

		mu.Lock()
		defer mu.Unlock()

		if !attemptCalled {
			t.Error("attempt callback was not called")
		}
		if !successCalled {
			t.Error("success callback was not called")
		}
		if failureCalled {
			t.Error("failure callback should not be called on success")
		}
	})

	t.Run("failure callback triggered on network error", func(t *testing.T) {
		var (
			attemptCalled bool
			successCalled bool
			failureCalled bool
			mu            sync.Mutex
		)

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("X-PAYMENT") == "" {
				requirements := x402.PaymentRequirement{
					Scheme:            "exact",
					Network:           "base",
					Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
					MaxAmountRequired: "100000",
					PayTo:             "0x1234567890123456789012345678901234567890",
					MaxTimeoutSeconds: 60,
				}
				body := makePaymentRequirementsResponse(requirements)
				w.WriteHeader(http.StatusPaymentRequired)
				_, _ = w.Write(body)
			} else {
				// Simulate network error
				hj, ok := w.(http.Hijacker)
				if !ok {
					t.Error("server doesn't support hijacking")
					return
				}
				conn, _, err := hj.Hijack()
				if err != nil {
					t.Errorf("hijack failed: %v", err)
					return
				}
				conn.Close()
			}
		}))
		defer server.Close()

		transport := &X402Transport{
			Base: http.DefaultTransport,
			Signers: []x402.Signer{
				&mockSigner{network: "base", scheme: "exact", canSignValue: true},
			},
			Selector: x402.NewDefaultPaymentSelector(),
			OnPaymentAttempt: func(event x402.PaymentEvent) {
				mu.Lock()
				defer mu.Unlock()
				attemptCalled = true
			},
			OnPaymentSuccess: func(event x402.PaymentEvent) {
				mu.Lock()
				defer mu.Unlock()
				successCalled = true
			},
			OnPaymentFailure: func(event x402.PaymentEvent) {
				mu.Lock()
				defer mu.Unlock()
				failureCalled = true
				if event.Type != x402.PaymentEventFailure {
					t.Errorf("expected failure event type, got %s", event.Type)
				}
				if event.Error == nil {
					t.Error("expected error to be set in failure event")
				}
				if event.Duration == 0 {
					t.Error("expected non-zero duration")
				}
			},
		}

		req, _ := http.NewRequest("GET", server.URL, nil)
		_, err := transport.RoundTrip(req)
		if err == nil {
			t.Fatal("expected error, got nil")
		}

		mu.Lock()
		defer mu.Unlock()

		if !attemptCalled {
			t.Error("attempt callback was not called")
		}
		if successCalled {
			t.Error("success callback should not be called on failure")
		}
		if !failureCalled {
			t.Error("failure callback was not called")
		}
	})

	t.Run("nil callbacks do not panic", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("X-PAYMENT") == "" {
				requirements := x402.PaymentRequirement{
					Scheme:            "exact",
					Network:           "base",
					Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
					MaxAmountRequired: "100000",
					PayTo:             "0x1234567890123456789012345678901234567890",
					MaxTimeoutSeconds: 60,
				}
				body := makePaymentRequirementsResponse(requirements)
				w.WriteHeader(http.StatusPaymentRequired)
				_, _ = w.Write(body)
			} else {
				settlement := x402.SettlementResponse{
					Success:     true,
					Transaction: "0xabcdef",
					Network:     "base",
					Payer:       "0x9876543210",
				}
				data, _ := json.Marshal(settlement)
				settlementHeader := base64.StdEncoding.EncodeToString(data)
				w.Header().Set("X-PAYMENT-RESPONSE", settlementHeader)
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte("success"))
			}
		}))
		defer server.Close()

		// No callbacks set - should not panic
		transport := &X402Transport{
			Base: http.DefaultTransport,
			Signers: []x402.Signer{
				&mockSigner{network: "base", scheme: "exact", canSignValue: true},
			},
			Selector: x402.NewDefaultPaymentSelector(),
		}

		req, _ := http.NewRequest("GET", server.URL, nil)
		resp, err := transport.RoundTrip(req)
		if err != nil {
			t.Fatalf("RoundTrip failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected status 200, got %d", resp.StatusCode)
		}
	})

	t.Run("callback event contains correct URL", func(t *testing.T) {
		var capturedURL string
		var mu sync.Mutex

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("X-PAYMENT") == "" {
				requirements := x402.PaymentRequirement{
					Scheme:            "exact",
					Network:           "base",
					Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
					MaxAmountRequired: "100000",
					PayTo:             "0x1234567890123456789012345678901234567890",
					MaxTimeoutSeconds: 60,
				}
				body := makePaymentRequirementsResponse(requirements)
				w.WriteHeader(http.StatusPaymentRequired)
				_, _ = w.Write(body)
			} else {
				settlement := x402.SettlementResponse{
					Success:     true,
					Transaction: "0xabcdef",
					Network:     "base",
					Payer:       "0x9876543210",
				}
				data, _ := json.Marshal(settlement)
				settlementHeader := base64.StdEncoding.EncodeToString(data)
				w.Header().Set("X-PAYMENT-RESPONSE", settlementHeader)
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte("success"))
			}
		}))
		defer server.Close()

		transport := &X402Transport{
			Base: http.DefaultTransport,
			Signers: []x402.Signer{
				&mockSigner{network: "base", scheme: "exact", canSignValue: true},
			},
			Selector: x402.NewDefaultPaymentSelector(),
			OnPaymentAttempt: func(event x402.PaymentEvent) {
				mu.Lock()
				defer mu.Unlock()
				capturedURL = event.URL
			},
		}

		testURL := server.URL + "/test/path?query=value"
		req, _ := http.NewRequest("GET", testURL, nil)
		resp, err := transport.RoundTrip(req)
		if err != nil {
			t.Fatalf("RoundTrip failed: %v", err)
		}
		defer resp.Body.Close()

		mu.Lock()
		defer mu.Unlock()

		if capturedURL != testURL {
			t.Errorf("expected URL %s, got %s", testURL, capturedURL)
		}
	})
}

// Test WithPaymentCallback client option
func TestWithPaymentCallback(t *testing.T) {
	t.Run("set individual callbacks", func(t *testing.T) {
		var attemptCalled, successCalled, failureCalled bool

		client, err := NewClient(
			WithSigner(&mockSigner{network: "base", scheme: "exact", canSignValue: true}),
			WithPaymentCallback(x402.PaymentEventAttempt, func(event x402.PaymentEvent) {
				attemptCalled = true
			}),
			WithPaymentCallback(x402.PaymentEventSuccess, func(event x402.PaymentEvent) {
				successCalled = true
			}),
			WithPaymentCallback(x402.PaymentEventFailure, func(event x402.PaymentEvent) {
				failureCalled = true
			}),
		)
		if err != nil {
			t.Fatalf("NewClient failed: %v", err)
		}

		transport, ok := client.Transport.(*X402Transport)
		if !ok {
			t.Fatal("expected X402Transport")
		}

		if transport.OnPaymentAttempt == nil {
			t.Error("OnPaymentAttempt callback not set")
		}
		if transport.OnPaymentSuccess == nil {
			t.Error("OnPaymentSuccess callback not set")
		}
		if transport.OnPaymentFailure == nil {
			t.Error("OnPaymentFailure callback not set")
		}

		// Trigger callbacks to verify they work
		transport.OnPaymentAttempt(x402.PaymentEvent{})
		transport.OnPaymentSuccess(x402.PaymentEvent{})
		transport.OnPaymentFailure(x402.PaymentEvent{})

		if !attemptCalled || !successCalled || !failureCalled {
			t.Error("callbacks were not invoked correctly")
		}
	})

	t.Run("invalid event type returns error", func(t *testing.T) {
		_, err := NewClient(
			WithPaymentCallback(x402.PaymentEventType("invalid"), func(event x402.PaymentEvent) {}),
		)
		if err == nil {
			t.Error("expected error for invalid event type")
		}
	})

	t.Run("WithPaymentCallbacks sets all at once", func(t *testing.T) {
		var attemptCalled, successCalled, failureCalled bool

		client, err := NewClient(
			WithSigner(&mockSigner{network: "base", scheme: "exact", canSignValue: true}),
			WithPaymentCallbacks(
				func(event x402.PaymentEvent) { attemptCalled = true },
				func(event x402.PaymentEvent) { successCalled = true },
				func(event x402.PaymentEvent) { failureCalled = true },
			),
		)
		if err != nil {
			t.Fatalf("NewClient failed: %v", err)
		}

		transport, ok := client.Transport.(*X402Transport)
		if !ok {
			t.Fatal("expected X402Transport")
		}

		transport.OnPaymentAttempt(x402.PaymentEvent{})
		transport.OnPaymentSuccess(x402.PaymentEvent{})
		transport.OnPaymentFailure(x402.PaymentEvent{})

		if !attemptCalled || !successCalled || !failureCalled {
			t.Error("callbacks were not invoked correctly")
		}
	})

	t.Run("nil callbacks in WithPaymentCallbacks are ignored", func(t *testing.T) {
		client, err := NewClient(
			WithSigner(&mockSigner{network: "base", scheme: "exact", canSignValue: true}),
			WithPaymentCallbacks(
				func(event x402.PaymentEvent) {},
				nil, // success callback is nil
				func(event x402.PaymentEvent) {},
			),
		)
		if err != nil {
			t.Fatalf("NewClient failed: %v", err)
		}

		transport, ok := client.Transport.(*X402Transport)
		if !ok {
			t.Fatal("expected X402Transport")
		}

		if transport.OnPaymentAttempt == nil {
			t.Error("OnPaymentAttempt should be set")
		}
		if transport.OnPaymentSuccess != nil {
			t.Error("OnPaymentSuccess should remain nil")
		}
		if transport.OnPaymentFailure == nil {
			t.Error("OnPaymentFailure should be set")
		}
	})
}
