package coinbase

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net/http"
	"sort"
	"strconv"
	"time"
)

// cdpAuth is an interface for JWT token generation, allowing for testing with mock implementations.
type cdpAuth interface {
	GenerateBearerToken(method, path string) (string, error)
	GenerateWalletAuthToken(method, path string, bodyHash []byte) (string, error)
}

// CDPClient is an HTTP client wrapper for the Coinbase Developer Platform REST API.
// It handles authentication, request/response serialization, error classification,
// and automatic retry logic with exponential backoff for transient failures.
//
// CDPClient is safe for concurrent use by multiple goroutines.
//
// Example usage:
//
//	auth := &CDPAuth{...}
//	client := NewCDPClient(auth)
//
//	var account CDPAccount
//	err := client.doRequestWithRetry(
//	    ctx,
//	    "POST",
//	    "/platform/v2/evm/accounts",
//	    map[string]string{"network_id": "base-sepolia"},
//	    &account,
//	    false,
//	)
type CDPClient struct {
	// baseURL is the CDP API base URL (https://api.cdp.coinbase.com)
	baseURL string

	// httpClient is the configured HTTP client with timeouts and connection pooling
	httpClient *http.Client

	// auth handles JWT token generation for API authentication
	auth cdpAuth
}

// NewCDPClient creates a new CDP API client with authentication credentials.
// It configures an HTTP client with a 30-second timeout and connection pooling
// optimized for API communication.
//
// The auth parameter must not be nil and should contain valid CDP API credentials.
//
// Example:
//
//	auth, _ := NewCDPAuth("organizations/abc/apiKeys/xyz", "-----BEGIN EC PRIVATE KEY-----\n...", "")
//	client := NewCDPClient(auth)
func NewCDPClient(auth cdpAuth) *CDPClient {
	return &CDPClient{
		baseURL: "https://api.cdp.coinbase.com",
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     90 * time.Second,
			},
		},
		auth: auth,
	}
}

// doRequest executes a single HTTP request to the CDP API with authentication headers.
// It handles request serialization, authentication token generation, and response parsing.
//
// Parameters:
//   - ctx: Request context for timeout and cancellation
//   - method: HTTP method (GET, POST, PUT, DELETE)
//   - path: API endpoint path (e.g., "/platform/v2/evm/accounts")
//   - body: Request body object (marshaled to JSON), can be nil for GET requests
//   - result: Response object (unmarshaled from JSON), can be nil if no response expected
//   - requireWalletAuth: Whether to include X-Wallet-Auth header for wallet operations
//   - attemptNumber: Current retry attempt number (0 for initial request)
//
// The function marshals the request body to JSON, generates Bearer and optional Wallet Auth
// JWT tokens, executes the HTTP request, and unmarshals the response. It returns a CDPError
// for non-2xx responses with proper error classification.
//
// Returns:
//   - nil on success (2xx status code)
//   - CDPError for API errors with classification and retry guidance
//   - Standard error for network or serialization failures
//
// Example:
//
//	var account CDPAccount
//	err := client.doRequest(
//	    ctx,
//	    "POST",
//	    "/platform/v2/evm/accounts",
//	    map[string]string{"network_id": "base-sepolia"},
//	    &account,
//	    false,
//	    0,
//	)
func (c *CDPClient) doRequest(ctx context.Context, method, path string, body, result interface{}, requireWalletAuth bool, attemptNumber int) error {
	// Marshal request body to JSON
	var bodyBytes []byte
	if body != nil {
		var err error
		bodyBytes, err = json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request body: %w", err)
		}
	}

	// Create HTTP request with context
	url := c.baseURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	// Generate and add Bearer token
	token, err := c.auth.GenerateBearerToken(method, path)
	if err != nil {
		return fmt.Errorf("generate JWT: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	// Add Wallet Auth header if required
	if requireWalletAuth {
		// Compute hash of sorted JSON for Wallet Auth (CDP requirement)
		bodyHash, err := computeSortedJSONHash(bodyBytes)
		if err != nil {
			return fmt.Errorf("compute request body hash: %w", err)
		}

		walletToken, err := c.auth.GenerateWalletAuthToken(method, path, bodyHash)
		if err != nil {
			return fmt.Errorf("generate wallet auth JWT: %w", err)
		}
		req.Header.Set("X-Wallet-Auth", walletToken)
	}

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	// Check status code
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return c.classifyError(resp, method, path, attemptNumber)
	}

	// Decode response
	if result != nil {
		bodyText, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("read response body: %w", err)
		}
		if err := json.Unmarshal(bodyText, result); err != nil {
			return fmt.Errorf("decode response: %w", err)
		}
	}

	return nil
}

