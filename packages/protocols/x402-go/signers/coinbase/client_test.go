package coinbase

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// mockCDPAuth creates a mock CDPAuth for testing that always returns valid tokens
type mockCDPAuth struct{}

func (m *mockCDPAuth) GenerateBearerToken(method, path string) (string, error) {
	return "mock-bearer-token", nil
}

func (m *mockCDPAuth) GenerateWalletAuthToken(method, path string, bodyBytes []byte) (string, error) {
	return "mock-wallet-token", nil
}

func TestNewCDPClient(t *testing.T) {
	auth := &mockCDPAuth{}
	client := NewCDPClient(auth)

	if client == nil {
		t.Fatal("NewCDPClient returned nil")
	}

	if client.baseURL != "https://api.cdp.coinbase.com" {
		t.Errorf("Expected baseURL to be https://api.cdp.coinbase.com, got %s", client.baseURL)
	}

	if client.httpClient == nil {
		t.Error("httpClient should not be nil")
	}

	if client.httpClient.Timeout != 30*time.Second {
		t.Errorf("Expected timeout to be 30s, got %v", client.httpClient.Timeout)
	}

	if client.auth == nil {
		t.Error("auth should not be nil")
	}
}

func TestDoRequest_Success(t *testing.T) {
	// Create mock server that returns successful response
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify headers are set
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Expected Content-Type header to be application/json, got %s", r.Header.Get("Content-Type"))
		}
		if r.Header.Get("Accept") != "application/json" {
			t.Errorf("Expected Accept header to be application/json, got %s", r.Header.Get("Accept"))
		}

		// Return successful response
		w.WriteHeader(http.StatusOK)
		if err := json.NewEncoder(w).Encode(map[string]string{
			"id":      "test-id",
			"address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
		}); err != nil {
			t.Errorf("Failed to encode response: %v", err)
		}
	}))
	defer server.Close()

	auth := &mockCDPAuth{}
	client := NewCDPClient(auth)
	client.baseURL = server.URL // Override baseURL for testing

	var result map[string]string
	err := client.doRequest(context.Background(), "GET", "/test", nil, &result, false, 0)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if result["id"] != "test-id" {
		t.Errorf("Expected id to be test-id, got %s", result["id"])
	}
	if result["address"] != "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" {
		t.Errorf("Expected address to match, got %s", result["address"])
	}
}

func TestDoRequest_AuthenticationHeaders(t *testing.T) {
	tests := []struct {
		name              string
		requireWalletAuth bool
		wantBearerToken   bool
		wantWalletToken   bool
	}{
		{
			name:              "bearer token only",
			requireWalletAuth: false,
			wantBearerToken:   true,
			wantWalletToken:   false,
		},
		{
			name:              "bearer and wallet tokens",
			requireWalletAuth: true,
			wantBearerToken:   true,
			wantWalletToken:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Check Bearer token
				authHeader := r.Header.Get("Authorization")
				if tt.wantBearerToken {
					if !strings.HasPrefix(authHeader, "Bearer ") {
						t.Errorf("Expected Authorization header to start with 'Bearer ', got %s", authHeader)
					}
					if authHeader != "Bearer mock-bearer-token" {
						t.Errorf("Expected Bearer token to be mock-bearer-token, got %s", authHeader)
					}
				}

				// Check Wallet Auth token
				walletAuthHeader := r.Header.Get("X-Wallet-Auth")
				if tt.wantWalletToken {
					if walletAuthHeader != "mock-wallet-token" {
						t.Errorf("Expected X-Wallet-Auth to be mock-wallet-token, got %s", walletAuthHeader)
					}
				} else {
					if walletAuthHeader != "" {
						t.Errorf("Expected no X-Wallet-Auth header, got %s", walletAuthHeader)
					}
				}

				w.WriteHeader(http.StatusOK)
			}))
			defer server.Close()

			auth := &mockCDPAuth{}
			client := NewCDPClient(auth)
			client.baseURL = server.URL

			err := client.doRequest(context.Background(), "POST", "/test", map[string]string{"test": "data"}, nil, tt.requireWalletAuth, 0)
			if err != nil {
				t.Fatalf("Expected no error, got %v", err)
			}
		})
	}
}

