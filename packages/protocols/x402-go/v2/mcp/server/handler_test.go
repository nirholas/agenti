package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	v2 "github.com/mark3labs/x402-go/v2"
)

// mockFacilitator implements the Facilitator interface for testing.
type mockFacilitator struct {
	verifyResponse *v2.VerifyResponse
	verifyErr      error
	settleResponse *v2.SettleResponse
	settleErr      error
	verifyCalled   bool
	settleCalled   bool
}

func (m *mockFacilitator) Verify(ctx context.Context, payment *v2.PaymentPayload, requirement v2.PaymentRequirements) (*v2.VerifyResponse, error) {
	m.verifyCalled = true
	if m.verifyErr != nil {
		return nil, m.verifyErr
	}
	return m.verifyResponse, nil
}

func (m *mockFacilitator) Settle(ctx context.Context, payment *v2.PaymentPayload, requirement v2.PaymentRequirements) (*v2.SettleResponse, error) {
	m.settleCalled = true
	if m.settleErr != nil {
		return nil, m.settleErr
	}
	return m.settleResponse, nil
}

// mockMCPHandler simulates an MCP server response.
type mockMCPHandler struct {
	response   interface{}
	statusCode int
}

func (h *mockMCPHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(h.statusCode)
	_ = json.NewEncoder(w).Encode(h.response)
}

func TestHandler_FreeTool(t *testing.T) {
	mcpResponse := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"result":  map[string]interface{}{"content": []interface{}{map[string]interface{}{"type": "text", "text": "Hello"}}},
	}

	mcpHandler := &mockMCPHandler{response: mcpResponse, statusCode: http.StatusOK}

	config := &Config{
		FacilitatorURL: "http://example.com",
		PaymentTools:   make(map[string]ToolPaymentConfig),
	}

	handler := &X402Handler{
		mcpHandler: mcpHandler,
		config:     config,
	}

	// Create a tools/call request for a free tool
	reqBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "tools/call",
		"id":      1,
		"params": map[string]interface{}{
			"name":      "free_tool",
			"arguments": map[string]interface{}{},
		},
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/mcp", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}
}

func TestHandler_PaidTool_NoPayment(t *testing.T) {
	config := &Config{
		FacilitatorURL: "http://example.com",
		PaymentTools: map[string]ToolPaymentConfig{
			"paid_tool": {
				Resource: v2.ResourceInfo{
					URL:         "mcp://tools/paid_tool",
					Description: "A paid tool",
				},
				Requirements: []v2.PaymentRequirements{
					{
						Scheme:            "exact",
						Network:           "eip155:84532",
						Amount:            "10000",
						Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
						PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
						MaxTimeoutSeconds: 60,
					},
				},
			},
		},
	}

	handler := &X402Handler{
		mcpHandler: &mockMCPHandler{},
		config:     config,
	}

	// Create a tools/call request without payment
	reqBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "tools/call",
		"id":      1,
		"params": map[string]interface{}{
			"name":      "paid_tool",
			"arguments": map[string]interface{}{},
		},
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/mcp", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	// Should return JSON-RPC 402 error
	if resp.StatusCode != http.StatusOK { // JSON-RPC errors are wrapped in 200
		t.Errorf("Expected status 200 (JSON-RPC), got %d", resp.StatusCode)
	}

	var jsonrpcResp map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&jsonrpcResp); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	// Check for error
	errorObj, ok := jsonrpcResp["error"].(map[string]interface{})
	if !ok {
		t.Fatal("Expected error in response")
	}

	code, ok := errorObj["code"].(float64)
	if !ok || int(code) != 402 {
		t.Errorf("Expected error code 402, got %v", code)
	}

	// Check error data contains v2 payment requirements
	data, ok := errorObj["data"].(map[string]interface{})
	if !ok {
		t.Fatal("Expected data in error response")
	}

	x402Version, ok := data["x402Version"].(float64)
	if !ok || int(x402Version) != 2 {
		t.Errorf("Expected x402Version 2, got %v", x402Version)
	}

	// Check resource is present
	resource, ok := data["resource"].(map[string]interface{})
	if !ok {
		t.Fatal("Expected resource in error data")
	}

	if url, ok := resource["url"].(string); !ok || url != "mcp://tools/paid_tool" {
		t.Errorf("Expected resource URL mcp://tools/paid_tool, got %v", resource["url"])
	}

	// Check accepts array
	accepts, ok := data["accepts"].([]interface{})
	if !ok || len(accepts) == 0 {
		t.Fatal("Expected accepts array in error data")
	}
}

