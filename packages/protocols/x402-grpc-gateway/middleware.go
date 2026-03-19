package x402

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// PaymentMiddleware creates HTTP middleware that enforces x402 payment requirements
// It integrates seamlessly with grpc-gateway and returns standard http.Handler middleware
func PaymentMiddleware(cfg Config) func(http.Handler) http.Handler {
	// Validate configuration
	if err := cfg.Validate(); err != nil {
		panic(fmt.Sprintf("invalid x402 middleware configuration: %v", err))
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			// Check if this path requires payment
			rule, requiresPayment := cfg.MatchEndpoint(r.URL.Path)
			if !requiresPayment {
				// No payment required, proceed
				next.ServeHTTP(w, r)
				return
			}

			// Check for X-PAYMENT header
			xPayment := r.Header.Get("X-PAYMENT")
			if xPayment == "" {
				// No payment provided, return 402 with payment requirements
				sendPaymentRequired(w, r, rule, &cfg)
				return
			}

			// Parse and verify payment
			payment, err := parsePayment(xPayment)
			if err != nil {
				sendError(w, http.StatusBadRequest, fmt.Sprintf("Invalid X-PAYMENT header: %v", err))
				return
			}

			// Verify the payment
			verifyResult, err := cfg.Verifier.Verify(ctx, payment)
			if err != nil {
				sendError(w, http.StatusInternalServerError, fmt.Sprintf("Payment verification error: %v", err))
				return
			}

			if !verifyResult.Valid {
				// Payment invalid, return 402 again with reason
				sendPaymentRequired(w, r, rule, &cfg)
				return
			}

			// Settle the payment on-chain
			settlementResult, err := cfg.Verifier.Settle(ctx, payment)
			if err != nil {
				sendError(w, http.StatusInternalServerError, fmt.Sprintf("Payment settlement error: %v", err))
				return
			}

			// Create payment context for downstream handlers
			paymentCtx := &PaymentContext{
				Verified:        true,
				PayerAddress:    verifyResult.PayerAddress,
				Amount:          verifyResult.Amount,
				TokenSymbol:     verifyResult.TokenSymbol,
				Network:         payment.Network,
				TransactionHash: settlementResult.TransactionHash,
				SettledAt:       settlementResult.SettledAt,
			}

			// Inject payment context into request context
			ctx = context.WithValue(ctx, PaymentContextKey, paymentCtx)

			// Add X-PAYMENT-RESPONSE header
			paymentResponse := PaymentResponse{
				TransactionHash: settlementResult.TransactionHash,
				Status:          settlementResult.Status,
			}
			if responseJSON, err := json.Marshal(paymentResponse); err == nil {
				w.Header().Set("X-PAYMENT-RESPONSE", base64.StdEncoding.EncodeToString(responseJSON))
			}

			// Proceed with the request
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// sendPaymentRequired sends a 402 Payment Required response
func sendPaymentRequired(w http.ResponseWriter, r *http.Request, rule *PricingRule, cfg *Config) {
	// Check if this is a browser request (based on User-Agent)
	isBrowser := isBrowserRequest(r)

	// If custom HTML paywall is configured and this is a browser, return HTML
	if cfg.CustomPaywallHTML != "" && isBrowser {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusPaymentRequired)
		w.Write([]byte(cfg.CustomPaywallHTML))
		return
	}

	// Build payment requirements from the pricing rule
	requirements := make([]PaymentRequirements, 0, len(rule.AcceptedTokens))

	validBefore := time.Now().Add(cfg.ValidityDuration).Unix()

	for _, token := range rule.AcceptedTokens {
		req := PaymentRequirements{
			X402Version:       1,
			Scheme:            "exact", // EVM scheme for now
			Network:           token.Network,
			MaxAmountRequired: rule.Amount,
			Resource:          r.URL.Path,
			Description:       rule.Description,
			MimeType:          rule.MimeType,
			Recipient:         token.Recipient,
			ValidBefore:       validBefore,
			AssetContract:     token.AssetContract,
			Metadata: Metadata{
				TokenSymbol:   token.Symbol,
				TokenName:     token.TokenName,
				TokenDecimals: token.TokenDecimals,
			},
			OutputSchema:      rule.OutputSchema,
		}
		requirements = append(requirements, req)
	}

	response := PaymentRequiredResponse{
		Error:               "Payment required",
		PaymentRequirements: requirements,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusPaymentRequired)
	json.NewEncoder(w).Encode(response)
}

// sendError sends a JSON error response
func sendError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]string{
		"error": message,
	})
}

