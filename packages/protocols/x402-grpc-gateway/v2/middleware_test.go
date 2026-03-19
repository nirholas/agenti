package x402

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// MockVerifier is a mock implementation of ChainVerifier for testing.
type MockVerifier struct {
	VerifyFunc func(ctx context.Context, payload *PaymentPayload, requirements *PaymentRequirements) (*VerificationResult, error)
	SettleFunc func(ctx context.Context, payload *PaymentPayload, requirements *PaymentRequirements) (*SettlementResult, error)
}

func (m *MockVerifier) Verify(ctx context.Context, payload *PaymentPayload, requirements *PaymentRequirements) (*VerificationResult, error) {
	if m.VerifyFunc != nil {
		return m.VerifyFunc(ctx, payload, requirements)
	}
	return &VerificationResult{Valid: true, PayerAddress: "0xtest", Amount: "1000000"}, nil
}

func (m *MockVerifier) Settle(ctx context.Context, payload *PaymentPayload, requirements *PaymentRequirements) (*SettlementResult, error) {
	if m.SettleFunc != nil {
		return m.SettleFunc(ctx, payload, requirements)
	}
	return &SettlementResult{TransactionHash: "0xtxhash", Status: "success", Network: "eip155:84532"}, nil
}

func (m *MockVerifier) SupportedKinds() []SupportedKind {
	return []SupportedKind{
		{Scheme: "exact", Network: "eip155:84532"},
	}
}

func testConfig() Config {
	return Config{
		Verifier: &MockVerifier{},
		EndpointPricing: map[string]PricingRule{
			"/v1/paid": {
				AcceptedTokens: []TokenRequirement{
					{
						Network:       "eip155:84532",
						Symbol:        "USDC",
						AssetContract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
						Recipient:     "0xRecipient",
						Amount:        "1000000",
					},
				},
			},
		},
	}
}

func makeV2PaymentHeader(t *testing.T) string {
	t.Helper()
	payload := PaymentPayload{
		X402Version: 2,
		Accepted: PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:84532",
			Amount:  "1000000",
			Asset:   "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
			PayTo:   "0xRecipient",
		},
		Payload: map[string]interface{}{
			"signature": "0xsig123",
			"authorization": map[string]interface{}{
				"from":        "0xPayer",
				"to":          "0xRecipient",
				"value":       "1000000",
				"validAfter":  0,
				"validBefore": 9999999999,
				"nonce":       "0xnonce123",
			},
		},
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("failed to marshal V2 payload: %v", err)
	}
	return base64.StdEncoding.EncodeToString(payloadJSON)
}

func makeV1PaymentHeader(t *testing.T) string {
	t.Helper()
	legacy := LegacyPayment{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-sepolia",
		Payload: map[string]interface{}{
			"signature": "0xsig123",
			"authorization": map[string]interface{}{
				"from":        "0xPayer",
				"to":          "0xRecipient",
				"value":       "1000000",
				"validAfter":  0,
				"validBefore": 9999999999,
				"nonce":       "0xnonce123",
			},
		},
	}

	legacyJSON, err := json.Marshal(legacy)
	if err != nil {
		t.Fatalf("failed to marshal V1 payment: %v", err)
	}
	return base64.StdEncoding.EncodeToString(legacyJSON)
}

// --- Middleware tests ---

func TestPaymentMiddleware_NoPaymentRequired(t *testing.T) {
	cfg := testConfig()

	handler := PaymentMiddleware(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("success"))
	}))

	req := httptest.NewRequest("GET", "/v1/free", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	if w.Body.String() != "success" {
		t.Errorf("expected body 'success', got %s", w.Body.String())
	}
}

