package http

import (
	"fmt"
	"net/http"

	"github.com/mark3labs/x402-go"
)

// Client is an HTTP client that automatically handles x402 payment flows.
// It wraps a standard http.Client and adds payment handling via a custom RoundTripper.
type Client struct {
	*http.Client
}

// ClientOption configures a Client.
type ClientOption func(*Client) error

// NewClient creates a new x402-enabled HTTP client.
func NewClient(opts ...ClientOption) (*Client, error) {
	// Start with a default HTTP client
	client := &Client{
		Client: &http.Client{},
	}

	// Default to an empty transport (will be wrapped)
	if client.Transport == nil {
		client.Transport = http.DefaultTransport
	}

	// Apply options
	for _, opt := range opts {
		if err := opt(client); err != nil {
			return nil, err
		}
	}

	return client, nil
}

// WithHTTPClient sets a custom underlying HTTP client.
func WithHTTPClient(httpClient *http.Client) ClientOption {
	return func(c *Client) error {
		c.Client = httpClient
		if c.Transport == nil {
			c.Transport = http.DefaultTransport
		}
		return nil
	}
}

// WithSigner adds a payment signer to the client.
// Multiple signers can be added; the client will select the appropriate one.
func WithSigner(signer x402.Signer) ClientOption {
	return func(c *Client) error {
		// Get or create the X402Transport
		transport, ok := c.Transport.(*X402Transport)
		if !ok {
			// Wrap the existing transport
			transport = &X402Transport{
				Base:     c.Transport,
				Signers:  []x402.Signer{},
				Selector: x402.NewDefaultPaymentSelector(),
			}
			c.Transport = transport
		}

		// Add the signer
		transport.Signers = append(transport.Signers, signer)
		return nil
	}
}

// WithSelector sets a custom payment selector.
func WithSelector(selector x402.PaymentSelector) ClientOption {
	return func(c *Client) error {
		// Get or create the X402Transport
		transport, ok := c.Transport.(*X402Transport)
		if !ok {
			// Wrap the existing transport
			transport = &X402Transport{
				Base:     c.Transport,
				Signers:  []x402.Signer{},
				Selector: selector,
			}
			c.Transport = transport
		} else {
			transport.Selector = selector
		}

		return nil
	}
}

// WithPaymentCallback sets a callback for a specific payment event type.
func WithPaymentCallback(eventType x402.PaymentEventType, callback x402.PaymentCallback) ClientOption {
	return func(c *Client) error {
		// Get or create the X402Transport
		transport := getOrCreateTransport(c)

		// Set the appropriate callback
		switch eventType {
		case x402.PaymentEventAttempt:
			transport.OnPaymentAttempt = callback
		case x402.PaymentEventSuccess:
			transport.OnPaymentSuccess = callback
		case x402.PaymentEventFailure:
			transport.OnPaymentFailure = callback
		default:
			return fmt.Errorf("unknown payment event type: %s", eventType)
		}

		return nil
	}
}

// WithPaymentCallbacks sets all payment callbacks at once.
// Pass nil for any callback you don't want to set.
func WithPaymentCallbacks(onAttempt, onSuccess, onFailure x402.PaymentCallback) ClientOption {
	return func(c *Client) error {
		transport := getOrCreateTransport(c)

		if onAttempt != nil {
			transport.OnPaymentAttempt = onAttempt
		}
		if onSuccess != nil {
			transport.OnPaymentSuccess = onSuccess
		}
		if onFailure != nil {
			transport.OnPaymentFailure = onFailure
		}

		return nil
	}
}

// getOrCreateTransport gets the X402Transport or creates one if it doesn't exist.
func getOrCreateTransport(c *Client) *X402Transport {
	transport, ok := c.Transport.(*X402Transport)
	if !ok {
		// Wrap the existing transport
		transport = &X402Transport{
			Base:     c.Transport,
			Signers:  []x402.Signer{},
			Selector: x402.NewDefaultPaymentSelector(),
		}
		c.Transport = transport
	}
	return transport
}

// GetSettlement extracts settlement information from an HTTP response.
// Returns nil if no settlement header is present or if parsing fails.
// Errors during parsing are silently ignored for backward compatibility.
func GetSettlement(resp *http.Response) *x402.SettlementResponse {
	settlementHeader := resp.Header.Get("X-PAYMENT-RESPONSE")
	if settlementHeader == "" {
		return nil
	}

	settlement, err := parseSettlement(settlementHeader)
	if err != nil {
		// TODO: Consider returning error in a future breaking change
		return nil
	}

	return settlement
}