// classifyError creates a CDPError from an HTTP response, categorizing the error type
// and determining whether it should be retried.
//
// Error classification:
//   - 429: rate_limit (retryable=true, respects Retry-After header)
//   - 5xx: server_error (retryable=true)
//   - 401: auth_error (retryable=false)
//   - 403: permission_error (retryable=false)
//   - 4xx: client_error (retryable=false)
func (c *CDPClient) classifyError(resp *http.Response, method, path string, attemptNumber int) error {
	cdpErr := &CDPError{
		StatusCode:    resp.StatusCode,
		RequestID:     resp.Header.Get("X-Request-ID"),
		Method:        method,
		Path:          path,
		AttemptNumber: attemptNumber,
	}

	// Read response body for error message
	bodyText, _ := io.ReadAll(resp.Body)
	if len(bodyText) > 0 {
		cdpErr.Message = string(bodyText)
	}

	// Classify by status code
	switch {
	case resp.StatusCode == 429:
		// Rate limit - retry with backoff
		cdpErr.ErrorType = ErrorTypeRateLimit
		cdpErr.Retryable = true
		cdpErr.RetryAfter = parseRetryAfter(resp)
		if cdpErr.Message == "" {
			cdpErr.Message = "Rate limit exceeded"
		}

	case resp.StatusCode >= 500:
		// Server errors - always retry
		cdpErr.ErrorType = ErrorTypeServerError
		cdpErr.Retryable = true
		if cdpErr.Message == "" {
			cdpErr.Message = "CDP server error"
		}

	case resp.StatusCode == 401:
		// Authentication failed - not retryable
		cdpErr.ErrorType = ErrorTypeAuthError
		cdpErr.Retryable = false
		if cdpErr.Message == "" {
			cdpErr.Message = "Authentication failed - check API credentials"
		}

	case resp.StatusCode == 403:
		// Forbidden - insufficient permissions
		cdpErr.ErrorType = ErrorTypeAuthError
		cdpErr.Retryable = false
		if cdpErr.Message == "" {
			cdpErr.Message = "Insufficient permissions"
		}

	case resp.StatusCode >= 400:
		// Client errors - not retryable
		cdpErr.ErrorType = ErrorTypeClientError
		cdpErr.Retryable = false
		if cdpErr.Message == "" {
			cdpErr.Message = "Invalid request parameters"
		}
	}

	return cdpErr
}

// parseRetryAfter extracts the backoff duration from the Retry-After HTTP header.
// It supports both integer seconds and HTTP date formats.
// Returns 60 seconds if the header is missing or invalid.
func parseRetryAfter(resp *http.Response) time.Duration {
	retryAfter := resp.Header.Get("Retry-After")
	if retryAfter == "" {
		return 60 * time.Second // Default
	}

	// Try parsing as seconds
	if seconds, err := strconv.Atoi(retryAfter); err == nil {
		return time.Duration(seconds) * time.Second
	}

	// Try parsing as HTTP date
	if retryTime, err := time.Parse(time.RFC1123, retryAfter); err == nil {
		duration := time.Until(retryTime)
		if duration > 0 {
			return duration
		}
	}

	return 60 * time.Second
}

// calculateBackoff computes the exponential backoff delay for a retry attempt.
// It applies the formula: initialDelay * (multiplier ^ attempt), capped at maxDelay,
// with ±25% jitter to avoid thundering herd problems.
//
// Parameters:
//   - attempt: Zero-based retry attempt number
//   - initialDelay: Starting delay for first retry
//   - maxDelay: Maximum delay cap
//   - multiplier: Exponential growth factor (typically 2.0)
//
// Returns: Backoff duration with jitter applied
//
// Example:
//
//	delay := calculateBackoff(0, 100*time.Millisecond, 10*time.Second, 2.0)
//	// First retry: ~100ms (±25%)
//	delay = calculateBackoff(1, 100*time.Millisecond, 10*time.Second, 2.0)
//	// Second retry: ~200ms (±25%)
//	delay = calculateBackoff(2, 100*time.Millisecond, 10*time.Second, 2.0)
//	// Third retry: ~400ms (±25%)
func calculateBackoff(attempt int, initialDelay, maxDelay time.Duration, multiplier float64) time.Duration {
	// Exponential backoff: delay * (multiplier ^ attempt)
	delay := float64(initialDelay) * math.Pow(multiplier, float64(attempt))

	// Cap at maximum
	if delay > float64(maxDelay) {
		delay = float64(maxDelay)
	}

	// Add jitter (±25%)
	jitterRange := delay / 2.0                                     // 50% of delay
	jitter := (rand.Float64() * jitterRange) - (jitterRange / 2.0) // Random value in [-25%, +25%]

	result := time.Duration(delay + jitter)
	if result < 0 {
		result = initialDelay
	}

	return result
}

