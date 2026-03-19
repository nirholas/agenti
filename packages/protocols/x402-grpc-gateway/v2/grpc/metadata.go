package grpc

import (
	"encoding/base64"
	"encoding/json"
	"fmt"

	x402 "github.com/becomeliminal/grpc-gateway-x402/v2"
	"google.golang.org/grpc/metadata"
)

// V2 metadata keys.
const (
	MetadataKeyPaymentSignature    = "payment-signature"
	MetadataKeyPaymentResponse     = "payment-response"
	MetadataKeyPaymentRequired     = "payment-required"

	// V1 legacy metadata keys.
	MetadataKeyLegacyPayment              = "x402-payment"
	MetadataKeyLegacyPaymentRequirements  = "x402-payment-requirements"
	MetadataKeyLegacyPaymentResponse      = "x402-payment-response"
)

// EncodePaymentRequirements encodes a PaymentRequiredResponse to base64 JSON.
func EncodePaymentRequirements(accepts []x402.PaymentRequirements) (string, error) {
	response := x402.PaymentRequiredResponse{
		X402Version: 2,
		Error:       "payment required",
		Accepts:     accepts,
	}

	jsonBytes, err := json.Marshal(response)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payment requirements: %w", err)
	}

	return base64.StdEncoding.EncodeToString(jsonBytes), nil
}

// DecodePaymentRequirements decodes base64 JSON payment requirements.
func DecodePaymentRequirements(encoded string) (*x402.PaymentRequiredResponse, error) {
	jsonBytes, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64: %w", err)
	}

	var response x402.PaymentRequiredResponse
	if err := json.Unmarshal(jsonBytes, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payment requirements: %w", err)
	}

	return &response, nil
}

// EncodePaymentPayload encodes a PaymentPayload to base64 JSON for metadata.
func EncodePaymentPayload(payload *x402.PaymentPayload) (string, error) {
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payment payload: %w", err)
	}

	return base64.StdEncoding.EncodeToString(jsonBytes), nil
}

// DecodePaymentPayload decodes base64 JSON payment payload from metadata.
// Tries V2 key first, falls back to V1 legacy key.
func DecodePaymentPayload(encoded string) (*x402.PaymentPayload, error) {
	jsonBytes, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64: %w", err)
	}

	var payload x402.PaymentPayload
	if err := json.Unmarshal(jsonBytes, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payment payload: %w", err)
	}

	if payload.Payload == nil {
		return nil, fmt.Errorf("payload is required")
	}

	return &payload, nil
}

// DecodeLegacyPayment decodes a V1 x402-payment metadata value into a PaymentPayload.
func DecodeLegacyPayment(encoded string) (*x402.PaymentPayload, error) {
	jsonBytes, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64: %w", err)
	}

	var legacy x402.LegacyPayment
	if err := json.Unmarshal(jsonBytes, &legacy); err != nil {
		return nil, fmt.Errorf("failed to unmarshal legacy payment: %w", err)
	}

	if legacy.X402Version == 0 {
		return nil, fmt.Errorf("x402Version is required")
	}
	if legacy.Scheme == "" {
		return nil, fmt.Errorf("scheme is required")
	}
	if legacy.Network == "" {
		return nil, fmt.Errorf("network is required")
	}
	if legacy.Payload == nil {
		return nil, fmt.Errorf("payload is required")
	}

	return &x402.PaymentPayload{
		X402Version: legacy.X402Version,
		Accepted: x402.PaymentRequirements{
			Scheme:  legacy.Scheme,
			Network: legacy.Network,
		},
		Payload: legacy.Payload,
	}, nil
}

// EncodePaymentResponse encodes a PaymentResponse to base64 JSON.
func EncodePaymentResponse(response *x402.PaymentResponse) (string, error) {
	jsonBytes, err := json.Marshal(response)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payment response: %w", err)
	}

	return base64.StdEncoding.EncodeToString(jsonBytes), nil
}

// DecodePaymentResponse decodes base64 JSON payment response.
func DecodePaymentResponse(encoded string) (*x402.PaymentResponse, error) {
	jsonBytes, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64: %w", err)
	}

	var response x402.PaymentResponse
	if err := json.Unmarshal(jsonBytes, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payment response: %w", err)
	}

	return &response, nil
}

// ExtractPaymentFromMetadata extracts payment from gRPC metadata.
// Tries V2 key (payment-signature) first, falls back to V1 (x402-payment).
func ExtractPaymentFromMetadata(md metadata.MD) (*x402.PaymentPayload, bool, error) {
	// Try V2 first.
	if values := md.Get(MetadataKeyPaymentSignature); len(values) > 0 {
		payload, err := DecodePaymentPayload(values[0])
		return payload, true, err
	}

	// Fall back to V1.
	if values := md.Get(MetadataKeyLegacyPayment); len(values) > 0 {
		payload, err := DecodeLegacyPayment(values[0])
		return payload, false, err
	}

	return nil, false, fmt.Errorf("no payment found in metadata")
}

// BuildPaymentRequirements builds PaymentRequirements from a pricing rule.
func BuildPaymentRequirements(rule *x402.PricingRule, fullMethod string, validityDuration interface{}) []x402.PaymentRequirements {
	accepts := make([]x402.PaymentRequirements, 0, len(rule.AcceptedTokens))

	for _, token := range rule.AcceptedTokens {
		accepts = append(accepts, x402.PaymentRequirements{
			Scheme:  "exact",
			Network: token.Network,
			Amount:  token.Amount,
			Asset:   token.AssetContract,
			PayTo:   token.Recipient,
		})
	}

	return accepts
}
