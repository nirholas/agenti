// Package http provides HTTP client and server implementations for the x402 v2 protocol.
package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/mark3labs/x402-go/retry"
	v2 "github.com/mark3labs/x402-go/v2"
	"github.com/mark3labs/x402-go/v2/facilitator"
)

// AuthorizationProvider is a function that returns an Authorization header value.
// This is useful for dynamic tokens (e.g., JWT refresh) where the value may change.
//
// Thread-safety: The provider function is called on each HTTP request, including
// during retry attempts. If your provider accesses shared state or performs I/O
// (e.g., token refresh), ensure it is safe for concurrent use. The FacilitatorClient
// does not serialize calls to the provider.
type AuthorizationProvider func(*http.Request) string

// OnBeforeFunc is a callback invoked before a verify or settle operation.
// Return an error to abort the operation.
type OnBeforeFunc func(context.Context, v2.PaymentPayload, v2.PaymentRequirements) error

// OnAfterVerifyFunc is a callback invoked after a Verify operation completes.
// Called with the result (success or failure) for logging, metrics, etc.
type OnAfterVerifyFunc func(context.Context, v2.PaymentPayload, v2.PaymentRequirements, *v2.VerifyResponse, error)

// OnAfterSettleFunc is a callback invoked after a Settle operation completes.
// Called with the result (success or failure) for logging, metrics, etc.
type OnAfterSettleFunc func(context.Context, v2.PaymentPayload, v2.PaymentRequirements, *v2.SettleResponse, error)

// FacilitatorClient is a client for communicating with x402 v2 facilitator services.
type FacilitatorClient struct {
	// BaseURL is the facilitator service URL (e.g., "https://facilitator.x402.org").
	BaseURL string

	// Client is the HTTP client to use for requests. If nil, http.DefaultClient is used.
	Client *http.Client

	// Timeouts contains timeout configuration for payment operations.
	Timeouts v2.TimeoutConfig

	// MaxRetries is the maximum number of retry attempts for failed requests (default: 0).
	// Set to 0 to disable retries.
	MaxRetries int

	// RetryDelay is the initial delay between retry attempts (default: 100ms).
	// Exponential backoff is applied with a multiplier of 2.0.
	RetryDelay time.Duration

	// Authorization is a static Authorization header value (e.g., "Bearer token" or "Basic base64").
	// If AuthorizationProvider is also set, the provider takes precedence.
	Authorization string

	// AuthorizationProvider is a function that returns an Authorization header value.
	// This is useful for dynamic tokens that may need to be refreshed.
	// If set, this takes precedence over the static Authorization field.
	AuthorizationProvider AuthorizationProvider

	// OnBeforeVerify is called before the Verify operation starts.
	// If it returns an error, the operation is aborted immediately.
	OnBeforeVerify OnBeforeFunc

	// OnAfterVerify is called after the Verify operation completes (success or failure).
	OnAfterVerify OnAfterVerifyFunc

	// OnBeforeSettle is called before the Settle operation starts.
	// If it returns an error, the operation is aborted immediately.
	OnBeforeSettle OnBeforeFunc

	// OnAfterSettle is called after the Settle operation completes (success or failure).
	OnAfterSettle OnAfterSettleFunc
}

// Verify that FacilitatorClient implements facilitator.Interface.
var _ facilitator.Interface = (*FacilitatorClient)(nil)

// httpClient returns the HTTP client to use, defaulting to http.DefaultClient.
func (c *FacilitatorClient) httpClient() *http.Client {
	if c.Client != nil {
		return c.Client
	}
	return http.DefaultClient
}

// setAuthorizationHeader sets the Authorization header on the request if configured.
// If AuthorizationProvider is set, it is called to get the current token value;
// otherwise, the static Authorization string is used. This is called per-request.
func (c *FacilitatorClient) setAuthorizationHeader(req *http.Request) {
	var authValue string
	if c.AuthorizationProvider != nil {
		authValue = c.AuthorizationProvider(req)
	} else if c.Authorization != "" {
		authValue = c.Authorization
	}
	if authValue != "" {
		req.Header.Set("Authorization", authValue)
	}
}

// retryConfig returns the retry configuration based on client settings.
func (c *FacilitatorClient) retryConfig() retry.Config {
	retryDelay := c.RetryDelay
	if retryDelay <= 0 {
		retryDelay = 100 * time.Millisecond
	}

	maxRetries := c.MaxRetries
	if maxRetries < 0 {
		maxRetries = 0
	}

	return retry.Config{
		MaxAttempts:  maxRetries + 1, // +1 because MaxRetries is retry count, not attempt count
		InitialDelay: retryDelay,
		MaxDelay:     retryDelay * 4,
		Multiplier:   2.0,
	}
}

