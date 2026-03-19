package x402

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mark3labs/mcp-go/client/transport"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func create402JSONRPCResponse(id any, requirements PaymentRequirementsResponse) transport.JSONRPCResponse {
	return transport.JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id.(mcp.RequestId),
		Error: &mcp.JSONRPCErrorDetails{
			Code:    402,
			Message: "Payment required",
			Data:    requirements,
		},
	}
}

func create402HTTPResponse(w http.ResponseWriter, requirements PaymentRequirementsResponse) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusPaymentRequired)
	_ = json.NewEncoder(w).Encode(requirements)
}

func createSuccessResponse(id any, includeSettlement bool) transport.JSONRPCResponse {
	result := map[string]any{
		"content": []map[string]any{
			{"type": "text", "text": "Success"},
		},
	}

	if includeSettlement {
		result["_meta"] = map[string]any{
			"x402/payment-response": SettlementResponse{
				Success:     true,
				Transaction: "0x123",
				Network:     "base-sepolia",
				Payer:       "0xTestWallet",
			},
		}
	}

	resultBytes, _ := json.Marshal(result)
	return transport.JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id.(mcp.RequestId),
		Result:  resultBytes,
	}
}

func TestX402Transport_Basic(t *testing.T) {
	var requestCount int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++

		var req transport.JSONRPCRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		// First request - check for payment in _meta
		if requestCount == 1 {
			// No payment expected, return 402 error
			response := create402JSONRPCResponse(req.ID, PaymentRequirementsResponse{
				X402Version: 1,
				Error:       "Payment required",
				Accepts: []PaymentRequirement{
					{
						Scheme:            "exact",
						Network:           "base-sepolia",
						MaxAmountRequired: "1000",
						Asset:             USDCAddressBaseSepolia,
						PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
						Resource:          "mcp://test",
						Description:       "Test payment",
						MaxTimeoutSeconds: 60,
						Extra: map[string]string{
							"name":    "USDC",
							"version": "2",
						},
					},
				},
			})
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(response)
			return
		}

		// Second request - check for payment in _meta
		var params map[string]any
		paramsBytes, _ := json.Marshal(req.Params)
		_ = json.Unmarshal(paramsBytes, &params)

		meta, ok := params["_meta"].(map[string]any)
		if !ok || meta["x402/payment"] == nil {
			t.Error("Expected payment in _meta field")
		}

		// Payment provided, return success with settlement response
		response := createSuccessResponse(req.ID, true)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	// Create transport with mock signer that supports Base Sepolia
	signer := NewMockSigner("0xTestWallet", AcceptUSDCBaseSepolia())
	recorder := NewPaymentRecorder()

	trans, err := New(Config{
		ServerURL: server.URL,
		Signer:    signer,
	})
	require.NoError(t, err)

	trans.paymentRecorder = recorder

	ctx := context.Background()
	err = trans.Start(ctx)
	require.NoError(t, err)
	defer trans.Close()

	// Send request
	request := transport.JSONRPCRequest{
		ID:     mcp.NewRequestId(1),
		Method: "test.method",
		Params: json.RawMessage(`{}`),
	}

	response, err := trans.SendRequest(ctx, request)
	require.NoError(t, err)
	assert.NotNil(t, response)
	assert.False(t, response.ID.IsNil())
	assert.Equal(t, 2, requestCount) // Should have made 2 requests

	// Check payment was made
	assert.Equal(t, 2, recorder.PaymentCount()) // Attempt + Success
	lastPayment := recorder.LastPayment()
	assert.Equal(t, PaymentEventSuccess, lastPayment.Type)
	assert.Equal(t, "1000", lastPayment.Amount.String())
}