func TestDoRequest_ErrorClassification(t *testing.T) {
	tests := []struct {
		name          string
		statusCode    int
		wantErrorType string
		wantRetryable bool
	}{
		{
			name:          "400 bad request - not retryable",
			statusCode:    400,
			wantErrorType: ErrorTypeClientError,
			wantRetryable: false,
		},
		{
			name:          "401 unauthorized - not retryable",
			statusCode:    401,
			wantErrorType: ErrorTypeAuthError,
			wantRetryable: false,
		},
		{
			name:          "403 forbidden - not retryable",
			statusCode:    403,
			wantErrorType: ErrorTypeAuthError,
			wantRetryable: false,
		},
		{
			name:          "404 not found - not retryable",
			statusCode:    404,
			wantErrorType: ErrorTypeClientError,
			wantRetryable: false,
		},
		{
			name:          "429 rate limit - retryable",
			statusCode:    429,
			wantErrorType: ErrorTypeRateLimit,
			wantRetryable: true,
		},
		{
			name:          "500 server error - retryable",
			statusCode:    500,
			wantErrorType: ErrorTypeServerError,
			wantRetryable: true,
		},
		{
			name:          "502 bad gateway - retryable",
			statusCode:    502,
			wantErrorType: ErrorTypeServerError,
			wantRetryable: true,
		},
		{
			name:          "503 service unavailable - retryable",
			statusCode:    503,
			wantErrorType: ErrorTypeServerError,
			wantRetryable: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.statusCode)
				if _, err := w.Write([]byte("Error message")); err != nil {
					t.Errorf("Failed to write response: %v", err)
				}
			}))
			defer server.Close()

			auth := &mockCDPAuth{}
			client := NewCDPClient(auth)
			client.baseURL = server.URL

			err := client.doRequest(context.Background(), "GET", "/test", nil, nil, false, 0)

			if err == nil {
				t.Fatal("Expected error, got nil")
			}

			cdpErr, ok := err.(*CDPError)
			if !ok {
				t.Fatalf("Expected CDPError, got %T", err)
			}

			if cdpErr.StatusCode != tt.statusCode {
				t.Errorf("Expected status code %d, got %d", tt.statusCode, cdpErr.StatusCode)
			}

			if cdpErr.ErrorType != tt.wantErrorType {
				t.Errorf("Expected error type %s, got %s", tt.wantErrorType, cdpErr.ErrorType)
			}

			if cdpErr.Retryable != tt.wantRetryable {
				t.Errorf("Expected retryable=%v, got %v", tt.wantRetryable, cdpErr.Retryable)
			}
		})
	}
}

func TestDoRequestWithRetry_RateLimit(t *testing.T) {
	attemptCount := 0

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attemptCount++

		if attemptCount < 3 {
			// Return rate limit error for first 2 attempts with short retry-after
			w.Header().Set("Retry-After", "0") // 0 seconds for fast tests
			w.WriteHeader(http.StatusTooManyRequests)
			if _, err := w.Write([]byte("Rate limit exceeded")); err != nil {
				t.Errorf("Failed to write response: %v", err)
			}
		} else {
			// Return success on 3rd attempt
			w.WriteHeader(http.StatusOK)
			if err := json.NewEncoder(w).Encode(map[string]string{"status": "success"}); err != nil {
				t.Errorf("Failed to encode response: %v", err)
			}
		}
	}))
	defer server.Close()

	auth := &mockCDPAuth{}
	client := NewCDPClient(auth)
	client.baseURL = server.URL

	var result map[string]string
	err := client.doRequestWithRetry(context.Background(), "GET", "/test", nil, &result, false)

	if err != nil {
		t.Fatalf("Expected success after retries, got %v", err)
	}

	if attemptCount != 3 {
		t.Errorf("Expected 3 attempts, got %d", attemptCount)
	}

	if result["status"] != "success" {
		t.Errorf("Expected status to be success, got %s", result["status"])
	}
}

