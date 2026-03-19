package x402

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"mime"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mark3labs/mcp-go/client/transport"
	"github.com/mark3labs/mcp-go/mcp"
)

const (
	// Timeouts
	defaultHTTPTimeout     = 2 * time.Minute
	sessionCloseTimeout    = 5 * time.Second
	requestHandlingTimeout = 30 * time.Second
)

// X402Transport implements transport.Interface with x402 payment support
// It is based on StreamableHTTP with added x402 payment handling
type X402Transport struct {
	serverURL  *url.URL
	httpClient *http.Client
	handler    *PaymentHandler

	// Session management (from StreamableHTTP)
	sessionID       atomic.Value
	protocolVersion atomic.Value
	initialized     chan struct{}
	initializedOnce sync.Once

	// Notification handling
	notificationHandler func(mcp.JSONRPCNotification)
	notifyMu            sync.RWMutex

	// Request handling for bidirectional support
	requestHandler transport.RequestHandler
	requestMu      sync.RWMutex

	// Event callbacks
	onPaymentAttempt func(PaymentEvent)
	onPaymentSuccess func(PaymentEvent)
	onPaymentFailure func(PaymentEvent, error)

	// State
	closed chan struct{}
	wg     sync.WaitGroup

	// Testing support
	paymentRecorder *PaymentRecorder
}

// Config configures the X402Transport
type Config struct {
	ServerURL        string
	Signer           PaymentSigner   // DEPRECATED: Use Signers instead
	Signers          []PaymentSigner // Multiple signers with priority
	PaymentCallback  func(amount *big.Int, resource string) bool
	HTTPClient       *http.Client
	OnPaymentAttempt func(PaymentEvent)
	OnPaymentSuccess func(PaymentEvent)
	OnPaymentFailure func(PaymentEvent, error)
	OnSignerAttempt  func(PaymentEvent) // Per-signer attempt callback
}

// New creates a new X402Transport
func New(config Config) (*X402Transport, error) {
	parsedURL, err := url.Parse(config.ServerURL)
	if err != nil {
		return nil, fmt.Errorf("invalid server URL: %w", err)
	}

	// Handle backward compatibility
	signers := config.Signers
	if len(signers) == 0 && config.Signer != nil {
		// Legacy single-signer configuration
		signers = []PaymentSigner{config.Signer}
	}

	if len(signers) == 0 {
		return nil, ErrNoSignerConfigured
	}

	// Assign implicit priorities based on array order if not set
	for i, signer := range signers {
		if signer.GetPriority() == 0 && i > 0 {
			// If priority is 0 and not first signer, use array index
			if ps, ok := signer.(*PrivateKeySigner); ok {
				ps.priority = i
			} else if ms, ok := signer.(*MnemonicSigner); ok {
				ms.priority = i
			} else if ks, ok := signer.(*KeystoreSigner); ok {
				ks.priority = i
			} else if mock, ok := signer.(*MockSigner); ok {
				mock.priority = i
			}
		}
	}

	// Sort signers by priority (stable sort preserves array order for ties)
	sort.SliceStable(signers, func(i, j int) bool {
		return signers[i].GetPriority() < signers[j].GetPriority()
	})

	handlerConfig := &HandlerConfig{
		PaymentCallback: config.PaymentCallback,
		OnSignerAttempt: config.OnSignerAttempt,
	}

	handler, err := NewPaymentHandlerMulti(signers, handlerConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create payment handler: %w", err)
	}

	httpClient := config.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{
			Timeout: defaultHTTPTimeout,
		}
	}

	t := &X402Transport{
		serverURL:        parsedURL,
		httpClient:       httpClient,
		handler:          handler,
		closed:           make(chan struct{}),
		initialized:      make(chan struct{}),
		onPaymentAttempt: config.OnPaymentAttempt,
		onPaymentSuccess: config.OnPaymentSuccess,
		onPaymentFailure: config.OnPaymentFailure,
	}

	t.sessionID.Store("")
	t.protocolVersion.Store("")

	return t, nil
}

// Start implements transport.Interface
func (t *X402Transport) Start(ctx context.Context) error {
	// Similar to StreamableHTTP, we don't need persistent connection
	return nil
}

