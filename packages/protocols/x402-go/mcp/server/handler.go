package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"

	"github.com/mark3labs/x402-go"
	"github.com/mark3labs/x402-go/facilitator"
	x402http "github.com/mark3labs/x402-go/http"
)

// X402Handler wraps an MCP HTTP handler and adds x402 payment verification
type X402Handler struct {
	mcpHandler          http.Handler
	config              *Config
	facilitator         Facilitator
	fallbackFacilitator Facilitator
}

// NewX402Handler creates a new x402 payment handler
func NewX402Handler(mcpHandler http.Handler, config *Config) (*X402Handler, error) {
	if config == nil {
		config = DefaultConfig()
	}

	facilitator, fallbackFacilitator, err := initializeFacilitators(config)
	if err != nil {
		return nil, err
	}

	return &X402Handler{
		mcpHandler:          mcpHandler,
		config:              config,
		facilitator:         facilitator,
		fallbackFacilitator: fallbackFacilitator,
	}, nil
}

type facilitatorConfig struct {
	url            string
	auth           string
	authProvider   x402http.AuthorizationProvider
	onBeforeVerify x402http.OnBeforeFunc
	onAfterVerify  x402http.OnAfterVerifyFunc
	onBeforeSettle x402http.OnBeforeFunc
	onAfterSettle  x402http.OnAfterSettleFunc
}

// Helper to create facilitator with given URL and options
func createFacilitator(cfg facilitatorConfig) Facilitator {
	return NewHTTPFacilitator(cfg.url,
		WithAuthorization(cfg.auth),
		WithAuthorizationProvider(cfg.authProvider),
		WithOnBeforeVerify(cfg.onBeforeVerify),
		WithOnAfterVerify(cfg.onAfterVerify),
		WithOnBeforeSettle(cfg.onBeforeSettle),
		WithOnAfterSettle(cfg.onAfterSettle))
}

func initializeFacilitators(config *Config) (Facilitator, Facilitator, error) {
	var facilitator, fallbackFacilitator Facilitator

	// Determine primary URL and options
	primaryURL := config.FacilitatorURL
	auth := config.FacilitatorAuthorization
	authProvider := config.FacilitatorAuthorizationProvider
	onBeforeVerify := config.FacilitatorOnBeforeVerify
	onAfterVerify := config.FacilitatorOnAfterVerify
	onBeforeSettle := config.FacilitatorOnBeforeSettle
	onAfterSettle := config.FacilitatorOnAfterSettle

	if config.HTTPConfig != nil && config.HTTPConfig.FacilitatorURL != "" {
		primaryURL = config.HTTPConfig.FacilitatorURL
		auth = config.HTTPConfig.FacilitatorAuthorization
		authProvider = config.HTTPConfig.FacilitatorAuthorizationProvider
		onBeforeVerify = config.HTTPConfig.FacilitatorOnBeforeVerify
		onAfterVerify = config.HTTPConfig.FacilitatorOnAfterVerify
		onBeforeSettle = config.HTTPConfig.FacilitatorOnBeforeSettle
		onAfterSettle = config.HTTPConfig.FacilitatorOnAfterSettle
	}

	if primaryURL == "" {
		return nil, nil, fmt.Errorf("x402: at least one facilitator URL must be provided")
	}

	facilitator = createFacilitator(facilitatorConfig{
		url:            primaryURL,
		auth:           auth,
		authProvider:   authProvider,
		onBeforeVerify: onBeforeVerify,
		onAfterVerify:  onAfterVerify,
		onBeforeSettle: onBeforeSettle,
		onAfterSettle:  onAfterSettle,
	})

	// Initialize fallback if configured
	if config.HTTPConfig != nil && config.HTTPConfig.FallbackFacilitatorURL != "" {
		fallbackFacilitator = createFacilitator(facilitatorConfig{
			url:            config.HTTPConfig.FallbackFacilitatorURL,
			auth:           config.HTTPConfig.FallbackFacilitatorAuthorization,
			authProvider:   config.HTTPConfig.FallbackFacilitatorAuthorizationProvider,
			onBeforeVerify: config.HTTPConfig.FallbackFacilitatorOnBeforeVerify,
			onAfterVerify:  config.HTTPConfig.FallbackFacilitatorOnAfterVerify,
			onBeforeSettle: config.HTTPConfig.FallbackFacilitatorOnBeforeSettle,
			onAfterSettle:  config.HTTPConfig.FallbackFacilitatorOnAfterSettle,
		})
	}

	return facilitator, fallbackFacilitator, nil
}

