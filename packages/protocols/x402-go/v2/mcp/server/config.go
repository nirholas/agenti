// Package server provides MCP server implementation with x402 v2 payment support.
package server

import (
	"log/slog"

	v2 "github.com/mark3labs/x402-go/v2"
	v2http "github.com/mark3labs/x402-go/v2/http"
)

// ToolPaymentConfig holds payment configuration for a specific MCP tool.
type ToolPaymentConfig struct {
	// Resource describes the protected resource.
	Resource v2.ResourceInfo

	// Requirements is the list of acceptable payment options.
	Requirements []v2.PaymentRequirements
}

// Config holds configuration for the MCP server with x402 v2 payment support.
type Config struct {
	// FacilitatorURL is the URL of the x402 facilitator service.
	FacilitatorURL string

	// FallbackFacilitatorURL is an optional fallback facilitator service URL.
	FallbackFacilitatorURL string

	// VerifyOnly when true, skips payment settlement (useful for testing).
	VerifyOnly bool

	// Verbose enables detailed logging.
	Verbose bool

	// PaymentTools maps tool names to their payment configuration.
	// Key: tool name, Value: payment configuration with resource info and requirements.
	PaymentTools map[string]ToolPaymentConfig

	// FacilitatorAuthorization is a static Authorization header value for the primary facilitator.
	// Example: "Bearer your-api-key" or "Basic base64-encoded-credentials"
	FacilitatorAuthorization string

	// FacilitatorAuthorizationProvider is a function that returns an Authorization header value
	// for the primary facilitator. Useful for dynamic tokens that may need to be refreshed.
	// If set, this takes precedence over FacilitatorAuthorization.
	FacilitatorAuthorizationProvider v2http.AuthorizationProvider

	// Facilitator hooks for custom logic before/after verify and settle operations
	FacilitatorOnBeforeVerify v2http.OnBeforeFunc
	FacilitatorOnAfterVerify  v2http.OnAfterVerifyFunc
	FacilitatorOnBeforeSettle v2http.OnBeforeFunc
	FacilitatorOnAfterSettle  v2http.OnAfterSettleFunc

	// Fallback facilitator options
	FallbackFacilitatorAuthorization         string
	FallbackFacilitatorAuthorizationProvider v2http.AuthorizationProvider
	FallbackFacilitatorOnBeforeVerify        v2http.OnBeforeFunc
	FallbackFacilitatorOnAfterVerify         v2http.OnAfterVerifyFunc
	FallbackFacilitatorOnBeforeSettle        v2http.OnBeforeFunc
	FallbackFacilitatorOnAfterSettle         v2http.OnAfterSettleFunc

	// Logger is the logger for the server.
	// If not set, slog.Default() is used.
	Logger *slog.Logger
}

// DefaultConfig returns a Config with default settings.
func DefaultConfig() *Config {
	return &Config{
		FacilitatorURL: "https://facilitator.x402.org",
		VerifyOnly:     false,
		Verbose:        false,
		PaymentTools:   make(map[string]ToolPaymentConfig),
		Logger:         slog.Default(),
	}
}

// AddPaymentTool adds payment requirements for a tool.
func (c *Config) AddPaymentTool(toolName string, resource v2.ResourceInfo, requirements ...v2.PaymentRequirements) {
	if c.PaymentTools == nil {
		c.PaymentTools = make(map[string]ToolPaymentConfig)
	}
	c.PaymentTools[toolName] = ToolPaymentConfig{
		Resource:     resource,
		Requirements: requirements,
	}
}

// RequiresPayment checks if a tool requires payment.
func (c *Config) RequiresPayment(toolName string) bool {
	if c.PaymentTools == nil {
		return false
	}
	config, exists := c.PaymentTools[toolName]
	return exists && len(config.Requirements) > 0
}

// GetPaymentConfig returns the payment configuration for a tool.
// Returns the config and a bool indicating if the tool has a payment configuration.
func (c *Config) GetPaymentConfig(toolName string) (ToolPaymentConfig, bool) {
	if c.PaymentTools == nil {
		return ToolPaymentConfig{}, false
	}
	config, exists := c.PaymentTools[toolName]
	if !exists {
		return ToolPaymentConfig{}, false
	}
	return config, true
}