// Close implements transport.Interface
func (t *X402Transport) Close() error {
	select {
	case <-t.closed:
		return nil
	default:
	}

	close(t.closed)

	// Send session close if we have a session
	if sessionIDVal := t.sessionID.Load(); sessionIDVal != nil {
		if sessionID, ok := sessionIDVal.(string); ok && sessionID != "" {
			t.sessionID.Store("")
			t.wg.Add(1)
			go func() {
				defer t.wg.Done()
				ctx, cancel := context.WithTimeout(context.Background(), sessionCloseTimeout)
				defer cancel()

				req, err := http.NewRequestWithContext(ctx, http.MethodDelete, t.serverURL.String(), nil)
				if err != nil {
					return
				}

				req.Header.Set(transport.HeaderKeySessionID, sessionID)
				if versionVal := t.protocolVersion.Load(); versionVal != nil {
					if version, ok := versionVal.(string); ok && version != "" {
						req.Header.Set(transport.HeaderKeyProtocolVersion, version)
					}
				}

				resp, err := t.httpClient.Do(req)
				if err == nil && resp != nil {
					resp.Body.Close()
				}
			}()
		}
	}

	t.wg.Wait()
	return nil
}

// SetProtocolVersion implements transport.Interface
func (t *X402Transport) SetProtocolVersion(version string) {
	t.protocolVersion.Store(version)
}

// ErrSessionTerminated is returned when a session is terminated (404)
var ErrSessionTerminated = errors.New("session terminated (404). need to re-initialize")

// SendRequest implements transport.Interface with x402 payment handling
func (t *X402Transport) SendRequest(ctx context.Context, request transport.JSONRPCRequest) (*transport.JSONRPCResponse, error) {
	// Marshal request
	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	ctx, cancel := t.contextAwareOfClientClose(ctx)
	defer cancel()

	// Try request without payment first
	resp, err := t.sendHTTP(ctx, http.MethodPost, bytes.NewReader(requestBody), "application/json, text/event-stream")
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Process the response to get JSON-RPC response
	jsonrpcResp, useHTTPHeaders, err := t.processResponse(ctx, resp, request)
	if err != nil {
		return nil, err
	}

	// Check for JSON-RPC 402 error (payment required)
	if jsonrpcResp.Error != nil && jsonrpcResp.Error.Code == 402 {
		paymentResp, err := t.handlePaymentRequired(ctx, jsonrpcResp.Error, request, useHTTPHeaders)
		if err != nil {
			return nil, err
		}
		return paymentResp, nil
	}

	return jsonrpcResp, nil
}