// ServeHTTP intercepts HTTP requests to check for x402 payments
func (h *X402Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logger := h.config.Logger
	if logger == nil {
		logger = slog.Default()
	}
	// Only intercept POST requests (JSON-RPC calls)
	if r.Method != http.MethodPost {
		h.mcpHandler.ServeHTTP(w, r)
		return
	}

	// Read request body
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		h.writeError(w, nil, -32700, "Parse error", nil)
		return
	}
	r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	// Parse JSON-RPC request
	var jsonrpcReq struct {
		JSONRPC string          `json:"jsonrpc"`
		Method  string          `json:"method"`
		Params  json.RawMessage `json:"params"`
		ID      interface{}     `json:"id"`
	}
	if err := json.Unmarshal(bodyBytes, &jsonrpcReq); err != nil {
		h.writeError(w, nil, -32700, "Parse error", nil)
		return
	}

	// Only intercept tools/call methods
	if jsonrpcReq.Method != "tools/call" {
		h.mcpHandler.ServeHTTP(w, r)
		return
	}

	// Parse tool call params
	var toolParams struct {
		Name      string                 `json:"name"`
		Arguments map[string]interface{} `json:"arguments"`
		Meta      *struct {
			AdditionalFields map[string]interface{} `json:"-"`
		} `json:"_meta"`
	}
	if err := json.Unmarshal(jsonrpcReq.Params, &toolParams); err != nil {
		h.writeError(w, jsonrpcReq.ID, -32602, "Invalid params", nil)
		return
	}
	logger = logger.With("requestID", jsonrpcReq.ID, "tool", toolParams.Name)

	// Unmarshal _meta separately to get AdditionalFields
	if len(jsonrpcReq.Params) > 0 {
		var params map[string]interface{}
		if err := json.Unmarshal(jsonrpcReq.Params, &params); err == nil {
			if meta, ok := params["_meta"].(map[string]interface{}); ok {
				if toolParams.Meta == nil {
					toolParams.Meta = &struct {
						AdditionalFields map[string]interface{} `json:"-"`
					}{}
				}
				toolParams.Meta.AdditionalFields = meta
			}
		}
	}

	// Check if tool requires payment
	requirements, needsPayment := h.checkPaymentRequired(toolParams.Name)
	if !needsPayment {
		// Free tool - pass through
		h.mcpHandler.ServeHTTP(w, r)
		return
	}

	// Tool requires payment - extract payment from _meta
	payment := h.extractPayment(toolParams.Meta)
	if payment == nil {
		// No payment provided - send 402 error
		h.sendPaymentRequiredError(w, jsonrpcReq.ID, requirements)
		return
	}

	// Find matching requirement
	requirement, err := h.findMatchingRequirement(payment, requirements)
	if err != nil {
		h.writeError(w, jsonrpcReq.ID, 402, fmt.Sprintf("Payment invalid: %v", err), nil)
		return
	}

	// Verify payment with facilitator
	ctx, cancel := context.WithTimeout(r.Context(), x402.DefaultTimeouts.VerifyTimeout)
	defer cancel()

	verifyResp, err := h.facilitator.Verify(ctx, payment, *requirement)
	if err != nil && h.fallbackFacilitator != nil {
		logger.WarnContext(ctx, "primary facilitator failed, trying fallback", "error", err)
		verifyResp, err = h.fallbackFacilitator.Verify(ctx, payment, *requirement)
	}
	if err != nil {
		if h.config.Verbose {
			logger.InfoContext(ctx, "Payment verification failed", "error", err)
		}
		h.writeError(w, jsonrpcReq.ID, -32603, fmt.Sprintf("Verification failed: %v", err), nil)
		return
	}

	if !verifyResp.IsValid {
		if h.config.Verbose {
			logger.InfoContext(ctx, "Payment rejected", "reason", verifyResp.InvalidReason)
		}
		h.writeError(w, jsonrpcReq.ID, 402, fmt.Sprintf("Payment invalid: %s", verifyResp.InvalidReason), nil)
		return
	}

	h.forwardAndSettle(w, r, bodyBytes, jsonrpcReq.ID, payment, requirement, verifyResp, logger)
}

