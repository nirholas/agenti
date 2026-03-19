package x402

import (
	"context"
	"time"
)

// PaymentRequirements describes what payment is required for a resource.
// Uses CAIP-2 network identifiers (e.g., "eip155:8453").
type PaymentRequirements struct {
	Scheme            string                 `json:"scheme"`
	Network           string                 `json:"network"`           // CAIP-2: "eip155:8453"
	Amount            string                 `json:"amount"`            // atomic units
	Asset             string                 `json:"asset"`             // token contract address
	PayTo             string                 `json:"payTo"`             // recipient address
	MaxTimeoutSeconds int                    `json:"maxTimeoutSeconds,omitempty"`
	Extra             map[string]interface{} `json:"extra,omitempty"`
}

// PaymentPayload wraps accepted requirements and scheme-specific payload.
type PaymentPayload struct {
	X402Version int                    `json:"x402Version"`
	Accepted    PaymentRequirements    `json:"accepted"`
	Payload     interface{}            `json:"payload"` // scheme-specific (e.g., EVMPayload)
	Extensions  map[string]interface{} `json:"extensions,omitempty"`
}

// SupportedKind represents a supported scheme+network pair.
type SupportedKind struct {
	Scheme  string `json:"scheme"`
	Network string `json:"network"` // CAIP-2
}

// SupportedResponse is returned by the facilitator's supported endpoint.
type SupportedResponse struct {
	Kinds      []SupportedKind   `json:"kinds"`
	Extensions []string          `json:"extensions"`
	Signers    map[string]string `json:"signers"` // CAIP-2 network -> facilitator address
}

// VerificationResult contains the result of payment verification.
type VerificationResult struct {
	Valid        bool
	Reason       string
	PayerAddress string
	Amount       string
	TokenSymbol  string
}

// SettlementResult contains the result of payment settlement.
type SettlementResult struct {
	TransactionHash  string
	Status           string
	SettledAt        time.Time
	Amount           string
	PayerAddress     string
	RecipientAddress string
	Network          string // CAIP-2
}

// PaymentResponse is sent in the PAYMENT-RESPONSE header.
type PaymentResponse struct {
	Success     bool   `json:"success"`
	Transaction string `json:"transaction,omitempty"`
	Network     string `json:"network,omitempty"` // CAIP-2
	Payer       string `json:"payer,omitempty"`
	ErrorReason string `json:"errorReason,omitempty"`
}

// PaymentRequiredResponse is the 402 response body.
type PaymentRequiredResponse struct {
	X402Version int                   `json:"x402Version"`
	Error       string                `json:"error"`
	Accepts     []PaymentRequirements `json:"accepts"`
}

// NetworkInfo describes a supported blockchain network.
type NetworkInfo struct {
	Network        string // CAIP-2
	ChainID        string
	ChainType      string
	NativeCurrency string
}

// ChainVerifier is the interface that payment verification backends must implement.
type ChainVerifier interface {
	// Verify checks if a payment is valid without settling it.
	Verify(ctx context.Context, payload *PaymentPayload, requirements *PaymentRequirements) (*VerificationResult, error)

	// Settle executes the payment on-chain and returns settlement details.
	Settle(ctx context.Context, payload *PaymentPayload, requirements *PaymentRequirements) (*SettlementResult, error)

	// SupportedKinds returns the supported scheme+network pairs.
	SupportedKinds() []SupportedKind
}

// PaymentContext contains payment information that can be extracted in handlers.
type PaymentContext struct {
	Verified        bool
	PayerAddress    string
	Amount          string
	TokenSymbol     string
	Network         string // CAIP-2
	TransactionHash string
	SettledAt       time.Time
}

type contextKey string

const (
	// PaymentContextKey is the key used to store payment context in request context.
	PaymentContextKey contextKey = "x402-payment"
)

// V1 compatibility types for parsing legacy X-PAYMENT headers.

// LegacyPayment represents a parsed V1 X-PAYMENT header.
type LegacyPayment struct {
	X402Version int         `json:"x402Version"`
	Scheme      string      `json:"scheme"`
	Network     string      `json:"network"`
	Payload     interface{} `json:"payload"`
}
