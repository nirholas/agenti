package client

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/mark3labs/mcp-go/client/transport"
	mcpproto "github.com/mark3labs/mcp-go/mcp"
	v2 "github.com/mark3labs/x402-go/v2"
	"github.com/mark3labs/x402-go/v2/mcp"
)

// Transport wraps an MCP transport and adds x402 v2 payment handling.
type Transport struct {
	baseTransport transport.Interface
	config        *Config
}

// NewTransport creates a new x402 v2-enabled MCP transport.
func NewTransport(serverURL string, opts ...Option) (*Transport, error) {
	config := DefaultConfig(serverURL)
	for _, opt := range opts {
		opt(config)
	}

	// Create base HTTP transport
	baseTransport, err := transport.NewStreamableHTTP(serverURL)
	if err != nil {
		return nil, fmt.Errorf("failed to create base transport: %w", err)
	}

	// Use default selector if none provided
	if config.Selector == nil {
		config.Selector = v2.NewDefaultPaymentSelector()
	}

	return &Transport{
		baseTransport: baseTransport,
		config:        config,
	}, nil
}

// Start starts the MCP connection.
func (t *Transport) Start(ctx context.Context) error {
	return t.baseTransport.Start(ctx)
}

// SendRequest implements transport.Interface by intercepting requests and handling 402 errors.
func (t *Transport) SendRequest(ctx context.Context, req transport.JSONRPCRequest) (*transport.JSONRPCResponse, error) {
	// Send initial request
	resp, err := t.baseTransport.SendRequest(ctx, req)
	if err != nil {
		return nil, err
	}

	// Check if response is a 402 error
	if resp.Error != nil && resp.Error.Code == 402 {
		// Extract payment requirements
		var data json.RawMessage
		if resp.Error.Data == nil {
			return resp, mcp.ErrNoPaymentRequirements
		}
		dataBytes, err := json.Marshal(resp.Error.Data)
		if err != nil {
			return resp, fmt.Errorf("failed to marshal error data: %w", err)
		}
		data = dataBytes

		requirements, resource, err := t.extractPaymentRequirements(data)
		if err != nil {
			return resp, fmt.Errorf("failed to extract payment requirements: %w", err)
		}

		// Create payment
		payment, startTime, err := t.createPayment(ctx, requirements, resource)
		if err != nil {
			return resp, mcp.WrapX402Error(err, req.Method)
		}

		// Inject payment and retry
		modifiedReq, err := t.injectPaymentMeta(req, payment)
		if err != nil {
			return resp, fmt.Errorf("failed to inject payment: %w", err)
		}

		// Retry with payment
		return t.retryWithPayment(ctx, modifiedReq, payment, startTime)
	}

	return resp, nil
}

// SendNotification sends a notification to the server.
func (t *Transport) SendNotification(ctx context.Context, notif mcpproto.JSONRPCNotification) error {
	return t.baseTransport.SendNotification(ctx, notif)
}

// SetNotificationHandler sets the notification handler.
func (t *Transport) SetNotificationHandler(handler func(mcpproto.JSONRPCNotification)) {
	t.baseTransport.SetNotificationHandler(handler)
}

// Close closes the transport.
func (t *Transport) Close() error {
	return t.baseTransport.Close()
}

// GetSessionId returns the session ID.
func (t *Transport) GetSessionId() string {
	return t.baseTransport.GetSessionId()
}

// extractPaymentRequirements extracts payment requirements from 402 error data.
func (t *Transport) extractPaymentRequirements(data json.RawMessage) ([]v2.PaymentRequirements, v2.ResourceInfo, error) {
	if len(data) == 0 {
		return nil, v2.ResourceInfo{}, mcp.ErrNoPaymentRequirements
	}
	var reqData mcp.PaymentRequirements
	if err := json.Unmarshal(data, &reqData); err != nil {
		return nil, v2.ResourceInfo{}, fmt.Errorf("failed to unmarshal payment requirements: %w", err)
	}

	if reqData.X402Version != v2.X402Version {
		return nil, v2.ResourceInfo{}, fmt.Errorf("unsupported x402 version: %d (expected %d)", reqData.X402Version, v2.X402Version)
	}

	if len(reqData.Accepts) == 0 {
		return nil, v2.ResourceInfo{}, mcp.ErrNoPaymentRequirements
	}

	return reqData.Accepts, reqData.Resource, nil
}