func TestPaymentMiddleware_MissingPayment(t *testing.T) {
	cfg := testConfig()

	handler := PaymentMiddleware(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/v1/paid", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusPaymentRequired {
		t.Errorf("expected status 402, got %d", w.Code)
	}

	var response PaymentRequiredResponse
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if response.X402Version != 2 {
		t.Errorf("expected x402Version 2, got %d", response.X402Version)
	}
	if response.Error == "" {
		t.Error("expected error message")
	}
	if len(response.Accepts) == 0 {
		t.Error("expected accepts list")
	}

	accept := response.Accepts[0]
	if accept.Scheme != "exact" {
		t.Errorf("expected scheme 'exact', got %s", accept.Scheme)
	}
	if accept.Network != "eip155:84532" {
		t.Errorf("expected network 'eip155:84532', got %s", accept.Network)
	}
	if accept.Amount != "1000000" {
		t.Errorf("expected amount '1000000', got %s", accept.Amount)
	}
	if accept.Asset != "0x036CbD53842c5426634e7929541eC2318f3dCF7e" {
		t.Errorf("expected asset contract, got %s", accept.Asset)
	}
	if accept.PayTo != "0xRecipient" {
		t.Errorf("expected payTo '0xRecipient', got %s", accept.PayTo)
	}
}

func TestPaymentMiddleware_402_IncludesPaymentRequiredHeader(t *testing.T) {
	cfg := testConfig()

	handler := PaymentMiddleware(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/v1/paid", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusPaymentRequired {
		t.Fatalf("expected status 402, got %d", w.Code)
	}

	headerVal := w.Header().Get(HeaderPaymentRequired)
	if headerVal == "" {
		t.Fatal("expected PAYMENT-REQUIRED header to be set")
	}

	decoded, err := base64.StdEncoding.DecodeString(headerVal)
	if err != nil {
		t.Fatalf("PAYMENT-REQUIRED header is not valid base64: %v", err)
	}

	var response PaymentRequiredResponse
	if err := json.Unmarshal(decoded, &response); err != nil {
		t.Fatalf("PAYMENT-REQUIRED header is not valid JSON: %v", err)
	}

	if response.X402Version != 2 {
		t.Errorf("expected x402Version 2 in header, got %d", response.X402Version)
	}
	if len(response.Accepts) == 0 {
		t.Error("expected accepts list in header")
	}
}

func TestPaymentMiddleware_V2Header_ValidPayment(t *testing.T) {
	verifier := &MockVerifier{
		VerifyFunc: func(ctx context.Context, payload *PaymentPayload, requirements *PaymentRequirements) (*VerificationResult, error) {
			return &VerificationResult{
				Valid:        true,
				PayerAddress: "0xPayer",
				Amount:       "1000000",
				TokenSymbol:  "USDC",
			}, nil
		},
		SettleFunc: func(ctx context.Context, payload *PaymentPayload, requirements *PaymentRequirements) (*SettlementResult, error) {
			return &SettlementResult{
				TransactionHash:  "0xtxhash123",
				Status:           "success",
				Amount:           "1000000",
				PayerAddress:     "0xPayer",
				RecipientAddress: "0xRecipient",
				Network:          "eip155:84532",
				SettledAt:        time.Now(),
			}, nil
		},
	}

	cfg := Config{
		Verifier: verifier,
		EndpointPricing: map[string]PricingRule{
			"/v1/paid": {
				AcceptedTokens: []TokenRequirement{
					{Network: "eip155:84532", Symbol: "USDC", AssetContract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", Recipient: "0xRecipient", Amount: "1000000"},
				},
			},
		},
	}

	var capturedPayment *PaymentContext
	handler := PaymentMiddleware(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payment, ok := GetPaymentFromContext(r.Context())
		if !ok {
			t.Error("payment context not found")
		}
		capturedPayment = payment
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("success"))
	}))

	req := httptest.NewRequest("GET", "/v1/paid", nil)
	req.Header.Set(HeaderPaymentSignature, makeV2PaymentHeader(t))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	if capturedPayment == nil {
		t.Fatal("payment context was not captured")
	}
	if !capturedPayment.Verified {
		t.Error("payment should be verified")
	}
	if capturedPayment.PayerAddress != "0xPayer" {
		t.Errorf("expected payer '0xPayer', got %s", capturedPayment.PayerAddress)
	}
	if capturedPayment.TransactionHash != "0xtxhash123" {
		t.Errorf("expected tx hash '0xtxhash123', got %s", capturedPayment.TransactionHash)
	}
	if capturedPayment.Network != "eip155:84532" {
		t.Errorf("expected network 'eip155:84532', got %s", capturedPayment.Network)
	}

	// V2 clients should receive PAYMENT-RESPONSE header (not X-PAYMENT-RESPONSE)
	responseHeader := w.Header().Get(HeaderPaymentResponse)
	if responseHeader == "" {
		t.Error("expected PAYMENT-RESPONSE header for V2 client")
	}
	legacyHeader := w.Header().Get(HeaderLegacyPaymentResponse)
	if legacyHeader != "" {
		t.Error("V2 client should NOT receive X-PAYMENT-RESPONSE header")
	}

	// Decode and verify response header
	resp, err := DecodePaymentResponse(responseHeader)
	if err != nil {
		t.Fatalf("failed to decode payment response: %v", err)
	}
	if !resp.Success {
		t.Error("expected success=true in payment response")
	}
	if resp.Transaction != "0xtxhash123" {
		t.Errorf("expected transaction '0xtxhash123', got %s", resp.Transaction)
	}
	if resp.Network != "eip155:84532" {
		t.Errorf("expected network 'eip155:84532', got %s", resp.Network)
	}
	if resp.Payer != "0xPayer" {
		t.Errorf("expected payer '0xPayer', got %s", resp.Payer)
	}
}

