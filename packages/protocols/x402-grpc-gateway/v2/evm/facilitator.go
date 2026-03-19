package evm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// FacilitatorClient handles communication with a V2 x402 facilitator service.
type FacilitatorClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewFacilitatorClient creates a new facilitator client targeting V2 endpoints.
func NewFacilitatorClient(baseURL string) *FacilitatorClient {
	return &FacilitatorClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Verify checks if a payment is valid via POST /v2/x402/verify.
func (c *FacilitatorClient) Verify(ctx context.Context, req *FacilitatorVerifyRequest) (*FacilitatorVerifyResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal verify request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/v2/x402/verify", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create verify request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to call facilitator verify endpoint: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("facilitator verify returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var verifyResp FacilitatorVerifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&verifyResp); err != nil {
		return nil, fmt.Errorf("failed to decode verify response: %w", err)
	}

	return &verifyResp, nil
}

// Settle executes the payment on-chain via POST /v2/x402/settle.
func (c *FacilitatorClient) Settle(ctx context.Context, req *FacilitatorSettleRequest) (*FacilitatorSettleResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal settle request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/v2/x402/settle", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create settle request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to call facilitator settle endpoint: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("facilitator settle returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var settleResp FacilitatorSettleResponse
	if err := json.NewDecoder(resp.Body).Decode(&settleResp); err != nil {
		return nil, fmt.Errorf("failed to decode settle response: %w", err)
	}

	return &settleResp, nil
}

// GetSupported fetches supported kinds, extensions, and signers via GET /v2/x402/supported.
func (c *FacilitatorClient) GetSupported(ctx context.Context) (*FacilitatorSupportedResponse, error) {
	httpReq, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/v2/x402/supported", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create supported request: %w", err)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to call facilitator supported endpoint: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("facilitator supported returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var supportedResp FacilitatorSupportedResponse
	if err := json.NewDecoder(resp.Body).Decode(&supportedResp); err != nil {
		return nil, fmt.Errorf("failed to decode supported response: %w", err)
	}

	return &supportedResp, nil
}
