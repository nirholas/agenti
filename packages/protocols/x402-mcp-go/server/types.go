package server

// PaymentRequirement defines payment requirements for a resource/tool
// as defined in the x402 specification section 5.1
type PaymentRequirement struct {
	Scheme            string            `json:"scheme"`
	Network           string            `json:"network"`
	MaxAmountRequired string            `json:"maxAmountRequired"`
	Asset             string            `json:"asset"`
	PayTo             string            `json:"payTo"`
	Resource          string            `json:"resource"`
	Description       string            `json:"description"`
	MimeType          string            `json:"mimeType"`
	OutputSchema      any               `json:"outputSchema,omitempty"`
	MaxTimeoutSeconds int               `json:"maxTimeoutSeconds"`
	Extra             map[string]string `json:"extra,omitempty"`
}

// PaymentRequirements402Response is the HTTP 402 response body
type PaymentRequirements402Response struct {
	X402Version int                  `json:"x402Version"`
	Error       string               `json:"error"`
	Accepts     []PaymentRequirement `json:"accepts"`
}

// PaymentPayload represents the X-PAYMENT header content
// as defined in the x402 specification section 5.2
type PaymentPayload struct {
	X402Version int    `json:"x402Version"`
	Scheme      string `json:"scheme"`
	Network     string `json:"network"`
	Payload     any    `json:"payload"`
}

// SettlementResponse is included in X-PAYMENT-RESPONSE header
// as defined in the x402 specification section 5.3
type SettlementResponse struct {
	Success     bool   `json:"success"`
	Transaction string `json:"transaction"`
	Network     string `json:"network"`
	Payer       string `json:"payer"`
	ErrorReason string `json:"errorReason,omitempty"`
}

// VerifyRequest sent to facilitator /verify endpoint
// as defined in the x402 specification section 7.1
// Note: x402Version added at root level for facilitator compatibility
type VerifyRequest struct {
	X402Version         int                 `json:"x402Version"`
	PaymentPayload      *PaymentPayload     `json:"paymentPayload"`
	PaymentRequirements *PaymentRequirement `json:"paymentRequirements"`
}

// VerifyResponse from facilitator
// as defined in the x402 specification section 7.1
type VerifyResponse struct {
	IsValid       bool   `json:"isValid"`
	Payer         string `json:"payer"`
	InvalidReason string `json:"invalidReason,omitempty"`
}

// SettleRequest sent to facilitator /settle endpoint
// as defined in the x402 specification section 7.2
// Note: x402Version added at root level for facilitator compatibility
type SettleRequest struct {
	X402Version         int                 `json:"x402Version"`
	PaymentPayload      *PaymentPayload     `json:"paymentPayload"`
	PaymentRequirements *PaymentRequirement `json:"paymentRequirements"`
}

// SettleResponse from facilitator
// as defined in the x402 specification section 7.2
type SettleResponse struct {
	Success     bool   `json:"success"`
	Payer       string `json:"payer"`
	Transaction string `json:"transaction"`
	Network     string `json:"network"`
	ErrorReason string `json:"errorReason,omitempty"`
}

// Config for X402Server
type Config struct {
	// FacilitatorURL is the base URL of the x402 facilitator service
	FacilitatorURL string

	// PaymentTools maps tool names to their payment requirements
	// Each tool can have multiple payment options
	PaymentTools map[string][]PaymentRequirement

	// VerifyOnly if true, only verifies but doesn't settle payments
	VerifyOnly bool

	// Verbose if true, logs detailed request and payment information
	Verbose bool
}