func TestHandler_PaidTool_ValidPayment(t *testing.T) {
	mock := &mockFacilitator{
		verifyResponse: &v2.VerifyResponse{
			IsValid: true,
			Payer:   "0xPayerAddress",
		},
		settleResponse: &v2.SettleResponse{
			Success:     true,
			Transaction: "0x1234567890abcdef",
			Network:     "eip155:84532",
			Payer:       "0xPayerAddress",
		},
	}

	mcpResponse := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"result":  map[string]interface{}{"content": []interface{}{map[string]interface{}{"type": "text", "text": "Paid result"}}},
	}

	config := &Config{
		FacilitatorURL: "http://example.com",
		PaymentTools: map[string]ToolPaymentConfig{
			"paid_tool": {
				Resource: v2.ResourceInfo{
					URL: "mcp://tools/paid_tool",
				},
				Requirements: []v2.PaymentRequirements{
					{
						Scheme:            "exact",
						Network:           "eip155:84532",
						Amount:            "10000",
						Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
						PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
						MaxTimeoutSeconds: 60,
					},
				},
			},
		},
	}

	handler := &X402Handler{
		mcpHandler:  &mockMCPHandler{response: mcpResponse, statusCode: http.StatusOK},
		config:      config,
		facilitator: mock,
	}

	// Create a tools/call request with payment in _meta
	reqBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "tools/call",
		"id":      1,
		"params": map[string]interface{}{
			"name":      "paid_tool",
			"arguments": map[string]interface{}{},
			"_meta": map[string]interface{}{
				"x402/payment": map[string]interface{}{
					"x402Version": 2,
					"accepted": map[string]interface{}{
						"scheme":  "exact",
						"network": "eip155:84532",
						"amount":  "10000",
					},
					"payload": map[string]interface{}{
						"signature": "0xsig",
					},
				},
			},
		},
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/mcp", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if !mock.verifyCalled {
		t.Error("Expected Verify to be called")
	}

	if !mock.settleCalled {
		t.Error("Expected Settle to be called")
	}

	// Parse response
	var jsonrpcResp map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&jsonrpcResp); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	// Should have result, not error
	if _, hasError := jsonrpcResp["error"]; hasError {
		t.Error("Expected no error in response")
	}

	// Check result has _meta with payment-response
	result, ok := jsonrpcResp["result"].(map[string]interface{})
	if !ok {
		t.Fatal("Expected result in response")
	}

	meta, ok := result["_meta"].(map[string]interface{})
	if !ok {
		t.Fatal("Expected _meta in result")
	}

	paymentResponse, ok := meta["x402/payment-response"].(map[string]interface{})
	if !ok {
		t.Fatal("Expected x402/payment-response in _meta")
	}

	if success, ok := paymentResponse["success"].(bool); !ok || !success {
		t.Error("Expected success: true in payment-response")
	}

	if tx, ok := paymentResponse["transaction"].(string); !ok || tx != "0x1234567890abcdef" {
		t.Errorf("Expected transaction 0x1234567890abcdef, got %v", paymentResponse["transaction"])
	}
}

