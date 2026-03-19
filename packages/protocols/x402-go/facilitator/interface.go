package facilitator

import (
	"context"

	"github.com/mark3labs/x402-go"
)

// Interface defines the standard facilitator contract for payment verification and settlement.
// Both HTTP and MCP facilitator implementations satisfy this interface.
type Interface interface {
	// Verify verifies a payment authorization without executing the transaction
	Verify(ctx context.Context, payment x402.PaymentPayload, requirement x402.PaymentRequirement) (*VerifyResponse, error)

	// Settle executes a verified payment on the blockchain
	Settle(ctx context.Context, payment x402.PaymentPayload, requirement x402.PaymentRequirement) (*x402.SettlementResponse, error)

	// Supported queries the facilitator for supported payment types
	Supported(ctx context.Context) (*SupportedResponse, error)
}

// VerifyResponse contains the payment verification result from the facilitator.
type VerifyResponse struct {
	IsValid        bool                `json:"isValid"`
	InvalidReason  string              `json:"invalidReason,omitempty"`
	Payer          string              `json:"payer"`
	PaymentPayload x402.PaymentPayload `json:"paymentPayload"`
}

// SupportedKind describes a supported payment type with its configuration.
type SupportedKind struct {
	X402Version int                    `json:"x402Version"`
	Scheme      string                 `json:"scheme"`
	Network     string                 `json:"network"`
	Extra       map[string]interface{} `json:"extra,omitempty"`
}

// SupportedResponse lists all payment types supported by the facilitator.
type SupportedResponse struct {
	Kinds []SupportedKind `json:"kinds"`
}
