package x402

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// MockVerifier is a mock implementation of ChainVerifier for testing
type MockVerifier struct {
	VerifyFunc func(ctx context.Context, payment *Payment) (*VerificationResult, error)
	SettleFunc func(ctx context.Context, payment *Payment) (*SettlementResult, error)
}

func (m *MockVerifier) Verify(ctx context.Context, payment *Payment) (*VerificationResult, error) {
	if m.VerifyFunc != nil {
		return m.VerifyFunc(ctx, payment)
	}
	return &VerificationResult{Valid: true, PayerAddress: "0xtest", Amount: "1.00"}, nil
}

func (m *MockVerifier) Settle(ctx context.Context, payment *Payment) (*SettlementResult, error) {
	if m.SettleFunc != nil {
		return m.SettleFunc(ctx, payment)
	}
	return &SettlementResult{TransactionHash: "0xtxhash", Status: "success"}, nil
}

func (m *MockVerifier) SupportedNetworks() []NetworkInfo {
	return []NetworkInfo{
		{Network: "base-sepolia", ChainID: "84532", ChainType: "evm"},
	}
}

func TestPaymentMiddleware_NoPaymentRequired(t *testing.T) {
	config := Config{
		Verifier: &MockVerifier{},
		EndpointPricing: map[string]PricingRule{
			"/v1/paid": {
				Amount: "1.00",
				AcceptedTokens: []TokenRequirement{
					{Network: "base-sepolia", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc"},
				},
			},
		},
	}

	handler := PaymentMiddleware(config)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
	config := Config{
		Verifier: &MockVerifier{},
		EndpointPricing: map[string]PricingRule{
			"/v1/paid": {
				Amount:      "1.00",
				Description: "Premium content",
				AcceptedTokens: []TokenRequirement{
					{
						Network:       "base-sepolia",
						Symbol:        "USDC",
						AssetContract: "0x123",
						Recipient:     "0xabc",
						TokenDecimals: 6,
					},
				},
			},
		},
	}

	handler := PaymentMiddleware(config)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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

	if response.Error == "" {
		t.Error("expected error message")
	}

	if len(response.PaymentRequirements) == 0 {
		t.Error("expected payment requirements")
	}

	req1 := response.PaymentRequirements[0]
	if req1.MaxAmountRequired != "1.00" {
		t.Errorf("expected amount 1.00, got %s", req1.MaxAmountRequired)
	}

	if req1.AssetContract != "0x123" {
		t.Errorf("expected asset contract 0x123, got %s", req1.AssetContract)
	}
}

func TestPaymentMiddleware_ValidPayment(t *testing.T) {
	verifier := &MockVerifier{
		VerifyFunc: func(ctx context.Context, payment *Payment) (*VerificationResult, error) {
			return &VerificationResult{
				Valid:        true,
				PayerAddress: "0xpayer",
				Amount:       "1.00",
				TokenSymbol:  "USDC",
			}, nil
		},
		SettleFunc: func(ctx context.Context, payment *Payment) (*SettlementResult, error) {
			return &SettlementResult{
				TransactionHash:  "0xtxhash123",
				Status:          "success",
				Amount:          "1.00",
				PayerAddress:    "0xpayer",
				RecipientAddress: "0xrecipient",
			}, nil
		},
	}

	config := Config{
		Verifier: verifier,
		EndpointPricing: map[string]PricingRule{
			"/v1/paid": {
				Amount: "1.00",
				AcceptedTokens: []TokenRequirement{
					{Network: "base-sepolia", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xrecipient"},
				},
			},
		},
	}

	var capturedPayment *PaymentContext
	handler := PaymentMiddleware(config)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payment, ok := GetPaymentFromContext(r.Context())
		if !ok {
			t.Error("payment context not found")
		}
		capturedPayment = payment
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("success"))
	}))

	// Create a valid payment
	payment := Payment{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-sepolia",
		Payload: map[string]interface{}{
			"signature": "0xsig",
			"authorization": map[string]interface{}{
				"from":        "0xpayer",
				"to":          "0xrecipient",
				"value":       "1000000",
				"validAfter":  0,
				"validBefore": 9999999999,
				"nonce":       "0xnonce",
			},
		},
	}

	paymentJSON, _ := json.Marshal(payment)
	xPayment := base64.StdEncoding.EncodeToString(paymentJSON)

	req := httptest.NewRequest("GET", "/v1/paid", nil)
	req.Header.Set("X-PAYMENT", xPayment)
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

	if capturedPayment.PayerAddress != "0xpayer" {
		t.Errorf("expected payer 0xpayer, got %s", capturedPayment.PayerAddress)
	}

	if capturedPayment.TransactionHash != "0xtxhash123" {
		t.Errorf("expected tx hash 0xtxhash123, got %s", capturedPayment.TransactionHash)
	}

	// Check X-PAYMENT-RESPONSE header
	xPaymentResponse := w.Header().Get("X-PAYMENT-RESPONSE")
	if xPaymentResponse == "" {
		t.Error("expected X-PAYMENT-RESPONSE header")
	}
}

func TestEncodeDecodePayment(t *testing.T) {
	payment := &Payment{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-sepolia",
		Payload: map[string]interface{}{
			"test": "data",
		},
	}

	encoded, err := EncodePayment(payment)
	if err != nil {
		t.Fatalf("failed to encode: %v", err)
	}

	decoded, err := parsePayment(encoded)
	if err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	if decoded.X402Version != payment.X402Version {
		t.Errorf("version mismatch: expected %d, got %d", payment.X402Version, decoded.X402Version)
	}

	if decoded.Scheme != payment.Scheme {
		t.Errorf("scheme mismatch: expected %s, got %s", payment.Scheme, decoded.Scheme)
	}

	if decoded.Network != payment.Network {
		t.Errorf("network mismatch: expected %s, got %s", payment.Network, decoded.Network)
	}
}