func TestHandler_VerifyOnly(t *testing.T) {
	mock := &mockFacilitator{
		verifyResponse: &v2.VerifyResponse{
			IsValid: true,
			Payer:   "0xPayerAddress",
		},
	}

	mcpResponse := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"result":  map[string]interface{}{"content": []interface{}{}},
	}

	config := &Config{
		FacilitatorURL: "http://example.com",
		VerifyOnly:     true,
		PaymentTools: map[string]ToolPaymentConfig{
			"paid_tool": {
				Requirements: []v2.PaymentRequirements{
					{
						Scheme:            "exact",
						Network:           "eip155:84532",
						Amount:            "10000",
						Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
						PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
						MaxTimeoutSeconds: 60,
					},
				},
			},
		},
	}

	handler := &X402Handler{
		mcpHandler:  &mockMCPHandler{response: mcpResponse, statusCode: http.StatusOK},
		config:      config,
		facilitator: mock,
	}

	// Create request with payment
	reqBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "tools/call",
		"id":      1,
		"params": map[string]interface{}{
			"name": "paid_tool",
			"_meta": map[string]interface{}{
				"x402/payment": map[string]interface{}{
					"x402Version": 2,
					"accepted":    map[string]interface{}{"scheme": "exact", "network": "eip155:84532"},
					"payload":     map[string]interface{}{},
				},
			},
		},
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/mcp", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if !mock.verifyCalled {
		t.Error("Expected Verify to be called")
	}

	if mock.settleCalled {
		t.Error("Settle should not be called in VerifyOnly mode")
	}
}

func TestHandler_InvalidPayment(t *testing.T) {
	mock := &mockFacilitator{
		verifyResponse: &v2.VerifyResponse{
			IsValid:       false,
			InvalidReason: "Insufficient balance",
		},
	}

	config := &Config{
		FacilitatorURL: "http://example.com",
		PaymentTools: map[string]ToolPaymentConfig{
			"paid_tool": {
				Requirements: []v2.PaymentRequirements{
					{
						Scheme:            "exact",
						Network:           "eip155:84532",
						Amount:            "10000",
						Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
						PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
						MaxTimeoutSeconds: 60,
					},
				},
			},
		},
	}

	handler := &X402Handler{
		mcpHandler:  &mockMCPHandler{},
		config:      config,
		facilitator: mock,
	}

	reqBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "tools/call",
		"id":      1,
		"params": map[string]interface{}{
			"name": "paid_tool",
			"_meta": map[string]interface{}{
				"x402/payment": map[string]interface{}{
					"x402Version": 2,
					"accepted":    map[string]interface{}{"scheme": "exact", "network": "eip155:84532"},
					"payload":     map[string]interface{}{},
				},
			},
		},
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/mcp", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	var jsonrpcResp map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&jsonrpcResp); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	errorObj, ok := jsonrpcResp["error"].(map[string]interface{})
	if !ok {
		t.Fatal("Expected error in response")
	}

	code, ok := errorObj["code"].(float64)
	if !ok || int(code) != 402 {
		t.Errorf("Expected error code 402, got %v", code)
	}

	message, ok := errorObj["message"].(string)
	if !ok || message == "" {
		t.Error("Expected error message")
	}
}

func TestHandler_NonPOST(t *testing.T) {
	var handlerCalled bool
	mcpHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
	})

	handler := &X402Handler{
		mcpHandler: mcpHandler,
		config:     &Config{FacilitatorURL: "http://example.com"},
	}

	req := httptest.NewRequest("GET", "/mcp", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if !handlerCalled {
		t.Error("Expected handler to be called for non-POST request")
	}
}

func TestHandler_NonToolsCall(t *testing.T) {
	var handlerCalled bool
	mcpHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
	})

	handler := &X402Handler{
		mcpHandler: mcpHandler,
		config:     &Config{FacilitatorURL: "http://example.com"},
	}

	reqBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "tools/list",
		"id":      1,
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/mcp", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if !handlerCalled {
		t.Error("Expected handler to be called for non-tools/call method")
	}
}

