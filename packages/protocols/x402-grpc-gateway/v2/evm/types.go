package evm

// EVMPayload represents the EVM-specific payload in a payment.
// Following the EIP-3009 transferWithAuthorization specification.
type EVMPayload struct {
	Signature     string         `json:"signature"`
	Authorization *Authorization `json:"authorization"`
}

// Authorization contains the EIP-3009 authorization parameters.
type Authorization struct {
	From        string `json:"from"`
	To          string `json:"to"`
	Value       string `json:"value"`
	ValidAfter  int64  `json:"validAfter"`
	ValidBefore int64  `json:"validBefore"`
	Nonce       string `json:"nonce"`
}

// FacilitatorVerifyRequest is the V2 request to /v2/x402/verify.
type FacilitatorVerifyRequest struct {
	Payload      interface{} `json:"payload"`      // PaymentPayload
	Requirements interface{} `json:"requirements"` // PaymentRequirements
}

// FacilitatorVerifyResponse is the V2 response from /v2/x402/verify.
type FacilitatorVerifyResponse struct {
	IsValid       bool   `json:"isValid"`
	InvalidReason string `json:"invalidReason,omitempty"`
	Payer         string `json:"payer,omitempty"`
}

// FacilitatorSettleRequest is the V2 request to /v2/x402/settle.
type FacilitatorSettleRequest struct {
	Payload      interface{} `json:"payload"`
	Requirements interface{} `json:"requirements"`
}

// FacilitatorSettleResponse is the V2 response from /v2/x402/settle.
type FacilitatorSettleResponse struct {
	Success     bool   `json:"success"`
	ErrorReason string `json:"errorReason,omitempty"`
	Payer       string `json:"payer,omitempty"`
	Transaction string `json:"transaction,omitempty"`
	Network     string `json:"network,omitempty"` // CAIP-2
}

// FacilitatorSupportedResponse is the V2 response from /v2/x402/supported.
type FacilitatorSupportedResponse struct {
	Kinds      []SupportedKind   `json:"kinds"`
	Extensions []string          `json:"extensions"`
	Signers    map[string]string `json:"signers"`
}

// SupportedKind represents a supported scheme+network pair.
type SupportedKind struct {
	Scheme  string `json:"scheme"`
	Network string `json:"network"`
}