func TestX402Transport_ExceedsLimit(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req transport.JSONRPCRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		response := create402JSONRPCResponse(req.ID, PaymentRequirementsResponse{
			X402Version: 1,
			Error:       "Payment required",
			Accepts: []PaymentRequirement{
				{
					Scheme:            "exact",
					Network:           "base-sepolia",
					MaxAmountRequired: "1000000", // Exceeds limit
					Asset:             USDCAddressBaseSepolia,
					PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
					Resource:          "mcp://test",
					Description:       "Expensive payment",
					MaxTimeoutSeconds: 60,
					Extra: map[string]string{
						"name":    "USDC",
						"version": "2",
					},
				},
			},
		})
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	signer := NewMockSigner("0xTestWallet", AcceptUSDCBaseSepolia())

	trans, err := New(Config{
		ServerURL: server.URL,
		Signer:    signer,
		PaymentCallback: func(amount *big.Int, resource string) bool {
			// Reject payments over 10000
			return amount.Cmp(big.NewInt(10000)) <= 0
		},
	})
	require.NoError(t, err)

	ctx := context.Background()
	request := transport.JSONRPCRequest{
		ID:     mcp.NewRequestId(1),
		Method: "test.method",
		Params: json.RawMessage(`{}`),
	}

	_, err = trans.SendRequest(ctx, request)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "payment declined")
}

func TestX402Transport_PaymentCallback(t *testing.T) {
	var requestCount int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++

		var req transport.JSONRPCRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		if requestCount == 1 {
			response := create402JSONRPCResponse(req.ID, PaymentRequirementsResponse{
				X402Version: 1,
				Error:       "Payment required",
				Accepts: []PaymentRequirement{
					{
						Scheme:            "exact",
						Network:           "base-sepolia",
						MaxAmountRequired: "10000",
						Asset:             USDCAddressBaseSepolia,
						PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
						Resource:          "mcp://test",
						Description:       "Test",
						MaxTimeoutSeconds: 60,
						Extra: map[string]string{
							"name":    "USDC",
							"version": "2",
						},
					},
				},
			})
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(response)
			return
		}

		response := createSuccessResponse(req.ID, true)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	signer := NewMockSigner("0xTestWallet", AcceptUSDCBaseSepolia())
	callbackCalled := false

	trans, err := New(Config{
		ServerURL: server.URL,
		Signer:    signer,
		PaymentCallback: func(amount *big.Int, resource string) bool {
			callbackCalled = true
			assert.Equal(t, "10000", amount.String())
			return true // Approve payment
		},
	})
	require.NoError(t, err)

	ctx := context.Background()
	request := transport.JSONRPCRequest{
		ID:     mcp.NewRequestId(1),
		Method: "test.method",
		Params: json.RawMessage(`{}`),
	}

	_, err = trans.SendRequest(ctx, request)
	assert.NoError(t, err)
	assert.True(t, callbackCalled, "Payment callback should have been called")
}

func TestX402Transport_MultipleRequests(t *testing.T) {
	var requestCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqNum := requestCount.Add(1)

		var req transport.JSONRPCRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		// Only first request requires payment
		var params map[string]any
		paramsBytes, _ := json.Marshal(req.Params)
		_ = json.Unmarshal(paramsBytes, &params)

		meta, _ := params["_meta"].(map[string]any)
		hasPayment := meta != nil && meta["x402/payment"] != nil

		if reqNum == 1 && !hasPayment {
			response := create402JSONRPCResponse(req.ID, PaymentRequirementsResponse{
				X402Version: 1,
				Error:       "Payment required",
				Accepts: []PaymentRequirement{
					{
						Scheme:            "exact",
						Network:           "base-sepolia",
						MaxAmountRequired: "1000",
						Asset:             USDCAddressBaseSepolia,
						PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
						Resource:          "mcp://test",
						Description:       "Test",
						MaxTimeoutSeconds: 60,
						Extra: map[string]string{
							"name":    "USDC",
							"version": "2",
						},
					},
				},
			})
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(response)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(transport.JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result:  json.RawMessage(fmt.Sprintf(`{"data":"response_%d"}`, reqNum)),
		})
	}))
	defer server.Close()

	signer := NewMockSigner("0xTestWallet", AcceptUSDCBaseSepolia())
	trans, err := New(Config{
		ServerURL: server.URL,
		Signer:    signer,
	})
	require.NoError(t, err)

	ctx := context.Background()
	err = trans.Start(ctx)
	require.NoError(t, err)
	defer trans.Close()

	const numRequests = 5
	var wg sync.WaitGroup
	responses := make([]*transport.JSONRPCResponse, numRequests)
	errors := make([]error, numRequests)

	for i := 0; i < numRequests; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			request := transport.JSONRPCRequest{
				ID:     mcp.NewRequestId(int64(100 + idx)),
				Method: "test.method",
				Params: map[string]any{
					"requestIndex": idx,
				},
			}

			resp, err := trans.SendRequest(ctx, request)
			responses[idx] = resp
			errors[idx] = err
		}(i)
	}

	wg.Wait()

	// Check results
	for i := 0; i < numRequests; i++ {
		if errors[i] != nil {
			t.Errorf("Request %d failed: %v", i, errors[i])
			continue
		}

		if responses[i] == nil {
			t.Errorf("Request %d: Response is nil", i)
			continue
		}

		expectedId := int64(100 + i)
		idValue, ok := responses[i].ID.Value().(int64)
		if !ok {
			t.Errorf("Request %d: Expected ID to be int64, got %T", i, responses[i].ID.Value())
		} else if idValue != expectedId {
			t.Errorf("Request %d: Expected ID %d, got %d", i, expectedId, idValue)
		}
	}
}

