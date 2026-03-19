package x402

import (
	"context"
	"time"
)

// Payment represents a parsed X-PAYMENT header
type Payment struct {
	X402Version int         `json:"x402Version"`
	Scheme      string      `json:"scheme"`
	Network     string      `json:"network"`
	Payload     interface{} `json:"payload"`
}

// PaymentRequirements describes what payment is required for a resource
type PaymentRequirements struct {
	X402Version       int                    `json:"x402Version"`
	Scheme            string                 `json:"scheme"`
	Network           string                 `json:"network"`
	MaxAmountRequired string                 `json:"maxAmountRequired"`
	Resource          string                 `json:"resource"`
	Description       string                 `json:"description,omitempty"`
	MimeType          string                 `json:"mimeType,omitempty"`
	Recipient         string                 `json:"recipient"`
	ValidBefore       int64                  `json:"validBefore"`
	AssetContract     string                 `json:"assetContract"`
	Metadata          Metadata               `json:"metadata,omitempty"`
	OutputSchema      map[string]interface{} `json:"outputSchema,omitempty"`
}

// Metadata contains scheme-specific metadata
type Metadata struct {
	TokenSymbol  string `json:"tokenSymbol,omitempty"`
	TokenName    string `json:"tokenName,omitempty"`
	TokenDecimals int   `json:"tokenDecimals,omitempty"`
}

// PaymentRequiredResponse is the response body when returning 402
type PaymentRequiredResponse struct {
	Error               string                `json:"error"`
	PaymentRequirements []PaymentRequirements `json:"paymentRequirements"`
}

// VerificationResult contains the result of payment verification
type VerificationResult struct {
	Valid     bool
	Reason    string
	PayerAddress string
	Amount    string
	TokenSymbol string
}

// SettlementResult contains the result of payment settlement
type SettlementResult struct {
	TransactionHash string
	Status          string
	SettledAt       time.Time
	Amount          string
	PayerAddress    string
	RecipientAddress string
}

// PaymentResponse is sent in the X-PAYMENT-RESPONSE header
type PaymentResponse struct {
	TransactionHash string `json:"transactionHash,omitempty"`
	Status          string `json:"status"`
	Message         string `json:"message,omitempty"`
}

// NetworkInfo describes a supported blockchain network
type NetworkInfo struct {
	Network       string
	ChainID       string
	ChainType     string // "evm", "solana", "bitcoin", etc.
	NativeCurrency string
}

// ChainVerifier is the interface that payment verification backends must implement
// This abstraction allows support for multiple blockchains (EVM, Solana, Lightning, etc.)
type ChainVerifier interface {
	// Verify checks if a payment is valid without settling it
	Verify(ctx context.Context, payment *Payment) (*VerificationResult, error)

	// Settle executes the payment on-chain and returns settlement details
	Settle(ctx context.Context, payment *Payment) (*SettlementResult, error)

	// SupportedNetworks returns the list of blockchain networks this verifier supports
	SupportedNetworks() []NetworkInfo
}

// PaymentContext contains payment information that can be extracted in gRPC handlers
type PaymentContext struct {
	Verified      bool
	PayerAddress  string
	Amount        string
	TokenSymbol   string
	Network       string
	TransactionHash string
	SettledAt     time.Time
}

type contextKey string

const (
	// PaymentContextKey is the key used to store payment context in request context
	PaymentContextKey contextKey = "x402-payment"
)