func TestDoRequestWithRetry_ServerError(t *testing.T) {
	attemptCount := 0

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attemptCount++

		if attemptCount < 2 {
			// Return server error for first attempt
			w.WriteHeader(http.StatusInternalServerError)
			if _, err := w.Write([]byte("Internal server error")); err != nil {
				t.Errorf("Failed to write response: %v", err)
			}
		} else {
			// Return success on 2nd attempt
			w.WriteHeader(http.StatusOK)
			if err := json.NewEncoder(w).Encode(map[string]string{"status": "success"}); err != nil {
				t.Errorf("Failed to encode response: %v", err)
			}
		}
	}))
	defer server.Close()

	auth := &mockCDPAuth{}
	client := NewCDPClient(auth)
	client.baseURL = server.URL

	var result map[string]string
	err := client.doRequestWithRetry(context.Background(), "GET", "/test", nil, &result, false)

	if err != nil {
		t.Fatalf("Expected success after retries, got %v", err)
	}

	if attemptCount != 2 {
		t.Errorf("Expected 2 attempts, got %d", attemptCount)
	}
}

func TestDoRequestWithRetry_NonRetryableError(t *testing.T) {
	attemptCount := 0

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attemptCount++
		w.WriteHeader(http.StatusUnauthorized)
		if _, err := w.Write([]byte("Unauthorized")); err != nil {
			t.Errorf("Failed to write response: %v", err)
		}
	}))
	defer server.Close()

	auth := &mockCDPAuth{}
	client := NewCDPClient(auth)
	client.baseURL = server.URL

	err := client.doRequestWithRetry(context.Background(), "GET", "/test", nil, nil, false)

	if err == nil {
		t.Fatal("Expected error, got nil")
	}

	cdpErr, ok := err.(*CDPError)
	if !ok {
		t.Fatalf("Expected CDPError, got %T", err)
	}

	if cdpErr.Retryable {
		t.Error("Expected non-retryable error")
	}

	if attemptCount != 1 {
		t.Errorf("Expected only 1 attempt for non-retryable error, got %d", attemptCount)
	}
}

func TestDoRequestWithRetry_MaxAttemptsExhausted(t *testing.T) {
	attemptCount := 0

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attemptCount++
		// Always return server error (uses exponential backoff, not Retry-After)
		w.WriteHeader(http.StatusInternalServerError)
		if _, err := w.Write([]byte("Internal server error")); err != nil {
			t.Errorf("Failed to write response: %v", err)
		}
	}))
	defer server.Close()

	auth := &mockCDPAuth{}
	client := NewCDPClient(auth)
	client.baseURL = server.URL

	err := client.doRequestWithRetry(context.Background(), "GET", "/test", nil, nil, false)

	if err == nil {
		t.Fatal("Expected error after max retries, got nil")
	}

	// Should make exactly 5 attempts (maxAttempts)
	if attemptCount != 5 {
		t.Errorf("Expected 5 attempts, got %d", attemptCount)
	}

	// Error should be the last CDPError returned (not wrapped)
	cdpErr, ok := err.(*CDPError)
	if !ok {
		t.Fatalf("Expected CDPError, got %T: %v", err, err)
	}

	if !cdpErr.Retryable {
		t.Error("Expected error to be retryable since we exhausted retries on a retryable error")
	}

	if cdpErr.ErrorType != ErrorTypeServerError {
		t.Errorf("Expected error type to be %s, got %s", ErrorTypeServerError, cdpErr.ErrorType)
	}
}

func TestDoRequestWithRetry_ContextCancellation(t *testing.T) {
	attemptCount := 0

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attemptCount++
		// Always return server error to trigger retry (uses exponential backoff)
		w.WriteHeader(http.StatusInternalServerError)
		if _, err := w.Write([]byte("Internal server error")); err != nil {
			t.Errorf("Failed to write response: %v", err)
		}
	}))
	defer server.Close()

	auth := &mockCDPAuth{}
	client := NewCDPClient(auth)
	client.baseURL = server.URL

	// Create context that will be cancelled after first attempt
	ctx, cancel := context.WithCancel(context.Background())

	// Start request in goroutine
	errChan := make(chan error, 1)
	go func() {
		errChan <- client.doRequestWithRetry(ctx, "GET", "/test", nil, nil, false)
	}()

	// Wait a bit for first attempt to complete
	time.Sleep(50 * time.Millisecond)

	// Cancel context during retry wait
	cancel()

	// Wait for request to complete
	err := <-errChan

	if err == nil {
		t.Fatal("Expected error due to context cancellation, got nil")
	}

	if err != context.Canceled {
		t.Errorf("Expected context.Canceled error, got %v", err)
	}

	// Should have made 1 attempt before cancellation
	if attemptCount != 1 {
		t.Errorf("Expected 1 attempt before cancellation, got %d", attemptCount)
	}
}