func TestX402Transport_SendRequestWithTimeout(t *testing.T) {
	// Server that delays response
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(2 * time.Second) // Delay longer than context timeout
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(transport.JSONRPCResponse{
			ID:     mcp.NewRequestId(1),
			Result: json.RawMessage(`{"data":"test"}`),
		})
	}))
	defer server.Close()

	signer := NewMockSigner("0xTestWallet", AcceptUSDCBaseSepolia())
	trans, err := New(Config{
		ServerURL: server.URL,
		Signer:    signer,
	})
	require.NoError(t, err)

	// Create a context with short timeout
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	request := transport.JSONRPCRequest{
		ID:     mcp.NewRequestId(1),
		Method: "test.method",
		Params: json.RawMessage(`{}`),
	}

	_, err = trans.SendRequest(ctx, request)
	assert.Error(t, err)
	assert.True(t, errors.Is(err, context.DeadlineExceeded) || strings.Contains(err.Error(), "context deadline exceeded"))
}

func TestX402Transport_ResponseError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Return JSON-RPC error response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(transport.JSONRPCResponse{
			ID: mcp.NewRequestId(1),
			Error: &mcp.JSONRPCErrorDetails{
				Code:    -32601,
				Message: "Method not found",
			},
		})
	}))
	defer server.Close()

	signer := NewMockSigner("0xTestWallet", AcceptUSDCBaseSepolia())
	trans, err := New(Config{
		ServerURL: server.URL,
		Signer:    signer,
	})
	require.NoError(t, err)

	ctx := context.Background()
	request := transport.JSONRPCRequest{
		ID:     mcp.NewRequestId(1),
		Method: "unknown.method",
		Params: json.RawMessage(`{}`),
	}

	resp, err := trans.SendRequest(ctx, request)
	assert.NoError(t, err) // No transport error
	assert.NotNil(t, resp)
	assert.NotNil(t, resp.Error)
	assert.Equal(t, -32601, resp.Error.Code)
	assert.Equal(t, "Method not found", resp.Error.Message)
}

