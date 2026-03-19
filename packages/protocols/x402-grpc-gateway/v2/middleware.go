package x402

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// V2 header names.
const (
	HeaderPaymentSignature = "PAYMENT-SIGNATURE"
	HeaderPaymentResponse  = "PAYMENT-RESPONSE"
	HeaderPaymentRequired  = "PAYMENT-REQUIRED"

	// V1 legacy header names.
	HeaderLegacyPayment         = "X-PAYMENT"
	HeaderLegacyPaymentResponse = "X-PAYMENT-RESPONSE"
)

// PaymentMiddleware creates HTTP middleware that enforces x402 payment requirements.
// It detects V2 headers (PAYMENT-SIGNATURE) first and falls back to V1 (X-PAYMENT).
func PaymentMiddleware(cfg Config) func(http.Handler) http.Handler {
	if err := cfg.Validate(); err != nil {
		panic(fmt.Sprintf("invalid x402 middleware configuration: %v", err))
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			rule, requiresPayment := cfg.MatchEndpoint(r.URL.Path)
			if !requiresPayment {
				next.ServeHTTP(w, r)
				return
			}

			// Detect protocol version from headers.
			// V2: PAYMENT-SIGNATURE, V1 fallback: X-PAYMENT
			paymentHeader := r.Header.Get(HeaderPaymentSignature)
			isV2 := true
			if paymentHeader == "" {
				paymentHeader = r.Header.Get(HeaderLegacyPayment)
				isV2 = false
			}

			if paymentHeader == "" {
				sendPaymentRequired(w, r, rule, &cfg)
				return
			}

			// Default requirements from first accepted token (used for V1 legacy).
			requirements := buildRequirementsFromRule(rule)

			// Parse payment header.
			var payload *PaymentPayload
			var err error
			if isV2 {
				payload, err = parsePaymentPayload(paymentHeader)
			} else {
				payload, err = parseLegacyPayment(paymentHeader, requirements)
			}
			if err != nil {
				sendError(w, http.StatusBadRequest, fmt.Sprintf("Invalid payment header: %v", err))
				return
			}

			// For V2, match the client's chosen token against the rule's accepted tokens
			// so requirements/symbol are correct for multi-token rules.
			var tokenSymbol string
			if isV2 && payload != nil {
				if matched, symbol := MatchClientToken(rule, payload); matched != nil {
					requirements = matched
					tokenSymbol = symbol
				}
			}

			// Verify the payment.
			verifyResult, err := cfg.Verifier.Verify(ctx, payload, requirements)
			if err != nil {
				sendError(w, http.StatusInternalServerError, fmt.Sprintf("Payment verification error: %v", err))
				return
			}

			if !verifyResult.Valid {
				sendPaymentRequired(w, r, rule, &cfg)
				return
			}

			// Settle the payment on-chain.
			settlementResult, err := cfg.Verifier.Settle(ctx, payload, requirements)
			if err != nil {
				sendError(w, http.StatusInternalServerError, fmt.Sprintf("Payment settlement error: %v", err))
				return
			}

			// Resolve token symbol from rule match or verifier.
			if tokenSymbol == "" {
				tokenSymbol = verifyResult.TokenSymbol
			}

			// Create payment context for downstream handlers.
			paymentCtx := &PaymentContext{
				Verified:        true,
				PayerAddress:    verifyResult.PayerAddress,
				Amount:          verifyResult.Amount,
				TokenSymbol:     tokenSymbol,
				Network:         requirements.Network,
				TransactionHash: settlementResult.TransactionHash,
				SettledAt:       settlementResult.SettledAt,
			}

			ctx = context.WithValue(ctx, PaymentContextKey, paymentCtx)

			// Set response headers (version-aware).
			paymentResponse := PaymentResponse{
				Success:     true,
				Transaction: settlementResult.TransactionHash,
				Network:     settlementResult.Network,
				Payer:       settlementResult.PayerAddress,
			}
			if responseJSON, err := json.Marshal(paymentResponse); err == nil {
				encoded := base64.StdEncoding.EncodeToString(responseJSON)
				if isV2 {
					w.Header().Set(HeaderPaymentResponse, encoded)
				} else {
					w.Header().Set(HeaderLegacyPaymentResponse, encoded)
				}
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// buildRequirementsFromRule constructs PaymentRequirements from the first accepted token.
// Used as a fallback for V1 legacy payments. V2 payments use matchClientToken instead.
func buildRequirementsFromRule(rule *PricingRule) *PaymentRequirements {
	if len(rule.AcceptedTokens) == 0 {
		return nil
	}
	token := rule.AcceptedTokens[0]
	return &PaymentRequirements{
		Scheme:  "exact",
		Network: token.Network,
		Amount:  token.Amount,
		Asset:   token.AssetContract,
		PayTo:   token.Recipient,
	}
}

// MatchClientToken finds the accepted token matching the client's chosen asset+network.
// Returns the requirements for that token and its symbol, or nil if no match.
func MatchClientToken(rule *PricingRule, payload *PaymentPayload) (*PaymentRequirements, string) {
	clientAsset := strings.ToLower(payload.Accepted.Asset)
	clientNetwork := payload.Accepted.Network

	for _, token := range rule.AcceptedTokens {
		if strings.ToLower(token.AssetContract) == clientAsset && token.Network == clientNetwork {
			return &PaymentRequirements{
				Scheme:  "exact",
				Network: token.Network,
				Amount:  token.Amount,
				Asset:   token.AssetContract,
				PayTo:   token.Recipient,
			}, token.Symbol
		}
	}
	return nil, ""
}

// sendPaymentRequired sends a 402 Payment Required response with V2 format.
func sendPaymentRequired(w http.ResponseWriter, r *http.Request, rule *PricingRule, cfg *Config) {
	if cfg.CustomPaywallHTML != "" && isBrowserRequest(r) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusPaymentRequired)
		w.Write([]byte(cfg.CustomPaywallHTML))
		return
	}

	accepts := make([]PaymentRequirements, 0, len(rule.AcceptedTokens))
	for _, token := range rule.AcceptedTokens {
		accepts = append(accepts, PaymentRequirements{
			Scheme:            "exact",
			Network:           token.Network,
			Amount:            token.Amount,
			Asset:             token.AssetContract,
			PayTo:             token.Recipient,
			MaxTimeoutSeconds: int(cfg.ValidityDuration.Seconds()),
			Extra: map[string]interface{}{
				"name":    token.TokenName,
				"version": "2",
			},
		})
	}

	response := PaymentRequiredResponse{
		X402Version: 2,
		Error:       "Payment required",
		Accepts:     accepts,
	}

	// Set PAYMENT-REQUIRED header with base64-encoded requirements.
	if responseJSON, err := json.Marshal(response); err == nil {
		w.Header().Set(HeaderPaymentRequired, base64.StdEncoding.EncodeToString(responseJSON))
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusPaymentRequired)
	json.NewEncoder(w).Encode(response)
}

func sendError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]string{
		"error": message,
	})
}