func TestCalculateBackoff(t *testing.T) {
	tests := []struct {
		name         string
		attempt      int
		initialDelay time.Duration
		maxDelay     time.Duration
		multiplier   float64
		wantMin      time.Duration
		wantMax      time.Duration
	}{
		{
			name:         "first attempt",
			attempt:      0,
			initialDelay: 100 * time.Millisecond,
			maxDelay:     10 * time.Second,
			multiplier:   2.0,
			wantMin:      75 * time.Millisecond,  // 100ms - 25%
			wantMax:      125 * time.Millisecond, // 100ms + 25%
		},
		{
			name:         "second attempt",
			attempt:      1,
			initialDelay: 100 * time.Millisecond,
			maxDelay:     10 * time.Second,
			multiplier:   2.0,
			wantMin:      150 * time.Millisecond, // 200ms - 25%
			wantMax:      250 * time.Millisecond, // 200ms + 25%
		},
		{
			name:         "third attempt",
			attempt:      2,
			initialDelay: 100 * time.Millisecond,
			maxDelay:     10 * time.Second,
			multiplier:   2.0,
			wantMin:      300 * time.Millisecond, // 400ms - 25%
			wantMax:      500 * time.Millisecond, // 400ms + 25%
		},
		{
			name:         "max delay reached",
			attempt:      10,
			initialDelay: 100 * time.Millisecond,
			maxDelay:     1 * time.Second,
			multiplier:   2.0,
			wantMin:      750 * time.Millisecond,  // 1s - 25%
			wantMax:      1250 * time.Millisecond, // 1s + 25%
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Run multiple times to test jitter randomness
			for i := 0; i < 10; i++ {
				delay := calculateBackoff(tt.attempt, tt.initialDelay, tt.maxDelay, tt.multiplier)

				if delay < tt.wantMin || delay > tt.wantMax {
					t.Errorf("Backoff delay %v out of range [%v, %v]", delay, tt.wantMin, tt.wantMax)
				}
			}
		})
	}
}

func TestParseRetryAfter(t *testing.T) {
	tests := []struct {
		name      string
		headerVal string
		wantMin   time.Duration
		wantMax   time.Duration
	}{
		{
			name:      "missing header",
			headerVal: "",
			wantMin:   60 * time.Second,
			wantMax:   60 * time.Second,
		},
		{
			name:      "integer seconds",
			headerVal: "30",
			wantMin:   30 * time.Second,
			wantMax:   30 * time.Second,
		},
		{
			name:      "http date format",
			headerVal: time.Now().Add(45 * time.Second).Format(time.RFC1123),
			wantMin:   40 * time.Second,
			wantMax:   50 * time.Second,
		},
		{
			name:      "invalid format",
			headerVal: "invalid",
			wantMin:   60 * time.Second,
			wantMax:   60 * time.Second,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create response with Retry-After header
			resp := &http.Response{
				Header: http.Header{},
			}
			if tt.headerVal != "" {
				resp.Header.Set("Retry-After", tt.headerVal)
			}

			duration := parseRetryAfter(resp)

			if duration < tt.wantMin || duration > tt.wantMax {
				t.Errorf("parseRetryAfter() = %v, want between %v and %v", duration, tt.wantMin, tt.wantMax)
			}
		})
	}
}