// parsePayment decodes and parses the X-PAYMENT header
func parsePayment(xPaymentHeader string) (*Payment, error) {
	// Decode base64
	payloadBytes, err := base64.StdEncoding.DecodeString(xPaymentHeader)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64: %w", err)
	}

	// Parse JSON
	var payment Payment
	if err := json.Unmarshal(payloadBytes, &payment); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	// Basic validation
	if payment.X402Version == 0 {
		return nil, fmt.Errorf("x402Version is required")
	}

	if payment.Scheme == "" {
		return nil, fmt.Errorf("scheme is required")
	}

	if payment.Network == "" {
		return nil, fmt.Errorf("network is required")
	}

	if payment.Payload == nil {
		return nil, fmt.Errorf("payload is required")
	}

	return &payment, nil
}

// GetPaymentFromContext extracts payment information from the request context
// This can be used in gRPC handlers to access payment details
func GetPaymentFromContext(ctx context.Context) (*PaymentContext, bool) {
	payment, ok := ctx.Value(PaymentContextKey).(*PaymentContext)
	return payment, ok
}

// RequirePayment is a helper that extracts payment from context and returns error if not found
// Useful for gRPC handlers that must have valid payment
func RequirePayment(ctx context.Context) (*PaymentContext, error) {
	payment, ok := GetPaymentFromContext(ctx)
	if !ok {
		return nil, fmt.Errorf("payment context not found")
	}
	if !payment.Verified {
		return nil, fmt.Errorf("payment not verified")
	}
	return payment, nil
}

// EncodePayment encodes a Payment struct to X-PAYMENT header format (base64 JSON)
// Useful for testing and client implementations
func EncodePayment(payment *Payment) (string, error) {
	paymentJSON, err := json.Marshal(payment)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payment: %w", err)
	}
	return base64.StdEncoding.EncodeToString(paymentJSON), nil
}

// DecodePaymentResponse decodes an X-PAYMENT-RESPONSE header
func DecodePaymentResponse(xPaymentResponse string) (*PaymentResponse, error) {
	responseBytes, err := base64.StdEncoding.DecodeString(xPaymentResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64: %w", err)
	}

	var response PaymentResponse
	if err := json.Unmarshal(responseBytes, &response); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	return &response, nil
}

// ReadPaymentRequirements is a helper to extract payment requirements from a 402 response
func ReadPaymentRequirements(resp *http.Response) (*PaymentRequiredResponse, error) {
	if resp.StatusCode != http.StatusPaymentRequired {
		return nil, fmt.Errorf("expected status 402, got %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var paymentReq PaymentRequiredResponse
	if err := json.Unmarshal(body, &paymentReq); err != nil {
		return nil, fmt.Errorf("failed to parse payment requirements: %w", err)
	}

	return &paymentReq, nil
}

// isBrowserRequest detects if the request is from a web browser based on User-Agent
func isBrowserRequest(r *http.Request) bool {
	userAgent := r.Header.Get("User-Agent")
	if userAgent == "" {
		return false
	}

	// Common browser User-Agent indicators
	browserIndicators := []string{
		"Mozilla/",
		"Chrome/",
		"Safari/",
		"Firefox/",
		"Edge/",
		"Opera/",
	}

	for _, indicator := range browserIndicators {
		if contains(userAgent, indicator) {
			return true
		}
	}

	return false
}

// contains checks if a string contains a substring (case-sensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && findSubstring(s, substr)
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
