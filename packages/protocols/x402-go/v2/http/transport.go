package http

import (
	"net/http"
	"time"

	v2 "github.com/mark3labs/x402-go/v2"
	"github.com/mark3labs/x402-go/v2/http/internal/helpers"
)

// X402Transport is a custom RoundTripper that handles x402 v2 payment flows.
// It wraps an existing http.RoundTripper and automatically handles 402 Payment Required responses.
type X402Transport struct {
	// Base is the underlying RoundTripper (typically http.DefaultTransport).
	Base http.RoundTripper

	// Signers is the list of available payment signers.
	Signers []v2.Signer

	// Selector is used to choose the appropriate signer and create payments.
	Selector v2.PaymentSelector

	// OnPaymentAttempt is called when a payment attempt is made.
	OnPaymentAttempt v2.PaymentCallback

	// OnPaymentSuccess is called when a payment succeeds.
	OnPaymentSuccess v2.PaymentCallback

	// OnPaymentFailure is called when a payment fails.
	OnPaymentFailure v2.PaymentCallback
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
	paymentReq, err := helpers.ParsePaymentRequirements(resp)
	if err != nil {
		resp.Body.Close()
		return nil, v2.NewPaymentError(v2.ErrCodeInvalidRequirements, "failed to parse payment requirements", err)
	}

	// Close the 402 response body
	resp.Body.Close()

	// Select signer and create payment
	payment, err := t.Selector.SelectAndSign(t.Signers, paymentReq.Accepts)
	if err != nil {
		return nil, err
	}

	// Get the selected requirement for callback data
	selectedRequirement, _ := v2.FindMatchingRequirement(payment, paymentReq.Accepts)

	// Record start time for duration tracking
	startTime := time.Now()

	// Trigger payment attempt callback
	if t.OnPaymentAttempt != nil && selectedRequirement != nil {
		event := v2.PaymentEvent{
			Type:      v2.PaymentEventAttempt,
			Timestamp: startTime,
			Method:    "HTTP",
			URL:       req.URL.String(),
			Network:   payment.Accepted.Network,
			Scheme:    payment.Accepted.Scheme,
			Amount:    selectedRequirement.Amount,
			Asset:     selectedRequirement.Asset,
			Recipient: selectedRequirement.PayTo,
		}
		t.OnPaymentAttempt(event)
	}

	// Build payment header
	paymentHeader, err := helpers.BuildPaymentHeader(payment)
	if err != nil {
		// Trigger failure callback
		if t.OnPaymentFailure != nil {
			event := v2.PaymentEvent{
				Type:      v2.PaymentEventFailure,
				Timestamp: time.Now(),
				Method:    "HTTP",
				URL:       req.URL.String(),
				Error:     err,
				Duration:  time.Since(startTime),
			}
			t.OnPaymentFailure(event)
		}
		return nil, v2.NewPaymentError(v2.ErrCodeSigningFailed, "failed to build payment header", err)
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
			event := v2.PaymentEvent{
				Type:      v2.PaymentEventFailure,
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
	settlement := helpers.ParseSettlement(respRetry.Header.Get("X-PAYMENT-RESPONSE"))

	// Trigger success callback if settlement indicates success
	if settlement != nil && settlement.Success && t.OnPaymentSuccess != nil {
		event := v2.PaymentEvent{
			Type:        v2.PaymentEventSuccess,
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
			event.Amount = selectedRequirement.Amount
			event.Asset = selectedRequirement.Asset
			event.Recipient = selectedRequirement.PayTo
		}
		t.OnPaymentSuccess(event)
	}

	return respRetry, nil
}
