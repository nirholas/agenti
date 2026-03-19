// Package gin provides Gin-compatible middleware for x402 payment gating.
// This package is a thin adapter that translates gin.Context to stdlib http patterns
// and delegates all payment verification and settlement logic to the http package.
package gin

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mark3labs/x402-go"
	httpx402 "github.com/mark3labs/x402-go/http"
	"github.com/mark3labs/x402-go/http/internal/helpers"
)

// NewGinX402Middleware creates a new x402 payment middleware for Gin.
// It returns a Gin-compatible middleware function that wraps handlers with payment gating.
//
// The middleware:
//   - Checks for X-PAYMENT header in requests
//   - Returns 402 Payment Required if missing or invalid
//   - Verifies payments with the facilitator
//   - Settles payments (unless VerifyOnly=true)
//   - Stores payment information in Gin context via c.Set("x402_payment", verifyResp)
//   - Calls c.Abort() on payment failure to stop the handler chain
//   - Calls c.Next() on payment success to proceed to the protected handler
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
//	r := gin.Default()
//	r.Use(NewGinX402Middleware(config))
//	r.GET("/protected", func(c *gin.Context) {
//	    if payment, exists := c.Get("x402_payment"); exists {
//	        verifyResp := payment.(*httpx402.VerifyResponse)
//	        c.JSON(200, gin.H{"payer": verifyResp.Payer})
//	    }
//	})
func NewGinX402Middleware(config *httpx402.Config) gin.HandlerFunc {
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

	// Return Gin middleware function
	return func(c *gin.Context) {
		logger := slog.Default()

		// Build absolute URL for the resource
		scheme := "http"
		if c.Request.TLS != nil {
			scheme = "https"
		}
		resourceURL := scheme + "://" + c.Request.Host + c.Request.RequestURI

		// Populate resource field in requirements with the actual request URL
		requirementsWithResource := make([]x402.PaymentRequirement, len(enrichedRequirements))
		for i, req := range enrichedRequirements {
			requirementsWithResource[i] = req
			requirementsWithResource[i].Resource = resourceURL
			if requirementsWithResource[i].Description == "" {
				requirementsWithResource[i].Description = "Payment required for " + c.Request.URL.Path
			}
		}

		// Check for X-PAYMENT header
		paymentHeader := c.GetHeader("X-PAYMENT")
		if paymentHeader == "" {
			// No payment provided - return 402 with requirements
			logger.Info("no payment header provided", "path", c.Request.URL.Path)
			sendPaymentRequiredGin(c, requirementsWithResource)
			return
		}

		// Parse payment header
		payment, err := parsePaymentHeaderFromRequest(c.Request)
		if err != nil {
			logger.Warn("invalid payment header", "error", err)
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"x402Version": 1,
				"error":       "Invalid payment header",
			})
			return
		}

		// Find matching requirement
		requirement, err := findMatchingRequirementGin(payment, requirementsWithResource)
		if err != nil {
			logger.Warn("no matching requirement", "error", err)
			sendPaymentRequiredGin(c, requirementsWithResource)
			return
		}

		// Verify payment with facilitator
		logger.Info("verifying payment", "scheme", payment.Scheme, "network", payment.Network)
		verifyResp, err := facilitator.Verify(c.Request.Context(), payment, requirement)
		if err != nil && fallbackFacilitator != nil {
			logger.Warn("primary facilitator failed, trying fallback", "error", err)
			verifyResp, err = fallbackFacilitator.Verify(c.Request.Context(), payment, requirement)
		}
		if err != nil {
			logger.Error("facilitator verification failed", "error", err)
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"x402Version": 1,
				"error":       "Payment verification failed",
			})
			return
		}

		if !verifyResp.IsValid {
			logger.Warn("payment verification failed", "reason", verifyResp.InvalidReason)
			sendPaymentRequiredGin(c, requirementsWithResource)
			return
		}

		// Payment verified successfully
		logger.Info("payment verified", "payer", verifyResp.Payer)

		// Settle payment if not verify-only mode
		var settlementResp *x402.SettlementResponse
		if !config.VerifyOnly {
			logger.Info("settling payment", "payer", verifyResp.Payer)
			settlementResp, err = facilitator.Settle(c.Request.Context(), payment, requirement)
			if err != nil && fallbackFacilitator != nil {
				logger.Warn("primary facilitator settlement failed, trying fallback", "error", err)
				settlementResp, err = fallbackFacilitator.Settle(c.Request.Context(), payment, requirement)
			}
			if err != nil {
				logger.Error("settlement failed", "error", err)
				c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
					"x402Version": 1,
					"error":       "Payment settlement failed",
				})
				return
			}

			if !settlementResp.Success {
				logger.Warn("settlement unsuccessful", "reason", settlementResp.ErrorReason)
				sendPaymentRequiredGin(c, requirementsWithResource)
				return
			}

			logger.Info("payment settled", "transaction", settlementResp.Transaction)

			// Add X-PAYMENT-RESPONSE header with settlement info
			if err := addPaymentResponseHeaderGin(c, settlementResp); err != nil {
				logger.Warn("failed to add payment response header", "error", err)
				// Continue anyway - payment was successful
			}
		}

		// Store payment info in Gin context for handler access
		c.Set("x402_payment", verifyResp)

		// Also store in stdlib context for compatibility with http package helpers
		ctx := context.WithValue(c.Request.Context(), httpx402.PaymentContextKey, verifyResp)
		c.Request = c.Request.WithContext(ctx)

		// Payment successful - call next handler
		c.Next()
	}
}

// parsePaymentHeaderFromRequest parses the X-PAYMENT header from an http.Request.
func parsePaymentHeaderFromRequest(r *http.Request) (x402.PaymentPayload, error) {
	return helpers.ParsePaymentHeaderFromRequest(r)
}

// sendPaymentRequiredGin sends a 402 Payment Required response using Gin's JSON methods.
// It aborts the request chain and returns the payment requirements to the client.
func sendPaymentRequiredGin(c *gin.Context, requirements []x402.PaymentRequirement) {
	response := x402.PaymentRequirementsResponse{
		X402Version: 1,
		Error:       "Payment required for this resource",
		Accepts:     requirements,
	}

	c.AbortWithStatusJSON(http.StatusPaymentRequired, response)
}

// findMatchingRequirementGin finds a payment requirement that matches the provided payment.
func findMatchingRequirementGin(payment x402.PaymentPayload, requirements []x402.PaymentRequirement) (x402.PaymentRequirement, error) {
	return helpers.FindMatchingRequirement(payment, requirements)
}

// addPaymentResponseHeaderGin adds the X-PAYMENT-RESPONSE header with settlement information.
func addPaymentResponseHeaderGin(c *gin.Context, settlement *x402.SettlementResponse) error {
	return helpers.AddPaymentResponseHeader(c.Writer, settlement)
}
