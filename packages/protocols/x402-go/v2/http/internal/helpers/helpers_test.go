package helpers

import (
	"crypto/tls"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	v2 "github.com/mark3labs/x402-go/v2"
	"github.com/mark3labs/x402-go/v2/encoding"
)

func TestParsePaymentHeader(t *testing.T) {
	// Create a valid payment payload
	payload := v2.PaymentPayload{
		X402Version: 2,
		Accepted: v2.PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:84532",
			Amount:  "10000",
		},
	}

	// Encode it
	encoded, err := encoding.EncodePayment(payload)
	if err != nil {
		t.Fatalf("Failed to encode payment: %v", err)
	}

	// Create a request with the header
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-PAYMENT", encoded)

	// Parse it
	parsed, err := ParsePaymentHeader(req)
	if err != nil {
		t.Fatalf("Failed to parse payment header: %v", err)
	}

	if parsed.X402Version != 2 {
		t.Errorf("Expected X402Version 2, got %d", parsed.X402Version)
	}

	if parsed.Accepted.Network != "eip155:84532" {
		t.Errorf("Expected network eip155:84532, got %s", parsed.Accepted.Network)
	}
}

func TestParsePaymentHeader_MissingHeader(t *testing.T) {
	req := httptest.NewRequest("GET", "/test", nil)

	_, err := ParsePaymentHeader(req)
	if err != v2.ErrMalformedHeader {
		t.Errorf("Expected ErrMalformedHeader, got %v", err)
	}
}

func TestParsePaymentHeader_InvalidBase64(t *testing.T) {
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-PAYMENT", "not-valid-base64!!!")

	_, err := ParsePaymentHeader(req)
	if err == nil {
		t.Error("Expected error for invalid base64, got nil")
	}
}

func TestParsePaymentHeader_WrongVersion(t *testing.T) {
	// Create a v1 payment payload
	payload := v2.PaymentPayload{
		X402Version: 1, // Wrong version
		Accepted: v2.PaymentRequirements{
			Scheme:  "exact",
			Network: "base",
		},
	}

	encoded, _ := encoding.EncodePayment(payload)

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-PAYMENT", encoded)

	_, err := ParsePaymentHeader(req)
	if err == nil {
		t.Error("Expected error for wrong version, got nil")
	}
}

func TestSendPaymentRequired(t *testing.T) {
	w := httptest.NewRecorder()

	resource := v2.ResourceInfo{
		URL:         "https://example.com/api/data",
		Description: "Protected API endpoint",
	}

	requirements := []v2.PaymentRequirements{
		{
			Scheme:            "exact",
			Network:           "eip155:84532",
			Amount:            "10000",
			Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
			PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
			MaxTimeoutSeconds: 60,
		},
	}

	err := SendPaymentRequired(w, resource, requirements, "Payment required for access")
	if err != nil {
		t.Fatalf("SendPaymentRequired returned error: %v", err)
	}

	resp := w.Result()
	defer resp.Body.Close()

	// Check status code
	if resp.StatusCode != http.StatusPaymentRequired {
		t.Errorf("Expected status 402, got %d", resp.StatusCode)
	}

	// Check content type
	if ct := resp.Header.Get("Content-Type"); ct != "application/json" {
		t.Errorf("Expected Content-Type application/json, got %s", ct)
	}

	// Parse body
	var paymentReq v2.PaymentRequired
	if err := json.NewDecoder(resp.Body).Decode(&paymentReq); err != nil {
		t.Fatalf("Failed to decode response body: %v", err)
	}

	if paymentReq.X402Version != 2 {
		t.Errorf("Expected X402Version 2, got %d", paymentReq.X402Version)
	}

	if paymentReq.Resource.URL != "https://example.com/api/data" {
		t.Errorf("Expected resource URL, got %s", paymentReq.Resource.URL)
	}

	if len(paymentReq.Accepts) != 1 {
		t.Errorf("Expected 1 requirement, got %d", len(paymentReq.Accepts))
	}

	if paymentReq.Accepts[0].Network != "eip155:84532" {
		t.Errorf("Expected network eip155:84532, got %s", paymentReq.Accepts[0].Network)
	}
}