func TestDoRequest_RequestIDInError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Request-ID", "test-request-123")
		w.WriteHeader(http.StatusInternalServerError)
		if _, err := w.Write([]byte("Server error")); err != nil {
			t.Errorf("Failed to write response: %v", err)
		}
	}))
	defer server.Close()

	auth := &mockCDPAuth{}
	client := NewCDPClient(auth)
	client.baseURL = server.URL

	err := client.doRequest(context.Background(), "GET", "/test", nil, nil, false, 0)

	if err == nil {
		t.Fatal("Expected error, got nil")
	}

	cdpErr, ok := err.(*CDPError)
	if !ok {
		t.Fatalf("Expected CDPError, got %T", err)
	}

	if cdpErr.RequestID != "test-request-123" {
		t.Errorf("Expected request ID to be test-request-123, got %s", cdpErr.RequestID)
	}

	if !strings.Contains(cdpErr.Error(), "test-request-123") {
		t.Errorf("Expected error message to contain request ID, got: %s", cdpErr.Error())
	}
}

func TestDoRequest_WithRequestBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request body
		var body map[string]string
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("Failed to decode request body: %v", err)
		}

		if body["network_id"] != "base-sepolia" {
			t.Errorf("Expected network_id to be base-sepolia, got %s", body["network_id"])
		}

		// Return response
		w.WriteHeader(http.StatusOK)
		if err := json.NewEncoder(w).Encode(map[string]string{
			"id":      "account-123",
			"address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
		}); err != nil {
			t.Errorf("Failed to encode response: %v", err)
		}
	}))
	defer server.Close()

	auth := &mockCDPAuth{}
	client := NewCDPClient(auth)
	client.baseURL = server.URL

	requestBody := map[string]string{
		"network_id": "base-sepolia",
	}

	var result map[string]string
	err := client.doRequest(context.Background(), "POST", "/accounts", requestBody, &result, false, 0)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if result["id"] != "account-123" {
		t.Errorf("Expected id to be account-123, got %s", result["id"])
	}
}

func TestDoRequestWithRetry_RetryAfterHeader(t *testing.T) {
	attemptCount := 0
	var firstAttemptTime time.Time
	var secondAttemptTime time.Time

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attemptCount++

		if attemptCount == 1 {
			firstAttemptTime = time.Now()
			// Return rate limit with Retry-After header
			w.Header().Set("Retry-After", "1") // 1 second
			w.WriteHeader(http.StatusTooManyRequests)
			if _, err := w.Write([]byte("Rate limit exceeded")); err != nil {
				t.Errorf("Failed to write response: %v", err)
			}
		} else {
			secondAttemptTime = time.Now()
			// Return success
			w.WriteHeader(http.StatusOK)
			if err := json.NewEncoder(w).Encode(map[string]string{"status": "success"}); err != nil {
				t.Errorf("Failed to encode response: %v", err)
			}
		}
	}))
	defer server.Close()

	auth := &mockCDPAuth{}
	client := NewCDPClient(auth)
	client.baseURL = server.URL

	var result map[string]string
	err := client.doRequestWithRetry(context.Background(), "GET", "/test", nil, &result, false)

	if err != nil {
		t.Fatalf("Expected success after retry, got %v", err)
	}

	// Verify Retry-After was respected (should wait approximately 1 second)
	waitTime := secondAttemptTime.Sub(firstAttemptTime)
	if waitTime < 900*time.Millisecond {
		t.Errorf("Expected wait time to be at least 900ms (respecting Retry-After), got %v", waitTime)
	}
}

