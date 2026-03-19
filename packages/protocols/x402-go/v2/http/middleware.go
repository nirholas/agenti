package http

import (
	"bufio"
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"

	v2 "github.com/mark3labs/x402-go/v2"
	"github.com/mark3labs/x402-go/v2/http/internal/helpers"
)

// Config holds the configuration for the x402 v2 middleware.
type Config struct {
	// FacilitatorURL is the primary facilitator endpoint.
	FacilitatorURL string

	// FallbackFacilitatorURL is the optional backup facilitator.
	FallbackFacilitatorURL string

	// Resource describes the protected resource.
	Resource v2.ResourceInfo

	// PaymentRequirements defines the accepted payment methods.
	PaymentRequirements []v2.PaymentRequirements

	// VerifyOnly skips settlement if true (only verifies payments).
	VerifyOnly bool

	// FacilitatorAuthorization is a static Authorization header value for the primary facilitator.
	// Example: "Bearer your-api-key" or "Basic base64-encoded-credentials"
	FacilitatorAuthorization string

	// FacilitatorAuthorizationProvider is a function that returns an Authorization header value
	// for the primary facilitator. Useful for dynamic tokens that may need to be refreshed.
	// If set, this takes precedence over FacilitatorAuthorization.
	FacilitatorAuthorizationProvider AuthorizationProvider

	// Facilitator hooks for custom logic before/after verify and settle operations.
	FacilitatorOnBeforeVerify OnBeforeFunc
	FacilitatorOnAfterVerify  OnAfterVerifyFunc
	FacilitatorOnBeforeSettle OnBeforeFunc
	FacilitatorOnAfterSettle  OnAfterSettleFunc

	// FallbackFacilitatorAuthorization is a static Authorization header value for the fallback facilitator.
	FallbackFacilitatorAuthorization string

	// FallbackFacilitatorAuthorizationProvider is a function that returns an Authorization header value
	// for the fallback facilitator. If set, this takes precedence over FallbackFacilitatorAuthorization.
	FallbackFacilitatorAuthorizationProvider AuthorizationProvider

	// FallbackFacilitator hooks for custom logic before/after verify and settle operations.
	FallbackFacilitatorOnBeforeVerify OnBeforeFunc
	FallbackFacilitatorOnAfterVerify  OnAfterVerifyFunc
	FallbackFacilitatorOnBeforeSettle OnBeforeFunc
	FallbackFacilitatorOnAfterSettle  OnAfterSettleFunc
}

// contextKey is a custom type for context keys to avoid collisions.
type contextKey string

// PaymentContextKey is the context key for storing verified payment information.
const PaymentContextKey = contextKey("x402_v2_payment")

// NewX402Middleware creates a new x402 v2 payment middleware.
// It returns a middleware function that wraps HTTP handlers with payment gating.
// The middleware automatically fetches network-specific configuration (like feePayer for SVM chains)
// from the facilitator's /supported endpoint.
func NewX402Middleware(config Config) func(http.Handler) http.Handler {
	// Create facilitator client
	facilitator := &FacilitatorClient{
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
	var fallbackFacilitator *FacilitatorClient
	if config.FallbackFacilitatorURL != "" {
		fallbackFacilitator = &FacilitatorClient{
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

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			logger := slog.Default()

			// Build resource info from request
			resource := config.Resource
			if resource.URL == "" {
				resource.URL = helpers.BuildResourceURL(r)
			}
			if resource.Description == "" {
				resource.Description = "Payment required for " + r.URL.Path
			}

			// Check for X-PAYMENT header
			paymentHeader := r.Header.Get("X-PAYMENT")
			if paymentHeader == "" {
				// No payment provided - return 402 with requirements
				logger.Info("no payment header provided", "path", r.URL.Path)
				if err := helpers.SendPaymentRequired(w, resource, enrichedRequirements, "Payment required"); err != nil {
					logger.Error("failed to send payment required response", "error", err)
				}
				return
			}

			// Parse payment header
			payment, err := helpers.ParsePaymentHeader(r)
			if err != nil {
				logger.Warn("invalid payment header", "error", err)
				http.Error(w, "Invalid payment header", http.StatusBadRequest)
				return
			}

			// Find matching requirement
			requirement, err := v2.FindMatchingRequirement(payment, enrichedRequirements)
			if err != nil {
				logger.Warn("no matching requirement", "error", err)
				if err := helpers.SendPaymentRequired(w, resource, enrichedRequirements, "No matching payment requirement"); err != nil {
					logger.Error("failed to send payment required response", "error", err)
				}
				return
			}

			// Verify payment with facilitator
			logger.Info("verifying payment", "scheme", payment.Accepted.Scheme, "network", payment.Accepted.Network)
			verifyResp, err := facilitator.Verify(r.Context(), *payment, *requirement)
			if err != nil && fallbackFacilitator != nil {
				logger.Warn("primary facilitator failed, trying fallback", "error", err)
				verifyResp, err = fallbackFacilitator.Verify(r.Context(), *payment, *requirement)
			}
			if err != nil {
				logger.Error("facilitator verification failed", "error", err)
				http.Error(w, "Payment verification failed", http.StatusServiceUnavailable)
				return
			}

			if !verifyResp.IsValid {
				logger.Warn("payment verification failed", "reason", verifyResp.InvalidReason)
				if err := helpers.SendPaymentRequired(w, resource, enrichedRequirements, verifyResp.InvalidReason); err != nil {
					logger.Error("failed to send payment required response", "error", err)
				}
				return
			}

			// Payment verified successfully
			logger.Info("payment verified", "payer", verifyResp.Payer)

			// Store payment info in context for handler access
			ctx := context.WithValue(r.Context(), PaymentContextKey, verifyResp)
			r = r.WithContext(ctx)

			interceptor := &settlementInterceptor{
				w: w,
				settleFunc: func() bool {
					if config.VerifyOnly {
						return true
					}

					logger.Info("settling payment", "payer", verifyResp.Payer)
					settlementResp, err := facilitator.Settle(r.Context(), *payment, *requirement)
					if err != nil && fallbackFacilitator != nil {
						logger.Warn("primary facilitator settlement failed, trying fallback", "error", err)
						settlementResp, err = fallbackFacilitator.Settle(r.Context(), *payment, *requirement)
					}
					if err != nil {
						logger.Error("settlement failed", "error", err)
						http.Error(w, "Payment settlement failed", http.StatusServiceUnavailable)
						return false
					}

					if !settlementResp.Success {
						logger.Warn("settlement unsuccessful", "reason", settlementResp.ErrorReason)
						if err := helpers.SendPaymentRequired(w, resource, enrichedRequirements, settlementResp.ErrorReason); err != nil {
							logger.Error("failed to send payment required response", "error", err)
						}
						return false
					}

					logger.Info("payment settled", "transaction", settlementResp.Transaction)

					// Add X-PAYMENT-RESPONSE header with settlement info
					if err := helpers.AddPaymentResponseHeader(w, settlementResp); err != nil {
						logger.Warn("failed to add payment response header", "error", err)
						// Continue anyway - payment was successful
					}
					return true
				},
				onFailure: func(statusCode int) {
					logger.Warn("handler returned non-success, skipping payment settlement", "status", statusCode)
				},
			}
			next.ServeHTTP(interceptor, r)
		})
	}
}

