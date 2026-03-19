// Package pocketbase provides PocketBase-compatible middleware for x402 payment gating.
// This package is a thin adapter that translates core.RequestEvent to stdlib http patterns
// and delegates all payment verification and settlement logic to the http package.
package pocketbase

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/mark3labs/x402-go"
	httpx402 "github.com/mark3labs/x402-go/http"
	"github.com/pocketbase/pocketbase/core"
)

// NewPocketBaseX402Middleware creates a new x402 payment middleware for PocketBase.
// It returns a PocketBase-compatible middleware function that wraps handlers with payment gating.
//
// The middleware:
//   - Checks for X-PAYMENT header in requests
//   - Returns 402 Payment Required if missing or invalid
//   - Verifies payments with the facilitator
//   - Settles payments (unless VerifyOnly=true)
//   - Stores payment information in request store via e.Set("x402_payment", verifyResp)
//   - Returns error to stop the handler chain on payment failure
//   - Calls e.Next() on payment success to proceed to the protected handler
//
// After successful verification, payment details are stored in the request store
// with key "x402_payment" as *httpx402.VerifyResponse. Handlers can access via:
//
//	verifyResp := e.Get("x402_payment").(*httpx402.VerifyResponse)
//
// Example usage:
//
//	config := &httpx402.Config{
//	    FacilitatorURL: "https://api.x402.coinbase.com",
//	    PaymentRequirements: []x402.PaymentRequirement{{
//	        Scheme:            "exact",
//	        Network:           "base-sepolia",
//	        MaxAmountRequired: "10000",
//	        Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
//	        PayTo:             "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
//	        MaxTimeoutSeconds: 300,
//	    }},
//	}
//
//	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
//	    middleware := NewPocketBaseX402Middleware(config)
//	    se.Router.GET("/api/premium/data", handler).BindFunc(middleware)
//	    return se.Next()
//	})
func NewPocketBaseX402Middleware(config *httpx402.Config) func(*core.RequestEvent) error {
	// Create facilitator client
	facilitator := &httpx402.FacilitatorClient{
		BaseURL:               config.FacilitatorURL,
		Client:                &http.Client{Timeout: x402.DefaultTimeouts.RequestTimeout},
		Timeouts:              x402.DefaultTimeouts,
		Authorization:         config.FacilitatorAuthorization,
		AuthorizationProvider: config.FacilitatorAuthorizationProvider,
	}

	// Create fallback facilitator client if configured
	var fallbackFacilitator *httpx402.FacilitatorClient
	if config.FallbackFacilitatorURL != "" {
		fallbackFacilitator = &httpx402.FacilitatorClient{
			BaseURL:               config.FallbackFacilitatorURL,
			Client:                &http.Client{Timeout: x402.DefaultTimeouts.RequestTimeout},
			Timeouts:              x402.DefaultTimeouts,
			Authorization:         config.FallbackFacilitatorAuthorization,
			AuthorizationProvider: config.FallbackFacilitatorAuthorizationProvider,
		}
	}

	// Enrich payment requirements with facilitator-specific data (like feePayer)
	ctx, cancel := context.WithTimeout(context.Background(), x402.DefaultTimeouts.RequestTimeout)
	defer cancel()
	enrichedRequirements, err := facilitator.EnrichRequirements(ctx, config.PaymentRequirements)
	if err != nil {
		// Log warning but continue with original requirements
		slog.Default().Warn("failed to enrich payment requirements from facilitator", "error", err)
		enrichedRequirements = config.PaymentRequirements
	} else {
		slog.Default().Info("payment requirements enriched from facilitator", "count", len(enrichedRequirements))
	}

	// Return PocketBase middleware function
	return func(e *core.RequestEvent) error {
		logger := slog.Default()

		// Bypass payment verification for OPTIONS requests (CORS preflight)
		if e.Request.Method == "OPTIONS" {
			logger.Debug("bypassing OPTIONS request")
			return e.Next()
		}

		// Build absolute URL for the resource
		scheme := "http"
		if e.Request.TLS != nil {
			scheme = "https"
		}
		resourceURL := scheme + "://" + e.Request.Host + e.Request.RequestURI

		// Populate resource field in requirements with the actual request URL
		requirementsWithResource := make([]x402.PaymentRequirement, len(enrichedRequirements))
		for i, req := range enrichedRequirements {
			requirementsWithResource[i] = req
			requirementsWithResource[i].Resource = resourceURL
			if requirementsWithResource[i].Description == "" {
				requirementsWithResource[i].Description = "Payment required for " + e.Request.URL.Path
			}
		}

		// Check for X-PAYMENT header
		paymentHeader := e.Request.Header.Get("X-PAYMENT")
		if paymentHeader == "" {
			// No payment provided - return 402 with requirements
			logger.Info("no payment header provided", "path", e.Request.URL.Path)
			return sendPaymentRequiredPocketBase(e, requirementsWithResource)
		}

		// Parse payment header
		payment, err := parsePaymentHeaderFromRequest(e.Request)
		if err != nil {
			logger.Warn("invalid payment header", "error", err)
			return e.JSON(http.StatusBadRequest, map[string]any{
				"x402Version": 1,
				"error":       "Invalid payment header",
			})
		}

		// Find matching requirement
		requirement, err := findMatchingRequirementPocketBase(payment, requirementsWithResource)
		if err != nil {
			logger.Warn("no matching requirement", "error", err)
			return sendPaymentRequiredPocketBase(e, requirementsWithResource)
		}

		// Verify payment with facilitator
		logger.Info("verifying payment", "scheme", payment.Scheme, "network", payment.Network)
		verifyResp, err := facilitator.Verify(e.Request.Context(), payment, requirement)
		if err != nil && fallbackFacilitator != nil {
			logger.Warn("primary facilitator failed, trying fallback", "error", err)
			verifyResp, err = fallbackFacilitator.Verify(e.Request.Context(), payment, requirement)
		}
		if err != nil {
			logger.Error("facilitator verification failed", "error", err)
			return e.JSON(http.StatusServiceUnavailable, map[string]any{
				"x402Version": 1,
				"error":       "Payment verification failed",
			})
		}

		if !verifyResp.IsValid {
			logger.Warn("payment verification failed", "reason", verifyResp.InvalidReason)
			return sendPaymentRequiredPocketBase(e, requirementsWithResource)
		}

		// Payment verified successfully
		logger.Info("payment verified", "payer", verifyResp.Payer)

		// Store payment info in PocketBase request store for handler access
		e.Set("x402_payment", verifyResp)

		// Settle payment if not verify-only mode
		if !config.VerifyOnly {
			logger.Info("settling payment", "payer", verifyResp.Payer)
			settlementResp, err := facilitator.Settle(e.Request.Context(), payment, requirement)
			if err != nil && fallbackFacilitator != nil {
				logger.Warn("primary facilitator settlement failed, trying fallback", "error", err)
				settlementResp, err = fallbackFacilitator.Settle(e.Request.Context(), payment, requirement)
			}
			if err != nil {
				logger.Error("settlement failed", "error", err)
				return e.JSON(http.StatusServiceUnavailable, map[string]any{
					"x402Version": 1,
					"error":       "Payment settlement failed",
				})
			}

			if !settlementResp.Success {
				logger.Warn("settlement unsuccessful", "reason", settlementResp.ErrorReason)
				return sendPaymentRequiredPocketBase(e, requirementsWithResource)
			}

			logger.Info("payment settled", "transaction", settlementResp.Transaction)

			// Add X-PAYMENT-RESPONSE header with settlement info
			if err := addPaymentResponseHeaderPocketBase(e, settlementResp); err != nil {
				logger.Warn("failed to add payment response header", "error", err)
				// Continue anyway - payment was successful
			}
		}

		// Payment successful - call next handler
		return e.Next()
	}
}