// handlePaymentRequired handles 402 errors by creating payment and retrying
// If useHTTPHeaders is true, sends payment in X-PAYMENT header (HTTP 402 transport)
// If useHTTPHeaders is false, sends payment in params._meta (JSON-RPC 402 transport)
func (t *X402Transport) handlePaymentRequired(ctx context.Context, rpcError *mcp.JSONRPCErrorDetails, originalRequest transport.JSONRPCRequest, useHTTPHeaders bool) (*transport.JSONRPCResponse, error) {
	// Parse payment requirements from error.data
	requirementsData, err := json.Marshal(rpcError.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payment requirements: %w", err)
	}

	var requirements PaymentRequirementsResponse
	if err := json.Unmarshal(requirementsData, &requirements); err != nil {
		return nil, fmt.Errorf("failed to parse payment requirements: %w", err)
	}

	// Record payment attempt
	t.recordPaymentEvent(PaymentEventAttempt, originalRequest.Method, requirements)

	// Create and sign payment
	payment, err := t.handler.CreatePayment(ctx, requirements)
	if err != nil {
		t.recordPaymentError(PaymentEventFailure, originalRequest.Method, requirements, err)
		return nil, fmt.Errorf("failed to create payment: %w", err)
	}

	var resp *http.Response
	if useHTTPHeaders {
		// HTTP 402 transport: send payment in X-PAYMENT header
		requestBody, err := json.Marshal(originalRequest)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request: %w", err)
		}

		// Marshal payment to JSON and encode as base64
		paymentJSON, err := json.Marshal(payment)
		if err != nil {
			t.recordPaymentError(PaymentEventFailure, originalRequest.Method, requirements, err)
			return nil, fmt.Errorf("failed to marshal payment: %w", err)
		}
		paymentHeader := base64.StdEncoding.EncodeToString(paymentJSON)

		headers := map[string]string{
			"X-PAYMENT": paymentHeader,
		}

		resp, err = t.sendHTTPWithHeaders(ctx, http.MethodPost, bytes.NewReader(requestBody), "application/json, text/event-stream", headers)
		if err != nil {
			t.recordPaymentError(PaymentEventFailure, originalRequest.Method, requirements, err)
			return nil, fmt.Errorf("failed to send payment request: %w", err)
		}
	} else {
		// JSON-RPC 402 transport: inject payment into request params._meta
		modifiedRequest, err := t.injectPaymentIntoRequest(originalRequest, payment)
		if err != nil {
			t.recordPaymentError(PaymentEventFailure, originalRequest.Method, requirements, err)
			return nil, fmt.Errorf("failed to inject payment: %w", err)
		}

		requestBody, err := json.Marshal(modifiedRequest)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request with payment: %w", err)
		}

		resp, err = t.sendHTTP(ctx, http.MethodPost, bytes.NewReader(requestBody), "application/json, text/event-stream")
		if err != nil {
			t.recordPaymentError(PaymentEventFailure, originalRequest.Method, requirements, err)
			return nil, fmt.Errorf("failed to send payment request: %w", err)
		}
	}
	defer resp.Body.Close()

	// Process response
	jsonrpcResp, _, err := t.processResponse(ctx, resp, originalRequest)
	if err != nil {
		t.recordPaymentError(PaymentEventFailure, originalRequest.Method, requirements, err)
		return nil, err
	}

	// Check if payment was accepted
	if jsonrpcResp.Error != nil && jsonrpcResp.Error.Code == 402 {
		t.recordPaymentError(PaymentEventFailure, originalRequest.Method, requirements,
			fmt.Errorf("payment rejected: server returned 402 after payment"))
		return nil, fmt.Errorf("payment rejected by server")
	}

	// Extract settlement response from result._meta or X-PAYMENT-RESPONSE header
	if jsonrpcResp.Error == nil {
		if useHTTPHeaders {
			// For HTTP transport, check X-PAYMENT-RESPONSE header
			if paymentRespHeader := resp.Header.Get("X-PAYMENT-RESPONSE"); paymentRespHeader != "" {
				t.extractAndRecordHTTPSettlement(paymentRespHeader, originalRequest.Method, requirements)
			}
		} else {
			// For JSON-RPC transport, check result._meta
			t.extractAndRecordSettlement(jsonrpcResp, originalRequest.Method, requirements)
		}
	}

	return jsonrpcResp, nil
}

// injectPaymentIntoRequest adds payment data to request params._meta
func (t *X402Transport) injectPaymentIntoRequest(request transport.JSONRPCRequest, payment *PaymentPayload) (transport.JSONRPCRequest, error) {
	// We need to add _meta["x402/payment"] to the params
	// The params could be any type, so we need to handle it carefully

	// Marshal params to JSON
	paramsBytes, err := json.Marshal(request.Params)
	if err != nil {
		return request, fmt.Errorf("failed to marshal params: %w", err)
	}

	// Unmarshal into map
	var paramsMap map[string]any
	if err := json.Unmarshal(paramsBytes, &paramsMap); err != nil {
		return request, fmt.Errorf("failed to unmarshal params: %w", err)
	}

	// Get or create _meta field
	var meta map[string]any
	if metaField, exists := paramsMap["_meta"]; exists {
		meta, _ = metaField.(map[string]any)
	}
	if meta == nil {
		meta = make(map[string]any)
	}

	// Add payment to _meta
	meta["x402/payment"] = payment
	paramsMap["_meta"] = meta

	// Update request
	request.Params = paramsMap
	return request, nil
}

