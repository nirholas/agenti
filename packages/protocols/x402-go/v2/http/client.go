package http

import (
	"fmt"
	"net/http"

	v2 "github.com/mark3labs/x402-go/v2"
	"github.com/mark3labs/x402-go/v2/http/internal/helpers"
)

// Client is an HTTP client that automatically handles x402 v2 payment flows.
// It wraps a standard http.Client and adds payment handling via a custom RoundTripper.
type Client struct {
	*http.Client
}

// ClientOption configures a Client.
type ClientOption func(*Client) error

// NewClient creates a new x402 v2-enabled HTTP client.
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
func WithSigner(signer v2.Signer) ClientOption {
	return func(c *Client) error {
		// Get or create the X402Transport
		transport, ok := c.Transport.(*X402Transport)
		if !ok {
			// Wrap the existing transport
			transport = &X402Transport{
				Base:     c.Transport,
				Signers:  []v2.Signer{},
				Selector: v2.NewDefaultPaymentSelector(),
			}
			c.Transport = transport
		}

		// Add the signer
		transport.Signers = append(transport.Signers, signer)
		return nil
	}
}

// WithSelector sets a custom payment selector.
func WithSelector(selector v2.PaymentSelector) ClientOption {
	return func(c *Client) error {
		// Get or create the X402Transport
		transport, ok := c.Transport.(*X402Transport)
		if !ok {
			// Wrap the existing transport
			transport = &X402Transport{
				Base:     c.Transport,
				Signers:  []v2.Signer{},
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
func WithPaymentCallback(eventType v2.PaymentEventType, callback v2.PaymentCallback) ClientOption {
	return func(c *Client) error {
		// Get or create the X402Transport
		transport := getOrCreateTransport(c)

		// Set the appropriate callback
		switch eventType {
		case v2.PaymentEventAttempt:
			transport.OnPaymentAttempt = callback
		case v2.PaymentEventSuccess:
			transport.OnPaymentSuccess = callback
		case v2.PaymentEventFailure:
			transport.OnPaymentFailure = callback
		default:
			return fmt.Errorf("unknown payment event type: %s", eventType)
		}

		return nil
	}
}

// WithPaymentCallbacks sets all payment callbacks at once.
// Pass nil for any callback you don't want to set.
func WithPaymentCallbacks(onAttempt, onSuccess, onFailure v2.PaymentCallback) ClientOption {
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
			Signers:  []v2.Signer{},
			Selector: v2.NewDefaultPaymentSelector(),
		}
		c.Transport = transport
	}
	return transport
}

// GetSettlement extracts settlement information from an HTTP response.
// Returns nil if no settlement header is present or if parsing fails.
func GetSettlement(resp *http.Response) *v2.SettleResponse {
	settlementHeader := resp.Header.Get("X-PAYMENT-RESPONSE")
	if settlementHeader == "" {
		return nil
	}
	return helpers.ParseSettlement(settlementHeader)
}