// checkPaymentRequired checks if a tool requires payment
func (h *X402Handler) checkPaymentRequired(toolName string) ([]x402.PaymentRequirement, bool) {
	requirements, exists := h.config.PaymentTools[toolName]
	if !exists || len(requirements) == 0 {
		return nil, false
	}

	// Work on a copy to avoid mutating shared config
	reqCopy := make([]x402.PaymentRequirement, len(requirements))
	copy(reqCopy, requirements)

	for i := range reqCopy {
		if reqCopy[i].Resource == "" {
			reqCopy[i].Resource = fmt.Sprintf("mcp://tools/%s", toolName)
		}
	}

	return reqCopy, true
}

// extractPayment extracts payment from params._meta["x402/payment"]
func (h *X402Handler) extractPayment(meta *struct {
	AdditionalFields map[string]interface{} `json:"-"`
}) *x402.PaymentPayload {
	if meta == nil || meta.AdditionalFields == nil {
		return nil
	}

	paymentData, ok := meta.AdditionalFields["x402/payment"]
	if !ok {
		return nil
	}

	// Marshal and unmarshal to convert to PaymentPayload
	paymentBytes, err := json.Marshal(paymentData)
	if err != nil {
		return nil
	}

	var payment x402.PaymentPayload
	if err := json.Unmarshal(paymentBytes, &payment); err != nil {
		return nil
	}

	return &payment
}

// findMatchingRequirement finds a requirement that matches the payment
// This delegates to x402.FindMatchingRequirement for consistent matching logic across packages.
func (h *X402Handler) findMatchingRequirement(payment *x402.PaymentPayload, requirements []x402.PaymentRequirement) (*x402.PaymentRequirement, error) {
	return x402.FindMatchingRequirement(*payment, requirements)
}

// sendPaymentRequiredError sends a 402 error with payment requirements
func (h *X402Handler) sendPaymentRequiredError(w http.ResponseWriter, id interface{}, requirements []x402.PaymentRequirement) {
	errorData := map[string]interface{}{
		"x402Version": 1,
		"error":       "Payment required to access this resource",
		"accepts":     requirements,
	}

	h.writeError(w, id, 402, "Payment required", errorData)
}

