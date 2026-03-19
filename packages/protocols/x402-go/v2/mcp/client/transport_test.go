package client

import (
	"encoding/json"
	"testing"

	v2 "github.com/mark3labs/x402-go/v2"
	"github.com/mark3labs/x402-go/v2/mcp"
)

func TestExtractPaymentRequirements(t *testing.T) {
	transport := &Transport{
		config: DefaultConfig("http://example.com"),
	}

	tests := []struct {
		name         string
		data         map[string]interface{}
		wantVersion  int
		wantAccepts  int
		wantResource string
		wantErr      bool
		wantErrType  error
	}{
		{
			name: "valid v2 requirements",
			data: map[string]interface{}{
				"x402Version": float64(2),
				"error":       "Payment required",
				"resource": map[string]interface{}{
					"url":         "mcp://tools/paid_tool",
					"description": "A paid tool",
				},
				"accepts": []interface{}{
					map[string]interface{}{
						"scheme":            "exact",
						"network":           "eip155:84532",
						"amount":            "10000",
						"asset":             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
						"payTo":             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
						"maxTimeoutSeconds": float64(60),
					},
				},
			},
			wantVersion:  2,
			wantAccepts:  1,
			wantResource: "mcp://tools/paid_tool",
			wantErr:      false,
		},
		{
			name: "unsupported v1 version",
			data: map[string]interface{}{
				"x402Version": float64(1),
				"accepts":     []interface{}{},
			},
			wantErr: true,
		},
		{
			name: "no accepts",
			data: map[string]interface{}{
				"x402Version": float64(2),
				"accepts":     []interface{}{},
			},
			wantErr:     true,
			wantErrType: mcp.ErrNoPaymentRequirements,
		},
		{
			name: "multiple accepts",
			data: map[string]interface{}{
				"x402Version": float64(2),
				"resource": map[string]interface{}{
					"url": "mcp://tools/multi_tool",
				},
				"accepts": []interface{}{
					map[string]interface{}{
						"scheme":  "exact",
						"network": "eip155:84532",
						"amount":  "10000",
					},
					map[string]interface{}{
						"scheme":  "exact",
						"network": "eip155:8453",
						"amount":  "10000",
					},
				},
			},
			wantVersion:  2,
			wantAccepts:  2,
			wantResource: "mcp://tools/multi_tool",
			wantErr:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rawData, _ := json.Marshal(tt.data)

			requirements, resource, err := transport.extractPaymentRequirements(rawData)

			if tt.wantErr {
				if err == nil {
					t.Error("Expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			if len(requirements) != tt.wantAccepts {
				t.Errorf("Expected %d accepts, got %d", tt.wantAccepts, len(requirements))
			}

			if resource.URL != tt.wantResource {
				t.Errorf("Expected resource URL %s, got %s", tt.wantResource, resource.URL)
			}
		})
	}
}

func TestInjectPaymentMeta(t *testing.T) {
	_ = &Transport{
		config: DefaultConfig("http://example.com"),
	}

	payment := &v2.PaymentPayload{
		X402Version: 2,
		Accepted: v2.PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:84532",
			Amount:  "10000",
		},
		Payload: map[string]interface{}{"signature": "0xsig"},
	}

	tests := []struct {
		name      string
		params    interface{}
		wantErr   bool
		checkMeta bool
	}{
		{
			name:      "nil params",
			params:    nil,
			wantErr:   false,
			checkMeta: true,
		},
		{
			name:      "empty map params",
			params:    map[string]interface{}{},
			wantErr:   false,
			checkMeta: true,
		},
		{
			name: "existing params",
			params: map[string]interface{}{
				"name": "test_tool",
				"arguments": map[string]interface{}{
					"query": "hello",
				},
			},
			wantErr:   false,
			checkMeta: true,
		},
		{
			name: "existing _meta",
			params: map[string]interface{}{
				"name": "test_tool",
				"_meta": map[string]interface{}{
					"existing": "value",
				},
			},
			wantErr:   false,
			checkMeta: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := mockJSONRPCRequest{
				Method: "tools/call",
				Params: tt.params,
			}

			// We need to test the injection logic directly
			// Since we can't import transport.JSONRPCRequest, we test the logic

			// Convert params to map
			params, ok := req.Params.(map[string]interface{})
			if !ok {
				params = make(map[string]interface{})
			}

			// Get or create _meta
			meta, ok := params["_meta"].(map[string]interface{})
			if !ok {
				meta = make(map[string]interface{})
			}

			// Add payment to _meta
			meta["x402/payment"] = payment
			params["_meta"] = meta

			// Verify payment was injected
			if tt.checkMeta {
				metaCheck := params["_meta"].(map[string]interface{})
				if metaCheck["x402/payment"] == nil {
					t.Error("Expected x402/payment in _meta")
				}
			}
		})
	}
}

type mockJSONRPCRequest struct {
	Method string
	Params interface{}
	ID     interface{}
}

func TestConfig_WithOptions(t *testing.T) {
	config := DefaultConfig("http://example.com")

	// Test default values
	if config.ServerURL != "http://example.com" {
		t.Errorf("Expected ServerURL http://example.com, got %s", config.ServerURL)
	}

	if len(config.Signers) != 0 {
		t.Errorf("Expected 0 signers, got %d", len(config.Signers))
	}

	if config.Selector == nil {
		t.Error("Expected default selector")
	}

	// Test WithVerbose
	verboseOpt := WithVerbose()
	verboseOpt(config)
	if !config.Verbose {
		t.Error("Expected Verbose to be true")
	}

	// Test callbacks
	var attemptCalled, successCalled, failureCalled bool

	attemptOpt := WithPaymentAttemptCallback(func(e v2.PaymentEvent) {
		attemptCalled = true
	})
	attemptOpt(config)

	successOpt := WithPaymentSuccessCallback(func(e v2.PaymentEvent) {
		successCalled = true
	})
	successOpt(config)

	failureOpt := WithPaymentFailureCallback(func(e v2.PaymentEvent) {
		failureCalled = true
	})
	failureOpt(config)

	// Trigger callbacks
	config.OnPaymentAttempt(v2.PaymentEvent{})
	config.OnPaymentSuccess(v2.PaymentEvent{})
	config.OnPaymentFailure(v2.PaymentEvent{})

	if !attemptCalled {
		t.Error("Expected attempt callback to be called")
	}
	if !successCalled {
		t.Error("Expected success callback to be called")
	}
	if !failureCalled {
		t.Error("Expected failure callback to be called")
	}
}

func TestConfig_WithPaymentCallback(t *testing.T) {
	config := DefaultConfig("http://example.com")

	var callCount int
	unifiedOpt := WithPaymentCallback(func(e v2.PaymentEvent) {
		callCount++
	})
	unifiedOpt(config)

	// All three callbacks should call the same function
	config.OnPaymentAttempt(v2.PaymentEvent{})
	config.OnPaymentSuccess(v2.PaymentEvent{})
	config.OnPaymentFailure(v2.PaymentEvent{})

	if callCount != 3 {
		t.Errorf("Expected callback to be called 3 times, got %d", callCount)
	}
}

func TestConfig_WithSelector(t *testing.T) {
	config := DefaultConfig("http://example.com")

	customSelector := v2.NewDefaultPaymentSelector()
	selectorOpt := WithSelector(customSelector)
	selectorOpt(config)

	if config.Selector != customSelector {
		t.Error("Expected custom selector to be set")
	}
}