// Verify verifies a payment authorization without executing the transaction.
func (c *FacilitatorClient) Verify(ctx context.Context, payload v2.PaymentPayload, requirements v2.PaymentRequirements) (*v2.VerifyResponse, error) {
	if c.OnBeforeVerify != nil {
		if err := c.OnBeforeVerify(ctx, payload, requirements); err != nil {
			return nil, err
		}
	}

	// Create request payload
	req := facilitator.VerifyRequest{
		X402Version:         v2.X402Version,
		PaymentPayload:      payload,
		PaymentRequirements: requirements,
	}

	// Marshal to JSON
	data, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, resultErr := retry.WithRetry(ctx, c.retryConfig(), isFacilitatorUnavailableError, func() (*v2.VerifyResponse, error) {
		// Use provided context, apply timeout only if not already set
		reqCtx := ctx
		if _, hasDeadline := ctx.Deadline(); !hasDeadline && c.Timeouts.VerifyTimeout > 0 {
			var cancel context.CancelFunc
			reqCtx, cancel = context.WithTimeout(ctx, c.Timeouts.VerifyTimeout)
			defer cancel()
		}

		httpReq, err := http.NewRequestWithContext(reqCtx, "POST", c.BaseURL+"/verify", bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}
		httpReq.Header.Set("Content-Type", "application/json")
		c.setAuthorizationHeader(httpReq)

		// Send request
		httpResp, err := c.httpClient().Do(httpReq)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", v2.ErrFacilitatorUnavailable, err)
		}
		defer httpResp.Body.Close()

		if httpResp.StatusCode != http.StatusOK {
			return nil, parseErrorResponse(httpResp, v2.ErrVerificationFailed)
		}

		// Parse response
		var verifyResp v2.VerifyResponse
		if err := json.NewDecoder(httpResp.Body).Decode(&verifyResp); err != nil {
			return nil, fmt.Errorf("failed to decode verify response: %w", err)
		}

		// Extract payer if not provided in response
		if verifyResp.Payer == "" {
			verifyResp.Payer = extractPayer(payload)
		}

		return &verifyResp, nil
	})

	if c.OnAfterVerify != nil {
		c.OnAfterVerify(ctx, payload, requirements, resp, resultErr)
	}

	return resp, resultErr
}

// Settle executes a verified payment on the blockchain.
func (c *FacilitatorClient) Settle(ctx context.Context, payload v2.PaymentPayload, requirements v2.PaymentRequirements) (*v2.SettleResponse, error) {
	if c.OnBeforeSettle != nil {
		if err := c.OnBeforeSettle(ctx, payload, requirements); err != nil {
			return nil, err
		}
	}

	// Create request payload
	req := facilitator.SettleRequest{
		X402Version:         v2.X402Version,
		PaymentPayload:      payload,
		PaymentRequirements: requirements,
	}

	// Marshal to JSON
	data, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, resultErr := retry.WithRetry(ctx, c.retryConfig(), isFacilitatorUnavailableError, func() (*v2.SettleResponse, error) {
		// Use provided context, apply timeout only if not already set
		reqCtx := ctx
		if _, hasDeadline := ctx.Deadline(); !hasDeadline && c.Timeouts.SettleTimeout > 0 {
			var cancel context.CancelFunc
			reqCtx, cancel = context.WithTimeout(ctx, c.Timeouts.SettleTimeout)
			defer cancel()
		}

		httpReq, err := http.NewRequestWithContext(reqCtx, "POST", c.BaseURL+"/settle", bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}
		httpReq.Header.Set("Content-Type", "application/json")
		c.setAuthorizationHeader(httpReq)

		// Send request
		httpResp, err := c.httpClient().Do(httpReq)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", v2.ErrFacilitatorUnavailable, err)
		}
		defer httpResp.Body.Close()

		if httpResp.StatusCode != http.StatusOK {
			return nil, parseErrorResponse(httpResp, v2.ErrSettlementFailed)
		}

		// Parse response
		var settleResp v2.SettleResponse
		if err := json.NewDecoder(httpResp.Body).Decode(&settleResp); err != nil {
			return nil, fmt.Errorf("failed to decode settle response: %w", err)
		}

		return &settleResp, nil
	})

	if c.OnAfterSettle != nil {
		c.OnAfterSettle(ctx, payload, requirements, resp, resultErr)
	}

	return resp, resultErr
}

