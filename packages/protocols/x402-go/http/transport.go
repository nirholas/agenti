package http

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/mark3labs/x402-go"
	"github.com/mark3labs/x402-go/encoding"
)

// X402Transport is a custom RoundTripper that handles x402 payment flows.
// It wraps an existing http.RoundTripper and automatically handles 402 Payment Required responses.
type X402Transport struct {
	// Base is the underlying RoundTripper (typically http.DefaultTransport).
	Base http.RoundTripper

	// Signers is the list of available payment signers.
	Signers []x402.Signer

	// Selector is used to choose the appropriate signer and create payments.
	Selector x402.PaymentSelector

	// OnPaymentAttempt is called when a payment attempt is made.
	OnPaymentAttempt x402.PaymentCallback

	// OnPaymentSuccess is called when a payment succeeds.
	OnPaymentSuccess x402.PaymentCallback

	// OnPaymentFailure is called when a payment fails.
	OnPaymentFailure x402.PaymentCallback
}

// RoundTrip implements http.RoundTripper.
// It makes the initial request, and if a 402 Payment Required response is received,
// it automatically signs a payment and retries the request.
func (t *X402Transport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Ensure we have a base transport
	if t.Base == nil {
		t.Base = http.DefaultTransport
	}

	// Clone the request to avoid modifying the original
	reqCopy := req.Clone(req.Context())

	// Make the first attempt
	resp, err := t.Base.RoundTrip(reqCopy)
	if err != nil {
		return nil, err
	}

	// Check if payment is required
	if resp.StatusCode != http.StatusPaymentRequired {
		return resp, nil
	}

	// Parse payment requirements from 402 response
	requirements, err := parsePaymentRequirements(resp)
	if err != nil {
		resp.Body.Close()
		return nil, x402.NewPaymentError(x402.ErrCodeInvalidRequirements, "failed to parse payment requirements", err)
	}

	// Close the 402 response body
	resp.Body.Close()

	// Select signer and create payment
	payment, err := t.Selector.SelectAndSign(requirements, t.Signers)
	if err != nil {
		return nil, err
	}

	// Get the selected requirement for callback data
	// Match on network and scheme since those are available in PaymentPayload
	var selectedRequirement *x402.PaymentRequirement
	for i := range requirements {
		if requirements[i].Network == payment.Network &&
			requirements[i].Scheme == payment.Scheme {
			selectedRequirement = &requirements[i]
			break
		}
	}

	// Record start time for duration tracking
	startTime := time.Now()

	// Trigger payment attempt callback
	if t.OnPaymentAttempt != nil && selectedRequirement != nil {
		event := x402.PaymentEvent{
			Type:      x402.PaymentEventAttempt,
			Timestamp: startTime,
			Method:    "HTTP",
			URL:       req.URL.String(),
			Network:   payment.Network,
			Scheme:    payment.Scheme,
			Amount:    selectedRequirement.MaxAmountRequired,
			Asset:     selectedRequirement.Asset,
			Recipient: selectedRequirement.PayTo,
		}
		t.OnPaymentAttempt(event)
	}

	// Build payment header
	paymentHeader, err := buildPaymentHeader(payment)
	if err != nil {
		// Trigger failure callback
		if t.OnPaymentFailure != nil {
			event := x402.PaymentEvent{
				Type:      x402.PaymentEventFailure,
				Timestamp: time.Now(),
				Method:    "HTTP",
				URL:       req.URL.String(),
				Error:     err,
				Duration:  time.Since(startTime),
			}
			t.OnPaymentFailure(event)
		}
		return nil, x402.NewPaymentError(x402.ErrCodeSigningFailed, "failed to build payment header", err)
	}

	// Clone the request again for the retry
	reqRetry := req.Clone(req.Context())

	// Add payment header
	reqRetry.Header.Set("X-PAYMENT", paymentHeader)

	// Retry the request with payment
	respRetry, err := t.Base.RoundTrip(reqRetry)
	duration := time.Since(startTime)

	if err != nil {
		// Trigger failure callback
		if t.OnPaymentFailure != nil {
			event := x402.PaymentEvent{
				Type:      x402.PaymentEventFailure,
				Timestamp: time.Now(),
				Method:    "HTTP",
				URL:       req.URL.String(),
				Error:     err,
				Duration:  duration,
			}
			t.OnPaymentFailure(event)
		}
		return nil, err
	}

	// Parse settlement response
	settlement, _ := parseSettlement(respRetry.Header.Get("X-PAYMENT-RESPONSE"))

	// Trigger success callback if settlement indicates success
	if settlement != nil && settlement.Success && t.OnPaymentSuccess != nil {
		event := x402.PaymentEvent{
			Type:        x402.PaymentEventSuccess,
			Timestamp:   time.Now(),
			Method:      "HTTP",
			URL:         req.URL.String(),
			Transaction: settlement.Transaction,
			Payer:       settlement.Payer,
			Duration:    duration,
		}
		if selectedRequirement != nil {
			event.Network = selectedRequirement.Network
			event.Scheme = selectedRequirement.Scheme
			event.Amount = selectedRequirement.MaxAmountRequired
			event.Asset = selectedRequirement.Asset
			event.Recipient = selectedRequirement.PayTo
		}
		t.OnPaymentSuccess(event)
	}

	return respRetry, nil
}

