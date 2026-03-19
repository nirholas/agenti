package encoding

import (
	"encoding/base64"
	"encoding/json"
	"testing"

	v2 "github.com/mark3labs/x402-go/v2"
)

func TestEncodeDecodePayment(t *testing.T) {
	original := v2.PaymentPayload{
		X402Version: 2,
		Resource: &v2.ResourceInfo{
			URL:         "https://example.com/api",
			Description: "Test API",
		},
		Accepted: v2.PaymentRequirements{
			Scheme:            "exact",
			Network:           "eip155:8453",
			Amount:            "1000000",
			Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			PayTo:             "0x1234567890123456789012345678901234567890",
			MaxTimeoutSeconds: 300,
		},
		Payload: map[string]interface{}{
			"signature": "0xabcdef",
		},
	}

	// Encode
	encoded, err := EncodePayment(original)
	if err != nil {
		t.Fatalf("EncodePayment() error = %v", err)
	}

	if encoded == "" {
		t.Error("EncodePayment() returned empty string")
	}

	// Verify it's valid base64
	_, err = base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Errorf("EncodePayment() result is not valid base64: %v", err)
	}

	// Decode
	decoded, err := DecodePayment(encoded)
	if err != nil {
		t.Fatalf("DecodePayment() error = %v", err)
	}

	// Verify fields
	if decoded.X402Version != original.X402Version {
		t.Errorf("X402Version = %d; want %d", decoded.X402Version, original.X402Version)
	}
	if decoded.Accepted.Network != original.Accepted.Network {
		t.Errorf("Accepted.Network = %s; want %s", decoded.Accepted.Network, original.Accepted.Network)
	}
	if decoded.Resource == nil {
		t.Error("Resource should not be nil")
	} else if decoded.Resource.URL != original.Resource.URL {
		t.Errorf("Resource.URL = %s; want %s", decoded.Resource.URL, original.Resource.URL)
	}
}

