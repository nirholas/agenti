package evm

// EVMPayload represents the payload in X-PAYMENT header for EVM chains
// Following the EIP-3009 transferWithAuthorization specification
type EVMPayload struct {
	Signature     string         `json:"signature"`
	Authorization *Authorization `json:"authorization"`
}

// Authorization contains the EIP-3009 authorization parameters
type Authorization struct {
	From        string `json:"from"`        // Payer's address
	To          string `json:"to"`          // Recipient address
	Value       string `json:"value"`       // Amount in token units
	ValidAfter  int64  `json:"validAfter"`  // Unix timestamp
	ValidBefore int64  `json:"validBefore"` // Unix timestamp
	Nonce       string `json:"nonce"`       // Unique nonce to prevent replay
}

// FacilitatorVerifyRequest is the request to the facilitator's /verify endpoint
type FacilitatorVerifyRequest struct {
	X402Version int         `json:"x402Version"`
	Scheme      string      `json:"scheme"`
	Network     string      `json:"network"`
	Payload     interface{} `json:"payload"`
}

// FacilitatorVerifyResponse is the response from /verify
type FacilitatorVerifyResponse struct {
	Valid  bool   `json:"valid"`
	Reason string `json:"reason,omitempty"`
}

// FacilitatorSettleRequest is the request to the facilitator's /settle endpoint
type FacilitatorSettleRequest struct {
	X402Version int         `json:"x402Version"`
	Scheme      string      `json:"scheme"`
	Network     string      `json:"network"`
	Payload     interface{} `json:"payload"`
}

// FacilitatorSettleResponse is the response from /settle
type FacilitatorSettleResponse struct {
	TransactionHash string `json:"transactionHash"`
	Status          string `json:"status"`
}

// FacilitatorSupportedResponse is the response from /supported
type FacilitatorSupportedResponse struct {
	Schemes  []SchemeInfo  `json:"schemes"`
	Networks []NetworkInfo `json:"networks"`
}

// SchemeInfo describes a supported payment scheme
type SchemeInfo struct {
	Scheme      string `json:"scheme"`
	Description string `json:"description,omitempty"`
}

// NetworkInfo describes a supported network
type NetworkInfo struct {
	Network        string `json:"network"`
	ChainID        string `json:"chainId"`
	ChainType      string `json:"chainType"`
	NativeCurrency string `json:"nativeCurrency,omitempty"`
}
