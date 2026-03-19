package caddyx402

import (
	"encoding/base64"
	"encoding/json"
	"net/http/httptest"
	"testing"
)

func TestPriceToAtomicUnits(t *testing.T) {
	tests := []struct {
		price string
		want  string
	}{
		{"0.01", "10000"},
		{"1", "1000000"},
		{"0.001", "1000"},
		{"0.000001", "1"},
		{"10", "10000000"},
		{"0.1", "100000"},
		{"100", "100000000"},
		{"0.123456", "123456"},
	}

	for _, tc := range tests {
		got, err := priceToAtomicUnits(tc.price)
		if err != nil {
			t.Errorf("priceToAtomicUnits(%q) error: %v", tc.price, err)
			continue
		}
		if got != tc.want {
			t.Errorf("priceToAtomicUnits(%q) = %q, want %q", tc.price, got, tc.want)
		}
	}
}

func TestPriceToAtomicUnits_Invalid(t *testing.T) {
	invalid := []string{
		"",
		"-1",
		"abc",
		"1.2.3",
		"-0.01",
		"0",
		"0.000000",
		"0.0",
		".01",
		"1e5",
		"1,000",
	}

	for _, price := range invalid {
		_, err := priceToAtomicUnits(price)
		if err == nil {
			t.Errorf("priceToAtomicUnits(%q) expected error, got nil", price)
		}
	}
}

func TestBuildPaymentRequirements(t *testing.T) {
	cfg := Config{
		PayTo:             "0x1234567890abcdef1234567890abcdef12345678",
		Price:             "0.01",
		Network:           "base-sepolia",
		Description:       "Test resource",
		MaxTimeoutSeconds: 60,
	}

	reqs, err := buildPaymentRequirements(cfg, "https://example.com/page")
	if err != nil {
		t.Fatal(err)
	}

	if reqs.Scheme != "exact" {
		t.Errorf("scheme = %q, want exact", reqs.Scheme)
	}
	if reqs.MaxAmountRequired != "10000" {
		t.Errorf("maxAmountRequired = %q, want 10000", reqs.MaxAmountRequired)
	}
	if reqs.Asset != "0x036CbD53842c5426634e7929541eC2318f3dCF7e" {
		t.Errorf("asset = %q, want USDC on base-sepolia", reqs.Asset)
	}
	if reqs.PayTo != cfg.PayTo {
		t.Errorf("payTo = %q, want %q", reqs.PayTo, cfg.PayTo)
	}
	if reqs.Resource != "https://example.com/page" {
		t.Errorf("resource = %q", reqs.Resource)
	}
}

func TestBuildPaymentRequirements_UnsupportedNetwork(t *testing.T) {
	cfg := Config{
		PayTo:   "0x1234567890abcdef1234567890abcdef12345678",
		Price:   "0.01",
		Network: "ethereum",
	}

	_, err := buildPaymentRequirements(cfg, "https://example.com/page")
	if err == nil {
		t.Error("expected error for unsupported network")
	}
}

func TestWritePaymentRequired(t *testing.T) {
	reqs := PaymentRequirements{
		Scheme:            "exact",
		Network:           "base-sepolia",
		MaxAmountRequired: "10000",
		Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
		PayTo:             "0x1234567890abcdef1234567890abcdef12345678",
		Resource:          "https://example.com/page",
		Description:       "Test",
		MaxTimeoutSeconds: 60,
		Extra:             map[string]interface{}{"name": "USDC", "version": "2"},
	}

	w := httptest.NewRecorder()
	err := writePaymentRequired(w, reqs, "Payment required")
	if err != nil {
		t.Fatal(err)
	}

	if w.Code != 402 {
		t.Errorf("status = %d, want 402", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("content-type = %q, want application/json", ct)
	}

	var resp PaymentRequirementsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.X402Version != 1 {
		t.Errorf("x402Version = %d, want 1", resp.X402Version)
	}
	if len(resp.Accepts) != 1 {
		t.Fatalf("accepts length = %d, want 1", len(resp.Accepts))
	}
	if resp.Accepts[0].MaxAmountRequired != "10000" {
		t.Errorf("maxAmountRequired = %q", resp.Accepts[0].MaxAmountRequired)
	}
}

func TestDecodePaymentHeader(t *testing.T) {
	payload := PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-sepolia",
	}
	data, _ := json.Marshal(payload)
	encoded := base64.StdEncoding.EncodeToString(data)

	decoded, err := decodePaymentHeader(encoded)
	if err != nil {
		t.Fatal(err)
	}
	if decoded.X402Version != 1 {
		t.Errorf("x402Version = %d", decoded.X402Version)
	}
	if decoded.Scheme != "exact" {
		t.Errorf("scheme = %q", decoded.Scheme)
	}
}

func TestDecodePaymentHeader_Invalid(t *testing.T) {
	_, err := decodePaymentHeader("not-valid-base64!!!")
	if err == nil {
		t.Error("expected error for invalid base64")
	}
}

func TestEncodeSettlementResponse(t *testing.T) {
	resp := &SettlementResponse{
		Success:     true,
		Transaction: "0xabc",
		Network:     "base-sepolia",
		Payer:       "0x123",
	}

	encoded, err := encodeSettlementResponse(resp)
	if err != nil {
		t.Fatal(err)
	}

	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatal(err)
	}

	var decoded SettlementResponse
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	if !decoded.Success {
		t.Error("expected success=true")
	}
	if decoded.Transaction != "0xabc" {
		t.Errorf("transaction = %q", decoded.Transaction)
	}
}

func TestIsValidEVMAddress(t *testing.T) {
	tests := []struct {
		addr string
		want bool
	}{
		{"0x1234567890abcdef1234567890abcdef12345678", true},
		{"0xABCDEF1234567890abcdef1234567890ABCDEF12", true},
		{"0x123", false},
		{"1234567890abcdef1234567890abcdef12345678", false},
		{"", false},
		{"0x", false},
		{"0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", false},
	}

	for _, tc := range tests {
		got := isValidEVMAddress(tc.addr)
		if got != tc.want {
			t.Errorf("isValidEVMAddress(%q) = %v, want %v", tc.addr, got, tc.want)
		}
	}
}

func TestIsSecureURL(t *testing.T) {
	tests := []struct {
		url  string
		want bool
	}{
		{"https://x402.org/facilitator", true},
		{"http://localhost:8080/facilitator", true},
		{"http://127.0.0.1:8080/facilitator", true},
		{"http://[::1]:8080/facilitator", true},
		{"http://evil.com/facilitator", false},
		{"http://x402.org/facilitator", false},
		{"ftp://x402.org", false},
	}

	for _, tc := range tests {
		got := isSecureURL(tc.url)
		if got != tc.want {
			t.Errorf("isSecureURL(%q) = %v, want %v", tc.url, got, tc.want)
		}
	}
}
