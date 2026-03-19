package types

import "encoding/json"

// Specification: https://github.com/coinbase/x402/tree/main?tab=readme-ov-file#type-specifications

// PaymentRequirements defines the structure for accepted payments by the resource server.
// This corresponds to the server's response in the 402 Payment Required flow.
type PaymentRequirements struct {
	// Scheme of the payment protocol to use (e.g., "exact")
	Scheme string `json:"scheme"`
	// Network of the blockchain to send payment on (e.g., "base-sepolia")
	Network string `json:"network"`
	// Maximum amount required to pay for the resource in atomic units
	MaxAmountRequired string `json:"maxAmountRequired"`
	// URL of the resource to pay for
	Resource string `json:"resource"`
	// Description of the resource
	Description string `json:"description"`
	// MIME type of the resource response
	MimeType string `json:"mimeType"`
	// Address to pay value to
	PayTo string `json:"payTo"`
	// Maximum time in seconds for the resource server to respond
	MaxTimeoutSeconds int `json:"maxTimeoutSeconds"`
	// Address of the EIP-3009 compliant ERC20 contract
	Asset string `json:"asset"`
	// Output schema of the resource response (optional)
	OutputSchema *json.RawMessage `json:"outputSchema,omitempty"`
	// Extra information about the payment details specific to the scheme
	Extra *json.RawMessage `json:"extra,omitempty"`
}

// PaymentPayload represents the data the client sends in the X-PAYMENT header.
type PaymentPayload struct {
	// Version of the x402 payment protocol
	X402Version int `json:"x402Version"`
	// Scheme value of the accepted paymentRequirements the client is using to pay
	Scheme string `json:"scheme"`
	// Network ID of the accepted paymentRequirements the client is using to pay
	Network string `json:"network"`
	// Payload is E-dependent and may contain authorization and signature data
	Payload json.RawMessage `json:"payload"`
}

// PaymentVerifyRequest is the request body sent to facilitator's /verify endpoint.
type PaymentVerifyRequest struct {
	X402Version         int                 `json:"x402Version"`
	PaymentHeader       PaymentPayload      `json:"paymentHeader"`
	PaymentRequirements PaymentRequirements `json:"paymentRequirements"`
}

// PaymentVerifyResponse is the response returned from the /verify endpoint.
type PaymentVerifyResponse struct {
	// Whether the payment payload is valid
	IsValid bool `json:"isValid"`
	// Error message or reason for invalidity, if applicable
	InvalidReason string `json:"invalidReason,omitempty"`
	Payer         string `json:"payer,omitempty"`
}

// PaymentSettleRequest is the request body sent to facilitator's /settle endpoint.
type PaymentSettleRequest struct {
	X402Version         int                 `json:"x402Version"`
	PaymentHeader       PaymentPayload      `json:"paymentHeader"`
	PaymentRequirements PaymentRequirements `json:"paymentRequirements"`
}

// PaymentSettleResponse is the response from the /settle endpoint.
type PaymentSettleResponse struct {
	// Whether the payment was successful
	Success bool `json:"success"`
	// Error message, if any
	Error string `json:"error,omitempty"`
	// Transaction hash of the settled payment
	TxHash string `json:"txHash,omitempty"`
	// Network ID where the transaction was submitted
	NetworkId string `json:"networkId,omitempty"`
}

// SupportedKind represents a supported scheme and network pair
// used in the /supported endpoint.
type SupportedKind struct {
	Scheme  string `json:"scheme"`
	Network string `json:"network"`
}

// SupportedResponse is the response structure returned from the /supported endpoint.
type SupportedResponse struct {
	Kinds []SupportedKind `json:"kinds"`
}