// parsePaymentHeaderFromRequest parses the X-PAYMENT header from an http.Request.
// It decodes the base64-encoded JSON, unmarshals it, and validates the protocol version.
func parsePaymentHeaderFromRequest(r *http.Request) (x402.PaymentPayload, error) {
	var payment x402.PaymentPayload

	headerValue := r.Header.Get("X-PAYMENT")
	if headerValue == "" {
		return payment, x402.ErrMalformedHeader
	}

	// Decode base64
	decoded, err := base64.StdEncoding.DecodeString(headerValue)
	if err != nil {
		return payment, fmt.Errorf("%w: invalid base64 encoding", x402.ErrMalformedHeader)
	}

	// Parse JSON
	if err := json.Unmarshal(decoded, &payment); err != nil {
		return payment, fmt.Errorf("%w: invalid JSON", x402.ErrMalformedHeader)
	}

	// Validate version
	if payment.X402Version != 1 {
		return payment, x402.ErrUnsupportedVersion
	}

	return payment, nil
}

// sendPaymentRequiredPocketBase sends a 402 Payment Required response for PocketBase.
// Returns the error from e.JSON() to stop the handler chain.
func sendPaymentRequiredPocketBase(e *core.RequestEvent, requirements []x402.PaymentRequirement) error {
	response := x402.PaymentRequirementsResponse{
		X402Version: 1,
		Error:       "Payment required for this resource",
		Accepts:     requirements,
	}

	return e.JSON(http.StatusPaymentRequired, response)
}

// findMatchingRequirementPocketBase finds a payment requirement matching the payment's scheme and network.
// It returns an error if no matching requirement is found.
func findMatchingRequirementPocketBase(payment x402.PaymentPayload, requirements []x402.PaymentRequirement) (x402.PaymentRequirement, error) {
	for _, req := range requirements {
		if req.Scheme == payment.Scheme && req.Network == payment.Network {
			return req, nil
		}
	}
	return x402.PaymentRequirement{}, x402.ErrUnsupportedScheme
}

// addPaymentResponseHeaderPocketBase adds the X-PAYMENT-RESPONSE header with settlement information.
// It marshals the settlement response to JSON, encodes it as base64, and sets the header.
func addPaymentResponseHeaderPocketBase(e *core.RequestEvent, settlement *x402.SettlementResponse) error {
	// Marshal settlement response to JSON
	data, err := json.Marshal(settlement)
	if err != nil {
		return fmt.Errorf("failed to marshal settlement response: %w", err)
	}

	// Encode as base64
	encoded := base64.StdEncoding.EncodeToString(data)

	// Set header using PocketBase's Response.Header().Set() method
	e.Response.Header().Set("X-PAYMENT-RESPONSE", encoded)
	return nil
}
