package caddyx402

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
	"go.uber.org/zap"
)

// mockHandler implements caddyhttp.Handler for testing.
type mockHandler struct {
	called bool
}

func (m *mockHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) error {
	m.called = true
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
	return nil
}

func newTestX402(t *testing.T) *X402 {
	t.Helper()
	detector, err := NewCrawlerDetector(nil)
	if err != nil {
		t.Fatal(err)
	}

	return &X402{
		Config: Config{
			PayTo:             "0x1234567890abcdef1234567890abcdef12345678",
			Price:             "0.01",
			Network:           "base-sepolia",
			Description:       "Test content",
			MaxTimeoutSeconds: 60,
			CloudflareCompat:  true,
			DryRun:            false,
		},
		logger:      zap.NewNop(),
		crawler:     detector,
		facilitator: NewFacilitatorClient("http://localhost:9999", ""),
	}
}

func TestHandler_NonCrawler_PassThrough(t *testing.T) {
	x := newTestX402(t)
	next := &mockHandler{}

	req := httptest.NewRequest("GET", "https://example.com/page", nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
	w := httptest.NewRecorder()

	err := x.ServeHTTP(w, req, next)
	if err != nil {
		t.Fatal(err)
	}
	if !next.called {
		t.Error("expected next handler to be called for non-crawler")
	}
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", w.Code)
	}
}

func TestHandler_Crawler_No_Payment_Returns402(t *testing.T) {
	x := newTestX402(t)
	next := &mockHandler{}

	req := httptest.NewRequest("GET", "https://example.com/page", nil)
	req.Header.Set("User-Agent", "GPTBot/1.0")
	w := httptest.NewRecorder()

	err := x.ServeHTTP(w, req, next)
	if err != nil {
		t.Fatal(err)
	}
	if next.called {
		t.Error("next handler should NOT be called for crawler without payment")
	}
	if w.Code != http.StatusPaymentRequired {
		t.Errorf("status = %d, want 402", w.Code)
	}

	// Check Cloudflare compat headers.
	if cp := w.Header().Get("crawler-price"); cp != "0.01" {
		t.Errorf("crawler-price = %q, want 0.01", cp)
	}

	// Check response body.
	var resp PaymentRequirementsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.X402Version != 1 {
		t.Errorf("x402Version = %d", resp.X402Version)
	}
	if len(resp.Accepts) != 1 {
		t.Fatalf("accepts length = %d", len(resp.Accepts))
	}
}

func TestHandler_ExemptPath_PassThrough(t *testing.T) {
	x := newTestX402(t)
	x.exemptGlobs = []string{"/robots.txt", "/.well-known/*"}
	next := &mockHandler{}

	tests := []struct {
		path string
		want bool // should pass through
	}{
		{"/robots.txt", true},
		{"/.well-known/something", true},
		{"/page", false},
		{"/about", false},
	}

	for _, tc := range tests {
		next.called = false
		req := httptest.NewRequest("GET", "https://example.com"+tc.path, nil)
		req.Header.Set("User-Agent", "GPTBot/1.0")
		w := httptest.NewRecorder()

		x.ServeHTTP(w, req, next)

		if next.called != tc.want {
			t.Errorf("path %q: next.called = %v, want %v", tc.path, next.called, tc.want)
		}
	}
}

func TestHandler_DryRun_PassThrough(t *testing.T) {
	x := newTestX402(t)
	x.DryRun = true
	next := &mockHandler{}

	// Create a valid payment header.
	payload := PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-sepolia",
	}
	data, _ := json.Marshal(payload)
	paymentHeader := base64.StdEncoding.EncodeToString(data)

	req := httptest.NewRequest("GET", "https://example.com/page", nil)
	req.Header.Set("User-Agent", "GPTBot/1.0")
	req.Header.Set("X-PAYMENT", paymentHeader)
	w := httptest.NewRecorder()

	err := x.ServeHTTP(w, req, next)
	if err != nil {
		t.Fatal(err)
	}
	if !next.called {
		t.Error("expected next handler to be called in dry run mode")
	}

	// Check X-PAYMENT-RESPONSE header is set.
	if xpr := w.Header().Get("X-PAYMENT-RESPONSE"); xpr == "" {
		t.Error("expected X-PAYMENT-RESPONSE header in dry run mode")
	}

	// Check Cloudflare charged headers.
	if cc := w.Header().Get("crawler-charged"); cc != "0.01" {
		t.Errorf("crawler-charged = %q, want 0.01", cc)
	}
}

func TestHandler_Crawler_InvalidPayment_Returns402(t *testing.T) {
	x := newTestX402(t)
	next := &mockHandler{}

	req := httptest.NewRequest("GET", "https://example.com/page", nil)
	req.Header.Set("User-Agent", "GPTBot/1.0")
	req.Header.Set("X-PAYMENT", "not-valid-base64!!!")
	w := httptest.NewRecorder()

	err := x.ServeHTTP(w, req, next)
	if err != nil {
		t.Fatal(err)
	}
	if next.called {
		t.Error("next handler should NOT be called for invalid payment")
	}
	if w.Code != http.StatusPaymentRequired {
		t.Errorf("status = %d, want 402", w.Code)
	}
}

