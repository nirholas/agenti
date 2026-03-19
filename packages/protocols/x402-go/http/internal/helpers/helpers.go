// Package helpers provides shared helper functions for x402 HTTP middleware implementations.
// These helpers are used by stdlib, Gin, PocketBase, and Chi middleware to ensure consistent behavior.
package helpers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/mark3labs/x402-go"
	"github.com/mark3labs/x402-go/encoding"
)

// ParsePaymentHeaderFromRequest parses the X-PAYMENT header from an http.Request and returns the payment payload.
// It decodes the base64-encoded JSON and validates the x402 protocol version.
//
// Returns x402.ErrMalformedHeader if the header is missing, invalid base64, or invalid JSON.
// Returns x402.ErrUnsupportedVersion if X402Version != 1.
func ParsePaymentHeaderFromRequest(r *http.Request) (x402.PaymentPayload, error) {
	var payment x402.PaymentPayload

	headerValue := r.Header.Get("X-PAYMENT")
	if headerValue == "" {
		return payment, x402.ErrMalformedHeader
	}

	// Decode base64-encoded JSON
	payment, err := encoding.DecodePayment(headerValue)
	if err != nil {
		return payment, fmt.Errorf("%w: %v", x402.ErrMalformedHeader, err)
	}

	// Validate version
	if payment.X402Version != 1 {
		return payment, x402.ErrUnsupportedVersion
	}

	return payment, nil
}

// FindMatchingRequirement finds a payment requirement that matches the provided payment's scheme and network.
// This is a wrapper around x402.FindMatchingRequirement that returns a value instead of a pointer
// for backwards compatibility with existing HTTP middleware code.
//
// Returns x402.ErrUnsupportedScheme if no matching requirement is found.
func FindMatchingRequirement(payment x402.PaymentPayload, requirements []x402.PaymentRequirement) (x402.PaymentRequirement, error) {
	req, err := x402.FindMatchingRequirement(payment, requirements)
	if err != nil {
		return x402.PaymentRequirement{}, err
	}
	return *req, nil
}

// SendPaymentRequired sends a 402 Payment Required response with payment requirements in JSON format.
// The response includes x402Version field and the list of accepted payment methods.
func SendPaymentRequired(w http.ResponseWriter, requirements []x402.PaymentRequirement) {
	response := x402.PaymentRequirementsResponse{
		X402Version: 1,
		Error:       "Payment required for this resource",
		Accepts:     requirements,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusPaymentRequired)
	// Ignore encoding errors - headers are already sent with 402 status
	// The response body may be incomplete, but the client will see the correct status code
	_ = json.NewEncoder(w).Encode(response)
}

// AddPaymentResponseHeader adds the X-PAYMENT-RESPONSE header with base64-encoded settlement information.
// The header contains JSON-encoded SettlementResponse data.
//
// Returns an error if encoding fails.
func AddPaymentResponseHeader(w http.ResponseWriter, settlement *x402.SettlementResponse) error {
	// Encode settlement response
	encoded, err := encoding.EncodeSettlement(*settlement)
	if err != nil {
		return err
	}

	// Set header
	w.Header().Set("X-PAYMENT-RESPONSE", encoded)
	return nil
}
