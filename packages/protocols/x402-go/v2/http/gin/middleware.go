// Package gin provides Gin-compatible middleware for x402 v2 payment gating.
// This package is a thin adapter that translates gin.Context to stdlib http patterns
// and delegates all payment verification and settlement logic to the v2/http package.
package gin

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	v2 "github.com/mark3labs/x402-go/v2"
	v2http "github.com/mark3labs/x402-go/v2/http"
	"github.com/mark3labs/x402-go/v2/http/internal/helpers"
)

// Config is an alias for v2http.Config for convenience.
type Config = v2http.Config

// PaymentContextKey is the gin context key for storing verified payment information.
const PaymentContextKey = "x402_v2_payment"

// NewX402Middleware creates a new x402 v2 payment middleware for Gin.
// It returns a Gin-compatible middleware function that wraps handlers with payment gating.
//
// The middleware:
//   - Checks for X-PAYMENT header in requests
//   - Returns 402 Payment Required if missing or invalid
//   - Verifies payments with the facilitator
//   - Settles payments (unless VerifyOnly=true)
//   - Stores payment information in Gin context via c.Set("x402_v2_payment", verifyResp)
//   - Calls c.Abort() on payment failure to stop the handler chain
//   - Calls c.Next() on payment success to proceed to the protected handler
//
// Example usage:
//
//	config := v2http.Config{
//	    FacilitatorURL: "https://api.x402.coinbase.com",
//	    Resource: v2.ResourceInfo{
//	        URL:         "https://api.example.com/resource",
//	        Description: "Premium API access",
//	    },
//	    PaymentRequirements: []v2.PaymentRequirements{{
//	        Scheme:            "exact",
//	        Network:           "eip155:84532", // Base Sepolia (CAIP-2 format)
//	        Amount:            "10000",
//	        Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
//	        PayTo:             "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
//	        MaxTimeoutSeconds: 300,
//	    }},
//	}
//	r := gin.Default()
//	r.Use(gin.NewX402Middleware(config))
//	r.GET("/protected", func(c *gin.Context) {
//	    if payment, exists := c.Get("x402_v2_payment"); exists {
//	        verifyResp := payment.(*v2.VerifyResponse)
//	        c.JSON(200, gin.H{"payer": verifyResp.Payer})
//	    }
//	})
func NewX402Middleware(config Config) gin.HandlerFunc {
	// Create facilitator client
	facilitator := &v2http.FacilitatorClient{
		BaseURL:               config.FacilitatorURL,
		Client:                &http.Client{Timeout: v2.DefaultTimeouts.RequestTimeout},
		Timeouts:              v2.DefaultTimeouts,
		Authorization:         config.FacilitatorAuthorization,
		AuthorizationProvider: config.FacilitatorAuthorizationProvider,
		OnBeforeVerify:        config.FacilitatorOnBeforeVerify,
		OnAfterVerify:         config.FacilitatorOnAfterVerify,
		OnBeforeSettle:        config.FacilitatorOnBeforeSettle,
		OnAfterSettle:         config.FacilitatorOnAfterSettle,
	}

	// Create fallback facilitator client if configured
	var fallbackFacilitator *v2http.FacilitatorClient
	if config.FallbackFacilitatorURL != "" {
		fallbackFacilitator = &v2http.FacilitatorClient{
			BaseURL:               config.FallbackFacilitatorURL,
			Client:                &http.Client{Timeout: v2.DefaultTimeouts.RequestTimeout},
			Timeouts:              v2.DefaultTimeouts,
			Authorization:         config.FallbackFacilitatorAuthorization,
			AuthorizationProvider: config.FallbackFacilitatorAuthorizationProvider,
			OnBeforeVerify:        config.FallbackFacilitatorOnBeforeVerify,
			OnAfterVerify:         config.FallbackFacilitatorOnAfterVerify,
			OnBeforeSettle:        config.FallbackFacilitatorOnBeforeSettle,
			OnAfterSettle:         config.FallbackFacilitatorOnAfterSettle,
		}
	}

	// Enrich payment requirements with facilitator-specific data (like feePayer)
	ctx, cancel := context.WithTimeout(context.Background(), v2.DefaultTimeouts.RequestTimeout)
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

		// Build resource info from request
		resource := config.Resource
		if resource.URL == "" {
			resource.URL = helpers.BuildResourceURL(c.Request)
		}
		if resource.Description == "" {
			resource.Description = "Payment required for " + c.Request.URL.Path
		}

		// Check for X-PAYMENT header
		paymentHeader := c.GetHeader("X-PAYMENT")
		if paymentHeader == "" {
			// No payment provided - return 402 with requirements
			logger.Info("no payment header provided", "path", c.Request.URL.Path)
			sendPaymentRequiredGin(c, resource, enrichedRequirements, "Payment required")
			return
		}

		// Parse payment header
		payment, err := helpers.ParsePaymentHeader(c.Request)
		if err != nil {
			logger.Warn("invalid payment header", "error", err)
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"x402Version": v2.X402Version,
				"error":       "Invalid payment header",
			})
			return
		}

		// Find matching requirement
		requirement, err := v2.FindMatchingRequirement(payment, enrichedRequirements)
		if err != nil {
			logger.Warn("no matching requirement", "error", err)
			sendPaymentRequiredGin(c, resource, enrichedRequirements, "No matching payment requirement")
			return
		}

		// Verify payment with facilitator
		logger.Info("verifying payment", "scheme", payment.Accepted.Scheme, "network", payment.Accepted.Network)
		verifyResp, err := facilitator.Verify(c.Request.Context(), *payment, *requirement)
		if err != nil && fallbackFacilitator != nil {
			logger.Warn("primary facilitator failed, trying fallback", "error", err)
			verifyResp, err = fallbackFacilitator.Verify(c.Request.Context(), *payment, *requirement)
		}
		if err != nil {
			logger.Error("facilitator verification failed", "error", err)
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"x402Version": v2.X402Version,
				"error":       "Payment verification failed",
			})
			return
		}

		if !verifyResp.IsValid {
			logger.Warn("payment verification failed", "reason", verifyResp.InvalidReason)
			sendPaymentRequiredGin(c, resource, enrichedRequirements, verifyResp.InvalidReason)
			return
		}

		// Payment verified successfully
		logger.Info("payment verified", "payer", verifyResp.Payer)

		// Settle payment if not verify-only mode
		if !config.VerifyOnly {
			logger.Info("settling payment", "payer", verifyResp.Payer)
			settlementResp, err := facilitator.Settle(c.Request.Context(), *payment, *requirement)
			if err != nil && fallbackFacilitator != nil {
				logger.Warn("primary facilitator settlement failed, trying fallback", "error", err)
				settlementResp, err = fallbackFacilitator.Settle(c.Request.Context(), *payment, *requirement)
			}
			if err != nil {
				logger.Error("settlement failed", "error", err)
				c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
					"x402Version": v2.X402Version,
					"error":       "Payment settlement failed",
				})
				return
			}

			if !settlementResp.Success {
				logger.Warn("settlement unsuccessful", "reason", settlementResp.ErrorReason)
				sendPaymentRequiredGin(c, resource, enrichedRequirements, settlementResp.ErrorReason)
				return
			}

			logger.Info("payment settled", "transaction", settlementResp.Transaction)

			// Add X-PAYMENT-RESPONSE header with settlement info
			if err := helpers.AddPaymentResponseHeader(c.Writer, settlementResp); err != nil {
				logger.Warn("failed to add payment response header", "error", err)
				// Continue anyway - payment was successful
			}
		}

		// Store payment info in Gin context for handler access
		c.Set(PaymentContextKey, verifyResp)

		// Also store in stdlib context for compatibility with http package helpers
		ctx := context.WithValue(c.Request.Context(), v2http.PaymentContextKey, verifyResp)
		c.Request = c.Request.WithContext(ctx)

		// Payment successful - call next handler
		c.Next()
	}
}

// sendPaymentRequiredGin sends a 402 Payment Required response using Gin's JSON methods.
// It aborts the request chain and returns the payment requirements to the client.
func sendPaymentRequiredGin(c *gin.Context, resource v2.ResourceInfo, requirements []v2.PaymentRequirements, errMsg string) {
	response := v2.PaymentRequired{
		X402Version: v2.X402Version,
		Error:       errMsg,
		Resource:    &resource,
		Accepts:     requirements,
	}

	c.AbortWithStatusJSON(http.StatusPaymentRequired, response)
}

// GetPaymentFromContext extracts the verified payment information from the Gin context.
// Returns nil if no payment was verified or the context does not contain payment info.
func GetPaymentFromContext(c *gin.Context) *v2.VerifyResponse {
	value, exists := c.Get(PaymentContextKey)
	if !exists {
		return nil
	}
	resp, ok := value.(*v2.VerifyResponse)
	if !ok {
		return nil
	}
	return resp
}