// extractAndRecordSettlement extracts settlement response from result._meta and records success
func (t *X402Transport) extractAndRecordSettlement(response *transport.JSONRPCResponse, method string, reqs PaymentRequirementsResponse) {
	// Parse result to extract _meta
	var resultMap map[string]any
	if err := json.Unmarshal(response.Result, &resultMap); err != nil {
		return
	}

	// Extract _meta field
	metaField, exists := resultMap["_meta"]
	if !exists {
		return
	}

	meta, ok := metaField.(map[string]any)
	if !ok {
		return
	}

	// Extract x402/payment-response
	paymentRespField, exists := meta["x402/payment-response"]
	if !exists {
		return
	}

	// Parse settlement response
	paymentRespBytes, err := json.Marshal(paymentRespField)
	if err != nil {
		return
	}

	var settlementResp SettlementResponse
	if err := json.Unmarshal(paymentRespBytes, &settlementResp); err != nil {
		return
	}

	// Record success if settlement was successful
	if settlementResp.Success {
		t.recordPaymentEvent(PaymentEventSuccess, method, reqs)
	}
}

// extractAndRecordHTTPSettlement extracts settlement response from X-PAYMENT-RESPONSE header and records success
func (t *X402Transport) extractAndRecordHTTPSettlement(paymentRespHeader string, method string, reqs PaymentRequirementsResponse) {
	// Decode base64 header
	paymentRespBytes, err := base64.StdEncoding.DecodeString(paymentRespHeader)
	if err != nil {
		return
	}

	// Parse settlement response
	var settlementResp SettlementResponse
	if err := json.Unmarshal(paymentRespBytes, &settlementResp); err != nil {
		return
	}

	// Record success if settlement was successful
	if settlementResp.Success {
		t.recordPaymentEvent(PaymentEventSuccess, method, reqs)
	}
}

// processResponse processes the HTTP response and returns a JSON-RPC response
// Returns (response, useHTTPHeaders, error) where useHTTPHeaders indicates if X-PAYMENT header should be used
func (t *X402Transport) processResponse(ctx context.Context, resp *http.Response, request transport.JSONRPCRequest) (*transport.JSONRPCResponse, bool, error) {
	// Check for non-successful status codes
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		// Try to parse the response as JSON-RPC (might contain error details)
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, false, fmt.Errorf("failed to read error response: %w", err)
		}

		// Handle HTTP 402 - Payment Required
		if resp.StatusCode == http.StatusPaymentRequired {
			// Parse payment requirements from body
			var paymentReqs PaymentRequirementsResponse
			if err := json.Unmarshal(body, &paymentReqs); err != nil {
				return nil, false, fmt.Errorf("failed to parse HTTP 402 payment requirements: %w", err)
			}

			// Create synthetic JSON-RPC error response with code 402
			// This normalizes HTTP 402 to look like JSON-RPC 402
			jsonrpcResp := &transport.JSONRPCResponse{
				JSONRPC: "2.0",
				ID:      request.ID,
				Error: &mcp.JSONRPCErrorDetails{
					Code:    402,
					Message: paymentReqs.Error,
					Data:    paymentReqs,
				},
			}
			// Return true to indicate X-PAYMENT header should be used
			return jsonrpcResp, true, nil
		}

		// Handle specific HTTP status codes
		switch resp.StatusCode {
		case http.StatusUnauthorized:
			return nil, false, fmt.Errorf("unauthorized (401): authentication required")
		case http.StatusForbidden:
			return nil, false, fmt.Errorf("forbidden (403): access denied")
		case http.StatusNotFound:
			return nil, false, fmt.Errorf("not found (404): endpoint does not exist")
		case http.StatusTooManyRequests:
			return nil, false, fmt.Errorf("rate limited (429): too many requests")
		case http.StatusInternalServerError:
			return nil, false, fmt.Errorf("server error (500): internal server error")
		case http.StatusBadGateway:
			return nil, false, fmt.Errorf("bad gateway (502): upstream server error")
		case http.StatusServiceUnavailable:
			return nil, false, fmt.Errorf("service unavailable (503): server temporarily unavailable")
		}

		// Try to parse as JSON-RPC error
		var errResponse transport.JSONRPCResponse
		if err := json.Unmarshal(body, &errResponse); err == nil {
			return &errResponse, false, nil
		}
		return nil, false, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, body)
	}

	if request.Method == string(mcp.MethodInitialize) {
		// Save the received session ID in the response
		if sessionID := resp.Header.Get(transport.HeaderKeySessionID); sessionID != "" {
			t.sessionID.Store(sessionID)
		}

		t.initializedOnce.Do(func() {
			close(t.initialized)
		})
	}

	// Handle different response types
	mediaType, _, _ := mime.ParseMediaType(resp.Header.Get("Content-Type"))
	switch mediaType {
	case "application/json":
		// Single response
		var response transport.JSONRPCResponse
		if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
			return nil, false, fmt.Errorf("failed to decode response: %w", err)
		}

		// Should not be a notification
		if response.ID.IsNil() {
			return nil, false, fmt.Errorf("response should contain RPC id: %v", response)
		}

		return &response, false, nil

	case "text/event-stream":
		// Server is using SSE for streaming responses
		return t.handleSSEResponse(ctx, resp.Body, false)

	default:
		return nil, false, fmt.Errorf("unexpected content type: %s", resp.Header.Get("Content-Type"))
	}
}

