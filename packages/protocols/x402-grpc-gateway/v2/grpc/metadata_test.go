package grpc

import (
	"encoding/base64"
	"encoding/json"
	"testing"

	x402 "github.com/becomeliminal/grpc-gateway-x402/v2"
	"google.golang.org/grpc/metadata"
)

func TestEncodeDecodePaymentRequirements(t *testing.T) {
	accepts := []x402.PaymentRequirements{
		{
			Scheme:            "exact",
			Network:           "eip155:84532",
			Amount:            "1000000",
			Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
			PayTo:             "0xRecipient",
			MaxTimeoutSeconds: 300,
		},
	}

	encoded, err := EncodePaymentRequirements(accepts)
	if err != nil {
		t.Fatalf("failed to encode: %v", err)
	}

	// Verify it's valid base64
	jsonBytes, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatalf("not valid base64: %v", err)
	}

	// Verify the wrapped structure
	var response x402.PaymentRequiredResponse
	if err := json.Unmarshal(jsonBytes, &response); err != nil {
		t.Fatalf("not valid JSON: %v", err)
	}

	if response.X402Version != 2 {
		t.Errorf("expected x402Version 2, got %d", response.X402Version)
	}
	if response.Error != "payment required" {
		t.Errorf("expected error 'payment required', got %s", response.Error)
	}
	if len(response.Accepts) != 1 {
		t.Fatalf("expected 1 accept, got %d", len(response.Accepts))
	}

	accept := response.Accepts[0]
	if accept.Network != "eip155:84532" {
		t.Errorf("expected network 'eip155:84532', got %s", accept.Network)
	}
	if accept.Amount != "1000000" {
		t.Errorf("expected amount '1000000', got %s", accept.Amount)
	}
	if accept.Asset != "0x036CbD53842c5426634e7929541eC2318f3dCF7e" {
		t.Errorf("expected asset contract, got %s", accept.Asset)
	}

	// Round-trip decode
	decoded, err := DecodePaymentRequirements(encoded)
	if err != nil {
		t.Fatalf("failed to decode: %v", err)
	}
	if decoded.X402Version != 2 {
		t.Errorf("expected x402Version 2, got %d", decoded.X402Version)
	}
	if len(decoded.Accepts) != 1 {
		t.Fatalf("expected 1 accept after round-trip, got %d", len(decoded.Accepts))
	}
}

func TestDecodePaymentRequirements_InvalidBase64(t *testing.T) {
	_, err := DecodePaymentRequirements("not-valid-base64!!!")
	if err == nil {
		t.Error("expected error for invalid base64")
	}
}

func TestDecodePaymentRequirements_InvalidJSON(t *testing.T) {
	encoded := base64.StdEncoding.EncodeToString([]byte("not json"))
	_, err := DecodePaymentRequirements(encoded)
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}

func TestEncodeDecodePaymentPayload(t *testing.T) {
	payload := &x402.PaymentPayload{
		X402Version: 2,
		Accepted: x402.PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:84532",
			Amount:  "1000000",
			Asset:   "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
			PayTo:   "0xRecipient",
		},
		Payload: map[string]interface{}{
			"signature": "0xsig123",
			"authorization": map[string]interface{}{
				"from":  "0xPayer",
				"to":    "0xRecipient",
				"value": "1000000",
			},
		},
	}

	encoded, err := EncodePaymentPayload(payload)
	if err != nil {
		t.Fatalf("failed to encode: %v", err)
	}

	decoded, err := DecodePaymentPayload(encoded)
	if err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	if decoded.X402Version != 2 {
		t.Errorf("expected version 2, got %d", decoded.X402Version)
	}
	if decoded.Accepted.Network != "eip155:84532" {
		t.Errorf("expected network 'eip155:84532', got %s", decoded.Accepted.Network)
	}
	if decoded.Payload == nil {
		t.Error("expected non-nil payload")
	}
}

func TestDecodePaymentPayload_MissingPayload(t *testing.T) {
	data := map[string]interface{}{
		"x402Version": 2,
		"accepted":    map[string]interface{}{"scheme": "exact"},
	}
	jsonBytes, _ := json.Marshal(data)
	encoded := base64.StdEncoding.EncodeToString(jsonBytes)

	_, err := DecodePaymentPayload(encoded)
	if err == nil {
		t.Error("expected error for missing payload")
	}
}

