package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/mark3labs/mcp-go/client/transport"
	"github.com/mark3labs/mcp-go/mcp"
)

// X402Handler wraps an MCP HTTP handler with x402 payment support using JSON-RPC errors
type X402Handler struct {
	mcpHandler  http.Handler
	config      *Config
	facilitator Facilitator
}

// NewX402Handler creates a new x402 handler wrapper
func NewX402Handler(mcpHandler http.Handler, config *Config) *X402Handler {
	facilitator := NewHTTPFacilitator(config.FacilitatorURL)
	facilitator.SetVerbose(config.Verbose)
	return &X402Handler{
		mcpHandler:  mcpHandler,
		config:      config,
		facilitator: facilitator,
	}
}

// ServeHTTP implements http.Handler and intercepts requests to handle x402 payment flow
func (h *X402Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Only intercept POST requests (MCP tool calls)
	if r.Method != http.MethodPost {
		h.mcpHandler.ServeHTTP(w, r)
		return
	}

	if h.config.Verbose {
		log.Printf("[X402] Incoming %s request from %s", r.Method, r.RemoteAddr)
	}

	// Read and buffer the request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request", http.StatusBadRequest)
		return
	}
	r.Body = io.NopCloser(bytes.NewReader(body))

	// Parse JSON-RPC request
	var jsonrpcReq transport.JSONRPCRequest
	if err := json.Unmarshal(body, &jsonrpcReq); err != nil {
		// Not valid JSON, let MCP handler deal with it
		h.mcpHandler.ServeHTTP(w, r)
		return
	}

	// Check if this is a tool call (JSON-RPC method)
	if jsonrpcReq.Method != "tools/call" {
		if h.config.Verbose && jsonrpcReq.Method != "" {
			log.Printf("[X402] Non-tool call method: %s, passing through", jsonrpcReq.Method)
		}
		h.mcpHandler.ServeHTTP(w, r)
		return
	}

	// Parse params to get tool name
	var params mcp.CallToolParams
	paramsBytes, _ := json.Marshal(jsonrpcReq.Params)
	if err := json.Unmarshal(paramsBytes, &params); err != nil {
		h.mcpHandler.ServeHTTP(w, r)
		return
	}

	toolName := params.Name
	requirements, needsPayment := h.config.PaymentTools[toolName]
	if !needsPayment {
		if h.config.Verbose {
			log.Printf("[X402] Tool '%s' is free, passing through", toolName)
		}
		h.mcpHandler.ServeHTTP(w, r)
		return
	}

	if h.config.Verbose {
		log.Printf("[X402] Tool '%s' requires payment, checking for payment in _meta", toolName)
	}

	// Ensure all requirements have proper fields set
	for i := range requirements {
		requirements[i].Resource = fmt.Sprintf("mcp://tools/%s", toolName)
		if requirements[i].MimeType == "" {
			requirements[i].MimeType = "application/json"
		}
	}

	// Check for payment in _meta
	var paymentData any
	if params.Meta != nil && params.Meta.AdditionalFields != nil {
		paymentData = params.Meta.AdditionalFields["x402/payment"]
	}

	if paymentData == nil {
		if h.config.Verbose {
			log.Printf("[X402] No payment found in _meta, sending 402 JSON-RPC error")
			log.Printf("[X402] Payment requirements: %d options for tool '%s'", len(requirements), toolName)
			for i, req := range requirements {
				log.Printf("[X402]   Option %d: %s %s on %s, pay to %s",
					i+1, req.MaxAmountRequired, req.Asset, req.Network, req.PayTo)
			}
		}
		h.sendPaymentRequiredError(w, jsonrpcReq.ID, requirements)
		return
	}

	if h.config.Verbose {
		log.Printf("[X402] Payment found in _meta, verifying...")
	}

	// Parse payment payload
	paymentBytes, err := json.Marshal(paymentData)
	if err != nil {
		h.sendInvalidParamsError(w, jsonrpcReq.ID, "Invalid payment format in _meta")
		return
	}

	var payment PaymentPayload
	if err := json.Unmarshal(paymentBytes, &payment); err != nil {
		h.sendInvalidParamsError(w, jsonrpcReq.ID, "Failed to parse payment data")
		return
	}

	if h.config.Verbose {
		if payment.Network == "solana" || payment.Network == "solana-devnet" {
			log.Printf("[X402] Payment parsed: network=%s, scheme=%s, type=SVM",
				payment.Network, payment.Scheme)
		} else {
			if payloadMap, ok := payment.Payload.(map[string]any); ok {
				if authData, ok := payloadMap["authorization"].(map[string]any); ok {
					log.Printf("[X402] Payment parsed: network=%s, scheme=%s, from=%v, to=%v, value=%v",
						payment.Network, payment.Scheme,
						authData["from"], authData["to"], authData["value"])
				} else {
					log.Printf("[X402] Payment parsed: network=%s, scheme=%s", payment.Network, payment.Scheme)
				}
			} else {
				log.Printf("[X402] Payment parsed: network=%s, scheme=%s", payment.Network, payment.Scheme)
			}
		}
	}

	// Find matching requirement
	requirement, err := h.findMatchingRequirement(&payment, requirements)
	if err != nil {
		if h.config.Verbose {
			log.Printf("[X402] Payment matching failed: %v", err)
		}
		h.sendInvalidParamsError(w, jsonrpcReq.ID, fmt.Sprintf("Payment does not match requirements: %v", err))
		return
	}

	// Verify payment with facilitator
	ctx := r.Context()
	verifyResp, err := h.facilitator.Verify(ctx, &payment, requirement)
	if err != nil {
		if h.config.Verbose {
			log.Printf("[X402] Facilitator verification error: %v", err)
		}
		h.sendInternalError(w, jsonrpcReq.ID, "Payment verification failed")
		return
	}

	if !verifyResp.IsValid {
		errorMsg := "Payment verification failed"
		if verifyResp.InvalidReason != "" {
			errorMsg = verifyResp.InvalidReason
		}
		if h.config.Verbose {
			log.Printf("[X402] Facilitator rejected payment: %s", errorMsg)
		}
		h.sendInvalidParamsError(w, jsonrpcReq.ID, errorMsg)
		return
	}

	if h.config.Verbose {
		log.Printf("[X402] Payment verified successfully, payer: %s", verifyResp.Payer)
	}

	// Settle payment if not in verify-only mode
	var settleResp *SettleResponse
	if !h.config.VerifyOnly {
		if h.config.Verbose {
			log.Printf("[X402] Settling payment on-chain...")
		}
		settleResp, err = h.facilitator.Settle(ctx, &payment, requirement)
		if err != nil || !settleResp.Success {
			errorMsg := "Payment settlement failed"
			if settleResp != nil && settleResp.ErrorReason != "" {
				errorMsg = settleResp.ErrorReason
			}
			if h.config.Verbose {
				log.Printf("[X402] Settlement failed: %s", errorMsg)
			}
			h.sendInternalError(w, jsonrpcReq.ID, errorMsg)
			return
		}
		if h.config.Verbose {
			log.Printf("[X402] Payment settled successfully, tx: %s", settleResp.Transaction)
		}
	} else {
		if h.config.Verbose {
			log.Printf("[X402] Verify-only mode, skipping settlement")
		}
		settleResp = &SettleResponse{
			Success:     true,
			Transaction: "verify-only-mode",
			Network:     payment.Network,
			Payer:       verifyResp.Payer,
		}
	}

	// Forward request to MCP handler and intercept response
	h.forwardWithSettlementResponse(w, r, jsonrpcReq.ID, settleResp)
}