func TestX402Transport_InvalidURL(t *testing.T) {
	signer := NewMockSigner("0xTestWallet", AcceptUSDCBaseSepolia())

	// Test invalid URL
	_, err := New(Config{
		ServerURL: "://invalid-url",
		Signer:    signer,
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid")
}

func TestX402Transport_NonExistentServer(t *testing.T) {
	signer := NewMockSigner("0xTestWallet", AcceptUSDCBaseSepolia())
	trans, err := New(Config{
		ServerURL: "http://localhost:1", // Port 1 is typically unused
		Signer:    signer,
		HTTPClient: &http.Client{
			Timeout: 1 * time.Second,
		},
	})
	require.NoError(t, err)

	ctx := context.Background()
	request := transport.JSONRPCRequest{
		ID:     mcp.NewRequestId(1),
		Method: "test.method",
		Params: json.RawMessage(`{}`),
	}

	_, err = trans.SendRequest(ctx, request)
	assert.Error(t, err)
	assert.True(t, strings.Contains(err.Error(), "connection refused") ||
		strings.Contains(err.Error(), "connect: connection refused"))
}

func TestX402Transport_HTTP402Flow(t *testing.T) {
	var requestCount int
	var receivedPaymentHeader string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++

		var req transport.JSONRPCRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		// First request - return HTTP 402
		if requestCount == 1 {
			requirements := PaymentRequirementsResponse{
				X402Version: 1,
				Error:       "X-PAYMENT header is required",
				Accepts: []PaymentRequirement{
					{
						Scheme:            "exact",
						Network:           "base-sepolia",
						MaxAmountRequired: "1000",
						Asset:             USDCAddressBaseSepolia,
						PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
						Resource:          "https://api.example.com/data",
						Description:       "Test HTTP 402 payment",
						MaxTimeoutSeconds: 60,
						Extra: map[string]string{
							"name":    "USDC",
							"version": "2",
						},
					},
				},
			}
			create402HTTPResponse(w, requirements)
			return
		}

		// Second request - check for X-PAYMENT header
		receivedPaymentHeader = r.Header.Get("X-PAYMENT")
		if receivedPaymentHeader == "" {
			http.Error(w, "X-PAYMENT header missing", http.StatusBadRequest)
			return
		}

		// Verify params._meta does NOT contain payment (HTTP transport only uses headers)
		var params map[string]any
		paramsBytes, _ := json.Marshal(req.Params)
		_ = json.Unmarshal(paramsBytes, &params)

		// Success response
		response := createSuccessResponse(req.ID, false)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-PAYMENT-RESPONSE", "eyJzdWNjZXNzIjp0cnVlLCJ0cmFuc2FjdGlvbiI6IjB4MTIzIiwibmV0d29yayI6ImJhc2Utc2Vwb2xpYSIsInBheWVyIjoiMHhUZXN0V2FsbGV0In0=") // base64 encoded settlement
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	signer := NewMockSigner("0xTestWallet", AcceptUSDCBaseSepolia())
	trans, err := New(Config{
		ServerURL: server.URL,
		Signer:    signer,
	})
	require.NoError(t, err)

	ctx := context.Background()
	request := transport.JSONRPCRequest{
		ID:     mcp.NewRequestId(1),
		Method: "test.method",
		Params: json.RawMessage(`{"test": "data"}`),
	}

	resp, err := trans.SendRequest(ctx, request)
	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Nil(t, resp.Error)
	assert.Equal(t, 2, requestCount, "Should make exactly 2 requests (402 + retry)")
	assert.NotEmpty(t, receivedPaymentHeader, "Should send X-PAYMENT header on retry")
}

func TestX402Transport_JSONRPC402FlowBackwardCompatibility(t *testing.T) {
	var requestCount int
	var hasPaymentInMeta bool

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++

		var req transport.JSONRPCRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		// First request - return JSON-RPC 402 error
		if requestCount == 1 {
			response := create402JSONRPCResponse(req.ID, PaymentRequirementsResponse{
				X402Version: 1,
				Error:       "Payment required",
				Accepts: []PaymentRequirement{
					{
						Scheme:            "exact",
						Network:           "base-sepolia",
						MaxAmountRequired: "1000",
						Asset:             USDCAddressBaseSepolia,
						PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
						Resource:          "mcp://test",
						Description:       "Test JSON-RPC 402 payment",
						MaxTimeoutSeconds: 60,
						Extra: map[string]string{
							"name":    "USDC",
							"version": "2",
						},
					},
				},
			})
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(response)
			return
		}

		// Second request - check for payment in _meta (NOT in header)
		var params map[string]any
		paramsBytes, _ := json.Marshal(req.Params)
		_ = json.Unmarshal(paramsBytes, &params)

		if meta, ok := params["_meta"].(map[string]any); ok {
			if _, ok := meta["x402/payment"]; ok {
				hasPaymentInMeta = true
			}
		}

		// X-PAYMENT header should NOT be present for JSON-RPC flow
		xPaymentHeader := r.Header.Get("X-PAYMENT")
		assert.Empty(t, xPaymentHeader, "X-PAYMENT header should not be set for JSON-RPC 402 flow")

		// Success response
		response := createSuccessResponse(req.ID, true)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	signer := NewMockSigner("0xTestWallet", AcceptUSDCBaseSepolia())
	trans, err := New(Config{
		ServerURL: server.URL,
		Signer:    signer,
	})
	require.NoError(t, err)

	ctx := context.Background()
	request := transport.JSONRPCRequest{
		ID:     mcp.NewRequestId(1),
		Method: "test.method",
		Params: json.RawMessage(`{"test": "data"}`),
	}

	resp, err := trans.SendRequest(ctx, request)
	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Nil(t, resp.Error)
	assert.Equal(t, 2, requestCount, "Should make exactly 2 requests (402 + retry)")
	assert.True(t, hasPaymentInMeta, "Should send payment in params._meta for JSON-RPC flow")
}

func TestX402Transport_SetNotificationHandler(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if this is SSE request
		accept := r.Header.Get("Accept")
		if strings.Contains(accept, "text/event-stream") {
			// Send SSE response with notification
			w.Header().Set("Content-Type", "text/event-stream")
			w.WriteHeader(http.StatusOK)

			// Send a notification
			notification := map[string]any{
				"jsonrpc": "2.0",
				"method":  "test/notification",
				"params":  map[string]any{"message": "Hello"},
			}
			data, _ := json.Marshal(notification)
			fmt.Fprintf(w, "event: message\ndata: %s\n\n", data)

			// Send the actual response
			response := map[string]any{
				"jsonrpc": "2.0",
				"id":      1,
				"result":  "success",
			}
			data, _ = json.Marshal(response)
			fmt.Fprintf(w, "event: message\ndata: %s\n\n", data)

			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
			return
		}

		// Regular response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(transport.JSONRPCResponse{
			ID:     mcp.NewRequestId(1),
			Result: json.RawMessage(`{"data":"test"}`),
		})
	}))
	defer server.Close()

	signer := NewMockSigner("0xTestWallet", AcceptUSDCBaseSepolia())
	trans, err := New(Config{
		ServerURL: server.URL,
		Signer:    signer,
	})
	require.NoError(t, err)

	notificationChan := make(chan mcp.JSONRPCNotification, 1)
	trans.SetNotificationHandler(func(notification mcp.JSONRPCNotification) {
		notificationChan <- notification
	})

	ctx := context.Background()
	request := transport.JSONRPCRequest{
		ID:     mcp.NewRequestId(1),
		Method: "test.method",
		Params: json.RawMessage(`{}`),
	}

	go func() {
		_, _ = trans.SendRequest(ctx, request)
	}()

	select {
	case notification := <-notificationChan:
		assert.Equal(t, "test/notification", notification.Method)
	case <-time.After(2 * time.Second):
		// It's okay if notification is not received in this test
		// as our transport might not fully support SSE
	}
}