func TestPaymentMiddleware_V1Header_Fallback(t *testing.T) {
	verifier := &MockVerifier{
		VerifyFunc: func(ctx context.Context, payload *PaymentPayload, requirements *PaymentRequirements) (*VerificationResult, error) {
			// Verify the payload was correctly converted from V1 to V2 format
			if payload.X402Version != 1 {
				t.Errorf("expected x402Version 1, got %d", payload.X402Version)
			}
			if payload.Accepted.Scheme != "exact" {
				t.Errorf("expected accepted scheme 'exact', got %s", payload.Accepted.Scheme)
			}
			if payload.Accepted.Network != "base-sepolia" {
				t.Errorf("expected accepted network 'base-sepolia', got %s", payload.Accepted.Network)
			}
			// Requirements fields should be populated from config
			if payload.Accepted.Amount != "1000000" {
				t.Errorf("expected accepted amount '1000000', got %s", payload.Accepted.Amount)
			}
			if payload.Accepted.PayTo != "0xRecipient" {
				t.Errorf("expected accepted payTo '0xRecipient', got %s", payload.Accepted.PayTo)
			}

			return &VerificationResult{
				Valid:        true,
				PayerAddress: "0xPayer",
				Amount:       "1000000",
				TokenSymbol:  "USDC",
			}, nil
		},
		SettleFunc: func(ctx context.Context, payload *PaymentPayload, requirements *PaymentRequirements) (*SettlementResult, error) {
			return &SettlementResult{
				TransactionHash:  "0xtxhash456",
				Status:           "success",
				Amount:           "1000000",
				PayerAddress:     "0xPayer",
				RecipientAddress: "0xRecipient",
				Network:          "eip155:84532",
				SettledAt:        time.Now(),
			}, nil
		},
	}

	cfg := Config{
		Verifier: verifier,
		EndpointPricing: map[string]PricingRule{
			"/v1/paid": {
				AcceptedTokens: []TokenRequirement{
					{Network: "eip155:84532", Symbol: "USDC", AssetContract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", Recipient: "0xRecipient", Amount: "1000000"},
				},
			},
		},
	}

	handler := PaymentMiddleware(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/v1/paid", nil)
	req.Header.Set(HeaderLegacyPayment, makeV1PaymentHeader(t))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	// V1 clients should receive X-PAYMENT-RESPONSE header (not PAYMENT-RESPONSE)
	legacyHeader := w.Header().Get(HeaderLegacyPaymentResponse)
	if legacyHeader == "" {
		t.Error("expected X-PAYMENT-RESPONSE header for V1 client")
	}
	v2Header := w.Header().Get(HeaderPaymentResponse)
	if v2Header != "" {
		t.Error("V1 client should NOT receive PAYMENT-RESPONSE header")
	}
}

func TestPaymentMiddleware_InvalidV2Header(t *testing.T) {
	cfg := testConfig()

	handler := PaymentMiddleware(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/v1/paid", nil)
	req.Header.Set(HeaderPaymentSignature, "not-valid-base64!!!")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for invalid header, got %d", w.Code)
	}
}

func TestPaymentMiddleware_V2Header_VersionTooLow(t *testing.T) {
	cfg := testConfig()

	handler := PaymentMiddleware(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// V2 header with x402Version=1 should be rejected
	payload := PaymentPayload{
		X402Version: 1,
		Accepted: PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:84532",
		},
		Payload: map[string]interface{}{"signature": "0xsig"},
	}
	payloadJSON, _ := json.Marshal(payload)
	encoded := base64.StdEncoding.EncodeToString(payloadJSON)

	req := httptest.NewRequest("GET", "/v1/paid", nil)
	req.Header.Set(HeaderPaymentSignature, encoded)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for version too low, got %d", w.Code)
	}
}

func TestPaymentMiddleware_VerificationFailed(t *testing.T) {
	verifier := &MockVerifier{
		VerifyFunc: func(ctx context.Context, payload *PaymentPayload, requirements *PaymentRequirements) (*VerificationResult, error) {
			return &VerificationResult{Valid: false, Reason: "insufficient balance"}, nil
		},
	}

	cfg := Config{
		Verifier: verifier,
		EndpointPricing: map[string]PricingRule{
			"/v1/paid": {
				AcceptedTokens: []TokenRequirement{
					{Network: "eip155:84532", Symbol: "USDC", AssetContract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", Recipient: "0xRecipient", Amount: "1000000"},
				},
			},
		},
	}

	handler := PaymentMiddleware(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/v1/paid", nil)
	req.Header.Set(HeaderPaymentSignature, makeV2PaymentHeader(t))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusPaymentRequired {
		t.Errorf("expected status 402, got %d", w.Code)
	}
}

func TestPaymentMiddleware_SkipPaths(t *testing.T) {
	cfg := Config{
		Verifier: &MockVerifier{},
		EndpointPricing: map[string]PricingRule{
			"/*": {
				AcceptedTokens: []TokenRequirement{
					{Network: "eip155:84532", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc", Amount: "1000000"},
				},
			},
		},
		SkipPaths: []string{"/health", "/readyz"},
	}

	handler := PaymentMiddleware(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))

	for _, path := range []string{"/health", "/readyz"} {
		req := httptest.NewRequest("GET", path, nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("path %s: expected status 200, got %d", path, w.Code)
		}
	}
}

func TestPaymentMiddleware_CustomPaywallHTML(t *testing.T) {
	cfg := Config{
		Verifier: &MockVerifier{},
		EndpointPricing: map[string]PricingRule{
			"/v1/paid": {
				AcceptedTokens: []TokenRequirement{
					{Network: "eip155:84532", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc", Amount: "1000000"},
				},
			},
		},
		CustomPaywallHTML: "<html><body>Pay up!</body></html>",
	}

	handler := PaymentMiddleware(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/v1/paid", nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64)")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusPaymentRequired {
		t.Errorf("expected status 402, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "text/html; charset=utf-8" {
		t.Errorf("expected html content type, got %s", ct)
	}
	if w.Body.String() != "<html><body>Pay up!</body></html>" {
		t.Errorf("expected custom paywall html, got %s", w.Body.String())
	}
}

// --- Encoding/Decoding tests ---

func TestEncodeDecodePaymentPayload(t *testing.T) {
	payload := &PaymentPayload{
		X402Version: 2,
		Accepted: PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:84532",
			Amount:  "1000000",
			Asset:   "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
			PayTo:   "0xRecipient",
		},
		Payload: map[string]interface{}{
			"signature": "0xsig",
			"authorization": map[string]interface{}{
				"from":  "0xPayer",
				"to":    "0xRecipient",
				"value": "1000000",
				"nonce": "0xnonce",
			},
		},
	}

	encoded, err := EncodePaymentPayload(payload)
	if err != nil {
		t.Fatalf("failed to encode: %v", err)
	}

	// Verify it's valid base64
	jsonBytes, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatalf("not valid base64: %v", err)
	}

	// Verify it round-trips
	var decoded PaymentPayload
	if err := json.Unmarshal(jsonBytes, &decoded); err != nil {
		t.Fatalf("not valid JSON: %v", err)
	}

	if decoded.X402Version != 2 {
		t.Errorf("version mismatch: expected 2, got %d", decoded.X402Version)
	}
	if decoded.Accepted.Scheme != "exact" {
		t.Errorf("scheme mismatch: expected 'exact', got %s", decoded.Accepted.Scheme)
	}
	if decoded.Accepted.Network != "eip155:84532" {
		t.Errorf("network mismatch: expected 'eip155:84532', got %s", decoded.Accepted.Network)
	}
	if decoded.Accepted.Amount != "1000000" {
		t.Errorf("amount mismatch: expected '1000000', got %s", decoded.Accepted.Amount)
	}
}

func TestDecodePaymentResponse(t *testing.T) {
	resp := &PaymentResponse{
		Success:     true,
		Transaction: "0xtxhash",
		Network:     "eip155:8453",
		Payer:       "0xPayer",
	}

	respJSON, _ := json.Marshal(resp)
	encoded := base64.StdEncoding.EncodeToString(respJSON)

	decoded, err := DecodePaymentResponse(encoded)
	if err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	if !decoded.Success {
		t.Error("expected success=true")
	}
	if decoded.Transaction != "0xtxhash" {
		t.Errorf("expected transaction '0xtxhash', got %s", decoded.Transaction)
	}
	if decoded.Network != "eip155:8453" {
		t.Errorf("expected network 'eip155:8453', got %s", decoded.Network)
	}
	if decoded.Payer != "0xPayer" {
		t.Errorf("expected payer '0xPayer', got %s", decoded.Payer)
	}
}

func TestDecodePaymentResponse_InvalidBase64(t *testing.T) {
	_, err := DecodePaymentResponse("not-valid-base64!!!")
	if err == nil {
		t.Error("expected error for invalid base64")
	}
}

func TestDecodePaymentResponse_InvalidJSON(t *testing.T) {
	encoded := base64.StdEncoding.EncodeToString([]byte("not json"))
	_, err := DecodePaymentResponse(encoded)
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}

func TestParsePaymentPayload_Valid(t *testing.T) {
	payload := PaymentPayload{
		X402Version: 2,
		Accepted: PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:84532",
		},
		Payload: map[string]interface{}{"signature": "0xsig"},
	}

	payloadJSON, _ := json.Marshal(payload)
	encoded := base64.StdEncoding.EncodeToString(payloadJSON)

	parsed, err := parsePaymentPayload(encoded)
	if err != nil {
		t.Fatalf("failed to parse: %v", err)
	}

	if parsed.X402Version != 2 {
		t.Errorf("expected version 2, got %d", parsed.X402Version)
	}
}

func TestParsePaymentPayload_VersionTooLow(t *testing.T) {
	payload := map[string]interface{}{
		"x402Version": 1,
		"accepted":    map[string]interface{}{"scheme": "exact"},
		"payload":     map[string]interface{}{"sig": "0x"},
	}

	payloadJSON, _ := json.Marshal(payload)
	encoded := base64.StdEncoding.EncodeToString(payloadJSON)

	_, err := parsePaymentPayload(encoded)
	if err == nil {
		t.Error("expected error for version < 2")
	}
}

func TestParsePaymentPayload_MissingPayload(t *testing.T) {
	payload := map[string]interface{}{
		"x402Version": 2,
		"accepted":    map[string]interface{}{"scheme": "exact"},
	}

	payloadJSON, _ := json.Marshal(payload)
	encoded := base64.StdEncoding.EncodeToString(payloadJSON)

	_, err := parsePaymentPayload(encoded)
	if err == nil {
		t.Error("expected error for missing payload")
	}
}

func TestParseLegacyPayment_Valid(t *testing.T) {
	legacy := LegacyPayment{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-sepolia",
		Payload:     map[string]interface{}{"signature": "0xsig"},
	}

	legacyJSON, _ := json.Marshal(legacy)
	encoded := base64.StdEncoding.EncodeToString(legacyJSON)

	requirements := &PaymentRequirements{
		Amount: "500000",
		Asset:  "0xAsset",
		PayTo:  "0xRecipient",
	}

	parsed, err := parseLegacyPayment(encoded, requirements)
	if err != nil {
		t.Fatalf("failed to parse: %v", err)
	}

	if parsed.X402Version != 1 {
		t.Errorf("expected version 1, got %d", parsed.X402Version)
	}
	if parsed.Accepted.Scheme != "exact" {
		t.Errorf("expected scheme 'exact', got %s", parsed.Accepted.Scheme)
	}
	if parsed.Accepted.Network != "base-sepolia" {
		t.Errorf("expected network 'base-sepolia', got %s", parsed.Accepted.Network)
	}
	// Requirements fields should be copied
	if parsed.Accepted.Amount != "500000" {
		t.Errorf("expected amount '500000', got %s", parsed.Accepted.Amount)
	}
	if parsed.Accepted.Asset != "0xAsset" {
		t.Errorf("expected asset '0xAsset', got %s", parsed.Accepted.Asset)
	}
	if parsed.Accepted.PayTo != "0xRecipient" {
		t.Errorf("expected payTo '0xRecipient', got %s", parsed.Accepted.PayTo)
	}
}

func TestParseLegacyPayment_ValidationErrors(t *testing.T) {
	tests := []struct {
		name    string
		legacy  map[string]interface{}
		wantErr string
	}{
		{
			name:    "missing version",
			legacy:  map[string]interface{}{"scheme": "exact", "network": "base-sepolia", "payload": map[string]interface{}{}},
			wantErr: "x402Version is required",
		},
		{
			name:    "missing scheme",
			legacy:  map[string]interface{}{"x402Version": 1, "network": "base-sepolia", "payload": map[string]interface{}{}},
			wantErr: "scheme is required",
		},
		{
			name:    "missing network",
			legacy:  map[string]interface{}{"x402Version": 1, "scheme": "exact", "payload": map[string]interface{}{}},
			wantErr: "network is required",
		},
		{
			name:    "missing payload",
			legacy:  map[string]interface{}{"x402Version": 1, "scheme": "exact", "network": "base-sepolia"},
			wantErr: "payload is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			legacyJSON, _ := json.Marshal(tt.legacy)
			encoded := base64.StdEncoding.EncodeToString(legacyJSON)

			_, err := parseLegacyPayment(encoded, nil)
			if err == nil {
				t.Errorf("expected error containing %q, got nil", tt.wantErr)
			}
		})
	}
}

func TestReadPaymentRequirements_FromHeader(t *testing.T) {
	requirements := PaymentRequiredResponse{
		X402Version: 2,
		Error:       "Payment required",
		Accepts: []PaymentRequirements{
			{
				Scheme:  "exact",
				Network: "eip155:84532",
				Amount:  "1000000",
				Asset:   "0xAsset",
				PayTo:   "0xRecipient",
			},
		},
	}

	reqJSON, _ := json.Marshal(requirements)
	encoded := base64.StdEncoding.EncodeToString(reqJSON)

	resp := &http.Response{
		StatusCode: http.StatusPaymentRequired,
		Header:     http.Header{},
	}
	resp.Header.Set(HeaderPaymentRequired, encoded)

	parsed, err := ReadPaymentRequirements(resp)
	if err != nil {
		t.Fatalf("failed to read requirements: %v", err)
	}

	if parsed.X402Version != 2 {
		t.Errorf("expected version 2, got %d", parsed.X402Version)
	}
	if len(parsed.Accepts) != 1 {
		t.Fatalf("expected 1 accept, got %d", len(parsed.Accepts))
	}
	if parsed.Accepts[0].Network != "eip155:84532" {
		t.Errorf("expected network 'eip155:84532', got %s", parsed.Accepts[0].Network)
	}
}

func TestReadPaymentRequirements_NonPaymentRequired(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusOK,
	}

	_, err := ReadPaymentRequirements(resp)
	if err == nil {
		t.Error("expected error for non-402 status")
	}
}

