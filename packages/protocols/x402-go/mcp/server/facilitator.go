// Package server provides MCP server integration for x402 payment gating.
// It enables payment-gated AI tools via the Model Context Protocol.
package server

import (
	"context"
	"fmt"
	nethttp "net/http"

	"github.com/mark3labs/x402-go"
	"github.com/mark3labs/x402-go/facilitator"
	"github.com/mark3labs/x402-go/http"
)

// Facilitator defines the interface for payment verification and settlement.
// Implementations communicate with an x402 facilitator service to verify
// payment authorizations and execute settlements on the blockchain.
type Facilitator interface {
	// Verify verifies a payment without settling it
	Verify(ctx context.Context, payment *x402.PaymentPayload, requirement x402.PaymentRequirement) (*facilitator.VerifyResponse, error)

	// Settle settles a payment on the blockchain
	Settle(ctx context.Context, payment *x402.PaymentPayload, requirement x402.PaymentRequirement) (*x402.SettlementResponse, error)
}

// HTTPFacilitator implements the Facilitator interface using the http.FacilitatorClient.
// It communicates with an x402 facilitator service over HTTP to verify and settle payments.
type HTTPFacilitator struct {
	client *http.FacilitatorClient
}

// HTTPFacilitatorOption is a functional option for configuring an HTTPFacilitator.
// Use WithAuthorization or WithAuthorizationProvider to set authentication.
type HTTPFacilitatorOption func(*http.FacilitatorClient)

// WithAuthorization sets a static Authorization header value for the facilitator.
// Example: "Bearer your-api-key" or "Basic base64-encoded-credentials"
func WithAuthorization(authorization string) HTTPFacilitatorOption {
	return func(c *http.FacilitatorClient) {
		c.Authorization = authorization
	}
}

// WithAuthorizationProvider sets a dynamic Authorization header provider for the facilitator.
// This is useful for tokens that may need to be refreshed.
// If set, this takes precedence over the static Authorization value.
func WithAuthorizationProvider(provider http.AuthorizationProvider) HTTPFacilitatorOption {
	return func(c *http.FacilitatorClient) {
		c.AuthorizationProvider = provider
	}
}

// WithOnBeforeVerify sets a hook function to be called before verifying a payment.
func WithOnBeforeVerify(f http.OnBeforeFunc) HTTPFacilitatorOption {
	return func(c *http.FacilitatorClient) {
		c.OnBeforeVerify = f
	}
}

// WithOnAfterVerify sets a hook function to be called after verifying a payment.
func WithOnAfterVerify(f http.OnAfterVerifyFunc) HTTPFacilitatorOption {
	return func(c *http.FacilitatorClient) {
		c.OnAfterVerify = f
	}
}

// WithOnBeforeSettle sets a hook function to be called before settling a payment.
func WithOnBeforeSettle(f http.OnBeforeFunc) HTTPFacilitatorOption {
	return func(c *http.FacilitatorClient) {
		c.OnBeforeSettle = f
	}
}

// WithOnAfterSettle sets a hook function to be called after settling a payment.
func WithOnAfterSettle(f http.OnAfterSettleFunc) HTTPFacilitatorOption {
	return func(c *http.FacilitatorClient) {
		c.OnAfterSettle = f
	}
}

// NewHTTPFacilitator creates a new HTTP facilitator client with the given URL and options.
// The facilitator is used to verify and settle payments for payment-gated MCP tools.
//
// Example:
//
//	facilitator := NewHTTPFacilitator("https://api.x402.coinbase.com",
//	    WithAuthorization("Bearer my-api-key"),
//	)
func NewHTTPFacilitator(facilitatorURL string, opts ...HTTPFacilitatorOption) *HTTPFacilitator {
	timeouts := x402.DefaultTimeouts
	client := &http.FacilitatorClient{
		BaseURL:    facilitatorURL,
		Client:     &nethttp.Client{Timeout: timeouts.RequestTimeout},
		Timeouts:   timeouts,
		MaxRetries: 2,
	}

	// Apply options
	for _, opt := range opts {
		opt(client)
	}

	return &HTTPFacilitator{
		client: client,
	}
}

// Verify verifies a payment with the facilitator
func (f *HTTPFacilitator) Verify(ctx context.Context, payment *x402.PaymentPayload, requirement x402.PaymentRequirement) (*facilitator.VerifyResponse, error) {
	resp, err := f.client.Verify(ctx, *payment, requirement)
	if err != nil {
		return nil, fmt.Errorf("facilitator verify failed: %w", err)
	}

	return resp, nil
}

// Settle settles a payment through the facilitator
func (f *HTTPFacilitator) Settle(ctx context.Context, payment *x402.PaymentPayload, requirement x402.PaymentRequirement) (*x402.SettlementResponse, error) {
	resp, err := f.client.Settle(ctx, *payment, requirement)
	if err != nil {
		return nil, fmt.Errorf("facilitator settle failed: %w", err)
	}

	return resp, nil
}
