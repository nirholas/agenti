// Package v2 implements the x402 protocol version 2.
//
// The v2 protocol introduces several key changes from v1:
//   - CAIP-2 network identifiers (e.g., "eip155:8453" instead of "base")
//   - Restructured types with ResourceInfo object
//   - Extension support for protocol extensibility
//   - Simplified VerifyResponse without payload echo
//
// Import path: github.com/mark3labs/x402-go/v2
package v2

import "math/big"

// Protocol version constant
const X402Version = 2

// ResourceInfo describes the protected resource.
type ResourceInfo struct {
	// URL is the URL of the protected resource.
	URL string `json:"url"`

	// Description is an optional human-readable description.
	Description string `json:"description,omitempty"`

	// MimeType is the content type of the protected resource.
	MimeType string `json:"mimeType,omitempty"`
}

// PaymentRequirements defines a single acceptable payment option.
// This is an element in the "accepts" array of PaymentRequired.
type PaymentRequirements struct {
	// Scheme is the payment scheme identifier (e.g., "exact").
	Scheme string `json:"scheme"`

	// Network is the blockchain network in CAIP-2 format (e.g., "eip155:8453").
	Network string `json:"network"`

	// Amount is the payment amount in atomic units (e.g., wei, lamports).
	Amount string `json:"amount"`

	// Asset is the token contract address (EVM) or mint address (Solana).
	Asset string `json:"asset"`

	// PayTo is the recipient address for the payment.
	PayTo string `json:"payTo"`

	// MaxTimeoutSeconds is the validity period for the payment authorization.
	MaxTimeoutSeconds int `json:"maxTimeoutSeconds"`

	// Extra contains scheme-specific additional data.
	Extra map[string]interface{} `json:"extra,omitempty"`
}

// Extension represents a protocol extension with its data and schema.
type Extension struct {
	// Info contains the extension data.
	Info map[string]interface{} `json:"info"`

	// Schema contains the JSON schema for validating info (passthrough only, not validated).
	Schema map[string]interface{} `json:"schema"`
}

// PaymentRequired is the 402 response body sent by resource servers.
type PaymentRequired struct {
	// X402Version is the protocol version (2 for v2).
	X402Version int `json:"x402Version"`

	// Error is a human-readable error message.
	Error string `json:"error,omitempty"`

	// Resource describes the protected resource. Optional for some use cases.
	Resource *ResourceInfo `json:"resource,omitempty"`

	// Accepts is an array of payment options the server will accept.
	Accepts []PaymentRequirements `json:"accepts"`

	// Extensions contains protocol extensions (passthrough, not validated).
	Extensions map[string]Extension `json:"extensions,omitempty"`
}

// PaymentPayload is sent by clients to pay for resources.
type PaymentPayload struct {
	// X402Version is the protocol version (2 for v2).
	X402Version int `json:"x402Version"`

	// Resource optionally describes the resource being accessed.
	Resource *ResourceInfo `json:"resource,omitempty"`

	// Accepted contains the payment requirements that were accepted.
	Accepted PaymentRequirements `json:"accepted"`

	// Payload contains the blockchain-specific signed payment data.
	// For EVM: EVMPayload with signature and authorization
	// For Solana: SVMPayload with partially signed transaction
	Payload interface{} `json:"payload"`

	// Extensions contains protocol extensions (passthrough, not validated).
	Extensions map[string]Extension `json:"extensions,omitempty"`
}

// EVMPayload contains EIP-3009 authorization data for EVM payments.
type EVMPayload struct {
	// Signature is the hex-encoded ECDSA signature.
	Signature string `json:"signature"`

	// Authorization contains the EIP-3009 transferWithAuthorization parameters.
	Authorization EVMAuthorization `json:"authorization"`
}

// EVMAuthorization contains EIP-3009 transferWithAuthorization parameters.
type EVMAuthorization struct {
	// From is the payer's address.
	From string `json:"from"`

	// To is the recipient's address.
	To string `json:"to"`

	// Value is the payment amount in atomic units (wei).
	Value string `json:"value"`

	// ValidAfter is the unix timestamp after which the authorization is valid.
	ValidAfter string `json:"validAfter"`

	// ValidBefore is the unix timestamp before which the authorization is valid.
	ValidBefore string `json:"validBefore"`

	// Nonce is a unique 32-byte hex string to prevent replay attacks.
	Nonce string `json:"nonce"`
}