// parsePaymentRequirements extracts payment requirements from a 402 response.
func parsePaymentRequirements(resp *http.Response) ([]x402.PaymentRequirement, error) {
	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// The response body should be a PaymentRequirementsResponse with an accepts array
	var paymentReqResp struct {
		X402Version int    `json:"x402Version"`
		Error       string `json:"error"`
		Accepts     []struct {
			Scheme            string                 `json:"scheme"`
			Network           string                 `json:"network"`
			MaxAmountRequired string                 `json:"maxAmountRequired"`
			Asset             string                 `json:"asset"`
			PayTo             string                 `json:"payTo"`
			Resource          string                 `json:"resource"`
			Description       string                 `json:"description,omitempty"`
			MimeType          string                 `json:"mimeType,omitempty"`
			MaxTimeoutSeconds int                    `json:"maxTimeoutSeconds"`
			Extra             map[string]interface{} `json:"extra,omitempty"`
		} `json:"accepts"`
	}

	if err := json.Unmarshal(body, &paymentReqResp); err != nil {
		return nil, fmt.Errorf("failed to parse payment requirements JSON: %w", err)
	}

	// Validate we got at least one payment requirement
	if len(paymentReqResp.Accepts) == 0 {
		return nil, fmt.Errorf("no payment requirements in response")
	}

	// Convert all requirements
	requirements := make([]x402.PaymentRequirement, len(paymentReqResp.Accepts))
	for i, req := range paymentReqResp.Accepts {
		requirements[i] = x402.PaymentRequirement{
			Scheme:            req.Scheme,
			Network:           req.Network,
			MaxAmountRequired: req.MaxAmountRequired,
			Asset:             req.Asset,
			PayTo:             req.PayTo,
			Resource:          req.Resource,
			Description:       req.Description,
			MimeType:          req.MimeType,
			MaxTimeoutSeconds: req.MaxTimeoutSeconds,
			Extra:             req.Extra,
		}
	}

	return requirements, nil
}

// buildPaymentHeader creates the X-PAYMENT header value from a payment payload.
func buildPaymentHeader(payment *x402.PaymentPayload) (string, error) {
	return encoding.EncodePayment(*payment)
}

// parseSettlement extracts settlement information from the X-PAYMENT-RESPONSE header.
func parseSettlement(headerValue string) (*x402.SettlementResponse, error) {
	settlement, err := encoding.DecodeSettlement(headerValue)
	if err != nil {
		return nil, err
	}

	return &settlement, nil
}

// RequestWithBody clones an HTTP request with a new body.
// This is needed because request bodies can only be read once.
func RequestWithBody(req *http.Request, body []byte) *http.Request {
	clone := req.Clone(req.Context())
	clone.Body = io.NopCloser(bytes.NewReader(body))
	clone.ContentLength = int64(len(body))
	return clone
}