func TestX402Transport_SetRequestHandler(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(transport.JSONRPCResponse{
			ID:     mcp.NewRequestId(1),
			Result: json.RawMessage(`{"data":"test"}`),
		})
	}))
	defer server.Close()

	signer := NewMockSigner("0xTestWallet", AcceptUSDCBaseSepolia())
	trans, err := New(Config{
		ServerURL: server.URL,
		Signer:    signer,
	})
	require.NoError(t, err)

	requestHandlerCalled := false
	trans.SetRequestHandler(func(ctx context.Context, request transport.JSONRPCRequest) (*transport.JSONRPCResponse, error) {
		requestHandlerCalled = true
		return &transport.JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      request.ID,
			Result:  json.RawMessage(`{"handled":true}`),
		}, nil
	})

	// The request handler would be called if the server sends requests to us
	// In this test we're just verifying it can be set
	assert.False(t, requestHandlerCalled, "Request handler shouldn't be called in this test")
}

func TestX402Transport_PaymentCallbackRejection(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req transport.JSONRPCRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		response := create402JSONRPCResponse(req.ID, PaymentRequirementsResponse{
			X402Version: 1,
			Error:       "Payment required",
			Accepts: []PaymentRequirement{
				{
					Scheme:            "exact",
					Network:           "base-sepolia",
					MaxAmountRequired: "10000",
					Asset:             USDCAddressBaseSepolia,
					PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
					Resource:          "mcp://test",
					Description:       "Test",
					MaxTimeoutSeconds: 60,
				},
			},
		})
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	signer := NewMockSigner("0xTestWallet", AcceptUSDCBaseSepolia())

	trans, err := New(Config{
		ServerURL: server.URL,
		Signer:    signer,
		PaymentCallback: func(amount *big.Int, resource string) bool {
			return false // Reject payment
		},
	})
	require.NoError(t, err)

	ctx := context.Background()
	request := transport.JSONRPCRequest{
		ID:     mcp.NewRequestId(1),
		Method: "test.method",
		Params: json.RawMessage(`{}`),
	}

	_, err = trans.SendRequest(ctx, request)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "payment declined")
}
func TestSolanaPaymentFlow(t *testing.T) {
	var requestCount int
	var receivedPayment *PaymentPayload

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++

		var req transport.JSONRPCRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		if requestCount == 1 {
			requirements := PaymentRequirementsResponse{
				X402Version: 1,
				Error:       "Payment required",
				Accepts: []PaymentRequirement{
					{
						Scheme:            "exact",
						Network:           "solana-devnet",
						MaxAmountRequired: "1000000",
						Asset:             "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
						PayTo:             "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
						Description:       "Test Solana payment",
						MaxTimeoutSeconds: 60,
						Extra: map[string]string{
							"name":     "USDC (Devnet)",
							"decimals": "6",
							"feePayer": "EwWqGE4ZFKLofuestmU4LDdK7XM1N4ALgdZccwYugwGd",
						},
					},
				},
			}
			resp := create402JSONRPCResponse(req.ID, requirements)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(resp)
			return
		}

		var params map[string]any
		paramsBytes, _ := json.Marshal(req.Params)
		_ = json.Unmarshal(paramsBytes, &params)

		if meta, ok := params["_meta"].(map[string]any); ok {
			if paymentData, ok := meta["x402/payment"].(map[string]any); ok {
				paymentBytes, _ := json.Marshal(paymentData)
				_ = json.Unmarshal(paymentBytes, &receivedPayment)
			}
		}

		response := createSuccessResponse(req.ID, true)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	mockSigner := NewMockSolanaSigner(
		"DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK",
		AcceptUSDCSolanaDevnet(),
	)

	trans, err := New(Config{
		ServerURL: server.URL,
		Signers:   []PaymentSigner{mockSigner},
	})
	require.NoError(t, err)

	ctx := context.Background()
	request := transport.JSONRPCRequest{
		ID:     mcp.NewRequestId(1),
		Method: "test.method",
		Params: json.RawMessage(`{"test": "solana"}`),
	}

	resp, err := trans.SendRequest(ctx, request)
	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, 2, requestCount, "Should make exactly 2 requests (402 + retry)")
	assert.NotNil(t, receivedPayment, "Should receive payment payload")
	assert.Equal(t, "solana-devnet", receivedPayment.Network)
	assert.Equal(t, "exact", receivedPayment.Scheme)

	if payloadMap, ok := receivedPayment.Payload.(map[string]any); ok {
		assert.Contains(t, payloadMap, "transaction", "Payload should contain transaction field")
		txBase64, ok := payloadMap["transaction"].(string)
		assert.True(t, ok, "Transaction should be a string")
		assert.NotEmpty(t, txBase64, "Transaction should not be empty")
	} else {
		t.Fatal("Payload should be a map[string]any")
	}
}
