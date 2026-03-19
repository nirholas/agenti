// Package encoding provides utilities for encoding and decoding x402 payment data.
// It handles base64 and JSON marshaling for payment payloads, settlements, and requirements.
package encoding

import (
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/mark3labs/x402-go"
)

// EncodePayment converts a PaymentPayload to base64-encoded JSON string.
// This is used for HTTP X-PAYMENT headers and other transport encoding needs.
//
// Returns an error if JSON marshaling fails.
func EncodePayment(payment x402.PaymentPayload) (string, error) {
	paymentJSON, err := json.Marshal(payment)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payment: %w", err)
	}
	return base64.StdEncoding.EncodeToString(paymentJSON), nil
}

// DecodePayment converts a base64-encoded JSON string to PaymentPayload.
//
// Returns an error if base64 decoding or JSON unmarshaling fails.
func DecodePayment(encoded string) (x402.PaymentPayload, error) {
	var payment x402.PaymentPayload

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return payment, fmt.Errorf("failed to decode base64: %w", err)
	}

	if err := json.Unmarshal(decoded, &payment); err != nil {
		return payment, fmt.Errorf("failed to unmarshal payment: %w", err)
	}

	return payment, nil
}

// EncodeSettlement converts a SettlementResponse to base64-encoded JSON string.
// This is used for HTTP X-PAYMENT-RESPONSE headers.
//
// Returns an error if JSON marshaling fails.
func EncodeSettlement(settlement x402.SettlementResponse) (string, error) {
	settlementJSON, err := json.Marshal(settlement)
	if err != nil {
		return "", fmt.Errorf("failed to marshal settlement: %w", err)
	}
	return base64.StdEncoding.EncodeToString(settlementJSON), nil
}

// DecodeSettlement converts a base64-encoded JSON string to SettlementResponse.
//
// Returns an error if base64 decoding or JSON unmarshaling fails.
func DecodeSettlement(encoded string) (x402.SettlementResponse, error) {
	var settlement x402.SettlementResponse

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return settlement, fmt.Errorf("failed to decode base64: %w", err)
	}

	if err := json.Unmarshal(decoded, &settlement); err != nil {
		return settlement, fmt.Errorf("failed to unmarshal settlement: %w", err)
	}

	return settlement, nil
}

// EncodeRequirements converts PaymentRequirementsResponse to base64-encoded JSON.
//
// Returns an error if JSON marshaling fails.
func EncodeRequirements(requirements x402.PaymentRequirementsResponse) (string, error) {
	reqJSON, err := json.Marshal(requirements)
	if err != nil {
		return "", fmt.Errorf("failed to marshal requirements: %w", err)
	}
	return base64.StdEncoding.EncodeToString(reqJSON), nil
}

// DecodeRequirements converts base64-encoded JSON to PaymentRequirementsResponse.
//
// Returns an error if base64 decoding or JSON unmarshaling fails.
func DecodeRequirements(encoded string) (x402.PaymentRequirementsResponse, error) {
	var requirements x402.PaymentRequirementsResponse

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return requirements, fmt.Errorf("failed to decode base64: %w", err)
	}

	if err := json.Unmarshal(decoded, &requirements); err != nil {
		return requirements, fmt.Errorf("failed to unmarshal requirements: %w", err)
	}

	return requirements, nil
}