// settlementInterceptor wraps the ResponseWriter to intercept the moment of commitment.
type settlementInterceptor struct {
	w http.ResponseWriter
	// settleFunc is the callback that performs the actual settlement logic
	settleFunc func() bool
	// onFailure is an internal logging callback
	onFailure func(statusCode int)
	committed bool
	hijacked  bool
}

func (i *settlementInterceptor) Header() http.Header {
	return i.w.Header()
}

func (i *settlementInterceptor) Write(b []byte) (int, error) {
	// If the handler calls Write without WriteHeader, it implies 200 OK.
	// We must trigger our check now.
	if !i.committed {
		i.WriteHeader(http.StatusOK)
	}

	// If settlement failed, we have "hijacked" the connection to send an error.
	// We silently discard the handler's payload to prevent mixed responses.
	if i.hijacked {
		return len(b), nil
	}

	return i.w.Write(b)
}

func (i *settlementInterceptor) WriteHeader(statusCode int) {
	if i.committed {
		return
	}
	i.committed = true

	// Case 1: Handler is returning an error (e.g., 404, 500).
	// We do nothing. Let the error pass through. No settlement.
	if statusCode >= 400 {
		if i.onFailure != nil {
			i.onFailure(statusCode)
		}
		i.w.WriteHeader(statusCode)
		return
	}

	// Case 2: Handler wants to succeed. STOP!
	// We run the settlement logic now.
	if !i.settleFunc() {
		// Settlement failed. We mark as hijacked.
		// The settleFunc has already written the 402/503 error to the underlying writer.
		i.hijacked = true
		return
	}

	// Case 3: Settlement succeeded.
	// The settleFunc has already added the X-PAYMENT-RESPONSE headers.
	// We now allow the original status code to proceed.
	i.w.WriteHeader(statusCode)
}

// Flush implements http.Flusher to support streaming responses.
func (i *settlementInterceptor) Flush() {
	if flusher, ok := i.w.(http.Flusher); ok {
		flusher.Flush()
	}
}

// Hijack implements http.Hijacker to support connection hijacking.
func (i *settlementInterceptor) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hijacker, ok := i.w.(http.Hijacker); ok {
		// Ensure settlement happens before hijacking (e.g., WebSocket upgrades)
		if !i.committed {
			// Treat hijack as a successful upgrade path; settle first.
			i.committed = true
			if !i.settleFunc() {
				i.hijacked = true
				return nil, nil, errors.New("payment settlement failed")
			}
		}
		return hijacker.Hijack()
	}
	return nil, nil, errors.New("hijacking not supported")
}

// Push implements http.Pusher to support HTTP/2 server push.
func (i *settlementInterceptor) Push(target string, opts *http.PushOptions) error {
	if pusher, ok := i.w.(http.Pusher); ok {
		return pusher.Push(target, opts)
	}
	return http.ErrNotSupported
}

// GetPaymentFromContext extracts the verified payment information from the request context.
// Returns nil if no payment was verified or the context does not contain payment info.
func GetPaymentFromContext(ctx context.Context) *v2.VerifyResponse {
	value := ctx.Value(PaymentContextKey)
	if value == nil {
		return nil
	}
	resp, ok := value.(*v2.VerifyResponse)
	if !ok {
		return nil
	}
	return resp
}
