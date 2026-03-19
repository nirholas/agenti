package x402

import "math/big"

type InputSchemaType string

const (
	InputSchemaTypeHTTP InputSchemaType = "http"
)

type InputSchemaMethod string

const (
	InputSchemaMethodGET     InputSchemaMethod = "GET"
	InputSchemaMethodPOST    InputSchemaMethod = "POST"
	InputSchemaMethodPUT     InputSchemaMethod = "PUT"
	InputSchemaMethodDELETE  InputSchemaMethod = "DELETE"
	InputSchemaMethodPATCH   InputSchemaMethod = "PATCH"
	InputSchemaMethodOPTIONS InputSchemaMethod = "OPTIONS"
	InputSchemaMethodHEAD    InputSchemaMethod = "HEAD"
)

type InputSchemaBodyType string

const (
	InputSchemaBodyTypeJSON              InputSchemaBodyType = "json"
	InputSchemaBodyTypeFormData          InputSchemaBodyType = "form-data"
	InputSchemaBodyTypeMultipartFormData InputSchemaBodyType = "multipart-form-data"
	InputSchemaBodyTypeText              InputSchemaBodyType = "text"
	InputSchemaBodyTypeBinary            InputSchemaBodyType = "binary"
)

// FieldDef defines the schema for a single field in the request or response. (https://www.x402scan.com)
type FieldDef struct {
	Type        string              `json:"type,omitempty"`
	Required    bool                `json:"required,omitempty"`
	Description string              `json:"description,omitempty"`
	Enum        []string            `json:"enum,omitempty"`
	Properties  map[string]FieldDef `json:"properties,omitempty"`
	Items       []FieldDef          `json:"items,omitempty"`
}

// InputSchema defines the expected structure of the client request. (https://www.x402scan.com)
type InputSchema struct {
	Type         InputSchemaType     `json:"type"`
	Method       InputSchemaMethod   `json:"method"`
	BodyType     InputSchemaBodyType `json:"bodyType,omitempty"`
	QueryParams  map[string]FieldDef `json:"queryParams,omitempty"`
	BodyFields   map[string]FieldDef `json:"bodyFields,omitempty"`
	HeaderFields map[string]FieldDef `json:"headerFields,omitempty"`
}

// OutputSchema defines the expected structure of the server response. (https://www.x402scan.com)
type OutputSchema struct {
	Input  InputSchema         `json:"input,omitempty"`
	Output map[string]FieldDef `json:"output,omitempty"`
}

// PaymentRequirement represents a single payment option from a 402 response.
type PaymentRequirement struct {
	// Scheme is the payment scheme identifier (e.g., "exact").
	Scheme string `json:"scheme"`

	// Network is the blockchain network identifier (e.g., "base", "solana").
	Network string `json:"network"`

	// MaxAmountRequired is the payment amount in atomic units (e.g., wei, lamports).
	MaxAmountRequired string `json:"maxAmountRequired"`

	// Asset is the token contract address (EVM) or mint address (Solana).
	Asset string `json:"asset"`

	// PayTo is the recipient address for the payment.
	PayTo string `json:"payTo"`

	// Resource is the URL of the protected resource.
	Resource string `json:"resource"`

	// Description is an optional human-readable payment description.
	Description string `json:"description"`

	// MimeType is the content type of the protected resource.
	MimeType string `json:"mimeType"`

	// MaxTimeoutSeconds is the validity period for the payment authorization.
	MaxTimeoutSeconds int `json:"maxTimeoutSeconds"`

	// Extra contains scheme-specific additional data.
	Extra map[string]interface{} `json:"extra"`

	// OutputSchema defines the expected structure of the server response. (https://www.x402scan.com/)
	OutputSchema *OutputSchema `json:"outputSchema,omitempty"`
}

// PaymentRequirementsResponse represents the complete 402 response body.
type PaymentRequirementsResponse struct {
	// X402Version is the protocol version (currently 1).
	X402Version int `json:"x402Version"`

	// Error is a human-readable error message.
	Error string `json:"error"`

	// Accepts is an array of payment options the server will accept.
	Accepts []PaymentRequirement `json:"accepts"`
}

// PaymentPayload represents a signed payment that will be sent to the server.
type PaymentPayload struct {
	// X402Version is the protocol version (currently 1).
	X402Version int `json:"x402Version"`

	// Scheme is the payment scheme identifier (e.g., "exact").
	Scheme string `json:"scheme"`

	// Network is the blockchain network identifier.
	Network string `json:"network"`

	// Payload contains the blockchain-specific signed payment data.
	// For EVM: EVMPayload with signature and authorization
	// For Solana: SVMPayload with partially signed transaction
	Payload interface{} `json:"payload"`
}

// TokenConfig represents configuration for a supported token.
type TokenConfig struct {
	// Address is the token contract address (EVM) or mint address (Solana).
	Address string

	// Symbol is the token symbol (e.g., "USDC", "SOL").
	Symbol string

	// Decimals is the number of decimal places for the token.
	Decimals int

	// Priority is the token's priority level within the signer.
	// Lower numbers indicate higher priority (1 > 2 > 3).
	// Default is 0 if not set.
	Priority int

	// Name is an optional human-readable token name.
	Name string
}

// EVMPayload represents an EVM payment with EIP-3009 authorization.
type EVMPayload struct {
	// Signature is the hex-encoded ECDSA signature.
	Signature string `json:"signature"`

	// Authorization contains the EIP-3009 transferWithAuthorization parameters.
	Authorization EVMAuthorization `json:"authorization"`
}

// EVMAuthorization represents EIP-3009 transferWithAuthorization parameters.
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

// SVMPayload represents a Solana payment with a partially signed transaction.
type SVMPayload struct {
	// Transaction is the base64-encoded partially signed Solana transaction.
	// The client signs with their private key, and the facilitator adds the fee payer signature.
	Transaction string `json:"transaction"`
}

// SettlementResponse represents the server's response after payment settlement.
type SettlementResponse struct {
	// Success indicates whether the payment was successfully settled.
	Success bool `json:"success"`

	// ErrorReason provides details if the payment failed.
	ErrorReason string `json:"errorReason,omitempty"`

	// Transaction is the blockchain transaction hash.
	Transaction string `json:"transaction,omitempty"`

	// Network is the blockchain network where the payment was settled.
	Network string `json:"network"`

	// Payer is the address that made the payment.
	Payer string `json:"payer"`
}

// AmountToBigInt converts a decimal amount string to *big.Int in atomic units.
// For example, "1.5" with 6 decimals becomes 1500000.
func AmountToBigInt(amount string, decimals int) (*big.Int, error) {
	// Parse decimal string and convert to atomic units
	value := new(big.Float)
	if _, ok := value.SetString(amount); !ok {
		return nil, ErrInvalidAmount
	}

	// Multiply by 10^decimals
	multiplier := new(big.Float).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil))
	value.Mul(value, multiplier)

	// Convert to integer
	result, accuracy := value.Int(nil)
	if accuracy != big.Exact {
		return nil, ErrInvalidAmount
	}
	return result, nil
}

// BigIntToAmount converts a *big.Int in atomic units to a decimal string.
// For example, 1500000 with 6 decimals becomes "1.5".
func BigIntToAmount(value *big.Int, decimals int) string {
	if value == nil {
		return "0"
	}

	// Convert to float and divide by 10^decimals
	f := new(big.Float).SetInt(value)
	divisor := new(big.Float).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil))
	f.Quo(f, divisor)

	return f.Text('f', decimals)
}
