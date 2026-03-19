package server

import (
	"log/slog"

	"github.com/mark3labs/x402-go"
	"github.com/mark3labs/x402-go/http"
)

// Config holds configuration for the MCP server with x402 payment support
type Config struct {
	// FacilitatorURL is the URL of the x402 facilitator service
	FacilitatorURL string

	// VerifyOnly when true, skips payment settlement (useful for testing)
	VerifyOnly bool

	// Verbose enables detailed logging
	Verbose bool

	// PaymentTools maps tool names to their payment requirements
	// Key: tool name, Value: list of acceptable payment options
	PaymentTools map[string][]x402.PaymentRequirement

	// FacilitatorAuthorization is a static Authorization header value for the primary facilitator.
	// Example: "Bearer your-api-key" or "Basic base64-encoded-credentials"
	FacilitatorAuthorization string

	// FacilitatorAuthorizationProvider is a function that returns an Authorization header value
	// for the primary facilitator. Useful for dynamic tokens that may need to be refreshed.
	// If set, this takes precedence over FacilitatorAuthorization.
	FacilitatorAuthorizationProvider http.AuthorizationProvider

	// Facilitator hooks for custom logic before/after verify and settle operations
	FacilitatorOnBeforeVerify http.OnBeforeFunc
	FacilitatorOnAfterVerify  http.OnAfterVerifyFunc
	FacilitatorOnBeforeSettle http.OnBeforeFunc
	FacilitatorOnAfterSettle  http.OnAfterSettleFunc

	// HTTPConfig to generate facilitator and fallback facilitator clients
	// HTTPConfig.VerifyOnly and HTTPConfig.PaymentRequirements are ignored
	HTTPConfig *http.Config

	// Logger is the logger for the server
	// if not set slog.Default() is used
	Logger *slog.Logger
}

// DefaultConfig returns a Config with default settings
func DefaultConfig() *Config {
	return &Config{
		FacilitatorURL: "https://facilitator.x402.rs",
		VerifyOnly:     false,
		Verbose:        false,
		PaymentTools:   make(map[string][]x402.PaymentRequirement),
		Logger:         slog.Default(),
	}
}

// AddPaymentTool adds payment requirements for a tool
func (c *Config) AddPaymentTool(toolName string, requirements ...x402.PaymentRequirement) {
	if c.PaymentTools == nil {
		c.PaymentTools = make(map[string][]x402.PaymentRequirement)
	}
	c.PaymentTools[toolName] = requirements
}

// RequiresPayment checks if a tool requires payment
func (c *Config) RequiresPayment(toolName string) bool {
	if c.PaymentTools == nil {
		return false
	}
	reqs, exists := c.PaymentTools[toolName]
	return exists && len(reqs) > 0
}

// GetPaymentRequirements returns the payment requirements for a tool
func (c *Config) GetPaymentRequirements(toolName string) []x402.PaymentRequirement {
	if c.PaymentTools == nil {
		return nil
	}
	return c.PaymentTools[toolName]
}
