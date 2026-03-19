package mcp

import (
	"errors"
	"fmt"

	v2 "github.com/mark3labs/x402-go/v2"
)

// MCP-specific error types
//
// This package uses root v2 errors where possible and only defines
// MCP-specific errors that don't have equivalents in the root package.
//
// Error mapping to v2 package:
// - ErrNoMatchingSigner -> v2.ErrNoValidSigner
// - ErrPaymentRejected -> v2.ErrVerificationFailed
// - ErrSettlementFailed -> v2.ErrSettlementFailed
// - ErrFacilitatorUnavailable -> v2.ErrFacilitatorUnavailable
// - ErrInsufficientBalance -> v2.ErrAmountExceeded

var (
	// ErrPaymentRequired indicates that a payment is required to access the resource (MCP-specific 402 signaling)
	ErrPaymentRequired = errors.New("payment required")

	// ErrNoPaymentRequirements indicates that no payment requirements were found in the 402 error
	ErrNoPaymentRequirements = errors.New("no payment requirements in 402 error")

	// ErrSessionTerminated indicates that the MCP session has ended
	ErrSessionTerminated = errors.New("mcp session terminated")

	// ErrInvalidRequest indicates that the MCP request is malformed
	ErrInvalidRequest = errors.New("invalid mcp request")

	// ErrToolNotFound indicates that the requested tool does not exist
	ErrToolNotFound = errors.New("tool not found")

	// ErrToolExecutionFailed indicates that the tool handler returned an error
	ErrToolExecutionFailed = errors.New("tool execution failed")

	// ErrVerificationTimeout indicates that payment verification took too long
	ErrVerificationTimeout = errors.New("payment verification timeout")

	// ErrSettlementTimeout indicates that payment settlement took too long
	ErrSettlementTimeout = errors.New("payment settlement timeout")
)

// PaymentError wraps an x402 v2 error with MCP-specific context
type PaymentError struct {
	Err      error
	Tool     string
	Resource string
	Context  string
}

func (e *PaymentError) Error() string {
	if e.Tool != "" {
		return fmt.Sprintf("payment error for tool %s: %v", e.Tool, e.Err)
	}
	if e.Resource != "" {
		return fmt.Sprintf("payment error for resource %s: %v", e.Resource, e.Err)
	}
	if e.Context != "" {
		return fmt.Sprintf("payment error (%s): %v", e.Context, e.Err)
	}
	return fmt.Sprintf("payment error: %v", e.Err)
}

func (e *PaymentError) Unwrap() error {
	return e.Err
}

// WrapX402Error wraps an x402 v2 error as a PaymentError
func WrapX402Error(err error, tool string) error {
	if err == nil {
		return nil
	}
	return &PaymentError{
		Err:  err,
		Tool: tool,
	}
}

// IsPaymentError checks if an error is payment-related
func IsPaymentError(err error) bool {
	if err == nil {
		return false
	}
	var paymentErr *PaymentError
	return errors.As(err, &paymentErr) ||
		// MCP-specific errors
		errors.Is(err, ErrPaymentRequired) ||
		errors.Is(err, ErrNoPaymentRequirements) ||
		errors.Is(err, ErrVerificationTimeout) ||
		errors.Is(err, ErrSettlementTimeout) ||
		// Root v2 errors
		errors.Is(err, v2.ErrNoValidSigner) ||
		errors.Is(err, v2.ErrSigningFailed) ||
		errors.Is(err, v2.ErrVerificationFailed) ||
		errors.Is(err, v2.ErrSettlementFailed) ||
		errors.Is(err, v2.ErrFacilitatorUnavailable) ||
		errors.Is(err, v2.ErrAmountExceeded) ||
		errors.Is(err, v2.ErrInvalidRequirements) ||
		errors.Is(err, v2.ErrMalformedHeader)
}