func TestHandler_ToolExecutionError_NoSettlement(t *testing.T) {
	mock := &mockFacilitator{
		verifyResponse: &v2.VerifyResponse{
			IsValid: true,
			Payer:   "0xPayerAddress",
		},
	}

	// MCP handler returns error response
	mcpResponse := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"error": map[string]interface{}{
			"code":    -32603,
			"message": "Internal error",
		},
	}

	config := &Config{
		FacilitatorURL: "http://example.com",
		PaymentTools: map[string]ToolPaymentConfig{
			"paid_tool": {
				Requirements: []v2.PaymentRequirements{
					{
						Scheme:            "exact",
						Network:           "eip155:84532",
						Amount:            "10000",
						Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
						PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
						MaxTimeoutSeconds: 60,
					},
				},
			},
		},
	}

	handler := &X402Handler{
		mcpHandler:  &mockMCPHandler{response: mcpResponse, statusCode: http.StatusOK},
		config:      config,
		facilitator: mock,
	}

	reqBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "tools/call",
		"id":      1,
		"params": map[string]interface{}{
			"name": "paid_tool",
			"_meta": map[string]interface{}{
				"x402/payment": map[string]interface{}{
					"x402Version": 2,
					"accepted":    map[string]interface{}{"scheme": "exact", "network": "eip155:84532"},
					"payload":     map[string]interface{}{},
				},
			},
		},
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/mcp", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if !mock.verifyCalled {
		t.Error("Expected Verify to be called")
	}

	if mock.settleCalled {
		t.Error("Settle should not be called when tool execution fails")
	}
}

func TestConfig_AddPaymentTool(t *testing.T) {
	config := DefaultConfig()

	resource := v2.ResourceInfo{
		URL:         "mcp://tools/test",
		Description: "Test tool",
	}
	requirements := v2.PaymentRequirements{
		Scheme:  "exact",
		Network: "eip155:84532",
		Amount:  "1000",
		Asset:   "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
		PayTo:   "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
	}

	config.AddPaymentTool("test_tool", resource, requirements)

	if !config.RequiresPayment("test_tool") {
		t.Error("Expected test_tool to require payment")
	}

	if config.RequiresPayment("free_tool") {
		t.Error("Expected free_tool to not require payment")
	}

	paymentConfig, exists := config.GetPaymentConfig("test_tool")
	if !exists {
		t.Fatal("Expected payment config for test_tool")
	}

	if paymentConfig.Resource.URL != "mcp://tools/test" {
		t.Errorf("Expected resource URL mcp://tools/test, got %s", paymentConfig.Resource.URL)
	}

	if len(paymentConfig.Requirements) != 1 {
		t.Errorf("Expected 1 requirement, got %d", len(paymentConfig.Requirements))
	}
}

func TestValidateRequirement(t *testing.T) {
	tests := []struct {
		name    string
		req     v2.PaymentRequirements
		wantErr bool
	}{
		{
			name: "valid requirement",
			req: v2.PaymentRequirements{
				Scheme:            "exact",
				Network:           "eip155:84532",
				Amount:            "1000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 60,
			},
			wantErr: false,
		},
		{
			name: "invalid scheme",
			req: v2.PaymentRequirements{
				Scheme:            "streaming",
				Network:           "eip155:84532",
				Amount:            "1000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 60,
			},
			wantErr: true,
		},
		{
			name: "invalid network format",
			req: v2.PaymentRequirements{
				Scheme:            "exact",
				Network:           "base-sepolia", // v1 format, not CAIP-2
				Amount:            "1000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 60,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateRequirement(tt.req)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateRequirement() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSetToolResource(t *testing.T) {
	resource := SetToolResource("my_tool")

	if resource.URL != "mcp://tools/my_tool" {
		t.Errorf("Expected URL mcp://tools/my_tool, got %s", resource.URL)
	}
}
