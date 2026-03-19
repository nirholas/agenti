package x402

import (
	"encoding/base64"
	"encoding/json"
	"math/big"
)

// PaymentRequirement represents a payment method from the server
type PaymentRequirement struct {
	Scheme            string            `json:"scheme"`
	Network           string            `json:"network"`
	MaxAmountRequired string            `json:"maxAmountRequired"`
	Asset             string            `json:"asset"`
	PayTo             string            `json:"payTo"`
	Resource          string            `json:"resource"`
	Description       string            `json:"description"`
	MimeType          string            `json:"mimeType,omitempty"`
	OutputSchema      interface{}       `json:"outputSchema,omitempty"`
	MaxTimeoutSeconds int               `json:"maxTimeoutSeconds"`
	Extra             map[string]string `json:"extra,omitempty"`
}

// PaymentRequirementsResponse is the 402 response body
type PaymentRequirementsResponse struct {
	X402Version int                  `json:"x402Version"`
	Error       string               `json:"error"`
	Accepts     []PaymentRequirement `json:"accepts"`
}

// PaymentPayload is the signed payment sent in X-PAYMENT header
type PaymentPayload struct {
	X402Version int    `json:"x402Version"`
	Scheme      string `json:"scheme"`
	Network     string `json:"network"`
	Payload     any    `json:"payload"`
}

// PaymentPayloadData contains the signature and authorization
type PaymentPayloadData struct {
	Signature     string               `json:"signature"`
	Authorization PaymentAuthorization `json:"authorization"`
}

// PaymentAuthorization contains EIP-3009 authorization data
type PaymentAuthorization struct {
	From        string `json:"from"`
	To          string `json:"to"`
	Value       string `json:"value"`
	ValidAfter  string `json:"validAfter"`
	ValidBefore string `json:"validBefore"`
	Nonce       string `json:"nonce"`
}

// NewSVMPayload creates a Solana (SVM) payment payload with a base64-encoded transaction
func NewSVMPayload(transactionBase64 string) map[string]any {
	return map[string]any{
		"transaction": transactionBase64,
	}
}

// Encode encodes the payment payload as base64 for the X-PAYMENT header
func (p *PaymentPayload) Encode() string {
	data, _ := json.Marshal(p)
	return base64.StdEncoding.EncodeToString(data)
}

// SettlementResponse represents the X-PAYMENT-RESPONSE header content
type SettlementResponse struct {
	Success     bool   `json:"success"`
	Transaction string `json:"transaction"`
	Network     string `json:"network"`
	Payer       string `json:"payer"`
	ErrorReason string `json:"errorReason,omitempty"`
}

// PaymentEvent represents a payment lifecycle event
type PaymentEvent struct {
	Type           PaymentEventType
	Resource       string
	Method         string
	Amount         *big.Int
	Network        string
	Asset          string
	Recipient      string
	Transaction    string
	Error          error
	Timestamp      int64
	SignerIndex    int    // Position in signers array
	SignerPriority int    // Signer's priority value
	SignerAddress  string // Signer's address
	AttemptNumber  int    // Sequential attempt count
}

// PaymentEventType represents types of payment events
type PaymentEventType string

const (
	PaymentEventAttempt       PaymentEventType = "attempt"
	PaymentEventSuccess       PaymentEventType = "success"
	PaymentEventFailure       PaymentEventType = "failure"
	PaymentEventSignerAttempt PaymentEventType = "signer_attempt"
	PaymentEventSignerSuccess PaymentEventType = "signer_success"
	PaymentEventSignerFailure PaymentEventType = "signer_failure"
)

// ClientPaymentOption represents a payment method the client accepts
type ClientPaymentOption struct {
	PaymentRequirement

	// Client-specific fields
	Priority   int      `json:"-"` // Lower number = higher priority
	MaxAmount  string   `json:"-"` // Client's max willing to pay with this option
	MinBalance string   `json:"-"` // Don't use if balance falls below this
	ChainID    *big.Int `json:"-"` // Chain ID for signing (EVM networks)
	NetworkID  string   `json:"-"` // Network ID for non-EVM networks (e.g., "mainnet-beta", "devnet")
}