func TestClassifyError_MessageParsing(t *testing.T) {
	tests := []struct {
		name         string
		statusCode   int
		responseBody string
		wantMessage  string
	}{
		{
			name:         "json error message",
			statusCode:   400,
			responseBody: `{"error": "Invalid parameter", "code": "INVALID_PARAM"}`,
			wantMessage:  `{"error": "Invalid parameter", "code": "INVALID_PARAM"}`,
		},
		{
			name:         "plain text error",
			statusCode:   500,
			responseBody: "Internal server error occurred",
			wantMessage:  "Internal server error occurred",
		},
		{
			name:         "empty response",
			statusCode:   503,
			responseBody: "",
			wantMessage:  "CDP server error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.statusCode)
				if tt.responseBody != "" {
					if _, err := w.Write([]byte(tt.responseBody)); err != nil {
						t.Errorf("Failed to write response: %v", err)
					}
				}
			}))
			defer server.Close()

			auth := &mockCDPAuth{}
			client := NewCDPClient(auth)
			client.baseURL = server.URL

			err := client.doRequest(context.Background(), "GET", "/test", nil, nil, false, 0)

			if err == nil {
				t.Fatal("Expected error, got nil")
			}

			cdpErr, ok := err.(*CDPError)
			if !ok {
				t.Fatalf("Expected CDPError, got %T", err)
			}

			if cdpErr.Message != tt.wantMessage {
				t.Errorf("Expected message %q, got %q", tt.wantMessage, cdpErr.Message)
			}
		})
	}
}

// TestDoRequestWithRetry_ExponentialBackoff verifies that retry delays follow exponential backoff pattern
func TestDoRequestWithRetry_ExponentialBackoff(t *testing.T) {
	attemptCount := 0
	attemptTimes := []time.Time{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attemptTimes = append(attemptTimes, time.Now())
		attemptCount++

		if attemptCount < 4 {
			// Return server error for first 3 attempts (uses exponential backoff)
			w.WriteHeader(http.StatusInternalServerError)
			if _, err := w.Write([]byte("Internal server error")); err != nil {
				t.Errorf("Failed to write response: %v", err)
			}
		} else {
			// Success on 4th attempt
			w.WriteHeader(http.StatusOK)
			if err := json.NewEncoder(w).Encode(map[string]string{"status": "success"}); err != nil {
				t.Errorf("Failed to encode response: %v", err)
			}
		}
	}))
	defer server.Close()

	auth := &mockCDPAuth{}
	client := NewCDPClient(auth)
	client.baseURL = server.URL

	var result map[string]string
	err := client.doRequestWithRetry(context.Background(), "GET", "/test", nil, &result, false)

	if err != nil {
		t.Fatalf("Expected success after retries, got %v", err)
	}

	// Verify exponential backoff pattern
	// First retry delay: ~100ms
	// Second retry delay: ~200ms
	// Third retry delay: ~400ms
	if len(attemptTimes) != 4 {
		t.Fatalf("Expected 4 attempts, got %d", len(attemptTimes))
	}

	// Check that each delay is at least 50ms (accounting for jitter and processing time)
	for i := 1; i < len(attemptTimes); i++ {
		delay := attemptTimes[i].Sub(attemptTimes[i-1])
		// Each delay should be at least 50ms (accounting for jitter and processing time)
		minDelay := 50 * time.Millisecond
		if delay < minDelay {
			t.Errorf("Delay between attempt %d and %d was %v, expected at least %v", i, i+1, delay, minDelay)
		}
	}
}

func TestCDPError_EnhancedErrorMessage(t *testing.T) {
	tests := []struct {
		name            string
		cdpErr          *CDPError
		wantContains    []string
		wantNotContains []string
	}{
		{
			name: "basic error with request ID",
			cdpErr: &CDPError{
				StatusCode: 500,
				Message:    "Internal server error",
				RequestID:  "req-123",
			},
			wantContains: []string{"500", "Internal server error", "req-123"},
		},
		{
			name: "error with method and path",
			cdpErr: &CDPError{
				StatusCode: 404,
				Message:    "Not found",
				Method:     "GET",
				Path:       "/platform/v2/evm/accounts",
			},
			wantContains: []string{"404", "Not found", "GET /platform/v2/evm/accounts"},
		},
		{
			name: "error with attempt number",
			cdpErr: &CDPError{
				StatusCode:    429,
				Message:       "Rate limit exceeded",
				RequestID:     "req-456",
				AttemptNumber: 2,
			},
			wantContains: []string{"429", "Rate limit exceeded", "req-456", "attempt 3"},
		},
		{
			name: "full error context",
			cdpErr: &CDPError{
				StatusCode:    503,
				Message:       "Service unavailable",
				RequestID:     "req-789",
				Method:        "POST",
				Path:          "/platform/v2/solana/accounts",
				AttemptNumber: 1,
			},
			wantContains: []string{"503", "Service unavailable", "req-789", "POST /platform/v2/solana/accounts", "attempt 2"},
		},
		{
			name: "error without request ID",
			cdpErr: &CDPError{
				StatusCode:    400,
				Message:       "Bad request",
				Method:        "DELETE",
				Path:          "/test",
				AttemptNumber: 0,
			},
			wantContains:    []string{"400", "Bad request", "DELETE /test"},
			wantNotContains: []string{"RequestID", "attempt"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errMsg := tt.cdpErr.Error()

			for _, want := range tt.wantContains {
				if !strings.Contains(errMsg, want) {
					t.Errorf("Error message %q does not contain expected string %q", errMsg, want)
				}
			}

			for _, notWant := range tt.wantNotContains {
				if strings.Contains(errMsg, notWant) {
					t.Errorf("Error message %q should not contain string %q", errMsg, notWant)
				}
			}
		})
	}
}