// createPayment creates a payment using the configured signers.
// Returns the payment payload and the start time for duration tracking.
func (t *Transport) createPayment(ctx context.Context, requirements []v2.PaymentRequirements, resource v2.ResourceInfo) (*v2.PaymentPayload, time.Time, error) {
	startTime := time.Now()

	if len(t.config.Signers) == 0 {
		return nil, startTime, v2.ErrNoValidSigner
	}

	// Use selector to choose signer and create payment
	payment, err := t.config.Selector.SelectAndSign(t.config.Signers, requirements)
	if err != nil {
		if t.config.OnPaymentFailure != nil {
			t.config.OnPaymentFailure(v2.PaymentEvent{
				Type:      v2.PaymentEventFailure,
				Timestamp: time.Now(),
				Method:    "MCP",
				Error:     err,
				Duration:  time.Since(startTime),
			})
		}
		return nil, startTime, err
	}

	// Set the resource info in the payment if provided
	if resource.URL != "" {
		payment.Resource = &resource
	}

	// Find the requirement that was actually selected by matching the payment's network and scheme
	// This ensures the payment attempt event reflects the actual requirement that was chosen
	var selectedReq *v2.PaymentRequirements
	for i := range requirements {
		if requirements[i].Network == payment.Accepted.Network && requirements[i].Scheme == payment.Accepted.Scheme {
			selectedReq = &requirements[i]
			break
		}
	}

	// Trigger payment attempt callback with the actually selected requirement
	if t.config.OnPaymentAttempt != nil && selectedReq != nil {
		t.config.OnPaymentAttempt(v2.PaymentEvent{
			Type:      v2.PaymentEventAttempt,
			Timestamp: startTime,
			Method:    "MCP",
			Amount:    selectedReq.Amount,
			Asset:     selectedReq.Asset,
			Network:   selectedReq.Network,
			Recipient: selectedReq.PayTo,
			Scheme:    selectedReq.Scheme,
		})
	}

	return payment, startTime, nil
}

// injectPaymentMeta injects payment into request params._meta.
func (t *Transport) injectPaymentMeta(req transport.JSONRPCRequest, payment *v2.PaymentPayload) (transport.JSONRPCRequest, error) {
	// Convert params to map
	params, ok := req.Params.(map[string]interface{})
	if !ok {
		// If params is not a map, create one
		params = make(map[string]interface{})
		if req.Params != nil {
			// Try to marshal and unmarshal to convert
			data, err := json.Marshal(req.Params)
			if err != nil {
				return req, fmt.Errorf("failed to marshal params: %w", err)
			}
			if err := json.Unmarshal(data, &params); err != nil {
				return req, fmt.Errorf("failed to unmarshal params: %w", err)
			}
		}
	}

	// Get or create _meta
	meta, ok := params["_meta"].(map[string]interface{})
	if !ok {
		meta = make(map[string]interface{})
	}

	// Add payment to _meta
	meta["x402/payment"] = payment
	params["_meta"] = meta

	// Create modified request
	modifiedReq := req
	modifiedReq.Params = params

	return modifiedReq, nil
}

// retryWithPayment retries the request with payment.
func (t *Transport) retryWithPayment(ctx context.Context, req transport.JSONRPCRequest, payment *v2.PaymentPayload, startTime time.Time) (*transport.JSONRPCResponse, error) {
	resp, err := t.baseTransport.SendRequest(ctx, req)
	duration := time.Since(startTime)

	if err != nil {
		if t.config.OnPaymentFailure != nil {
			t.config.OnPaymentFailure(v2.PaymentEvent{
				Type:      v2.PaymentEventFailure,
				Timestamp: time.Now(),
				Method:    "MCP",
				Error:     err,
				Network:   payment.Accepted.Network,
				Scheme:    payment.Accepted.Scheme,
				Duration:  duration,
			})
		}
		return resp, err
	}

	// Check if payment succeeded
	if resp.Error != nil {
		if resp.Error.Code == 402 && t.config.OnPaymentFailure != nil {
			t.config.OnPaymentFailure(v2.PaymentEvent{
				Type:      v2.PaymentEventFailure,
				Timestamp: time.Now(),
				Method:    "MCP",
				Error:     fmt.Errorf("payment rejected: %s", resp.Error.Message),
				Network:   payment.Accepted.Network,
				Scheme:    payment.Accepted.Scheme,
				Duration:  duration,
			})
		}
		return resp, nil
	}

	// Payment succeeded
	if t.config.OnPaymentSuccess != nil {
		// Extract tool name from request method
		toolName := req.Method
		t.config.OnPaymentSuccess(v2.PaymentEvent{
			Type:      v2.PaymentEventSuccess,
			Timestamp: time.Now(),
			Method:    "MCP",
			Tool:      toolName,
			Network:   payment.Accepted.Network,
			Scheme:    payment.Accepted.Scheme,
			Duration:  duration,
		})
	}

	return resp, nil
}