// forwardAndSettle executes the mcpHandler and on success, settles the payment and injects settlement response in result._meta
func (h *X402Handler) forwardAndSettle(w http.ResponseWriter, r *http.Request, requestBody []byte, requestID interface{}, payment *x402.PaymentPayload, requirement *x402.PaymentRequirement, verifyResp *facilitator.VerifyResponse, logger *slog.Logger) {
	// Create a response recorder to capture the MCP handler's response
	recorder := &responseRecorder{
		headerMap:  make(http.Header),
		statusCode: http.StatusOK,
	}

	// Restore request body
	r.Body = io.NopCloser(bytes.NewBuffer(requestBody))

	// Forward to MCP handler
	h.mcpHandler.ServeHTTP(recorder, r)

	// Parse response
	var jsonrpcResp struct {
		JSONRPC string          `json:"jsonrpc"`
		Result  json.RawMessage `json:"result,omitempty"`
		Error   interface{}     `json:"error,omitempty"`
		ID      interface{}     `json:"id"`
	}

	if err := json.Unmarshal(recorder.body.Bytes(), &jsonrpcResp); err != nil {
		if h.config.Verbose {
			logger.ErrorContext(r.Context(), "Failed to parse MCP response, skipping settlement", "error", err)
		}
		// If we can't parse response, just forward it as-is
		for k, v := range recorder.headerMap {
			w.Header()[k] = v
		}
		w.WriteHeader(recorder.statusCode)
		_, _ = w.Write(recorder.body.Bytes())
		return
	}

	if jsonrpcResp.Error != nil {
		if h.config.Verbose {
			logger.InfoContext(r.Context(), "Execution failed. Payment will not be settled.")
		}
		for k, v := range recorder.headerMap {
			w.Header()[k] = v
		}
		w.WriteHeader(recorder.statusCode)
		_, _ = w.Write(recorder.body.Bytes())
		return
	}

	var settleResp *x402.SettlementResponse
	// Settle if not verify-only mode
	if !h.config.VerifyOnly {
		if h.config.Verbose {
			logger.InfoContext(r.Context(), "Execution successful. Settling payment.")
		}
		settleCtx, settleCancel := context.WithTimeout(r.Context(), x402.DefaultTimeouts.SettleTimeout)
		defer settleCancel()

		var err error
		settleResp, err = h.facilitator.Settle(settleCtx, payment, *requirement)
		if err != nil && h.fallbackFacilitator != nil {
			logger.WarnContext(settleCtx, "primary facilitator settlement failed, trying fallback", "error", err)
			settleResp, err = h.fallbackFacilitator.Settle(settleCtx, payment, *requirement)
		}
		if err != nil || settleResp == nil || !settleResp.Success {
			reason := "unknown reason"
			if err != nil {
				reason = err.Error()
			} else if settleResp != nil {
				reason = settleResp.ErrorReason
			}

			if h.config.Verbose {
				logger.ErrorContext(settleCtx, "Settlement failed", "error", reason)
			}
			payer := ""
			if verifyResp != nil {
				payer = verifyResp.Payer
			}
			errorData := map[string]interface{}{
				"x402/payment-response": x402.SettlementResponse{
					Success:     false,
					Network:     payment.Network,
					Payer:       payer,
					ErrorReason: reason,
				},
			}
			h.writeError(w, requestID, -32603, fmt.Sprintf("Settlement failed: %v", reason), errorData)
			return
		} else if h.config.Verbose {
			logger.InfoContext(settleCtx, "Payment successful", "transaction", settleResp.Transaction)
		}
	}

	if jsonrpcResp.Result != nil {
		var result map[string]interface{}
		if err := json.Unmarshal(jsonrpcResp.Result, &result); err == nil {
			meta, ok := result["_meta"].(map[string]interface{})
			if !ok {
				meta = make(map[string]interface{})
			}

			// Add settlement response
			if settleResp != nil {
				meta["x402/payment-response"] = settleResp
			} else {
				payer := ""
				if verifyResp != nil {
					payer = verifyResp.Payer
				}
				// In verify-only mode: Success=false indicates settlement was skipped (not attempted), not that it failed.
				meta["x402/payment-response"] = x402.SettlementResponse{
					Success: false,
					Network: payment.Network,
					Payer:   payer,
				}
			}
			result["_meta"] = meta

			// Re-marshal result
			modifiedResult, err := json.Marshal(result)
			if err == nil {
				jsonrpcResp.Result = modifiedResult
			}
		}
	}

	// Write modified response
	responseBytes, err := json.Marshal(jsonrpcResp)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	// Copy headers
	for k, v := range recorder.headerMap {
		w.Header()[k] = v
	}

	w.WriteHeader(recorder.statusCode)
	_, _ = w.Write(responseBytes)
}

// writeError writes a JSON-RPC error response
func (h *X402Handler) writeError(w http.ResponseWriter, id interface{}, code int, message string, data interface{}) {
	errorResp := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      id,
		"error": map[string]interface{}{
			"code":    code,
			"message": message,
		},
	}

	if data != nil {
		errorResp["error"].(map[string]interface{})["data"] = data
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK) // JSON-RPC errors use 200 status
	_ = json.NewEncoder(w).Encode(errorResp)
}

// responseRecorder records HTTP responses for modification
type responseRecorder struct {
	headerMap  http.Header
	body       bytes.Buffer
	statusCode int
}

func (r *responseRecorder) Header() http.Header {
	return r.headerMap
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	return r.body.Write(b)
}

func (r *responseRecorder) WriteHeader(statusCode int) {
	r.statusCode = statusCode
}
