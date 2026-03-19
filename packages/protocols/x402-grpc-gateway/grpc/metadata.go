package grpc

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/becomeliminal/grpc-gateway-x402"
	"google.golang.org/grpc/metadata"
)

const (
	// MetadataKeyPaymentRequirements is the metadata key for payment requirements
	MetadataKeyPaymentRequirements = "x402-payment-requirements"

	// MetadataKeyPayment is the metadata key for payment payload
	MetadataKeyPayment = "x402-payment"

	// MetadataKeyPaymentResponse is the metadata key for settlement response
	MetadataKeyPaymentResponse = "x402-payment-response"
)

// EncodePaymentRequirements encodes a PaymentRequirementsResponse to base64 JSON
// for inclusion in gRPC metadata
func EncodePaymentRequirements(requirements []x402.PaymentRequirements) (string, error) {
	response := x402.PaymentRequiredResponse{
		Error:               "payment required",
		PaymentRequirements: requirements,
	}

	jsonBytes, err := json.Marshal(response)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payment requirements: %w", err)
	}

	return base64.StdEncoding.EncodeToString(jsonBytes), nil
}

// DecodePaymentRequirements decodes base64 JSON payment requirements from gRPC metadata
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

// EncodePayment encodes a Payment to base64 JSON for inclusion in gRPC metadata
func EncodePayment(payment *x402.Payment) (string, error) {
	jsonBytes, err := json.Marshal(payment)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payment: %w", err)
	}

	return base64.StdEncoding.EncodeToString(jsonBytes), nil
}

// DecodePayment decodes base64 JSON payment from gRPC metadata
func DecodePayment(encoded string) (*x402.Payment, error) {
	jsonBytes, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64: %w", err)
	}

	var payment x402.Payment
	if err := json.Unmarshal(jsonBytes, &payment); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payment: %w", err)
	}

	// Basic validation
	if payment.X402Version == 0 {
		return nil, fmt.Errorf("x402Version is required")
	}

	if payment.Scheme == "" {
		return nil, fmt.Errorf("scheme is required")
	}

	if payment.Network == "" {
		return nil, fmt.Errorf("network is required")
	}

	if payment.Payload == nil {
		return nil, fmt.Errorf("payload is required")
	}

	return &payment, nil
}

// EncodePaymentResponse encodes a PaymentResponse to base64 JSON
func EncodePaymentResponse(response *x402.PaymentResponse) (string, error) {
	jsonBytes, err := json.Marshal(response)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payment response: %w", err)
	}

	return base64.StdEncoding.EncodeToString(jsonBytes), nil
}

// DecodePaymentResponse decodes base64 JSON payment response from gRPC metadata
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

// ExtractPaymentFromMetadata extracts and decodes payment from gRPC metadata
func ExtractPaymentFromMetadata(md metadata.MD) (*x402.Payment, error) {
	values := md.Get(MetadataKeyPayment)
	if len(values) == 0 {
		return nil, fmt.Errorf("no payment found in metadata")
	}

	return DecodePayment(values[0])
}

// ExtractPaymentRequirementsFromMetadata extracts and decodes payment requirements from gRPC metadata
func ExtractPaymentRequirementsFromMetadata(md metadata.MD) (*x402.PaymentRequiredResponse, error) {
	values := md.Get(MetadataKeyPaymentRequirements)
	if len(values) == 0 {
		return nil, fmt.Errorf("no payment requirements found in metadata")
	}

	return DecodePaymentRequirements(values[0])
}

// BuildPaymentRequirements builds payment requirements from a pricing rule
func BuildPaymentRequirements(rule *x402.PricingRule, fullMethod string, validityDuration time.Duration) []x402.PaymentRequirements {
	requirements := make([]x402.PaymentRequirements, 0, len(rule.AcceptedTokens))
	validBefore := time.Now().Add(validityDuration).Unix()

	for _, token := range rule.AcceptedTokens {
		req := x402.PaymentRequirements{
			X402Version:       1,
			Scheme:            "exact", // EVM scheme
			Network:           token.Network,
			MaxAmountRequired: rule.Amount,
			Resource:          fullMethod,
			Description:       rule.Description,
			MimeType:          rule.MimeType,
			Recipient:         token.Recipient,
			ValidBefore:       validBefore,
			AssetContract:     token.AssetContract,
			Metadata: x402.Metadata{
				TokenSymbol:   token.Symbol,
				TokenName:     token.TokenName,
				TokenDecimals: token.TokenDecimals,
			},
			OutputSchema: rule.OutputSchema,
		}
		requirements = append(requirements, req)
	}

	return requirements
}
