package x402

import (
	"fmt"
	"path"
	"strings"
	"time"
)

// Config holds the middleware configuration.
type Config struct {
	// Verifier is the payment verification backend (e.g., EVMVerifier).
	Verifier ChainVerifier

	// EndpointPricing maps URL patterns to pricing rules.
	// Patterns support exact matches ("/v1/endpoint") and wildcards ("/v1/*").
	// Used by HTTP middleware (grpc-gateway).
	EndpointPricing map[string]PricingRule

	// MethodPricing maps gRPC method names to pricing rules.
	// Methods are full names like "/package.Service/Method".
	// Supports wildcards: "/package.Service/*" matches all methods in a service.
	// Used by native gRPC interceptors.
	MethodPricing map[string]PricingRule

	// DefaultPricing is used when no pattern matches (optional).
	// If nil, unmatched endpoints don't require payment.
	DefaultPricing *PricingRule

	// ValidityDuration is how long payment requirements are valid.
	// Defaults to 5 minutes.
	ValidityDuration time.Duration

	// SkipPaths lists paths that should bypass payment checks entirely.
	SkipPaths []string

	// SkipMethods lists gRPC methods that should bypass payment checks.
	SkipMethods []string

	// CustomPaywallHTML is custom HTML to return for browser requests (optional).
	CustomPaywallHTML string
}

// PricingRule defines payment requirements for an endpoint.
type PricingRule struct {
	// AcceptedTokens lists the currencies/tokens accepted for this endpoint.
	// Each token specifies its own Amount in atomic units.
	AcceptedTokens []TokenRequirement

	// Description explains what this payment is for.
	Description string

	// MimeType of the resource being sold (optional).
	MimeType string

	// OutputSchema is a JSON schema describing the response format (optional).
	OutputSchema map[string]interface{}
}

// TokenRequirement specifies a payment option (network + token).
type TokenRequirement struct {
	// Network is the blockchain network in CAIP-2 format (e.g., "eip155:8453").
	Network string

	// AssetContract is the token contract address.
	AssetContract string

	// Symbol is the token symbol (e.g., "USDC").
	Symbol string

	// Recipient is the address that will receive payment.
	Recipient string

	// Amount is the payment amount required in atomic units for this token.
	Amount string

	// TokenName is the human-readable token name (optional).
	TokenName string

	// TokenDecimals is the number of decimals for this token (optional).
	TokenDecimals int
}

// Validate checks if the configuration is valid.
func (c *Config) Validate() error {
	if c.Verifier == nil {
		return fmt.Errorf("verifier is required")
	}

	if c.ValidityDuration == 0 {
		c.ValidityDuration = 5 * time.Minute
	}

	for pattern, rule := range c.EndpointPricing {
		if err := rule.Validate(); err != nil {
			return fmt.Errorf("invalid pricing rule for pattern %q: %w", pattern, err)
		}
	}

	for method, rule := range c.MethodPricing {
		if err := rule.Validate(); err != nil {
			return fmt.Errorf("invalid pricing rule for method %q: %w", method, err)
		}
	}

	if c.DefaultPricing != nil {
		if err := c.DefaultPricing.Validate(); err != nil {
			return fmt.Errorf("invalid default pricing rule: %w", err)
		}
	}

	return nil
}

// Validate checks if the pricing rule is valid.
func (p *PricingRule) Validate() error {
	if len(p.AcceptedTokens) == 0 {
		return fmt.Errorf("at least one accepted token is required")
	}

	for i, token := range p.AcceptedTokens {
		if err := token.Validate(); err != nil {
			return fmt.Errorf("invalid token requirement at index %d: %w", i, err)
		}
	}

	return nil
}

// Validate checks if the token requirement is valid.
func (t *TokenRequirement) Validate() error {
	if t.Network == "" {
		return fmt.Errorf("network is required")
	}

	if t.Symbol == "" {
		return fmt.Errorf("symbol is required")
	}

	if t.Recipient == "" {
		return fmt.Errorf("recipient is required")
	}

	if t.AssetContract == "" {
		return fmt.Errorf("asset contract is required")
	}

	if t.Amount == "" {
		return fmt.Errorf("amount is required")
	}

	return nil
}

// MatchEndpoint finds the pricing rule for a given path.
func (c *Config) MatchEndpoint(requestPath string) (*PricingRule, bool) {
	for _, skipPath := range c.SkipPaths {
		if matchPath(requestPath, skipPath) {
			return nil, false
		}
	}

	if rule, ok := c.EndpointPricing[requestPath]; ok {
		return &rule, true
	}

	var bestMatch string
	var bestRule *PricingRule

	for pattern, rule := range c.EndpointPricing {
		if matchPath(requestPath, pattern) {
			if len(pattern) > len(bestMatch) {
				bestMatch = pattern
				ruleCopy := rule
				bestRule = &ruleCopy
			}
		}
	}

	if bestRule != nil {
		return bestRule, true
	}

	if c.DefaultPricing != nil {
		return c.DefaultPricing, true
	}

	return nil, false
}

// MatchMethod finds the pricing rule for a given gRPC method.
func (c *Config) MatchMethod(fullMethod string) (*PricingRule, bool) {
	for _, skipMethod := range c.SkipMethods {
		if matchPath(fullMethod, skipMethod) {
			return nil, false
		}
	}

	if rule, ok := c.MethodPricing[fullMethod]; ok {
		return &rule, true
	}

	var bestMatch string
	var bestRule *PricingRule

	for pattern, rule := range c.MethodPricing {
		if matchPath(fullMethod, pattern) {
			if len(pattern) > len(bestMatch) {
				bestMatch = pattern
				ruleCopy := rule
				bestRule = &ruleCopy
			}
		}
	}

	if bestRule != nil {
		return bestRule, true
	}

	if c.DefaultPricing != nil {
		return c.DefaultPricing, true
	}

	return nil, false
}

func matchPath(requestPath, pattern string) bool {
	if requestPath == pattern {
		return true
	}

	if strings.HasSuffix(pattern, "/*") {
		prefix := strings.TrimSuffix(pattern, "/*")
		return strings.HasPrefix(requestPath, prefix+"/") || requestPath == prefix
	}

	matched, _ := path.Match(pattern, requestPath)
	return matched
}
