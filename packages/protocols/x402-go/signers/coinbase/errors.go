package coinbase

import (
	"fmt"
	"time"
)

// CDPError represents a structured error from the Coinbase Developer Platform API.
// It provides detailed information about API failures including HTTP status codes,
// error categorization, and retry behavior guidance.
//
// CDPError implements the error interface and can be used with errors.Is/errors.As
// for error handling. The Retryable field indicates whether the operation should
// be retried, and RetryAfter provides the recommended backoff duration.
//
// Example usage:
//
//	if cdpErr, ok := err.(*CDPError); ok {
//	    if cdpErr.Retryable {
//	        time.Sleep(cdpErr.RetryAfter)
//	        // retry the operation
//	    }
//	    log.Printf("CDP API error: %s (RequestID: %s)", cdpErr.Message, cdpErr.RequestID)
//	}
type CDPError struct {
	// StatusCode is the HTTP status code returned by the CDP API.
	// Common values: 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden),
	// 429 (Too Many Requests), 500 (Internal Server Error), 503 (Service Unavailable).
	StatusCode int

	// ErrorType categorizes the error for programmatic handling.
	// Valid values: "rate_limit", "server_error", "auth_error", "client_error".
	// This field helps distinguish between different error classes without
	// inspecting status codes.
	ErrorType string

	// Message is a human-readable description of the error.
	// This message should be suitable for logging and debugging, but may contain
	// technical details that should not be exposed directly to end users.
	Message string

	// RequestID is the CDP API request identifier for tracking and debugging.
	// Include this value when contacting Coinbase support for assistance.
	// Empty string if the API did not return a request ID.
	RequestID string

	// Retryable indicates whether the operation should be retried.
	// True for transient errors (rate limits, server errors, network issues).
	// False for permanent errors (authentication failures, invalid requests).
	Retryable bool

	// RetryAfter is the recommended backoff duration before retrying.
	// For rate limit errors (429), this is parsed from the Retry-After header.
	// For other retryable errors, this is calculated using exponential backoff.
	// Zero value if the error is not retryable.
	RetryAfter time.Duration

	// AttemptNumber tracks which retry attempt this error occurred on.
	// 0 for the initial request, incremented for each retry.
	// This helps with debugging and understanding retry behavior.
	AttemptNumber int

	// Method is the HTTP method of the failed request (GET, POST, etc).
	// Useful for debugging and log correlation.
	Method string

	// Path is the API endpoint path of the failed request.
	// Useful for debugging and log correlation.
	Path string
}

// Error implements the error interface, returning a formatted error message.
// The format includes the HTTP status code, error message, request ID,
// attempt number, method, and path when available for easier debugging and log analysis.
func (e *CDPError) Error() string {
	var msg string

	// Start with basic error info
	if e.RequestID != "" {
		msg = fmt.Sprintf("CDP API error [%d]: %s (RequestID: %s)",
			e.StatusCode, e.Message, e.RequestID)
	} else {
		msg = fmt.Sprintf("CDP API error [%d]: %s", e.StatusCode, e.Message)
	}

	// Add request details for better debugging
	if e.Method != "" && e.Path != "" {
		msg += fmt.Sprintf(" [%s %s]", e.Method, e.Path)
	}

	// Add attempt info if this is a retry
	if e.AttemptNumber > 0 {
		msg += fmt.Sprintf(" (attempt %d)", e.AttemptNumber+1)
	}

	return msg
}

// Error type constants for programmatic error classification.
const (
	// ErrorTypeRateLimit indicates the request was rate-limited (HTTP 429).
	// Operations should be retried after the RetryAfter duration.
	ErrorTypeRateLimit = "rate_limit"

	// ErrorTypeServerError indicates a CDP server-side error (HTTP 5xx).
	// These errors are typically transient and operations should be retried
	// with exponential backoff.
	ErrorTypeServerError = "server_error"

	// ErrorTypeAuthError indicates an authentication or authorization failure (HTTP 401/403).
	// These errors are not retryable and indicate invalid credentials or
	// insufficient permissions.
	ErrorTypeAuthError = "auth_error"

	// ErrorTypeClientError indicates an invalid request from the client (HTTP 4xx except 429).
	// These errors are not retryable and indicate incorrect request parameters,
	// malformed data, or unsupported operations.
	ErrorTypeClientError = "client_error"
)
