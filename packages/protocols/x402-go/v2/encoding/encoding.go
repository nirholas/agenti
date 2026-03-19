// Package encoding provides utilities for encoding and decoding x402 v2 payment data.
// It handles base64 and JSON marshaling for payment payloads, settlements, and requirements.
package encoding

import (
	"encoding/base64"
	"encoding/json"
	"fmt"

	v2 "github.com/mark3labs/x402-go/v2"
)

// EncodePayment converts a PaymentPayload to base64-encoded JSON string.
// This is used for HTTP X-PAYMENT headers and other transport encoding needs.
//
// Returns an error if JSON marshaling fails.
func EncodePayment(payment v2.PaymentPayload) (string, error) {
	paymentJSON, err := json.Marshal(payment)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payment: %w", err)
	}
	return base64.StdEncoding.EncodeToString(paymentJSON), nil
}

// DecodePayment converts a base64-encoded JSON string to PaymentPayload.
//
// Returns an error if base64 decoding or JSON unmarshaling fails.
func DecodePayment(encoded string) (v2.PaymentPayload, error) {
	var payment v2.PaymentPayload

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return payment, fmt.Errorf("failed to decode base64: %w", err)
	}

	if err := json.Unmarshal(decoded, &payment); err != nil {
		return payment, fmt.Errorf("failed to unmarshal payment: %w", err)
	}

	return payment, nil
}

// EncodeSettlement converts a SettleResponse to base64-encoded JSON string.
// This is used for HTTP X-PAYMENT-RESPONSE headers.
//
// Returns an error if JSON marshaling fails.
func EncodeSettlement(settlement v2.SettleResponse) (string, error) {
	settlementJSON, err := json.Marshal(settlement)
	if err != nil {
		return "", fmt.Errorf("failed to marshal settlement: %w", err)
	}
	return base64.StdEncoding.EncodeToString(settlementJSON), nil
}

// DecodeSettlement converts a base64-encoded JSON string to SettleResponse.
//
// Returns an error if base64 decoding or JSON unmarshaling fails.
func DecodeSettlement(encoded string) (v2.SettleResponse, error) {
	var settlement v2.SettleResponse

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return settlement, fmt.Errorf("failed to decode base64: %w", err)
	}

	if err := json.Unmarshal(decoded, &settlement); err != nil {
		return settlement, fmt.Errorf("failed to unmarshal settlement: %w", err)
	}

	return settlement, nil
}

// EncodeRequirements converts PaymentRequired to base64-encoded JSON.
//
// Returns an error if JSON marshaling fails.
func EncodeRequirements(requirements v2.PaymentRequired) (string, error) {
	reqJSON, err := json.Marshal(requirements)
	if err != nil {
		return "", fmt.Errorf("failed to marshal requirements: %w", err)
	}
	return base64.StdEncoding.EncodeToString(reqJSON), nil
}

// DecodeRequirements converts base64-encoded JSON to PaymentRequired.
//
// Returns an error if base64 decoding or JSON unmarshaling fails.
func DecodeRequirements(encoded string) (v2.PaymentRequired, error) {
	var requirements v2.PaymentRequired

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return requirements, fmt.Errorf("failed to decode base64: %w", err)
	}

	if err := json.Unmarshal(decoded, &requirements); err != nil {
		return requirements, fmt.Errorf("failed to unmarshal requirements: %w", err)
	}

	return requirements, nil
}

// EncodeVerifyResponse converts a VerifyResponse to base64-encoded JSON string.
//
// Returns an error if JSON marshaling fails.
func EncodeVerifyResponse(response v2.VerifyResponse) (string, error) {
	responseJSON, err := json.Marshal(response)
	if err != nil {
		return "", fmt.Errorf("failed to marshal verify response: %w", err)
	}
	return base64.StdEncoding.EncodeToString(responseJSON), nil
}

// DecodeVerifyResponse converts a base64-encoded JSON string to VerifyResponse.
//
// Returns an error if base64 decoding or JSON unmarshaling fails.
func DecodeVerifyResponse(encoded string) (v2.VerifyResponse, error) {
	var response v2.VerifyResponse

	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return response, fmt.Errorf("failed to decode base64: %w", err)
	}

	if err := json.Unmarshal(decoded, &response); err != nil {
		return response, fmt.Errorf("failed to unmarshal verify response: %w", err)
	}

	return response, nil
}
