package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// Facilitator interface for payment verification and settlement
type Facilitator interface {
	Verify(ctx context.Context, payment *PaymentPayload, requirement *PaymentRequirement) (*VerifyResponse, error)
	Settle(ctx context.Context, payment *PaymentPayload, requirement *PaymentRequirement) (*SettleResponse, error)
	GetSupported(ctx context.Context) ([]SupportedKind, error)
}

// SupportedKind represents a supported payment scheme/network combination
type SupportedKind struct {
	X402Version int               `json:"x402Version"`
	Scheme      string            `json:"scheme"`
	Network     string            `json:"network"`
	Extra       map[string]string `json:"extra,omitempty"`
}

// HTTPFacilitator implements Facilitator using HTTP API
type HTTPFacilitator struct {
	baseURL string
	client  *http.Client
	verbose bool
}

// NewHTTPFacilitator creates a new HTTP-based facilitator client
func NewHTTPFacilitator(baseURL string) *HTTPFacilitator {
	return &HTTPFacilitator{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SetVerbose enables verbose logging
func (f *HTTPFacilitator) SetVerbose(verbose bool) {
	f.verbose = verbose
}

// Verify validates a payment against the given requirement
func (f *HTTPFacilitator) Verify(ctx context.Context, payment *PaymentPayload, requirement *PaymentRequirement) (*VerifyResponse, error) {
	req := &VerifyRequest{
		X402Version:         1,
		PaymentPayload:      payment,
		PaymentRequirements: requirement,
	}

	if f.verbose {
		log.Printf("[Facilitator] Sending verify request to %s/verify", f.baseURL)
		if payment.Network == "solana" || payment.Network == "solana-devnet" {
			log.Printf("[Facilitator] Payment: network=%s, type=SVM", payment.Network)
		} else {
			if payloadMap, ok := payment.Payload.(map[string]any); ok {
				if authData, ok := payloadMap["authorization"].(map[string]any); ok {
					log.Printf("[Facilitator] Payment: from=%v, to=%v, value=%v, network=%s",
						authData["from"], authData["to"], authData["value"], payment.Network)
				}
			}
		}
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal verify request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", f.baseURL+"/verify", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create verify request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := f.client.Do(httpReq)
	if err != nil {
		if f.verbose {
			log.Printf("[Facilitator] Verify request failed: %v", err)
		}
		return nil, fmt.Errorf("verify request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Try to read error response
		bodyBytes, _ := io.ReadAll(resp.Body)
		errMsg := string(bodyBytes)

		// Try to parse as JSON for more details
		var errResp map[string]interface{}
		if err := json.Unmarshal(bodyBytes, &errResp); err == nil {
			if details, ok := errResp["details"]; ok {
				errMsg = fmt.Sprintf("%s - details: %v", errMsg, details)
			}
		}

		if f.verbose {
			log.Printf("[Facilitator] Verify failed with status %d: %s", resp.StatusCode, errMsg)
		}
		return nil, fmt.Errorf("verify failed with status %d: %s", resp.StatusCode, errMsg)
	}

	var verifyResp VerifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&verifyResp); err != nil {
		return nil, fmt.Errorf("decode verify response: %w", err)
	}

	if f.verbose {
		if verifyResp.IsValid {
			log.Printf("[Facilitator] Payment verified: valid=true, payer=%s", verifyResp.Payer)
		} else {
			log.Printf("[Facilitator] Payment rejected: valid=false, reason=%s", verifyResp.InvalidReason)
		}
	}

	return &verifyResp, nil
}

// Settle processes a payment settlement for the given requirement
func (f *HTTPFacilitator) Settle(ctx context.Context, payment *PaymentPayload, requirement *PaymentRequirement) (*SettleResponse, error) {
	req := &SettleRequest{
		X402Version:         1,
		PaymentPayload:      payment,
		PaymentRequirements: requirement,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal settle request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", f.baseURL+"/settle", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create settle request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := f.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("settle request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Try to read error response
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("settle failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var settleResp SettleResponse
	if err := json.NewDecoder(resp.Body).Decode(&settleResp); err != nil {
		return nil, fmt.Errorf("decode settle response: %w", err)
	}

	return &settleResp, nil
}

// GetSupported retrieves the list of supported payment schemes and networks
func (f *HTTPFacilitator) GetSupported(ctx context.Context) ([]SupportedKind, error) {
	httpReq, err := http.NewRequestWithContext(ctx, "GET", f.baseURL+"/supported", nil)
	if err != nil {
		return nil, fmt.Errorf("create supported request: %w", err)
	}

	resp, err := f.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("supported request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("supported failed with status %d", resp.StatusCode)
	}

	var result struct {
		Kinds []SupportedKind `json:"kinds"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode supported response: %w", err)
	}

	return result.Kinds, nil
}