// Supported queries the facilitator for supported payment types.
func (c *FacilitatorClient) Supported(ctx context.Context) (*v2.SupportedResponse, error) {
	// Use provided context, apply timeout only if not already set
	reqCtx := ctx
	if _, hasDeadline := ctx.Deadline(); !hasDeadline && c.Timeouts.VerifyTimeout > 0 {
		var cancel context.CancelFunc
		reqCtx, cancel = context.WithTimeout(ctx, c.Timeouts.VerifyTimeout)
		defer cancel()
	}

	httpReq, err := http.NewRequestWithContext(reqCtx, "GET", c.BaseURL+"/supported", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	c.setAuthorizationHeader(httpReq)

	// Send request
	httpResp, err := c.httpClient().Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", v2.ErrFacilitatorUnavailable, err)
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("supported endpoint failed: status %d", httpResp.StatusCode)
	}

	// Parse response
	var supportedResp v2.SupportedResponse
	if err := json.NewDecoder(httpResp.Body).Decode(&supportedResp); err != nil {
		return nil, fmt.Errorf("failed to decode supported response: %w", err)
	}

	return &supportedResp, nil
}

// EnrichRequirements fetches supported payment types from the facilitator and
// enriches the provided payment requirements with network-specific data like feePayer.
// This is particularly useful for SVM chains where the feePayer must be specified.
func (c *FacilitatorClient) EnrichRequirements(ctx context.Context, requirements []v2.PaymentRequirements) ([]v2.PaymentRequirements, error) {
	// Fetch supported payment types
	supported, err := c.Supported(ctx)
	if err != nil {
		return requirements, fmt.Errorf("failed to fetch supported payment types: %w", err)
	}

	// Create a lookup map for supported kinds by network and scheme
	supportedMap := make(map[string]v2.SupportedKind)
	for _, kind := range supported.Kinds {
		key := kind.Network + "-" + kind.Scheme
		supportedMap[key] = kind
	}

	// Enrich each requirement with extra data from the facilitator
	enriched := make([]v2.PaymentRequirements, len(requirements))
	for i, req := range requirements {
		enriched[i] = req
		key := req.Network + "-" + req.Scheme
		if kind, ok := supportedMap[key]; ok && kind.Extra != nil {
			// Initialize Extra map if it doesn't exist
			if enriched[i].Extra == nil {
				enriched[i].Extra = make(map[string]interface{})
			}
			// Merge facilitator's extra data into requirement
			for k, v := range kind.Extra {
				// Only set if not already present (user-specified values take precedence)
				if _, exists := enriched[i].Extra[k]; !exists {
					enriched[i].Extra[k] = v
				}
			}
		}
	}

	return enriched, nil
}

// parseErrorResponse extracts error details from a non-200 HTTP response.
func parseErrorResponse(resp *http.Response, baseErr error) error {
	bodyBytes, _ := io.ReadAll(resp.Body)

	// Try to parse as JSON with invalidReason or errorReason
	var errBody map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &errBody); err == nil {
		if reason, ok := errBody["invalidReason"].(string); ok && reason != "" {
			return fmt.Errorf("%w: status %d, reason: %s", baseErr, resp.StatusCode, reason)
		}
		if reason, ok := errBody["errorReason"].(string); ok && reason != "" {
			return fmt.Errorf("%w: status %d, reason: %s", baseErr, resp.StatusCode, reason)
		}
	}

	// If we couldn't parse as JSON, include raw body (truncated)
	if len(bodyBytes) > 0 && len(bodyBytes) < 500 {
		return fmt.Errorf("%w: status %d, body: %s", baseErr, resp.StatusCode, string(bodyBytes))
	}

	return fmt.Errorf("%w: status %d", baseErr, resp.StatusCode)
}

// extractPayer extracts the payer address from a payment payload.
func extractPayer(payload v2.PaymentPayload) string {
	// Try to extract from EVM payload
	if evmPayload, ok := payload.Payload.(map[string]interface{}); ok {
		if auth, ok := evmPayload["authorization"].(map[string]interface{}); ok {
			if from, ok := auth["from"].(string); ok {
				return from
			}
		}
	}
	// For SVM payloads, the payer would need to be extracted from the transaction
	// which requires decoding. The facilitator should provide this in the response.
	return ""
}

// isFacilitatorUnavailableError checks if an error is a facilitator unavailable error.
// It uses errors.Is to properly detect wrapped errors.
func isFacilitatorUnavailableError(err error) bool {
	return errors.Is(err, v2.ErrFacilitatorUnavailable)
}