// parsePaymentPayload decodes a V2 PAYMENT-SIGNATURE header into a PaymentPayload.
func parsePaymentPayload(header string) (*PaymentPayload, error) {
	payloadBytes, err := base64.StdEncoding.DecodeString(header)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64: %w", err)
	}

	var payload PaymentPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	if payload.X402Version < 2 {
		return nil, fmt.Errorf("PAYMENT-SIGNATURE header requires x402Version >= 2, got %d", payload.X402Version)
	}

	if payload.Payload == nil {
		return nil, fmt.Errorf("payload is required")
	}

	return &payload, nil
}

// parseLegacyPayment decodes a V1 X-PAYMENT header and converts to V2 PaymentPayload.
func parseLegacyPayment(header string, requirements *PaymentRequirements) (*PaymentPayload, error) {
	payloadBytes, err := base64.StdEncoding.DecodeString(header)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64: %w", err)
	}

	var legacy LegacyPayment
	if err := json.Unmarshal(payloadBytes, &legacy); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	if legacy.X402Version == 0 {
		return nil, fmt.Errorf("x402Version is required")
	}
	if legacy.Scheme == "" {
		return nil, fmt.Errorf("scheme is required")
	}
	if legacy.Network == "" {
		return nil, fmt.Errorf("network is required")
	}
	if legacy.Payload == nil {
		return nil, fmt.Errorf("payload is required")
	}

	// Convert V1 to V2 payload format.
	accepted := PaymentRequirements{
		Scheme:  legacy.Scheme,
		Network: legacy.Network,
	}
	if requirements != nil {
		accepted.Amount = requirements.Amount
		accepted.Asset = requirements.Asset
		accepted.PayTo = requirements.PayTo
	}

	return &PaymentPayload{
		X402Version: legacy.X402Version,
		Accepted:    accepted,
		Payload:     legacy.Payload,
	}, nil
}

