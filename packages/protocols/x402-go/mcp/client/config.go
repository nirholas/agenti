package client

import (
	"net/http"

	"github.com/mark3labs/x402-go"
)

// Config holds configuration for the MCP client with x402 payment support
type Config struct {
	// Signers is the list of payment signers in priority order
	Signers []x402.Signer

	// ServerURL is the MCP server endpoint
	ServerURL string

	// HTTPClient is the HTTP client for requests (optional, uses default if nil)
	HTTPClient *http.Client

	// OnPaymentAttempt is called when a payment attempt is made
	OnPaymentAttempt func(x402.PaymentEvent)

	// OnPaymentSuccess is called when a payment succeeds
	OnPaymentSuccess func(x402.PaymentEvent)

	// OnPaymentFailure is called when a payment fails
	OnPaymentFailure func(x402.PaymentEvent)

	// Selector is the payment selector for choosing which signer to use (optional, uses default if nil)
	Selector x402.PaymentSelector

	// Verbose enables detailed logging
	Verbose bool
}

// Option is a functional option for configuring the Transport
type Option func(*Config)

// WithSigner adds a payment signer to the configuration
func WithSigner(signer x402.Signer) Option {
	return func(c *Config) {
		c.Signers = append(c.Signers, signer)
	}
}

// WithHTTPClient sets a custom HTTP client
func WithHTTPClient(client *http.Client) Option {
	return func(c *Config) {
		c.HTTPClient = client
	}
}

// WithPaymentCallback sets a unified payment callback for all events
func WithPaymentCallback(callback func(x402.PaymentEvent)) Option {
	return func(c *Config) {
		c.OnPaymentAttempt = callback
		c.OnPaymentSuccess = callback
		c.OnPaymentFailure = callback
	}
}

// WithPaymentAttemptCallback sets the payment attempt callback
func WithPaymentAttemptCallback(callback func(x402.PaymentEvent)) Option {
	return func(c *Config) {
		c.OnPaymentAttempt = callback
	}
}

// WithPaymentSuccessCallback sets the payment success callback
func WithPaymentSuccessCallback(callback func(x402.PaymentEvent)) Option {
	return func(c *Config) {
		c.OnPaymentSuccess = callback
	}
}

// WithPaymentFailureCallback sets the payment failure callback
func WithPaymentFailureCallback(callback func(x402.PaymentEvent)) Option {
	return func(c *Config) {
		c.OnPaymentFailure = callback
	}
}

// WithSelector sets a custom payment selector
func WithSelector(selector x402.PaymentSelector) Option {
	return func(c *Config) {
		c.Selector = selector
	}
}

// WithVerbose enables verbose logging
func WithVerbose() Option {
	return func(c *Config) {
		c.Verbose = true
	}
}

// DefaultConfig returns a Config with default settings
func DefaultConfig(serverURL string) *Config {
	return &Config{
		ServerURL:  serverURL,
		HTTPClient: http.DefaultClient,
		Selector:   &x402.DefaultPaymentSelector{},
		Signers:    make([]x402.Signer, 0),
	}
}
