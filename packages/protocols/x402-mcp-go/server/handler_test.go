package server

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mark3labs/mcp-go-x402"
)

// mockMCPHandler simulates an MCP handler
type mockMCPHandler struct {
	called   bool
	response string
}

func (m *mockMCPHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	m.called = true
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(m.response))
}

func TestX402Handler_NoPaymentRequired(t *testing.T) {
	mockHandler := &mockMCPHandler{
		response: `{"jsonrpc":"2.0","result":{"content":[{"type":"text","text":"success"}]},"id":1}`,
	}

	config := &Config{
		FacilitatorURL: "http://mock",
		PaymentTools:   make(map[string][]PaymentRequirement),
	}

	handler := NewX402Handler(mockHandler, config)

	// Request for non-paid tool
	reqBody := `{"jsonrpc":"2.0","method":"tools/call","params":{"name":"free-tool"},"id":1}`
	req := httptest.NewRequest("POST", "/mcp", bytes.NewReader([]byte(reqBody)))
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}

	if !mockHandler.called {
		t.Error("MCP handler should have been called")
	}
}

func TestX402Handler_PaymentRequired(t *testing.T) {
	mockHandler := &mockMCPHandler{
		response: `{"jsonrpc":"2.0","result":{"content":[{"type":"text","text":"success"}]},"id":1}`,
	}

	config := &Config{
		FacilitatorURL: "http://mock",
		PaymentTools: map[string][]PaymentRequirement{
			"paid-tool": {
				{
					Scheme:            "exact",
					Network:           "test",
					MaxAmountRequired: "1000",
					Asset:             "0xusdc",
					PayTo:             "0xrecipient",
					MaxTimeoutSeconds: 60,
				},
			},
		},
	}

	handler := NewX402Handler(mockHandler, config)

	// Request for paid tool without payment
	reqBody := `{"jsonrpc":"2.0","method":"tools/call","params":{"name":"paid-tool"},"id":1}`
	req := httptest.NewRequest("POST", "/mcp", bytes.NewReader([]byte(reqBody)))
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}

	// Check JSON-RPC response
	var jsonrpcResp struct {
		JSONRPC string `json:"jsonrpc"`
		ID      int    `json:"id"`
		Error   *struct {
			Code    int                            `json:"code"`
			Message string                         `json:"message"`
			Data    PaymentRequirements402Response `json:"data"`
		} `json:"error"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&jsonrpcResp); err != nil {
		t.Fatal(err)
	}

	if jsonrpcResp.Error == nil {
		t.Fatal("Expected error in response")
	}

	if jsonrpcResp.Error.Code != 402 {
		t.Errorf("Expected error code 402, got %d", jsonrpcResp.Error.Code)
	}

	if len(jsonrpcResp.Error.Data.Accepts) != 1 {
		t.Error("Expected payment requirements")
	}

	if jsonrpcResp.Error.Data.Accepts[0].MaxAmountRequired != "1000" {
		t.Errorf("Wrong amount: %s", jsonrpcResp.Error.Data.Accepts[0].MaxAmountRequired)
	}

	if !mockHandler.called {
		// Correct - handler should NOT be called without payment
	} else {
		t.Error("MCP handler should NOT have been called without payment")
	}
}

func TestX402Handler_WithValidPayment(t *testing.T) {
	mockHandler := &mockMCPHandler{
		response: `{"jsonrpc":"2.0","result":{"content":[{"type":"text","text":"success"}]},"id":1}`,
	}

	// Mock facilitator
	mockFacilitator := &MockFacilitator{
		verifyResponse: &VerifyResponse{
			IsValid: true,
			Payer:   "0xpayer",
		},
		settleResponse: &SettleResponse{
			Success:     true,
			Transaction: "0xtx",
			Network:     "test",
		},
	}

	config := &Config{
		FacilitatorURL: "http://mock",
		PaymentTools: map[string][]PaymentRequirement{
			"paid-tool": {
				{
					Scheme:            "exact",
					Network:           "test",
					MaxAmountRequired: "1000",
					Asset:             "0xusdc",
					PayTo:             "0xrecipient",
					MaxTimeoutSeconds: 60,
				},
			},
		},
	}

	handler := NewX402Handler(mockHandler, config)
	handler.facilitator = mockFacilitator

	// Create payment
	payment := &PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "test",
		Payload: map[string]any{
			"signature": "0xsig",
			"authorization": map[string]any{
				"from":  "0xpayer",
				"to":    "0xusdc", // Asset address in EIP-3009
				"value": "1000",
			},
		},
	}

	// Request with payment in _meta
	reqJSON := map[string]any{
		"jsonrpc": "2.0",
		"method":  "tools/call",
		"params": map[string]any{
			"name": "paid-tool",
			"_meta": map[string]any{
				"x402/payment": payment,
			},
		},
		"id": 1,
	}
	reqBody, _ := json.Marshal(reqJSON)
	req := httptest.NewRequest("POST", "/mcp", bytes.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		body, _ := io.ReadAll(rr.Body)
		t.Errorf("Expected 200, got %d. Body: %s", rr.Code, string(body))
	}

	if !mockHandler.called {
		t.Error("MCP handler should have been called with valid payment")
	}

	// Check for settlement response in result._meta
	var jsonrpcResp struct {
		JSONRPC string `json:"jsonrpc"`
		ID      int    `json:"id"`
		Result  struct {
			Content []any          `json:"content"`
			Meta    map[string]any `json:"_meta"`
		} `json:"result"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&jsonrpcResp); err != nil {
		t.Fatal(err)
	}

	if jsonrpcResp.Result.Meta == nil {
		t.Fatal("Expected _meta in result")
	}

	settlementResp, ok := jsonrpcResp.Result.Meta["x402/payment-response"]
	if !ok {
		t.Error("Expected x402/payment-response in _meta")
	}
	_ = settlementResp // Validate structure if needed
}

