package caddyx402

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
)

// PaymentRequirementsResponse is the 402 response body per x402 spec v1.
type PaymentRequirementsResponse struct {
	X402Version int                   `json:"x402Version"`
	Error       string                `json:"error"`
	Accepts     []PaymentRequirements `json:"accepts"`
}

// PaymentRequirements defines a single acceptable payment method.
type PaymentRequirements struct {
	Scheme            string                 `json:"scheme"`
	Network           string                 `json:"network"`
	MaxAmountRequired string                 `json:"maxAmountRequired"`
	Asset             string                 `json:"asset"`
	PayTo             string                 `json:"payTo"`
	Resource          string                 `json:"resource"`
	Description       string                 `json:"description"`
	MimeType          string                 `json:"mimeType,omitempty"`
	OutputSchema      interface{}            `json:"outputSchema"`
	MaxTimeoutSeconds int                    `json:"maxTimeoutSeconds"`
	Extra             map[string]interface{} `json:"extra"`
}

// PaymentPayload is the decoded X-PAYMENT header (base64 JSON).
type PaymentPayload struct {
	X402Version int             `json:"x402Version"`
	Scheme      string          `json:"scheme"`
	Network     string          `json:"network"`
	Payload     json.RawMessage `json:"payload"`
}

// SettlementResponse is included in the X-PAYMENT-RESPONSE header.
type SettlementResponse struct {
	Success     bool   `json:"success"`
	ErrorReason string `json:"errorReason,omitempty"`
	Transaction string `json:"transaction"`
	Network     string `json:"network"`
	Payer       string `json:"payer"`
}

// buildPaymentRequirements constructs the PaymentRequirements from config.
func buildPaymentRequirements(cfg Config, resource string) (PaymentRequirements, error) {
	atomicPrice, err := priceToAtomicUnits(cfg.Price)
	if err != nil {
		return PaymentRequirements{}, fmt.Errorf("invalid price %q: %w", cfg.Price, err)
	}

	asset := assetForNetwork(cfg.Network)
	if asset == "" {
		return PaymentRequirements{}, fmt.Errorf("unsupported network %q", cfg.Network)
	}

	return PaymentRequirements{
		Scheme:            "exact",
		Network:           cfg.Network,
		MaxAmountRequired: atomicPrice,
		Asset:             asset,
		PayTo:             cfg.PayTo,
		Resource:          resource,
		Description:       cfg.Description,
		MimeType:          "text/html",
		OutputSchema:      nil,
		MaxTimeoutSeconds: cfg.MaxTimeoutSeconds,
		Extra: map[string]interface{}{
			"name":    "USDC",
			"version": "2",
		},
	}, nil
}

// writePaymentRequired writes a 402 response with payment requirements.
func writePaymentRequired(w http.ResponseWriter, reqs PaymentRequirements, errMsg string) error {
	resp := PaymentRequirementsResponse{
		X402Version: 1,
		Error:       errMsg,
		Accepts:     []PaymentRequirements{reqs},
	}

	body, err := json.Marshal(resp)
	if err != nil {
		return fmt.Errorf("marshal payment requirements: %w", err)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusPaymentRequired)
	_, err = w.Write(body)
	return err
}

// decodePaymentHeader decodes the base64-encoded X-PAYMENT header.
func decodePaymentHeader(header string) (*PaymentPayload, error) {
	data, err := base64.StdEncoding.DecodeString(header)
	if err != nil {
		// Try URL-safe base64 as fallback.
		data, err = base64.URLEncoding.DecodeString(header)
		if err != nil {
			// Try without padding.
			data, err = base64.RawStdEncoding.DecodeString(header)
			if err != nil {
				return nil, fmt.Errorf("invalid base64 in X-PAYMENT header: %w", err)
			}
		}
	}

	var payload PaymentPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("invalid JSON in X-PAYMENT payload: %w", err)
	}
	return &payload, nil
}

// encodeSettlementResponse base64-encodes a SettlementResponse for the X-PAYMENT-RESPONSE header.
func encodeSettlementResponse(resp *SettlementResponse) (string, error) {
	data, err := json.Marshal(resp)
	if err != nil {
		return "", fmt.Errorf("marshal settlement response: %w", err)
	}
	return base64.StdEncoding.EncodeToString(data), nil
}