func TestAddPaymentResponseHeader(t *testing.T) {
	w := httptest.NewRecorder()

	settlement := &v2.SettleResponse{
		Success:     true,
		Transaction: "0x1234567890abcdef",
		Network:     "eip155:84532",
		Payer:       "0xPayerAddress",
	}

	err := AddPaymentResponseHeader(w, settlement)
	if err != nil {
		t.Fatalf("Failed to add payment response header: %v", err)
	}

	header := w.Header().Get("X-PAYMENT-RESPONSE")
	if header == "" {
		t.Error("Expected X-PAYMENT-RESPONSE header to be set")
	}

	// Decode and verify
	decoded, err := encoding.DecodeSettlement(header)
	if err != nil {
		t.Fatalf("Failed to decode settlement: %v", err)
	}

	if !decoded.Success {
		t.Error("Expected Success to be true")
	}

	if decoded.Transaction != "0x1234567890abcdef" {
		t.Errorf("Expected transaction hash, got %s", decoded.Transaction)
	}
}

func TestParsePaymentRequirements(t *testing.T) {
	// Create a mock 402 response
	paymentReq := v2.PaymentRequired{
		X402Version: 2,
		Error:       "Payment required",
		Resource: &v2.ResourceInfo{
			URL: "https://example.com/api/data",
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

	body, _ := json.Marshal(paymentReq)
	resp := &http.Response{
		StatusCode: 402,
		Body:       &nopCloser{strings.NewReader(string(body))},
	}

	parsed, err := ParsePaymentRequirements(resp)
	if err != nil {
		t.Fatalf("Failed to parse requirements: %v", err)
	}

	if len(parsed.Accepts) != 1 {
		t.Errorf("Expected 1 requirement, got %d", len(parsed.Accepts))
	}

	if parsed.Accepts[0].Network != "eip155:84532" {
		t.Errorf("Expected network eip155:84532, got %s", parsed.Accepts[0].Network)
	}
}

func TestParsePaymentRequirements_EmptyAccepts(t *testing.T) {
	paymentReq := v2.PaymentRequired{
		X402Version: 2,
		Accepts:     []v2.PaymentRequirements{},
	}

	body, _ := json.Marshal(paymentReq)
	resp := &http.Response{
		StatusCode: 402,
		Body:       &nopCloser{strings.NewReader(string(body))},
	}

	_, err := ParsePaymentRequirements(resp)
	if err == nil {
		t.Error("Expected error for empty accepts, got nil")
	}
}

func TestParsePaymentRequirements_NilResponse(t *testing.T) {
	_, err := ParsePaymentRequirements(nil)
	if err == nil {
		t.Fatal("Expected error for nil response, got nil")
	}

	// Check that it's a PaymentError with the right code
	var paymentErr *v2.PaymentError
	if !errors.As(err, &paymentErr) {
		t.Fatalf("Expected PaymentError, got %T", err)
	}

	if paymentErr.Code != v2.ErrCodeInvalidRequirements {
		t.Errorf("Expected ErrCodeInvalidRequirements, got %s", paymentErr.Code)
	}

	if !errors.Is(err, v2.ErrInvalidRequirements) {
		t.Errorf("Expected error to wrap ErrInvalidRequirements, got %v", err)
	}
}

func TestParsePaymentRequirements_NilBody(t *testing.T) {
	resp := &http.Response{
		StatusCode: 402,
		Body:       nil,
	}

	_, err := ParsePaymentRequirements(resp)
	if err == nil {
		t.Fatal("Expected error for nil body, got nil")
	}

	// Check that it's a PaymentError with the right code
	var paymentErr *v2.PaymentError
	if !errors.As(err, &paymentErr) {
		t.Fatalf("Expected PaymentError, got %T", err)
	}

	if paymentErr.Code != v2.ErrCodeInvalidRequirements {
		t.Errorf("Expected ErrCodeInvalidRequirements, got %s", paymentErr.Code)
	}
}

func TestParseSettlement(t *testing.T) {
	settlement := v2.SettleResponse{
		Success:     true,
		Transaction: "0x1234567890abcdef",
		Network:     "eip155:84532",
		Payer:       "0xPayerAddress",
	}

	encoded, _ := encoding.EncodeSettlement(settlement)

	parsed := ParseSettlement(encoded)
	if parsed == nil {
		t.Fatal("Expected settlement, got nil")
	}

	if !parsed.Success {
		t.Error("Expected Success to be true")
	}

	if parsed.Transaction != "0x1234567890abcdef" {
		t.Errorf("Expected transaction hash, got %s", parsed.Transaction)
	}
}

func TestParseSettlement_EmptyHeader(t *testing.T) {
	parsed := ParseSettlement("")
	if parsed != nil {
		t.Error("Expected nil for empty header")
	}
}

func TestParseSettlement_InvalidBase64(t *testing.T) {
	parsed := ParseSettlement("not-valid-base64!!!")
	if parsed != nil {
		t.Error("Expected nil for invalid base64")
	}
}

func TestBuildResourceURL(t *testing.T) {
	tests := []struct {
		name     string
		host     string
		uri      string
		tls      bool
		expected string
	}{
		{
			name:     "HTTP request",
			host:     "example.com",
			uri:      "/api/data",
			tls:      false,
			expected: "http://example.com/api/data",
		},
		{
			name:     "HTTPS request",
			host:     "example.com",
			uri:      "/api/secure",
			tls:      true,
			expected: "https://example.com/api/secure",
		},
		{
			name:     "With port",
			host:     "example.com:8080",
			uri:      "/api/data",
			tls:      false,
			expected: "http://example.com:8080/api/data",
		},
		{
			name:     "With query string",
			host:     "example.com",
			uri:      "/api/data?foo=bar",
			tls:      false,
			expected: "http://example.com/api/data?foo=bar",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.uri, nil)
			req.Host = tt.host
			if tt.tls {
				req.TLS = &tls.ConnectionState{}
			}

			result := BuildResourceURL(req)
			if result != tt.expected {
				t.Errorf("Expected %s, got %s", tt.expected, result)
			}
		})
	}
}