// MockFacilitator for testing
type MockFacilitator struct {
	verifyResponse *VerifyResponse
	settleResponse *SettleResponse
	verifyCalled   bool
	settleCalled   bool
}

func (m *MockFacilitator) Verify(ctx context.Context, payment *PaymentPayload, requirement *PaymentRequirement) (*VerifyResponse, error) {
	m.verifyCalled = true
	return m.verifyResponse, nil
}

func (m *MockFacilitator) Settle(ctx context.Context, payment *PaymentPayload, requirement *PaymentRequirement) (*SettleResponse, error) {
	m.settleCalled = true
	return m.settleResponse, nil
}

func (m *MockFacilitator) GetSupported(ctx context.Context) ([]SupportedKind, error) {
	return []SupportedKind{{X402Version: 1, Scheme: "exact", Network: "test"}}, nil
}

func TestX402Handler_MultiplePaymentOptions(t *testing.T) {
	mockHandler := &mockMCPHandler{
		response: `{"jsonrpc":"2.0","result":{"content":[{"type":"text","text":"success"}]},"id":1}`,
	}

	config := &Config{
		FacilitatorURL: "http://mock",
		PaymentTools: map[string][]PaymentRequirement{
			"multi-pay-tool": {
				{
					Scheme:            "exact",
					Network:           "ethereum-mainnet",
					MaxAmountRequired: "1000000", // 1 USDC
					Asset:             "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
					PayTo:             "0xrecipient",
					Description:       "Pay with USDC on Ethereum",
				},
				{
					Scheme:            "exact",
					Network:           "polygon-mainnet",
					MaxAmountRequired: "1000000", // 1 USDC
					Asset:             "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
					PayTo:             "0xrecipient",
					Description:       "Pay with USDC on Polygon",
				},
				{
					Scheme:            "exact",
					Network:           "base-mainnet",
					MaxAmountRequired: "500000", // 0.5 USDC (discount)
					Asset:             x402.USDCAddressBase,
					PayTo:             "0xrecipient",
					Description:       "Pay with USDC on Base (50% discount)",
				},
			},
		},
	}

	handler := NewX402Handler(mockHandler, config)

	// Request without payment should return all options
	reqBody := `{"jsonrpc":"2.0","method":"tools/call","params":{"name":"multi-pay-tool"},"id":1}`
	req := httptest.NewRequest("POST", "/mcp", bytes.NewReader([]byte(reqBody)))
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}

	// Check JSON-RPC response has 402 error with all 3 payment options
	var jsonrpcResp struct {
		JSONRPC string `json:"jsonrpc"`
		ID      int    `json:"id"`
		Error   *struct {
			Code    int                            `json:"code"`
			Message string                         `json:"message"`
			Data    PaymentRequirements402Response `json:"data"`
		} `json:"error"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&jsonrpcResp); err != nil {
		t.Fatal(err)
	}

	if jsonrpcResp.Error == nil {
		t.Fatal("Expected error in response")
	}

	if jsonrpcResp.Error.Code != 402 {
		t.Errorf("Expected error code 402, got %d", jsonrpcResp.Error.Code)
	}

	resp := jsonrpcResp.Error.Data

	if len(resp.Accepts) != 3 {
		t.Errorf("Expected 3 payment options, got %d", len(resp.Accepts))
	}

	// Verify each option
	if resp.Accepts[0].Network != "ethereum-mainnet" {
		t.Errorf("First option should be ethereum-mainnet, got %s", resp.Accepts[0].Network)
	}
	if resp.Accepts[1].Network != "polygon-mainnet" {
		t.Errorf("Second option should be polygon-mainnet, got %s", resp.Accepts[1].Network)
	}
	if resp.Accepts[2].Network != "base-mainnet" {
		t.Errorf("Third option should be base-mainnet, got %s", resp.Accepts[2].Network)
	}
	if resp.Accepts[2].MaxAmountRequired != "500000" {
		t.Errorf("Base option should have discount price, got %s", resp.Accepts[2].MaxAmountRequired)
	}
}

func TestX402Handler_PaymentMatching(t *testing.T) {
	mockHandler := &mockMCPHandler{
		response: `{"jsonrpc":"2.0","result":{"content":[{"type":"text","text":"success"}]},"id":1}`,
	}

	// Mock facilitator
	mockFacilitator := &MockFacilitator{
		verifyResponse: &VerifyResponse{
			IsValid: true,
			Payer:   "0xpayer",
		},
		settleResponse: &SettleResponse{
			Success:     true,
			Transaction: "0xtx",
			Network:     "base-mainnet",
		},
	}

	config := &Config{
		FacilitatorURL: "http://mock",
		PaymentTools: map[string][]PaymentRequirement{
			"multi-pay-tool": {
				{
					Scheme:            "exact",
					Network:           "ethereum-mainnet",
					MaxAmountRequired: "1000000",
					Asset:             "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
					PayTo:             "0xrecipient",
				},
				{
					Scheme:            "exact",
					Network:           "base-mainnet",
					MaxAmountRequired: "500000",
					Asset:             x402.USDCAddressBase,
					PayTo:             "0xrecipient",
				},
			},
		},
	}

	handler := NewX402Handler(mockHandler, config)
	handler.facilitator = mockFacilitator

	// Create payment for Base network (cheaper option)
	payment := &PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     "base-mainnet",
		Payload: map[string]any{
			"signature": "0xsig",
			"authorization": map[string]any{
				"from":  "0xpayer",
				"to":    x402.USDCAddressBase, // Base USDC
				"value": "500000",
			},
		},
	}

	// Request with payment in _meta
	reqJSON := map[string]any{
		"jsonrpc": "2.0",
		"method":  "tools/call",
		"params": map[string]any{
			"name": "multi-pay-tool",
			"_meta": map[string]any{
				"x402/payment": payment,
			},
		},
		"id": 1,
	}
	reqBody, _ := json.Marshal(reqJSON)
	req := httptest.NewRequest("POST", "/mcp", bytes.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		body, _ := io.ReadAll(rr.Body)
		t.Errorf("Expected 200, got %d. Body: %s", rr.Code, string(body))
	}

	if !mockHandler.called {
		t.Error("MCP handler should have been called with valid payment")
	}

	if !mockFacilitator.verifyCalled {
		t.Error("Facilitator verify should have been called")
	}
}
