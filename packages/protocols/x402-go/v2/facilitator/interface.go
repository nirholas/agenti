// Package facilitator defines the interface for x402 v2 payment facilitator operations.
//
// A facilitator is responsible for verifying payment authorizations and settling
// payments on the blockchain. This package defines the interface that both HTTP
// and MCP facilitator implementations must satisfy.
package facilitator

import (
	"context"

	v2 "github.com/mark3labs/x402-go/v2"
)

// Interface defines the standard facilitator contract for payment verification and settlement.
// Both HTTP and MCP facilitator implementations satisfy this interface.
type Interface interface {
	// Verify verifies a payment authorization without executing the transaction.
	// It checks that the payment payload is valid, properly signed, and the
	// payer has sufficient funds.
	Verify(ctx context.Context, payload v2.PaymentPayload, requirements v2.PaymentRequirements) (*v2.VerifyResponse, error)

	// Settle executes a verified payment on the blockchain.
	// This should only be called after successful verification.
	Settle(ctx context.Context, payload v2.PaymentPayload, requirements v2.PaymentRequirements) (*v2.SettleResponse, error)

	// Supported queries the facilitator for supported payment types, extensions, and signers.
	Supported(ctx context.Context) (*v2.SupportedResponse, error)
}

// VerifyRequest is the request payload sent to POST /verify.
type VerifyRequest struct {
	// X402Version is the protocol version (2 for v2).
	X402Version int `json:"x402Version"`

	// PaymentPayload contains the signed payment data from the client.
	PaymentPayload v2.PaymentPayload `json:"paymentPayload"`

	// PaymentRequirements contains the payment option that was accepted.
	PaymentRequirements v2.PaymentRequirements `json:"paymentRequirements"`
}

// SettleRequest is the request payload sent to POST /settle.
type SettleRequest struct {
	// X402Version is the protocol version (2 for v2).
	X402Version int `json:"x402Version"`

	// PaymentPayload contains the signed payment data from the client.
	PaymentPayload v2.PaymentPayload `json:"paymentPayload"`

	// PaymentRequirements contains the payment option that was accepted.
	PaymentRequirements v2.PaymentRequirements `json:"paymentRequirements"`
}