func TestDecodeLegacyPayment(t *testing.T) {
	legacy := x402.LegacyPayment{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-sepolia",
		Payload:     map[string]interface{}{"signature": "0xsig"},
	}

	jsonBytes, _ := json.Marshal(legacy)
	encoded := base64.StdEncoding.EncodeToString(jsonBytes)

	decoded, err := DecodeLegacyPayment(encoded)
	if err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	if decoded.X402Version != 1 {
		t.Errorf("expected version 1, got %d", decoded.X402Version)
	}
	if decoded.Accepted.Scheme != "exact" {
		t.Errorf("expected scheme 'exact', got %s", decoded.Accepted.Scheme)
	}
	if decoded.Accepted.Network != "base-sepolia" {
		t.Errorf("expected network 'base-sepolia', got %s", decoded.Accepted.Network)
	}
}

func TestDecodeLegacyPayment_ValidationErrors(t *testing.T) {
	tests := []struct {
		name    string
		data    map[string]interface{}
		wantErr string
	}{
		{
			name:    "missing version",
			data:    map[string]interface{}{"scheme": "exact", "network": "base-sepolia", "payload": map[string]interface{}{}},
			wantErr: "x402Version is required",
		},
		{
			name:    "missing scheme",
			data:    map[string]interface{}{"x402Version": 1, "network": "base-sepolia", "payload": map[string]interface{}{}},
			wantErr: "scheme is required",
		},
		{
			name:    "missing network",
			data:    map[string]interface{}{"x402Version": 1, "scheme": "exact", "payload": map[string]interface{}{}},
			wantErr: "network is required",
		},
		{
			name:    "missing payload",
			data:    map[string]interface{}{"x402Version": 1, "scheme": "exact", "network": "base-sepolia"},
			wantErr: "payload is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			jsonBytes, _ := json.Marshal(tt.data)
			encoded := base64.StdEncoding.EncodeToString(jsonBytes)

			_, err := DecodeLegacyPayment(encoded)
			if err == nil {
				t.Errorf("expected error containing %q, got nil", tt.wantErr)
			}
		})
	}
}

func TestEncodeDecodePaymentResponse(t *testing.T) {
	resp := &x402.PaymentResponse{
		Success:     true,
		Transaction: "0xtxhash123",
		Network:     "eip155:84532",
		Payer:       "0xPayer",
	}

	encoded, err := EncodePaymentResponse(resp)
	if err != nil {
		t.Fatalf("failed to encode: %v", err)
	}

	decoded, err := DecodePaymentResponse(encoded)
	if err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	if !decoded.Success {
		t.Error("expected success=true")
	}
	if decoded.Transaction != "0xtxhash123" {
		t.Errorf("expected transaction '0xtxhash123', got %s", decoded.Transaction)
	}
	if decoded.Network != "eip155:84532" {
		t.Errorf("expected network 'eip155:84532', got %s", decoded.Network)
	}
	if decoded.Payer != "0xPayer" {
		t.Errorf("expected payer '0xPayer', got %s", decoded.Payer)
	}
}

// --- ExtractPaymentFromMetadata tests ---

func TestExtractPaymentFromMetadata_V2Key(t *testing.T) {
	payload := &x402.PaymentPayload{
		X402Version: 2,
		Accepted: x402.PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:84532",
		},
		Payload: map[string]interface{}{"signature": "0xsig"},
	}

	encoded, _ := EncodePaymentPayload(payload)
	md := metadata.Pairs(MetadataKeyPaymentSignature, encoded)

	extracted, isV2, err := ExtractPaymentFromMetadata(md)
	if err != nil {
		t.Fatalf("failed to extract: %v", err)
	}

	if !isV2 {
		t.Error("expected isV2=true for V2 key")
	}
	if extracted.X402Version != 2 {
		t.Errorf("expected version 2, got %d", extracted.X402Version)
	}
	if extracted.Accepted.Network != "eip155:84532" {
		t.Errorf("expected network 'eip155:84532', got %s", extracted.Accepted.Network)
	}
}

func TestExtractPaymentFromMetadata_V1Fallback(t *testing.T) {
	legacy := x402.LegacyPayment{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-mainnet",
		Payload:     map[string]interface{}{"signature": "0xsig"},
	}

	jsonBytes, _ := json.Marshal(legacy)
	encoded := base64.StdEncoding.EncodeToString(jsonBytes)

	md := metadata.Pairs(MetadataKeyLegacyPayment, encoded)

	extracted, isV2, err := ExtractPaymentFromMetadata(md)
	if err != nil {
		t.Fatalf("failed to extract: %v", err)
	}

	if isV2 {
		t.Error("expected isV2=false for V1 key")
	}
	if extracted.X402Version != 1 {
		t.Errorf("expected version 1, got %d", extracted.X402Version)
	}
	if extracted.Accepted.Network != "base-mainnet" {
		t.Errorf("expected network 'base-mainnet', got %s", extracted.Accepted.Network)
	}
}

