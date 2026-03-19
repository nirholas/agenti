package v2

import "time"

// PaymentEventType represents the type of payment event.
type PaymentEventType string

const (
	// PaymentEventAttempt indicates a payment is being attempted.
	PaymentEventAttempt PaymentEventType = "attempt"

	// PaymentEventSuccess indicates a payment succeeded.
	PaymentEventSuccess PaymentEventType = "success"

	// PaymentEventFailure indicates a payment failed.
	PaymentEventFailure PaymentEventType = "failure"
)

// PaymentEvent represents a payment lifecycle event.
// This type is used by both HTTP and MCP packages to provide consistent
// payment event notifications for logging, monitoring, and debugging.
type PaymentEvent struct {
	// Type is the event type (attempt, success, failure).
	Type PaymentEventType

	// Timestamp is when the event occurred.
	Timestamp time.Time

	// Method is the transport method ("HTTP" or "MCP").
	Method string

	// Tool is the MCP tool/resource being accessed (MCP only).
	Tool string

	// URL is the HTTP URL being accessed (HTTP only).
	URL string

	// Amount is the payment amount in atomic units.
	Amount string

	// Asset is the token/asset address or identifier.
	Asset string

	// Network is the blockchain network identifier (CAIP-2 format).
	Network string

	// Scheme is the payment scheme (e.g., "exact").
	Scheme string

	// Recipient is the payment recipient address.
	Recipient string

	// Payer is the address that made the payment (available on success).
	Payer string

	// Transaction is the blockchain transaction hash (available on success).
	Transaction string

	// Error contains error details (available on failure).
	Error error

	// Duration is the time taken for the payment operation.
	Duration time.Duration

	// Metadata contains additional context-specific information.
	Metadata map[string]interface{}
}

// PaymentCallback is a function that handles payment events.
// Callbacks are invoked synchronously during payment processing, so they
// should be fast to avoid blocking the payment flow. For longer operations,
// consider using goroutines within the callback.
type PaymentCallback func(PaymentEvent)