// sendHTTP sends an HTTP request with standard headers (similar to StreamableHTTP)
func (t *X402Transport) sendHTTP(ctx context.Context, method string, body io.Reader, acceptType string) (*http.Response, error) {
	return t.sendHTTPWithHeaders(ctx, method, body, acceptType, nil)
}

// sendHTTPWithHeaders sends an HTTP request with custom headers (for x402 payments)
func (t *X402Transport) sendHTTPWithHeaders(ctx context.Context, method string, body io.Reader, acceptType string, extraHeaders map[string]string) (*http.Response, error) {
	// Check for context cancellation before making expensive operations
	if err := ctx.Err(); err != nil {
		return nil, fmt.Errorf("context cancelled before request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, method, t.serverURL.String(), body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set standard headers (thread-safe, each request gets its own headers)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", acceptType)

	if sessionIDVal := t.sessionID.Load(); sessionIDVal != nil {
		if sessionID, ok := sessionIDVal.(string); ok && sessionID != "" {
			req.Header.Set(transport.HeaderKeySessionID, sessionID)
		}
	}

	// Set protocol version header if negotiated
	if versionVal := t.protocolVersion.Load(); versionVal != nil {
		if version, ok := versionVal.(string); ok && version != "" {
			req.Header.Set(transport.HeaderKeyProtocolVersion, version)
		}
	}

	// Add extra headers
	for k, v := range extraHeaders {
		req.Header.Set(k, v)
	}

	// Send request
	resp, err := t.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}

	// Universal handling for session terminated
	if resp.StatusCode == http.StatusNotFound {
		// Try to get the current session ID for comparison
		var sessionID string
		if sessionIDVal := t.sessionID.Load(); sessionIDVal != nil {
			sessionID, _ = sessionIDVal.(string)
		}
		t.sessionID.CompareAndSwap(sessionID, "")
		resp.Body.Close()
		return nil, ErrSessionTerminated
	}

	return resp, nil
}

// handleSSEResponse processes Server-Sent Events stream (similar to StreamableHTTP)
// handleSSEResponse processes Server-Sent Events response stream
func (t *X402Transport) handleSSEResponse(ctx context.Context, reader io.ReadCloser, ignoreResponse bool) (*transport.JSONRPCResponse, bool, error) {
	// Create a channel for this specific request
	responseChan := make(chan *transport.JSONRPCResponse, 1)

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Start a goroutine to process the SSE stream
	go func() {
		// Ensure this goroutine respects the context
		defer close(responseChan)

		t.readSSE(ctx, reader, func(event, data string) {
			// Try to unmarshal as a response first
			var message transport.JSONRPCResponse
			if err := json.Unmarshal([]byte(data), &message); err != nil {
				// Silently ignore unmarshal errors for SSE events
				return
			}

			// Handle notification
			if message.ID.IsNil() {
				var notification mcp.JSONRPCNotification
				if err := json.Unmarshal([]byte(data), &notification); err != nil {
					return
				}
				t.notifyMu.RLock()
				if t.notificationHandler != nil {
					t.notificationHandler(notification)
				}
				t.notifyMu.RUnlock()
				return
			}

			// Check if this is actually a request from the server by looking for method field
			var rawMessage map[string]json.RawMessage
			if err := json.Unmarshal([]byte(data), &rawMessage); err == nil {
				if _, hasMethod := rawMessage["method"]; hasMethod && !message.ID.IsNil() {
					var request transport.JSONRPCRequest
					if err := json.Unmarshal([]byte(data), &request); err == nil {
						// This is a request from the server
						t.handleIncomingRequest(ctx, request)
						return
					}
				}
			}

			if !ignoreResponse {
				responseChan <- &message
			}
		})
	}()

	// Wait for the response or context cancellation
	select {
	case response := <-responseChan:
		if response == nil {
			return nil, false, fmt.Errorf("unexpected nil response")
		}
		return response, false, nil
	case <-ctx.Done():
		return nil, false, ctx.Err()
	}
}