// sendPaymentRequiredError sends a JSON-RPC 402 error per spec
func (h *X402Handler) sendPaymentRequiredError(w http.ResponseWriter, id any, requirements []PaymentRequirement) {
	response := transport.JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id.(mcp.RequestId),
		Error: &mcp.JSONRPCErrorDetails{
			Code:    402,
			Message: "Payment required",
			Data: PaymentRequirements402Response{
				X402Version: 1,
				Error:       "Payment required to access this resource",
				Accepts:     requirements,
			},
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK) // HTTP is 200, error is in JSON-RPC
	_ = json.NewEncoder(w).Encode(response)
}

// sendInvalidParamsError sends a JSON-RPC INVALID_PARAMS error per spec
func (h *X402Handler) sendInvalidParamsError(w http.ResponseWriter, id any, message string) {
	response := transport.JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id.(mcp.RequestId),
		Error: &mcp.JSONRPCErrorDetails{
			Code:    mcp.INVALID_PARAMS,
			Message: message,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(response)
}

// sendInternalError sends a JSON-RPC INTERNAL_ERROR per spec
func (h *X402Handler) sendInternalError(w http.ResponseWriter, id any, message string) {
	response := transport.JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id.(mcp.RequestId),
		Error: &mcp.JSONRPCErrorDetails{
			Code:    mcp.INTERNAL_ERROR,
			Message: message,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(response)
}

// forwardWithSettlementResponse forwards to MCP handler and adds settlement response
func (h *X402Handler) forwardWithSettlementResponse(w http.ResponseWriter, r *http.Request, reqID any, settleResp *SettleResponse) {
	// Capture the response
	recorder := &responseRecorder{
		ResponseWriter: w,
		body:           &bytes.Buffer{},
		statusCode:     http.StatusOK,
	}

	// Forward to MCP handler
	h.mcpHandler.ServeHTTP(recorder, r)

	// Parse response to add settlement data
	if recorder.statusCode == http.StatusOK && recorder.Header().Get("Content-Type") == "application/json" {
		var jsonrpcResp transport.JSONRPCResponse
		if err := json.Unmarshal(recorder.body.Bytes(), &jsonrpcResp); err == nil && jsonrpcResp.Error == nil {
			// Parse result to add _meta
			var result map[string]any
			if err := json.Unmarshal(jsonrpcResp.Result, &result); err == nil {
				// Get or create _meta
				meta, _ := result["_meta"].(map[string]any)
				if meta == nil {
					meta = make(map[string]any)
				}

				// Add settlement response
				meta["x402/payment-response"] = SettlementResponse{
					Success:     settleResp.Success,
					Transaction: settleResp.Transaction,
					Network:     settleResp.Network,
					Payer:       settleResp.Payer,
				}
				result["_meta"] = meta

				// Re-marshal
				jsonrpcResp.Result, _ = json.Marshal(result)
				recorder.body = &bytes.Buffer{}
				_ = json.NewEncoder(recorder.body).Encode(jsonrpcResp)
			}
		}
	}

	// Write the captured response
	for k, v := range recorder.Header() {
		w.Header()[k] = v
	}
	w.WriteHeader(recorder.statusCode)
	_, _ = w.Write(recorder.body.Bytes())
}

// findMatchingRequirement finds the payment requirement that matches the provided payment
func (h *X402Handler) findMatchingRequirement(payment *PaymentPayload, requirements []PaymentRequirement) (*PaymentRequirement, error) {
	for i := range requirements {
		req := &requirements[i]

		if req.Network != "" && req.Network != payment.Network {
			continue
		}

		if req.Scheme != "" && req.Scheme != payment.Scheme {
			continue
		}

		return req, nil
	}

	return nil, fmt.Errorf("no matching payment requirement found for network=%s, scheme=%s",
		payment.Network, payment.Scheme)
}

// responseRecorder captures HTTP response for modification
type responseRecorder struct {
	http.ResponseWriter
	body       *bytes.Buffer
	statusCode int
}

// Write implements http.ResponseWriter by capturing written bytes
func (rr *responseRecorder) Write(b []byte) (int, error) {
	return rr.body.Write(b)
}

// WriteHeader implements http.ResponseWriter by capturing status code
func (rr *responseRecorder) WriteHeader(statusCode int) {
	rr.statusCode = statusCode
}