// nopCloser is a helper to create a ReadCloser from a Reader
type nopCloser struct {
	*strings.Reader
}

func (n *nopCloser) Close() error {
	return nil
}

func TestAddPaymentResponseHeader_NilSettlement(t *testing.T) {
	w := httptest.NewRecorder()

	err := AddPaymentResponseHeader(w, nil)
	if err == nil {
		t.Fatal("Expected error for nil settlement, got nil")
	}

	if !errors.Is(err, ErrNilSettlement) {
		t.Errorf("Expected error to wrap ErrNilSettlement, got %v", err)
	}

	// Verify error message contains context
	if !strings.Contains(err.Error(), "AddPaymentResponseHeader") {
		t.Errorf("Expected error to contain function name, got %v", err)
	}
}

func TestBuildPaymentHeader(t *testing.T) {
	payload := &v2.PaymentPayload{
		X402Version: 2,
		Accepted: v2.PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:84532",
			Amount:  "10000",
		},
	}

	header, err := BuildPaymentHeader(payload)
	if err != nil {
		t.Fatalf("Failed to build payment header: %v", err)
	}

	if header == "" {
		t.Error("Expected non-empty header")
	}

	// Verify we can decode it back
	decoded, err := encoding.DecodePayment(header)
	if err != nil {
		t.Fatalf("Failed to decode payment header: %v", err)
	}

	if decoded.X402Version != 2 {
		t.Errorf("Expected X402Version 2, got %d", decoded.X402Version)
	}
}

func TestBuildPaymentHeader_NilPayment(t *testing.T) {
	_, err := BuildPaymentHeader(nil)
	if err == nil {
		t.Fatal("Expected error for nil payment, got nil")
	}

	if !errors.Is(err, ErrNilPayment) {
		t.Errorf("Expected error to wrap ErrNilPayment, got %v", err)
	}

	// Verify error message contains context
	if !strings.Contains(err.Error(), "BuildPaymentHeader") {
		t.Errorf("Expected error to contain function name, got %v", err)
	}
}

func TestParsePaymentHeader_WrongVersion_ErrorCode(t *testing.T) {
	// Create a v1 payment payload
	payload := v2.PaymentPayload{
		X402Version: 1, // Wrong version
		Accepted: v2.PaymentRequirements{
			Scheme:  "exact",
			Network: "base",
		},
	}

	encoded, _ := encoding.EncodePayment(payload)

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-PAYMENT", encoded)

	_, err := ParsePaymentHeader(req)
	if err == nil {
		t.Fatal("Expected error for wrong version, got nil")
	}

	// Check that the error is a PaymentError with the correct code
	var paymentErr *v2.PaymentError
	if !errors.As(err, &paymentErr) {
		t.Fatalf("Expected PaymentError, got %T", err)
	}

	if paymentErr.Code != v2.ErrCodeUnsupportedVersion {
		t.Errorf("Expected ErrCodeUnsupportedVersion, got %s", paymentErr.Code)
	}

	// Check that it wraps ErrUnsupportedVersion
	if !errors.Is(err, v2.ErrUnsupportedVersion) {
		t.Errorf("Expected error to wrap ErrUnsupportedVersion, got %v", err)
	}
}
