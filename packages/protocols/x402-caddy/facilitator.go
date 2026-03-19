package caddyx402

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// FacilitatorClient handles HTTP communication with the x402 facilitator service.
type FacilitatorClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewFacilitatorClient creates a new facilitator HTTP client.
func NewFacilitatorClient(baseURL, apiKey string) *FacilitatorClient {
	return &FacilitatorClient{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: facilitatorTimeout,
		},
	}
}

// VerifyRequest is the request body for POST /verify.
type VerifyRequest struct {
	PaymentPayload      *PaymentPayload     `json:"paymentPayload"`
	PaymentRequirements PaymentRequirements `json:"paymentRequirements"`
}

// VerifyResponse is the response from POST /verify.
type VerifyResponse struct {
	IsValid       bool   `json:"isValid"`
	InvalidReason string `json:"invalidReason,omitempty"`
	Payer         string `json:"payer,omitempty"`
}

// SettleRequest is the request body for POST /settle (same structure as verify).
type SettleRequest = VerifyRequest

// Verify calls the facilitator /verify endpoint.
func (c *FacilitatorClient) Verify(ctx context.Context, payload *PaymentPayload, reqs PaymentRequirements) (*VerifyResponse, error) {
	reqBody := VerifyRequest{
		PaymentPayload:      payload,
		PaymentRequirements: reqs,
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal verify request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/verify", bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("create verify request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("facilitator verify request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxFacilitatorResponseSize))
	if err != nil {
		return nil, fmt.Errorf("read verify response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("facilitator verify returned HTTP %d", resp.StatusCode)
	}

	var verifyResp VerifyResponse
	if err := json.Unmarshal(body, &verifyResp); err != nil {
		return nil, fmt.Errorf("invalid JSON in facilitator verify response")
	}

	return &verifyResp, nil
}

// Settle calls the facilitator /settle endpoint.
func (c *FacilitatorClient) Settle(ctx context.Context, payload *PaymentPayload, reqs PaymentRequirements) (*SettlementResponse, error) {
	reqBody := SettleRequest{
		PaymentPayload:      payload,
		PaymentRequirements: reqs,
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal settle request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/settle", bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("create settle request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("facilitator settle request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxFacilitatorResponseSize))
	if err != nil {
		return nil, fmt.Errorf("read settle response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("facilitator settle returned HTTP %d", resp.StatusCode)
	}

	var settleResp SettlementResponse
	if err := json.Unmarshal(body, &settleResp); err != nil {
		return nil, fmt.Errorf("invalid JSON in facilitator settle response")
	}

	// Validate settlement response completeness.
	if settleResp.Success && settleResp.Transaction == "" {
		return nil, fmt.Errorf("facilitator settle returned success but empty transaction hash")
	}

	return &settleResp, nil
}

// newTestFacilitatorClient creates a facilitator client for testing.
func newTestFacilitatorClient(baseURL string) *FacilitatorClient {
	return &FacilitatorClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}
