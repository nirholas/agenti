package grpc

import (
	"encoding/base64"
	"encoding/json"
	"testing"
	"time"

	"github.com/becomeliminal/grpc-gateway-x402"
	"google.golang.org/grpc/metadata"
)

func TestEncodeDecodePaymentRequirements(t *testing.T) {
	requirements := []x402.PaymentRequirements{
		{
			X402Version:       1,
			Scheme:            "exact",
			Network:           "base-mainnet",
			MaxAmountRequired: "1.00",
			Resource:          "/test.v1.TestService/TestMethod",
			Description:       "Test payment",
			Recipient:         "0x123",
			ValidBefore:       time.Now().Unix() + 300,
			AssetContract:     "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Metadata: x402.Metadata{
				TokenSymbol:   "USDC",
				TokenDecimals: 6,
			},
		},
	}

	// Encode
	encoded, err := EncodePaymentRequirements(requirements)
	if err != nil {
		t.Fatalf("Failed to encode: %v", err)
	}

	// Verify it's valid base64
	_, err = base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatalf("Not valid base64: %v", err)
	}

	// Decode
	decoded, err := DecodePaymentRequirements(encoded)
	if err != nil {
		t.Fatalf("Failed to decode: %v", err)
	}

	// Verify
	if len(decoded.PaymentRequirements) != 1 {
		t.Fatalf("Expected 1 requirement, got %d", len(decoded.PaymentRequirements))
	}

	req := decoded.PaymentRequirements[0]
	if req.Network != "base-mainnet" {
		t.Errorf("Expected network base-mainnet, got %s", req.Network)
	}
	if req.MaxAmountRequired != "1.00" {
		t.Errorf("Expected amount 1.00, got %s", req.MaxAmountRequired)
	}
}

func TestEncodeDecodePayment(t *testing.T) {
	payment := &x402.Payment{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-mainnet",
		Payload: map[string]interface{}{
			"signature": "0xabc123",
			"authorization": map[string]interface{}{
				"from":  "0x123",
				"to":    "0x456",
				"value": "1000000",
			},
		},
	}

	// Encode
	encoded, err := EncodePayment(payment)
	if err != nil {
		t.Fatalf("Failed to encode: %v", err)
	}

	// Verify it's valid base64
	_, err = base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatalf("Not valid base64: %v", err)
	}

	// Decode
	decoded, err := DecodePayment(encoded)
	if err != nil {
		t.Fatalf("Failed to decode: %v", err)
	}

	// Verify
	if decoded.X402Version != 1 {
		t.Errorf("Expected version 1, got %d", decoded.X402Version)
	}
	if decoded.Network != "base-mainnet" {
		t.Errorf("Expected network base-mainnet, got %s", decoded.Network)
	}
}

func TestDecodePaymentValidation(t *testing.T) {
	tests := []struct {
		name        string
		payment     map[string]interface{}
		shouldError bool
		errorMsg    string
	}{
		{
			name: "valid payment",
			payment: map[string]interface{}{
				"x402Version": 1,
				"scheme":      "exact",
				"network":     "base-mainnet",
				"payload": map[string]interface{}{
					"signature": "0x123",
				},
			},
			shouldError: false,
		},
		{
			name: "missing version",
			payment: map[string]interface{}{
				"scheme":  "exact",
				"network": "base-mainnet",
				"payload": map[string]interface{}{},
			},
			shouldError: true,
			errorMsg:    "x402Version is required",
		},
		{
			name: "missing scheme",
			payment: map[string]interface{}{
				"x402Version": 1,
				"network":     "base-mainnet",
				"payload": map[string]interface{}{},
			},
			shouldError: true,
			errorMsg:    "scheme is required",
		},
		{
			name: "missing network",
			payment: map[string]interface{}{
				"x402Version": 1,
				"scheme":      "exact",
				"payload": map[string]interface{}{},
			},
			shouldError: true,
			errorMsg:    "network is required",
		},
		{
			name: "missing payload",
			payment: map[string]interface{}{
				"x402Version": 1,
				"scheme":      "exact",
				"network":     "base-mainnet",
			},
			shouldError: true,
			errorMsg:    "payload is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Encode as JSON then base64
			jsonBytes, _ := json.Marshal(tt.payment)
			encoded := base64.StdEncoding.EncodeToString(jsonBytes)

			// Decode
			_, err := DecodePayment(encoded)

			if tt.shouldError {
				if err == nil {
					t.Errorf("Expected error containing %q, got nil", tt.errorMsg)
				} else if err.Error() != tt.errorMsg {
					t.Errorf("Expected error %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("Expected no error, got: %v", err)
				}
			}
		})
	}
}

func TestExtractPaymentFromMetadata(t *testing.T) {
	payment := &x402.Payment{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-mainnet",
		Payload:     map[string]interface{}{"test": "data"},
	}

	encoded, _ := EncodePayment(payment)

	// Create metadata with payment
	md := metadata.Pairs(MetadataKeyPayment, encoded)

	// Extract
	extracted, err := ExtractPaymentFromMetadata(md)
	if err != nil {
		t.Fatalf("Failed to extract: %v", err)
	}

	if extracted.Network != "base-mainnet" {
		t.Errorf("Expected network base-mainnet, got %s", extracted.Network)
	}
}

func TestExtractPaymentFromMetadataNotFound(t *testing.T) {
	// Empty metadata
	md := metadata.MD{}

	// Should error
	_, err := ExtractPaymentFromMetadata(md)
	if err == nil {
		t.Error("Expected error for missing payment, got nil")
	}
}

func TestBuildPaymentRequirements(t *testing.T) {
	rule := &x402.PricingRule{
		Amount: "0.50",
		AcceptedTokens: []x402.TokenRequirement{
			{
				Network:       "base-mainnet",
				AssetContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Symbol:        "USDC",
				Recipient:     "0xRecipient",
				TokenDecimals: 6,
			},
			{
				Network:       "ethereum-mainnet",
				AssetContract: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
				Symbol:        "DAI",
				Recipient:     "0xRecipient",
				TokenDecimals: 18,
			},
		},
		Description: "Test payment",
	}

	fullMethod := "/test.v1.TestService/TestMethod"
	validityDuration := 5 * time.Minute

	requirements := BuildPaymentRequirements(rule, fullMethod, validityDuration)

	// Should have 2 requirements (one per token)
	if len(requirements) != 2 {
		t.Fatalf("Expected 2 requirements, got %d", len(requirements))
	}

	// Check first requirement
	req := requirements[0]
	if req.X402Version != 1 {
		t.Errorf("Expected version 1, got %d", req.X402Version)
	}
	if req.Scheme != "exact" {
		t.Errorf("Expected scheme exact, got %s", req.Scheme)
	}
	if req.Network != "base-mainnet" {
		t.Errorf("Expected network base-mainnet, got %s", req.Network)
	}
	if req.MaxAmountRequired != "0.50" {
		t.Errorf("Expected amount 0.50, got %s", req.MaxAmountRequired)
	}
	if req.Resource != fullMethod {
		t.Errorf("Expected resource %s, got %s", fullMethod, req.Resource)
	}
	if req.Metadata.TokenSymbol != "USDC" {
		t.Errorf("Expected token USDC, got %s", req.Metadata.TokenSymbol)
	}

	// Verify validBefore is in the future
	if req.ValidBefore <= time.Now().Unix() {
		t.Error("ValidBefore should be in the future")
	}
}