// readSSE reads the SSE stream and calls the handler for each event
func (t *X402Transport) readSSE(ctx context.Context, reader io.ReadCloser, handler func(event, data string)) {
	defer reader.Close()

	br := bufio.NewReader(reader)
	var event string
	var dataLines []string

	for {
		select {
		case <-ctx.Done():
			return
		default:
			line, err := br.ReadString('\n')
			if err != nil {
				if err == io.EOF {
					// Process any pending event before exit
					if len(dataLines) > 0 {
						// If no event type is specified, use "message" (default event type)
						if event == "" {
							event = "message"
						}
						handler(event, strings.Join(dataLines, "\n"))
					}
					return
				}
				select {
				case <-ctx.Done():
					return
				default:
					return
				}
			}

			// Remove only newline markers
			line = strings.TrimRight(line, "\r\n")
			if line == "" {
				// Empty line means end of event
				if len(dataLines) > 0 {
					// If no event type is specified, use "message" (default event type)
					if event == "" {
						event = "message"
					}
					handler(event, strings.Join(dataLines, "\n"))
					event = ""
					dataLines = nil
				}
				continue
			}

			if strings.HasPrefix(line, "event:") {
				event = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
			} else if strings.HasPrefix(line, "data:") {
				// Append data lines (SSE can have multiple data: lines per event)
				dataLine := strings.TrimPrefix(line, "data:")
				// Only trim leading space, preserve trailing spaces
				if len(dataLine) > 0 && dataLine[0] == ' ' {
					dataLine = dataLine[1:]
				}
				dataLines = append(dataLines, dataLine)
			}
		}
	}
}

// SendNotification implements transport.Interface
func (t *X402Transport) SendNotification(ctx context.Context, notification mcp.JSONRPCNotification) error {
	notificationBody, err := json.Marshal(notification)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}

	ctx, cancel := t.contextAwareOfClientClose(ctx)
	defer cancel()

	resp, err := t.sendHTTP(ctx, http.MethodPost, bytes.NewReader(notificationBody), "application/json, text/event-stream")
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// For notifications, we don't expect a result, but we should check for errors
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("notification failed with status %d", resp.StatusCode)
		}
		return fmt.Errorf("notification failed with status %d: %s", resp.StatusCode, body)
	}

	return nil
}

// SetNotificationHandler implements transport.Interface
func (t *X402Transport) SetNotificationHandler(handler func(mcp.JSONRPCNotification)) {
	t.notifyMu.Lock()
	defer t.notifyMu.Unlock()
	t.notificationHandler = handler
}

// SetRequestHandler implements transport.Interface
func (t *X402Transport) SetRequestHandler(handler transport.RequestHandler) {
	t.requestMu.Lock()
	defer t.requestMu.Unlock()
	t.requestHandler = handler
}

// GetSessionId implements transport.Interface
func (t *X402Transport) GetSessionId() string {
	if sessionIDVal := t.sessionID.Load(); sessionIDVal != nil {
		if sessionID, ok := sessionIDVal.(string); ok {
			return sessionID
		}
	}
	return ""
}

// Helper methods for event recording

// recordPaymentEvent records a payment event for callbacks and recording
func (t *X402Transport) recordPaymentEvent(eventType PaymentEventType, method string, reqs PaymentRequirementsResponse) {
	if len(reqs.Accepts) == 0 {
		return
	}

	req := reqs.Accepts[0]
	amount := new(big.Int)
	// Safely parse amount, use zero if invalid
	if _, ok := amount.SetString(req.MaxAmountRequired, 10); !ok {
		amount = big.NewInt(0)
	}

	event := PaymentEvent{
		Type:      eventType,
		Resource:  req.Resource,
		Method:    method,
		Amount:    amount,
		Network:   req.Network,
		Asset:     req.Asset,
		Recipient: req.PayTo,
		Timestamp: time.Now().Unix(),
	}

	switch eventType {
	case PaymentEventAttempt:
		if t.onPaymentAttempt != nil {
			t.onPaymentAttempt(event)
		}
	case PaymentEventSuccess:
		if t.onPaymentSuccess != nil {
			t.onPaymentSuccess(event)
		}
	}

	if t.paymentRecorder != nil {
		t.paymentRecorder.Record(event)
	}
}

