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

	"github.com/mark3labs/x402-go"
	"github.com/mark3labs/x402-go/facilitator"
	"github.com/mark3labs/x402-go/http/internal/helpers"
	"github.com/mark3labs/x402-go/retry"
)

// AuthorizationProvider is a function that returns an Authorization header value.
// This is useful for dynamic tokens (e.g., JWT refresh) where the value may change.
//
// Thread-safety: The provider function is called on each HTTP request, including
// during retry attempts. If your provider accesses shared state or performs I/O
// (e.g., token refresh), ensure it is safe for concurrent use. The FacilitatorClient
// does not serialize calls to the provider.
type AuthorizationProvider func(*http.Request) string

// OnBeforeFunc is a function that returns an error to abort an operation.
type OnBeforeFunc func(context.Context, x402.PaymentPayload, x402.PaymentRequirement) error

// OnAfterVerifyFunc is a function that is called after a Verify operation completes
type OnAfterVerifyFunc func(context.Context, x402.PaymentPayload, x402.PaymentRequirement, *facilitator.VerifyResponse, error)

// OnAfterSettleFunc is a function that is called after a Settle operation completes
type OnAfterSettleFunc func(context.Context, x402.PaymentPayload, x402.PaymentRequirement, *x402.SettlementResponse, error)

// FacilitatorClient is a client for communicating with x402 facilitator services.
type FacilitatorClient struct {
	BaseURL    string
	Client     *http.Client
	Timeouts   x402.TimeoutConfig // Timeout configuration for payment operations
	MaxRetries int                // Maximum number of retry attempts for failed requests (default: 0)
	RetryDelay time.Duration      // Delay between retry attempts (default: 100ms)

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

// FacilitatorRequest is the request payload sent to the facilitator.
type FacilitatorRequest struct {
	X402Version         int                     `json:"x402Version"`
	PaymentPayload      x402.PaymentPayload     `json:"paymentPayload"`
	PaymentRequirements x402.PaymentRequirement `json:"paymentRequirements"`
}

// Verify verifies a payment authorization without executing the transaction.
func (c *FacilitatorClient) Verify(ctx context.Context, payment x402.PaymentPayload, requirement x402.PaymentRequirement) (*facilitator.VerifyResponse, error) {
	if c.OnBeforeVerify != nil {
		if err := c.OnBeforeVerify(ctx, payment, requirement); err != nil {
			return nil, err
		}
	}

	// Create request payload
	req := FacilitatorRequest{
		X402Version:         1,
		PaymentPayload:      payment,
		PaymentRequirements: requirement,
	}

	// Marshal to JSON
	data, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Configure retry with exponential backoff
	retryDelay := c.RetryDelay
	if retryDelay <= 0 {
		retryDelay = 100 * time.Millisecond
	}

	maxRetries := c.MaxRetries
	if maxRetries < 0 {
		maxRetries = 0
	}

	config := retry.Config{
		MaxAttempts:  maxRetries + 1, // +1 because MaxRetries is retry count, not attempt count
		InitialDelay: retryDelay,
		MaxDelay:     retryDelay * 4,
		Multiplier:   2.0,
	}

	resp, resultErr := retry.WithRetry(ctx, config, isFacilitatorUnavailableError, func() (*facilitator.VerifyResponse, error) {
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
		resp, err := c.Client.Do(httpReq)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", x402.ErrFacilitatorUnavailable, err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			// Try to read error details from response body
			bodyBytes, _ := io.ReadAll(resp.Body)
			var errBody map[string]interface{}
			if err := json.Unmarshal(bodyBytes, &errBody); err == nil {
				if reason, ok := errBody["invalidReason"].(string); ok {
					return nil, fmt.Errorf("%w: status %d, reason: %s", x402.ErrVerificationFailed, resp.StatusCode, reason)
				}
			}
			// If we couldn't parse as JSON, include raw body
			if len(bodyBytes) > 0 && len(bodyBytes) < 500 {
				return nil, fmt.Errorf("%w: status %d, body: %s", x402.ErrVerificationFailed, resp.StatusCode, string(bodyBytes))
			}
			return nil, fmt.Errorf("%w: status %d", x402.ErrVerificationFailed, resp.StatusCode)
		}

		// Parse response
		var verifyResp facilitator.VerifyResponse
		if err := json.NewDecoder(resp.Body).Decode(&verifyResp); err != nil {
			return nil, fmt.Errorf("failed to decode verify response: %w", err)
		}

		verifyResp.PaymentPayload = payment

		if verifyResp.Payer != "" {
			return &verifyResp, nil
		}

		verifyResp.Payer = helpers.GetPayer(payment)

		return &verifyResp, nil
	})

	if c.OnAfterVerify != nil {
		c.OnAfterVerify(ctx, payment, requirement, resp, resultErr)
	}

	return resp, resultErr
}