func TestDecodePaymentErrors(t *testing.T) {
	tests := []struct {
		name    string
		encoded string
		wantErr bool
	}{
		{
			name:    "invalid base64",
			encoded: "not-valid-base64!!!",
			wantErr: true,
		},
		{
			name:    "valid base64 but invalid JSON",
			encoded: base64.StdEncoding.EncodeToString([]byte("not json")),
			wantErr: true,
		},
		{
			name:    "empty string",
			encoded: "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := DecodePayment(tt.encoded)
			if (err != nil) != tt.wantErr {
				t.Errorf("DecodePayment() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestEncodeDecodeSettlement(t *testing.T) {
	original := v2.SettleResponse{
		Success:     true,
		Transaction: "0xabcdef1234567890",
		Network:     "eip155:8453",
		Payer:       "0x1234567890123456789012345678901234567890",
	}

	// Encode
	encoded, err := EncodeSettlement(original)
	if err != nil {
		t.Fatalf("EncodeSettlement() error = %v", err)
	}

	// Decode
	decoded, err := DecodeSettlement(encoded)
	if err != nil {
		t.Fatalf("DecodeSettlement() error = %v", err)
	}

	if decoded.Success != original.Success {
		t.Errorf("Success = %v; want %v", decoded.Success, original.Success)
	}
	if decoded.Transaction != original.Transaction {
		t.Errorf("Transaction = %s; want %s", decoded.Transaction, original.Transaction)
	}
	if decoded.Network != original.Network {
		t.Errorf("Network = %s; want %s", decoded.Network, original.Network)
	}
}

func TestEncodeDecodeSettlementWithError(t *testing.T) {
	original := v2.SettleResponse{
		Success:     false,
		ErrorReason: "insufficient funds",
		Network:     "eip155:8453",
	}

	encoded, err := EncodeSettlement(original)
	if err != nil {
		t.Fatalf("EncodeSettlement() error = %v", err)
	}

	decoded, err := DecodeSettlement(encoded)
	if err != nil {
		t.Fatalf("DecodeSettlement() error = %v", err)
	}

	if decoded.Success != false {
		t.Error("Success should be false")
	}
	if decoded.ErrorReason != original.ErrorReason {
		t.Errorf("ErrorReason = %s; want %s", decoded.ErrorReason, original.ErrorReason)
	}
}

func TestDecodeSettlementErrors(t *testing.T) {
	tests := []struct {
		name    string
		encoded string
		wantErr bool
	}{
		{
			name:    "invalid base64",
			encoded: "not-valid!!!",
			wantErr: true,
		},
		{
			name:    "valid base64 but invalid JSON",
			encoded: base64.StdEncoding.EncodeToString([]byte("{invalid")),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := DecodeSettlement(tt.encoded)
			if (err != nil) != tt.wantErr {
				t.Errorf("DecodeSettlement() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestEncodeDecodeRequirements(t *testing.T) {
	original := v2.PaymentRequired{
		X402Version: 2,
		Error:       "Payment required",
		Resource: &v2.ResourceInfo{
			URL:         "https://example.com/api",
			Description: "Test API",
			MimeType:    "application/json",
		},
		Accepts: []v2.PaymentRequirements{
			{
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
			},
		},
		Extensions: map[string]v2.Extension{
			"budget": {
				Info: map[string]interface{}{
					"budgetId": "test-budget",
				},
				Schema: map[string]interface{}{
					"type": "object",
				},
			},
		},
	}

	// Encode
	encoded, err := EncodeRequirements(original)
	if err != nil {
		t.Fatalf("EncodeRequirements() error = %v", err)
	}

	// Decode
	decoded, err := DecodeRequirements(encoded)
	if err != nil {
		t.Fatalf("DecodeRequirements() error = %v", err)
	}

	if decoded.X402Version != original.X402Version {
		t.Errorf("X402Version = %d; want %d", decoded.X402Version, original.X402Version)
	}
	if decoded.Resource.URL != original.Resource.URL {
		t.Errorf("Resource.URL = %s; want %s", decoded.Resource.URL, original.Resource.URL)
	}
	if len(decoded.Accepts) != len(original.Accepts) {
		t.Errorf("len(Accepts) = %d; want %d", len(decoded.Accepts), len(original.Accepts))
	}
	if len(decoded.Extensions) != len(original.Extensions) {
		t.Errorf("len(Extensions) = %d; want %d", len(decoded.Extensions), len(original.Extensions))
	}
}

func TestDecodeRequirementsErrors(t *testing.T) {
	tests := []struct {
		name    string
		encoded string
		wantErr bool
	}{
		{
			name:    "invalid base64",
			encoded: "!!!invalid",
			wantErr: true,
		},
		{
			name:    "valid base64 but invalid JSON",
			encoded: base64.StdEncoding.EncodeToString([]byte("not json")),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := DecodeRequirements(tt.encoded)
			if (err != nil) != tt.wantErr {
				t.Errorf("DecodeRequirements() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestEncodeDecodeVerifyResponse(t *testing.T) {
	tests := []struct {
		name     string
		response v2.VerifyResponse
	}{
		{
			name: "valid response",
			response: v2.VerifyResponse{
				IsValid: true,
				Payer:   "0x1234567890123456789012345678901234567890",
			},
		},
		{
			name: "invalid response",
			response: v2.VerifyResponse{
				IsValid:       false,
				InvalidReason: "signature verification failed",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encoded, err := EncodeVerifyResponse(tt.response)
			if err != nil {
				t.Fatalf("EncodeVerifyResponse() error = %v", err)
			}

			decoded, err := DecodeVerifyResponse(encoded)
			if err != nil {
				t.Fatalf("DecodeVerifyResponse() error = %v", err)
			}

			if decoded.IsValid != tt.response.IsValid {
				t.Errorf("IsValid = %v; want %v", decoded.IsValid, tt.response.IsValid)
			}
			if decoded.InvalidReason != tt.response.InvalidReason {
				t.Errorf("InvalidReason = %s; want %s", decoded.InvalidReason, tt.response.InvalidReason)
			}
			if decoded.Payer != tt.response.Payer {
				t.Errorf("Payer = %s; want %s", decoded.Payer, tt.response.Payer)
			}
		})
	}
}

func TestRoundTripPreservesExtensions(t *testing.T) {
	original := v2.PaymentPayload{
		X402Version: 2,
		Accepted: v2.PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:8453",
			Amount:  "1000000",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			PayTo:   "0x1234567890123456789012345678901234567890",
		},
		Payload: map[string]interface{}{"test": "data"},
		Extensions: map[string]v2.Extension{
			"custom": {
				Info: map[string]interface{}{
					"key1": "value1",
					"key2": float64(42),
				},
				Schema: map[string]interface{}{
					"type": "object",
				},
			},
		},
	}

	encoded, err := EncodePayment(original)
	if err != nil {
		t.Fatalf("EncodePayment() error = %v", err)
	}

	decoded, err := DecodePayment(encoded)
	if err != nil {
		t.Fatalf("DecodePayment() error = %v", err)
	}

	if len(decoded.Extensions) != 1 {
		t.Fatalf("len(Extensions) = %d; want 1", len(decoded.Extensions))
	}

	ext, ok := decoded.Extensions["custom"]
	if !ok {
		t.Fatal("Extensions[custom] not found")
	}

	if ext.Info["key1"] != "value1" {
		t.Errorf("Extensions[custom].Info[key1] = %v; want value1", ext.Info["key1"])
	}
}

func TestEncodedFormatIsValidJSON(t *testing.T) {
	payment := v2.PaymentPayload{
		X402Version: 2,
		Accepted: v2.PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:8453",
			Amount:  "1000000",
			Asset:   "0xUSDC",
			PayTo:   "0xrecipient",
		},
		Payload: map[string]interface{}{"test": true},
	}

	encoded, err := EncodePayment(payment)
	if err != nil {
		t.Fatalf("EncodePayment() error = %v", err)
	}

	// Decode base64 and verify it's valid JSON
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatalf("base64.DecodeString() error = %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(decoded, &result); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	// Verify expected fields exist
	if result["x402Version"] != float64(2) {
		t.Errorf("x402Version = %v; want 2", result["x402Version"])
	}

	accepted, ok := result["accepted"].(map[string]interface{})
	if !ok {
		t.Fatal("accepted field not found or not an object")
	}

	if accepted["network"] != "eip155:8453" {
		t.Errorf("accepted.network = %v; want eip155:8453", accepted["network"])
	}
}