// recordPaymentError records a payment error event for callbacks and recording
func (t *X402Transport) recordPaymentError(eventType PaymentEventType, method string, reqs PaymentRequirementsResponse, err error) {
	if len(reqs.Accepts) == 0 {
		return
	}

	req := reqs.Accepts[0]
	amount := new(big.Int)
	// Safely parse amount, use zero if invalid
	if _, ok := amount.SetString(req.MaxAmountRequired, 10); !ok {
		amount = big.NewInt(0)
	}

	event := PaymentEvent{
		Type:      eventType,
		Resource:  req.Resource,
		Method:    method,
		Amount:    amount,
		Network:   req.Network,
		Asset:     req.Asset,
		Recipient: req.PayTo,
		Error:     err,
		Timestamp: time.Now().Unix(),
	}

	if t.onPaymentFailure != nil {
		t.onPaymentFailure(event, err)
	}

	if t.paymentRecorder != nil {
		t.paymentRecorder.Record(event)
	}
}

// WithPaymentRecorder adds a payment recorder for testing
func WithPaymentRecorder(recorder *PaymentRecorder) func(*X402Transport) {
	return func(t *X402Transport) {
		t.paymentRecorder = recorder
	}
}

// contextAwareOfClientClose creates a context that is canceled when client closes
func (t *X402Transport) contextAwareOfClientClose(ctx context.Context) (context.Context, context.CancelFunc) {
	newCtx, cancel := context.WithCancel(ctx)
	go func() {
		select {
		case <-t.closed:
			cancel()
		case <-newCtx.Done():
			// The original context was canceled
			cancel()
		}
	}()
	return newCtx, cancel
}

// handleIncomingRequest processes requests from the server (like sampling requests)
func (t *X402Transport) handleIncomingRequest(ctx context.Context, request transport.JSONRPCRequest) {
	t.requestMu.RLock()
	handler := t.requestHandler
	t.requestMu.RUnlock()

	if handler == nil {
		// Send method not found error
		errorResponse := &transport.JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      request.ID,
			Error: &mcp.JSONRPCErrorDetails{
				Code:    mcp.METHOD_NOT_FOUND,
				Message: fmt.Sprintf("no handler configured for method: %s", request.Method),
			},
		}
		t.sendResponseToServer(ctx, errorResponse)
		return
	}

	// Handle the request in a goroutine to avoid blocking the SSE reader
	t.wg.Add(1)
	go func() {
		defer t.wg.Done()
		// Create a new context with timeout for request handling
		requestCtx, cancel := context.WithTimeout(ctx, requestHandlingTimeout)
		defer cancel()

		response, err := handler(requestCtx, request)
		if err != nil {
			// Send error response
			errorResponse := &transport.JSONRPCResponse{
				JSONRPC: "2.0",
				ID:      request.ID,
				Error: &mcp.JSONRPCErrorDetails{
					Code:    mcp.INTERNAL_ERROR,
					Message: err.Error(),
				},
			}
			t.sendResponseToServer(requestCtx, errorResponse)
			return
		}

		if response != nil {
			t.sendResponseToServer(requestCtx, response)
		}
	}()
}

// sendResponseToServer sends a response back to the server via HTTP POST
func (t *X402Transport) sendResponseToServer(ctx context.Context, response *transport.JSONRPCResponse) {
	if response == nil {
		return
	}

	responseBody, err := json.Marshal(response)
	if err != nil {
		return
	}

	ctx, cancel := t.contextAwareOfClientClose(ctx)
	defer cancel()

	resp, err := t.sendHTTP(ctx, http.MethodPost, bytes.NewReader(responseBody), "application/json, text/event-stream")
	if err != nil {
		return
	}
	defer resp.Body.Close()

	// We don't need to process the response for a response message
}