// Supported queries the facilitator for supported payment types.
func (c *FacilitatorClient) Supported(ctx context.Context) (*facilitator.SupportedResponse, error) {
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
	resp, err := c.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", x402.ErrFacilitatorUnavailable, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("supported endpoint failed: status %d", resp.StatusCode)
	}

	// Parse response
	var supportedResp facilitator.SupportedResponse
	if err := json.NewDecoder(resp.Body).Decode(&supportedResp); err != nil {
		return nil, fmt.Errorf("failed to decode supported response: %w", err)
	}

	return &supportedResp, nil
}

// Settle executes a verified payment on the blockchain.
func (c *FacilitatorClient) Settle(ctx context.Context, payment x402.PaymentPayload, requirement x402.PaymentRequirement) (*x402.SettlementResponse, error) {
	if c.OnBeforeSettle != nil {
		if err := c.OnBeforeSettle(ctx, payment, requirement); err != nil {
			return nil, err
		}
	}

	// Create request payload
	req := FacilitatorRequest{
		X402Version:         1,
		PaymentPayload:      payment,
		PaymentRequirements: requirement,
	}

	// Marshal to JSON
	data, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Configure retry with exponential backoff
	retryDelay := c.RetryDelay
	if retryDelay <= 0 {
		retryDelay = 100 * time.Millisecond
	}

	maxRetries := c.MaxRetries
	if maxRetries < 0 {
		maxRetries = 0
	}

	config := retry.Config{
		MaxAttempts:  maxRetries + 1, // +1 because MaxRetries is retry count, not attempt count
		InitialDelay: retryDelay,
		MaxDelay:     retryDelay * 4,
		Multiplier:   2.0,
	}

	resp, resultErr := retry.WithRetry(ctx, config, isFacilitatorUnavailableError, func() (*x402.SettlementResponse, error) {
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
		resp, err := c.Client.Do(httpReq)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", x402.ErrFacilitatorUnavailable, err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			// Try to read error details from response body
			bodyBytes, _ := io.ReadAll(resp.Body)
			var errBody map[string]interface{}
			if err := json.Unmarshal(bodyBytes, &errBody); err == nil {
				if reason, ok := errBody["errorReason"].(string); ok {
					return nil, fmt.Errorf("%w: status %d, reason: %s", x402.ErrSettlementFailed, resp.StatusCode, reason)
				}
			}
			// If we couldn't parse as JSON, include raw body
			if len(bodyBytes) > 0 && len(bodyBytes) < 500 {
				return nil, fmt.Errorf("%w: status %d, body: %s", x402.ErrSettlementFailed, resp.StatusCode, string(bodyBytes))
			}
			return nil, fmt.Errorf("%w: status %d", x402.ErrSettlementFailed, resp.StatusCode)
		}

		// Parse response
		var settlementResp x402.SettlementResponse
		if err := json.NewDecoder(resp.Body).Decode(&settlementResp); err != nil {
			return nil, fmt.Errorf("failed to decode settlement response: %w", err)
		}

		return &settlementResp, nil
	})

	if c.OnAfterSettle != nil {
		c.OnAfterSettle(ctx, payment, requirement, resp, resultErr)
	}

	return resp, resultErr
}

// EnrichRequirements fetches supported payment types from the facilitator and
// enriches the provided payment requirements with network-specific data like feePayer.
// This is particularly useful for SVM chains where the feePayer must be specified.
func (c *FacilitatorClient) EnrichRequirements(ctx context.Context, requirements []x402.PaymentRequirement) ([]x402.PaymentRequirement, error) {
	// Fetch supported payment types
	supported, err := c.Supported(ctx)
	if err != nil {
		return requirements, fmt.Errorf("failed to fetch supported payment types: %w", err)
	}

	// Create a lookup map for supported kinds by network
	supportedMap := make(map[string]facilitator.SupportedKind)
	for _, kind := range supported.Kinds {
		key := kind.Network + "-" + kind.Scheme
		supportedMap[key] = kind
	}

	// Enrich each requirement with extra data from the facilitator
	enriched := make([]x402.PaymentRequirement, len(requirements))
	for i, req := range requirements {
		enriched[i] = req
		key := req.Network + "-" + req.Scheme
		if kind, ok := supportedMap[key]; ok && kind.Extra != nil {
			// Initialize Extra map if it doesn't exist
			if enriched[i].Extra == nil {
				enriched[i].Extra = make(map[string]any)
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

// isFacilitatorUnavailableError checks if an error is a facilitator unavailable error.
// It uses errors.Is to properly detect wrapped errors.
func isFacilitatorUnavailableError(err error) bool {
	return errors.Is(err, x402.ErrFacilitatorUnavailable)
}