// --- Context extraction tests ---

func TestGetPaymentFromContext(t *testing.T) {
	payment := &PaymentContext{
		Verified:        true,
		PayerAddress:    "0xPayer",
		Amount:          "1000000",
		TokenSymbol:     "USDC",
		Network:         "eip155:84532",
		TransactionHash: "0xtxhash",
	}

	ctx := context.WithValue(context.Background(), PaymentContextKey, payment)

	extracted, ok := GetPaymentFromContext(ctx)
	if !ok {
		t.Fatal("expected to find payment in context")
	}
	if extracted.PayerAddress != "0xPayer" {
		t.Errorf("expected payer '0xPayer', got %s", extracted.PayerAddress)
	}
	if extracted.Network != "eip155:84532" {
		t.Errorf("expected network 'eip155:84532', got %s", extracted.Network)
	}
}

func TestGetPaymentFromContext_NotFound(t *testing.T) {
	_, ok := GetPaymentFromContext(context.Background())
	if ok {
		t.Error("expected not to find payment in empty context")
	}
}

func TestRequirePayment_Valid(t *testing.T) {
	payment := &PaymentContext{
		Verified:     true,
		PayerAddress: "0xPayer",
	}

	ctx := context.WithValue(context.Background(), PaymentContextKey, payment)

	extracted, err := RequirePayment(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if extracted.PayerAddress != "0xPayer" {
		t.Errorf("expected payer '0xPayer', got %s", extracted.PayerAddress)
	}
}

func TestRequirePayment_NotFound(t *testing.T) {
	_, err := RequirePayment(context.Background())
	if err == nil {
		t.Error("expected error for missing payment context")
	}
}

func TestRequirePayment_NotVerified(t *testing.T) {
	payment := &PaymentContext{
		Verified: false,
	}

	ctx := context.WithValue(context.Background(), PaymentContextKey, payment)

	_, err := RequirePayment(ctx)
	if err == nil {
		t.Error("expected error for unverified payment")
	}
}

// --- isBrowserRequest tests ---

func TestIsBrowserRequest(t *testing.T) {
	tests := []struct {
		userAgent string
		expected  bool
	}{
		{"Mozilla/5.0 (X11; Linux x86_64)", true},
		{"Mozilla/5.0 Chrome/120.0.0.0", true},
		{"curl/7.88.1", false},
		{"Go-http-client/1.1", false},
		{"", false},
	}

	for _, tt := range tests {
		req := httptest.NewRequest("GET", "/", nil)
		if tt.userAgent != "" {
			req.Header.Set("User-Agent", tt.userAgent)
		}
		result := isBrowserRequest(req)
		if result != tt.expected {
			t.Errorf("isBrowserRequest(%q) = %v, want %v", tt.userAgent, result, tt.expected)
		}
	}
}