func TestExtractPaymentFromMetadata_V2TakesPrecedence(t *testing.T) {
	// If both V2 and V1 keys are present, V2 should win
	v2Payload := &x402.PaymentPayload{
		X402Version: 2,
		Accepted: x402.PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:84532",
		},
		Payload: map[string]interface{}{"signature": "0xv2sig"},
	}
	v2Encoded, _ := EncodePaymentPayload(v2Payload)

	v1Legacy := x402.LegacyPayment{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-sepolia",
		Payload:     map[string]interface{}{"signature": "0xv1sig"},
	}
	v1JSON, _ := json.Marshal(v1Legacy)
	v1Encoded := base64.StdEncoding.EncodeToString(v1JSON)

	md := metadata.Pairs(
		MetadataKeyPaymentSignature, v2Encoded,
		MetadataKeyLegacyPayment, v1Encoded,
	)

	extracted, isV2, err := ExtractPaymentFromMetadata(md)
	if err != nil {
		t.Fatalf("failed to extract: %v", err)
	}

	if !isV2 {
		t.Error("expected isV2=true when both keys present")
	}
	if extracted.X402Version != 2 {
		t.Errorf("expected version 2, got %d", extracted.X402Version)
	}
}

func TestExtractPaymentFromMetadata_NotFound(t *testing.T) {
	md := metadata.MD{}

	_, _, err := ExtractPaymentFromMetadata(md)
	if err == nil {
		t.Error("expected error for missing payment metadata")
	}
}

// --- BuildPaymentRequirements tests ---

func TestBuildPaymentRequirements(t *testing.T) {
	rule := &x402.PricingRule{
		AcceptedTokens: []x402.TokenRequirement{
			{
				Network:       "eip155:84532",
				AssetContract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				Symbol:        "USDC",
				Recipient:     "0xRecipient",
				Amount:        "1000000",
			},
			{
				Network:       "eip155:42161",
				AssetContract: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
				Symbol:        "USDC",
				Recipient:     "0xRecipient",
				Amount:        "1000000",
			},
		},
	}

	fullMethod := "/test.v1.TestService/TestMethod"
	validityDuration := 5 * 60 // 5 minutes in seconds (interface{})

	requirements := BuildPaymentRequirements(rule, fullMethod, validityDuration)

	if len(requirements) != 2 {
		t.Fatalf("expected 2 requirements, got %d", len(requirements))
	}

	req := requirements[0]
	if req.Scheme != "exact" {
		t.Errorf("expected scheme 'exact', got %s", req.Scheme)
	}
	if req.Network != "eip155:84532" {
		t.Errorf("expected network 'eip155:84532', got %s", req.Network)
	}
	if req.Amount != "1000000" {
		t.Errorf("expected amount '1000000', got %s", req.Amount)
	}
	if req.Asset != "0x036CbD53842c5426634e7929541eC2318f3dCF7e" {
		t.Errorf("expected asset contract, got %s", req.Asset)
	}
	if req.PayTo != "0xRecipient" {
		t.Errorf("expected payTo '0xRecipient', got %s", req.PayTo)
	}

	req2 := requirements[1]
	if req2.Network != "eip155:42161" {
		t.Errorf("expected network 'eip155:42161', got %s", req2.Network)
	}
}

func TestBuildPaymentRequirements_EmptyTokens(t *testing.T) {
	rule := &x402.PricingRule{
		AcceptedTokens: []x402.TokenRequirement{},
	}

	requirements := BuildPaymentRequirements(rule, "/method", nil)

	if len(requirements) != 0 {
		t.Errorf("expected 0 requirements for empty tokens, got %d", len(requirements))
	}
}

// --- Metadata key constants tests ---

func TestMetadataKeyConstants(t *testing.T) {
	// V2 keys
	if MetadataKeyPaymentSignature != "payment-signature" {
		t.Errorf("unexpected V2 payment key: %s", MetadataKeyPaymentSignature)
	}
	if MetadataKeyPaymentResponse != "payment-response" {
		t.Errorf("unexpected V2 response key: %s", MetadataKeyPaymentResponse)
	}
	if MetadataKeyPaymentRequired != "payment-required" {
		t.Errorf("unexpected V2 required key: %s", MetadataKeyPaymentRequired)
	}

	// V1 legacy keys
	if MetadataKeyLegacyPayment != "x402-payment" {
		t.Errorf("unexpected V1 payment key: %s", MetadataKeyLegacyPayment)
	}
	if MetadataKeyLegacyPaymentRequirements != "x402-payment-requirements" {
		t.Errorf("unexpected V1 requirements key: %s", MetadataKeyLegacyPaymentRequirements)
	}
	if MetadataKeyLegacyPaymentResponse != "x402-payment-response" {
		t.Errorf("unexpected V1 response key: %s", MetadataKeyLegacyPaymentResponse)
	}
}