// GetPaymentFromContext extracts payment information from the request context.
func GetPaymentFromContext(ctx context.Context) (*PaymentContext, bool) {
	payment, ok := ctx.Value(PaymentContextKey).(*PaymentContext)
	return payment, ok
}

// RequirePayment extracts payment from context and returns error if not found.
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

// EncodePaymentPayload encodes a PaymentPayload to base64 JSON for the PAYMENT-SIGNATURE header.
func EncodePaymentPayload(payload *PaymentPayload) (string, error) {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payment payload: %w", err)
	}
	return base64.StdEncoding.EncodeToString(payloadJSON), nil
}

// DecodePaymentResponse decodes a PAYMENT-RESPONSE header.
func DecodePaymentResponse(header string) (*PaymentResponse, error) {
	responseBytes, err := base64.StdEncoding.DecodeString(header)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64: %w", err)
	}

	var response PaymentResponse
	if err := json.Unmarshal(responseBytes, &response); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	return &response, nil
}

// ReadPaymentRequirements extracts payment requirements from a 402 response.
func ReadPaymentRequirements(resp *http.Response) (*PaymentRequiredResponse, error) {
	if resp.StatusCode != http.StatusPaymentRequired {
		return nil, fmt.Errorf("expected status 402, got %d", resp.StatusCode)
	}

	// Try PAYMENT-REQUIRED header first (V2).
	if header := resp.Header.Get(HeaderPaymentRequired); header != "" {
		decoded, err := base64.StdEncoding.DecodeString(header)
		if err == nil {
			var paymentReq PaymentRequiredResponse
			if err := json.Unmarshal(decoded, &paymentReq); err == nil {
				return &paymentReq, nil
			}
		}
	}

	// Fall back to body.
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

func isBrowserRequest(r *http.Request) bool {
	userAgent := r.Header.Get("User-Agent")
	if userAgent == "" {
		return false
	}

	browserIndicators := []string{"Mozilla/", "Chrome/", "Safari/", "Firefox/", "Edge/", "Opera/"}
	for _, indicator := range browserIndicators {
		if strings.Contains(userAgent, indicator) {
			return true
		}
	}

	return false
}

// buildAcceptsFromRule constructs all PaymentRequirements from a pricing rule.
func buildAcceptsFromRule(rule *PricingRule, validityDuration time.Duration) []PaymentRequirements {
	accepts := make([]PaymentRequirements, 0, len(rule.AcceptedTokens))
	for _, token := range rule.AcceptedTokens {
		accepts = append(accepts, PaymentRequirements{
			Scheme:            "exact",
			Network:           token.Network,
			Amount:            token.Amount,
			Asset:             token.AssetContract,
			PayTo:             token.Recipient,
			MaxTimeoutSeconds: int(validityDuration.Seconds()),
		})
	}
	return accepts
}