func TestDoRequestWithRetry_AttemptTracking(t *testing.T) {
	attemptCount := 0
	var capturedErrors []*CDPError

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attemptCount++
		w.Header().Set("X-Request-ID", fmt.Sprintf("req-%d", attemptCount))
		w.WriteHeader(http.StatusInternalServerError)
		if _, err := w.Write([]byte("Server error")); err != nil {
			t.Errorf("Failed to write response: %v", err)
		}
	}))
	defer server.Close()

	auth := &mockCDPAuth{}
	client := NewCDPClient(auth)
	client.baseURL = server.URL

	// This will exhaust all retry attempts
	err := client.doRequestWithRetry(context.Background(), "GET", "/test", nil, nil, false)

	if err == nil {
		t.Fatal("Expected error after retry exhaustion, got nil")
	}

	// The final error should have attempt number tracked
	cdpErr, ok := err.(*CDPError)
	if !ok {
		t.Fatalf("Expected CDPError, got %T", err)
	}

	// Should be on attempt 4 (0-indexed, so 5 total attempts)
	if cdpErr.AttemptNumber != 4 {
		t.Errorf("Expected AttemptNumber to be 4, got %d", cdpErr.AttemptNumber)
	}

	// Error message should contain attempt info
	errMsg := cdpErr.Error()
	if !strings.Contains(errMsg, "attempt 5") {
		t.Errorf("Error message should contain 'attempt 5', got: %s", errMsg)
	}

	// Should contain method and path
	if !strings.Contains(errMsg, "GET /test") {
		t.Errorf("Error message should contain 'GET /test', got: %s", errMsg)
	}

	// Should have made exactly 5 attempts
	if attemptCount != 5 {
		t.Errorf("Expected 5 attempts, got %d", attemptCount)
	}

	_ = capturedErrors // For potential future use
}

func TestDoRequestWithRetry_ContextDeadline(t *testing.T) {
	var mu sync.Mutex
	attemptCount := 0

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		attemptCount++
		mu.Unlock()
		// Simulate slow response
		time.Sleep(50 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	auth := &mockCDPAuth{}
	client := NewCDPClient(auth)
	client.baseURL = server.URL

	// Create context with very short deadline
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

	err := client.doRequestWithRetry(ctx, "GET", "/test", nil, nil, false)

	if err == nil {
		t.Fatal("Expected error due to context deadline, got nil")
	}

	// Should fail quickly due to deadline
	mu.Lock()
	count := attemptCount
	mu.Unlock()
	if count > 1 {
		t.Errorf("Expected at most 1 attempt due to deadline, got %d", count)
	}
}

// Benchmark tests

func BenchmarkCalculateBackoff(b *testing.B) {
	for i := 0; i < b.N; i++ {
		calculateBackoff(3, 100*time.Millisecond, 10*time.Second, 2.0)
	}
}

func BenchmarkDoRequest_Success(b *testing.B) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok"}`)
	}))
	defer server.Close()

	auth := &mockCDPAuth{}
	client := NewCDPClient(auth)
	client.baseURL = server.URL

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var result map[string]string
		_ = client.doRequest(context.Background(), "GET", "/test", nil, &result, false, 0)
	}
}