// doRequestWithRetry wraps doRequest with exponential backoff retry logic for transient failures.
// It automatically retries requests that fail with retryable errors (rate limits, server errors)
// up to a maximum number of attempts.
//
// Retry configuration:
//   - Max attempts: 5
//   - Initial delay: 100ms
//   - Multiplier: 2x
//   - Max delay: 10s
//   - Jitter: ±25%
//
// Retryable errors:
//   - 429 Too Many Requests (rate limit)
//   - 5xx Server Errors
//
// Non-retryable errors (fail immediately):
//   - 401 Unauthorized
//   - 403 Forbidden
//   - 4xx Client Errors (except 429)
//
// The function respects context cancellation and will stop retrying if the context is cancelled.
//
// Parameters: Same as doRequest
//
// Returns:
//   - nil on success
//   - Original error if non-retryable
//   - Last error after exhausting retry attempts
//
// Example:
//
//	err := client.doRequestWithRetry(
//	    ctx,
//	    "POST",
//	    "/platform/v2/evm/accounts",
//	    map[string]string{"network_id": "base-sepolia"},
//	    &account,
//	    false,
//	)
//	if err != nil {
//	    // Error occurred after retries exhausted or non-retryable error
//	}
func (c *CDPClient) doRequestWithRetry(ctx context.Context, method, path string, body, result interface{}, requireWalletAuth bool) error {
	const (
		maxAttempts  = 5
		initialDelay = 100 * time.Millisecond
		maxDelay     = 10 * time.Second
		multiplier   = 2.0
	)

	var lastErr error

	for attempt := 0; attempt < maxAttempts; attempt++ {
		err := c.doRequest(ctx, method, path, body, result, requireWalletAuth, attempt)

		if err == nil {
			return nil // Success
		}

		lastErr = err

		// Check if error is retryable
		cdpErr, ok := err.(*CDPError)
		if !ok || !cdpErr.Retryable {
			return err // Not retryable
		}

		// Don't retry on last attempt
		if attempt == maxAttempts-1 {
			return err
		}

		// Calculate backoff delay
		var delay time.Duration
		if cdpErr.RetryAfter > 0 {
			// Use Retry-After header if available
			delay = cdpErr.RetryAfter
		} else {
			// Calculate exponential backoff with jitter
			delay = calculateBackoff(attempt, initialDelay, maxDelay, multiplier)
		}

		// Wait with context cancellation support
		select {
		case <-time.After(delay):
			// Continue to next attempt
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	return fmt.Errorf("max retry attempts exceeded: %w", lastErr)
}

// sortJSONKeys recursively sorts all object keys in a JSON value to produce canonical JSON.
// This is required for computing request body hashes for Wallet Auth tokens, as CDP requires
// keys to be sorted alphabetically.
//
// Parameters:
//   - v: Any JSON value (map, slice, or primitive)
//
// Returns: The same value with all object keys sorted
func sortJSONKeys(v interface{}) interface{} {
	switch val := v.(type) {
	case map[string]interface{}:
		// Sort map keys
		sorted := make(map[string]interface{}, len(val))
		keys := make([]string, 0, len(val))
		for k := range val {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			sorted[k] = sortJSONKeys(val[k])
		}
		return sorted
	case []interface{}:
		// Recursively sort array elements
		for i, elem := range val {
			val[i] = sortJSONKeys(elem)
		}
		return val
	default:
		// Primitive value, return as-is
		return val
	}
}

// computeSortedJSONHash computes the SHA-256 hash of a JSON value with sorted keys.
// This implements CDP's canonical JSON hashing requirement for Wallet Auth tokens.
//
// The process is:
//  1. Parse the JSON bytes
//  2. Recursively sort all object keys
//  3. Re-marshal to compact JSON (no whitespace)
//  4. Compute SHA-256 hash
//
// Parameters:
//   - bodyBytes: Raw JSON bytes (may have unsorted keys)
//
// Returns:
//   - []byte: SHA-256 hash of the canonical JSON, or nil for empty/trivial bodies
//   - error: Parsing or marshaling errors
func computeSortedJSONHash(bodyBytes []byte) ([]byte, error) {
	if len(bodyBytes) == 0 {
		return nil, nil
	}

	// Parse JSON
	var v interface{}
	if err := json.Unmarshal(bodyBytes, &v); err != nil {
		return nil, fmt.Errorf("parse JSON for sorting: %w", err)
	}

	// Check if body is essentially empty (matches Python SDK's "falsy" check)
	// Empty objects {}, empty arrays [], and null should not generate a hash
	switch val := v.(type) {
	case map[string]interface{}:
		if len(val) == 0 {
			return nil, nil // Empty object - no hash
		}
	case []interface{}:
		if len(val) == 0 {
			return nil, nil // Empty array - no hash
		}
	case nil:
		return nil, nil // null - no hash
	}

	// Sort all keys
	sorted := sortJSONKeys(v)

	// Re-marshal to canonical form (compact, sorted keys)
	canonical, err := json.Marshal(sorted)
	if err != nil {
		return nil, fmt.Errorf("marshal sorted JSON: %w", err)
	}

	// Compute SHA-256 hash
	hash := sha256.Sum256(canonical)
	return hash[:], nil
}
