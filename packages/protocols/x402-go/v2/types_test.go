package v2

import (
	"encoding/json"
	"math/big"
	"testing"
)

func TestX402Version(t *testing.T) {
	if X402Version != 2 {
		t.Errorf("X402Version = %d; want 2", X402Version)
	}
}

func TestResourceInfoJSON(t *testing.T) {
	tests := []struct {
		name     string
		resource ResourceInfo
		wantJSON string
	}{
		{
			name: "full resource",
			resource: ResourceInfo{
				URL:         "https://example.com/api/data",
				Description: "Test data endpoint",
				MimeType:    "application/json",
			},
			wantJSON: `{"url":"https://example.com/api/data","description":"Test data endpoint","mimeType":"application/json"}`,
		},
		{
			name: "url only",
			resource: ResourceInfo{
				URL: "https://example.com/api",
			},
			wantJSON: `{"url":"https://example.com/api"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := json.Marshal(tt.resource)
			if err != nil {
				t.Fatalf("json.Marshal() error = %v", err)
			}
			if string(data) != tt.wantJSON {
				t.Errorf("json.Marshal() = %s; want %s", string(data), tt.wantJSON)
			}

			// Test round-trip
			var decoded ResourceInfo
			if err := json.Unmarshal(data, &decoded); err != nil {
				t.Fatalf("json.Unmarshal() error = %v", err)
			}
			if decoded != tt.resource {
				t.Errorf("round-trip failed: got %+v; want %+v", decoded, tt.resource)
			}
		})
	}
}

func TestPaymentRequirementsJSON(t *testing.T) {
	req := PaymentRequirements{
		Scheme:            "exact",
		Network:           "eip155:8453",
		Amount:            "1000000",
		Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		PayTo:             "0x1234567890123456789012345678901234567890",
		MaxTimeoutSeconds: 300,
		Extra: map[string]interface{}{
			"name":    "USD Coin",
			"version": "2",
		},
	}

	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}

	var decoded PaymentRequirements
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	if decoded.Scheme != req.Scheme {
		t.Errorf("Scheme = %s; want %s", decoded.Scheme, req.Scheme)
	}
	if decoded.Network != req.Network {
		t.Errorf("Network = %s; want %s", decoded.Network, req.Network)
	}
	if decoded.Amount != req.Amount {
		t.Errorf("Amount = %s; want %s", decoded.Amount, req.Amount)
	}
}

func TestPaymentRequiredJSON(t *testing.T) {
	pr := PaymentRequired{
		X402Version: 2,
		Error:       "Payment required",
		Resource: &ResourceInfo{
			URL:         "https://example.com/api",
			Description: "Test API",
		},
		Accepts: []PaymentRequirements{
			{
				Scheme:            "exact",
				Network:           "eip155:8453",
				Amount:            "1000000",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				PayTo:             "0x1234567890123456789012345678901234567890",
				MaxTimeoutSeconds: 300,
			},
		},
	}

	data, err := json.Marshal(pr)
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}

	var decoded PaymentRequired
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	if decoded.X402Version != 2 {
		t.Errorf("X402Version = %d; want 2", decoded.X402Version)
	}
	if len(decoded.Accepts) != 1 {
		t.Errorf("len(Accepts) = %d; want 1", len(decoded.Accepts))
	}
}

func TestPaymentPayloadJSON(t *testing.T) {
	payload := PaymentPayload{
		X402Version: 2,
		Resource: &ResourceInfo{
			URL: "https://example.com/api",
		},
		Accepted: PaymentRequirements{
			Scheme:            "exact",
			Network:           "eip155:8453",
			Amount:            "1000000",
			Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			PayTo:             "0x1234567890123456789012345678901234567890",
			MaxTimeoutSeconds: 300,
		},
		Payload: EVMPayload{
			Signature: "0xabcdef",
			Authorization: EVMAuthorization{
				From:        "0x1111111111111111111111111111111111111111",
				To:          "0x2222222222222222222222222222222222222222",
				Value:       "1000000",
				ValidAfter:  "0",
				ValidBefore: "9999999999",
				Nonce:       "0x3333333333333333333333333333333333333333333333333333333333333333",
			},
		},
	}

	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}

	var decoded PaymentPayload
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	if decoded.X402Version != 2 {
		t.Errorf("X402Version = %d; want 2", decoded.X402Version)
	}
	if decoded.Accepted.Network != "eip155:8453" {
		t.Errorf("Accepted.Network = %s; want eip155:8453", decoded.Accepted.Network)
	}
}

func TestExtensionJSON(t *testing.T) {
	ext := Extension{
		Info: map[string]interface{}{
			"budgetId": "budget-123",
			"limit":    float64(100),
		},
		Schema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"budgetId": map[string]interface{}{"type": "string"},
				"limit":    map[string]interface{}{"type": "number"},
			},
		},
	}

	data, err := json.Marshal(ext)
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}

	var decoded Extension
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	if decoded.Info["budgetId"] != "budget-123" {
		t.Errorf("Info[budgetId] = %v; want budget-123", decoded.Info["budgetId"])
	}
}

func TestVerifyResponseJSON(t *testing.T) {
	tests := []struct {
		name     string
		response VerifyResponse
	}{
		{
			name: "valid payment",
			response: VerifyResponse{
				IsValid: true,
				Payer:   "0x1234567890123456789012345678901234567890",
			},
		},
		{
			name: "invalid payment",
			response: VerifyResponse{
				IsValid:       false,
				InvalidReason: "insufficient funds",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := json.Marshal(tt.response)
			if err != nil {
				t.Fatalf("json.Marshal() error = %v", err)
			}

			var decoded VerifyResponse
			if err := json.Unmarshal(data, &decoded); err != nil {
				t.Fatalf("json.Unmarshal() error = %v", err)
			}

			if decoded.IsValid != tt.response.IsValid {
				t.Errorf("IsValid = %v; want %v", decoded.IsValid, tt.response.IsValid)
			}
		})
	}
}

func TestSettleResponseJSON(t *testing.T) {
	resp := SettleResponse{
		Success:     true,
		Transaction: "0xabcdef1234567890",
		Network:     "eip155:8453",
		Payer:       "0x1234567890123456789012345678901234567890",
	}

	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}

	var decoded SettleResponse
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	if decoded.Network != "eip155:8453" {
		t.Errorf("Network = %s; want eip155:8453", decoded.Network)
	}
}

func TestSupportedResponseJSON(t *testing.T) {
	resp := SupportedResponse{
		Kinds: []SupportedKind{
			{
				X402Version: 2,
				Scheme:      "exact",
				Network:     "eip155:8453",
			},
		},
		Extensions: []string{"budget", "receipt"},
		Signers: map[string][]string{
			"eip155:*": {"0x1234567890123456789012345678901234567890"},
		},
	}

	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}

	var decoded SupportedResponse
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	if len(decoded.Kinds) != 1 {
		t.Errorf("len(Kinds) = %d; want 1", len(decoded.Kinds))
	}
	if len(decoded.Extensions) != 2 {
		t.Errorf("len(Extensions) = %d; want 2", len(decoded.Extensions))
	}
}

func TestAmountToBigInt(t *testing.T) {
	tests := []struct {
		name     string
		amount   string
		decimals int
		want     string
		wantErr  bool
	}{
		{
			name:     "whole number",
			amount:   "1",
			decimals: 6,
			want:     "1000000",
		},
		{
			name:     "decimal",
			amount:   "1.5",
			decimals: 6,
			want:     "1500000",
		},
		{
			name:     "small decimal",
			amount:   "0.000001",
			decimals: 6,
			want:     "1",
		},
		{
			name:     "large number",
			amount:   "1000000",
			decimals: 6,
			want:     "1000000000000",
		},
		{
			name:     "zero",
			amount:   "0",
			decimals: 6,
			want:     "0",
		},
		{
			name:     "invalid",
			amount:   "abc",
			decimals: 6,
			wantErr:  true,
		},
		{
			name:     "empty",
			amount:   "",
			decimals: 6,
			wantErr:  true,
		},
		{
			name:     "negative amount",
			amount:   "-1.5",
			decimals: 6,
			wantErr:  true,
		},
		{
			name:     "negative decimals",
			amount:   "1.5",
			decimals: -1,
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := AmountToBigInt(tt.amount, tt.decimals)
			if (err != nil) != tt.wantErr {
				t.Errorf("AmountToBigInt() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got.String() != tt.want {
				t.Errorf("AmountToBigInt() = %s; want %s", got.String(), tt.want)
			}
		})
	}
}

func TestBigIntToAmount(t *testing.T) {
	tests := []struct {
		name     string
		value    *big.Int
		decimals int
		want     string
	}{
		{
			name:     "whole number",
			value:    big.NewInt(1000000),
			decimals: 6,
			want:     "1.000000",
		},
		{
			name:     "decimal",
			value:    big.NewInt(1500000),
			decimals: 6,
			want:     "1.500000",
		},
		{
			name:     "small value",
			value:    big.NewInt(1),
			decimals: 6,
			want:     "0.000001",
		},
		{
			name:     "zero",
			value:    big.NewInt(0),
			decimals: 6,
			want:     "0.000000",
		},
		{
			name:     "nil",
			value:    nil,
			decimals: 6,
			want:     "0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := BigIntToAmount(tt.value, tt.decimals)
			if got != tt.want {
				t.Errorf("BigIntToAmount() = %s; want %s", got, tt.want)
			}
		})
	}
}

func TestTokenConfig(t *testing.T) {
	config := TokenConfig{
		Address:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		Symbol:   "USDC",
		Decimals: 6,
		Priority: 1,
		Name:     "USD Coin",
	}

	if config.Address == "" {
		t.Error("Address should not be empty")
	}
	if config.Decimals != 6 {
		t.Errorf("Decimals = %d; want 6", config.Decimals)
	}
}

func TestPaymentError_WithDetails_NilMap(t *testing.T) {
	// Create a PaymentError with a nil Details map (simulating a manually constructed error)
	err := &PaymentError{
		Code:    ErrCodeInvalidRequirements,
		Message: "test error",
		Details: nil, // Explicitly nil to test the nil guard
	}

	// This should not panic
	result := err.WithDetails("key", "value")

	// Verify the details were added
	if result.Details == nil {
		t.Fatal("Details map should have been initialized")
	}
	if result.Details["key"] != "value" {
		t.Errorf("Expected Details[key] = value, got %v", result.Details["key"])
	}
}

func TestPaymentError_WithDetails_ChainedCalls(t *testing.T) {
	err := NewPaymentError(ErrCodeInvalidRequirements, "test error", nil)

	// Chain multiple WithDetails calls
	result := err.WithDetails("key1", "value1").WithDetails("key2", "value2")

	if result.Details["key1"] != "value1" {
		t.Errorf("Expected Details[key1] = value1, got %v", result.Details["key1"])
	}
	if result.Details["key2"] != "value2" {
		t.Errorf("Expected Details[key2] = value2, got %v", result.Details["key2"])
	}
}