func TestIsExempt(t *testing.T) {
	x := &X402{
		exemptGlobs: []string{
			"/robots.txt",
			"/favicon.ico",
			"/.well-known/*",
			"/metrix*",
		},
	}

	tests := []struct {
		path string
		want bool
	}{
		{"/robots.txt", true},
		{"/favicon.ico", true},
		{"/.well-known/something", true},
		{"/.well-known/acme-challenge/token", true},
		{"/metrix", true},
		{"/metrix-something", true},
		{"/page", false},
		{"/", false},
		{"/about", false},
	}

	for _, tc := range tests {
		got := x.isExempt(tc.path)
		if got != tc.want {
			t.Errorf("isExempt(%q) = %v, want %v", tc.path, got, tc.want)
		}
	}
}

// Verify the handler properly integrates with a mock facilitator.
func TestHandler_FullFlow_WithMockFacilitator(t *testing.T) {
	// Set up mock facilitator.
	facilitatorServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/verify":
			json.NewEncoder(w).Encode(VerifyResponse{
				IsValid: true,
				Payer:   "0xPAYER",
			})
		case "/settle":
			json.NewEncoder(w).Encode(SettlementResponse{
				Success:     true,
				Transaction: "0xTXHASH",
				Network:     "base-sepolia",
				Payer:       "0xPAYER",
			})
		}
	}))
	defer facilitatorServer.Close()

	x := newTestX402(t)
	x.facilitator = newTestFacilitatorClient(facilitatorServer.URL)
	next := &mockHandler{}

	// Create payment header.
	payload := PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-sepolia",
		Payload:     json.RawMessage(`{"signature":"0x123","authorization":{}}`),
	}
	data, _ := json.Marshal(payload)
	paymentHeader := base64.StdEncoding.EncodeToString(data)

	req := httptest.NewRequest("GET", "https://example.com/page", nil)
	req.Header.Set("User-Agent", "GPTBot/1.0")
	req.Header.Set("X-PAYMENT", paymentHeader)
	w := httptest.NewRecorder()

	err := x.ServeHTTP(w, req, next)
	if err != nil {
		t.Fatal(err)
	}
	if !next.called {
		t.Error("expected next handler to be called after successful payment")
	}

	// Check X-PAYMENT-RESPONSE header.
	xpr := w.Header().Get("X-PAYMENT-RESPONSE")
	if xpr == "" {
		t.Fatal("expected X-PAYMENT-RESPONSE header")
	}

	// Decode and verify.
	decoded, err := base64.StdEncoding.DecodeString(xpr)
	if err != nil {
		t.Fatal(err)
	}

	var settlement SettlementResponse
	if err := json.Unmarshal(decoded, &settlement); err != nil {
		t.Fatal(err)
	}
	if !settlement.Success {
		t.Error("expected settlement success")
	}
	if settlement.Transaction != "0xTXHASH" {
		t.Errorf("transaction = %q", settlement.Transaction)
	}
}

func TestHandler_OversizedPaymentHeader_Returns402(t *testing.T) {
	x := newTestX402(t)
	next := &mockHandler{}

	// Create a payment header that exceeds maxPaymentHeaderSize.
	oversized := make([]byte, maxPaymentHeaderSize+1)
	for i := range oversized {
		oversized[i] = 'A'
	}

	req := httptest.NewRequest("GET", "https://example.com/page", nil)
	req.Header.Set("User-Agent", "GPTBot/1.0")
	req.Header.Set("X-PAYMENT", string(oversized))
	w := httptest.NewRecorder()

	err := x.ServeHTTP(w, req, next)
	if err != nil {
		t.Fatal(err)
	}
	if next.called {
		t.Error("next handler should NOT be called for oversized payment header")
	}
	if w.Code != http.StatusPaymentRequired {
		t.Errorf("status = %d, want 402", w.Code)
	}
}

func TestHandler_FailClosed_OnBuildError(t *testing.T) {
	detector, err := NewCrawlerDetector(nil)
	if err != nil {
		t.Fatal(err)
	}

	// Config with invalid network — buildPaymentRequirements will fail.
	x := &X402{
		Config: Config{
			PayTo:             "0x1234567890abcdef1234567890abcdef12345678",
			Price:             "0.01",
			Network:           "invalid-network",
			MaxTimeoutSeconds: 60,
			CloudflareCompat:  true,
		},
		logger:  zap.NewNop(),
		crawler: detector,
	}

	next := &mockHandler{}
	req := httptest.NewRequest("GET", "https://example.com/page", nil)
	req.Header.Set("User-Agent", "GPTBot/1.0")
	w := httptest.NewRecorder()

	x.ServeHTTP(w, req, next)

	if next.called {
		t.Error("next handler should NOT be called when build fails — must fail closed")
	}
	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500 (fail closed)", w.Code)
	}
}

func TestHandler_PathTraversal_Cleaned(t *testing.T) {
	x := newTestX402(t)
	x.exemptGlobs = []string{"/safe"}
	next := &mockHandler{}

	// Path traversal attempt: /../safe should be cleaned to /safe.
	req := httptest.NewRequest("GET", "https://example.com/../safe", nil)
	req.Header.Set("User-Agent", "GPTBot/1.0")
	w := httptest.NewRecorder()

	x.ServeHTTP(w, req, next)

	if !next.called {
		t.Error("expected pass-through after path cleaning resolves to exempt path")
	}
}

// Ensure the handler interface is properly satisfied.
var _ caddyhttp.MiddlewareHandler = (*X402)(nil)