// SVMPayload contains a partially signed Solana transaction.
type SVMPayload struct {
	// Transaction is the base64-encoded partially signed Solana transaction.
	// The client signs with their private key, and the facilitator adds the fee payer signature.
	Transaction string `json:"transaction"`
}

// VerifyResponse is returned by the facilitator /verify endpoint.
// Note: v2 simplifies this by removing the paymentPayload echo.
type VerifyResponse struct {
	// IsValid indicates whether the payment is valid.
	IsValid bool `json:"isValid"`

	// InvalidReason provides a short error code if the payment is invalid.
	InvalidReason string `json:"invalidReason,omitempty"`

	// InvalidMessage provides a human-readable error message if the payment is invalid.
	InvalidMessage string `json:"invalidMessage,omitempty"`

	// Payer is the address that made the payment.
	Payer string `json:"payer,omitempty"`
}

// SettleResponse is returned by the facilitator /settle endpoint.
type SettleResponse struct {
	// Success indicates whether the payment was successfully settled.
	Success bool `json:"success"`

	// ErrorReason provides a short error code if the payment failed.
	ErrorReason string `json:"errorReason,omitempty"`

	// ErrorMessage provides a human-readable error message if the payment failed.
	ErrorMessage string `json:"errorMessage,omitempty"`

	// Transaction is the blockchain transaction hash.
	Transaction string `json:"transaction"`

	// Network is the blockchain network where the payment was settled (CAIP-2 format).
	Network string `json:"network"`

	// Payer is the address that made the payment.
	Payer string `json:"payer,omitempty"`
}

// SupportedKind describes a payment type supported by a facilitator.
type SupportedKind struct {
	// X402Version is the protocol version supported.
	X402Version int `json:"x402Version"`

	// Scheme is the payment scheme identifier (e.g., "exact").
	Scheme string `json:"scheme"`

	// Network is the blockchain network in CAIP-2 format.
	Network string `json:"network"`

	// Extra contains scheme-specific additional data.
	Extra map[string]interface{} `json:"extra,omitempty"`
}

// SupportedResponse is returned by the facilitator /supported endpoint.
type SupportedResponse struct {
	// Kinds lists the payment types supported by the facilitator.
	Kinds []SupportedKind `json:"kinds"`

	// Extensions lists the extension identifiers supported.
	Extensions []string `json:"extensions"`

	// Signers maps CAIP-2 network patterns to signer addresses.
	Signers map[string][]string `json:"signers"`
}

// TokenConfig defines a token supported by a signer.
type TokenConfig struct {
	// Address is the token contract address (EVM) or mint address (Solana).
	Address string

	// Symbol is the token symbol (e.g., "USDC").
	Symbol string

	// Decimals is the number of decimal places for the token.
	Decimals int

	// Priority is the token's priority level within the signer.
	// Lower numbers indicate higher priority (1 > 2 > 3).
	Priority int

	// Name is an optional human-readable token name.
	Name string
}

// AmountToBigInt converts a decimal amount string to *big.Int in atomic units.
// For example, "1.5" with 6 decimals becomes 1500000.
// Returns ErrInvalidAmount if the amount is negative or decimals is negative.
func AmountToBigInt(amount string, decimals int) (*big.Int, error) {
	// Reject negative decimals
	if decimals < 0 {
		return nil, ErrInvalidAmount
	}

	value := new(big.Rat)
	if _, ok := value.SetString(amount); !ok {
		return nil, ErrInvalidAmount
	}

	// Reject negative amounts
	if value.Sign() < 0 {
		return nil, ErrInvalidAmount
	}

	scale := new(big.Rat).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil))
	value.Mul(value, scale)

	if value.Denom().Cmp(big.NewInt(1)) != 0 {
		return nil, ErrInvalidAmount
	}
	return new(big.Int).Set(value.Num()), nil
}

// BigIntToAmount converts a *big.Int in atomic units to a decimal string.
// For example, 1500000 with 6 decimals becomes "1.500000".
func BigIntToAmount(value *big.Int, decimals int) string {
	if value == nil {
		return "0"
	}

	rat := new(big.Rat).SetInt(value)
	scale := new(big.Rat).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil))
	rat.Quo(rat, scale)

	return rat.FloatString(decimals)
}
