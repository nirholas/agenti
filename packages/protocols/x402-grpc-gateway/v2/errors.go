package x402

import "fmt"

// PaymentError represents an error related to payment processing.
type PaymentError struct {
	Code    string
	Message string
	Cause   error
}

func (e *PaymentError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s (caused by: %v)", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *PaymentError) Unwrap() error {
	return e.Cause
}

// Error codes.
const (
	ErrCodeInvalidPayment     = "INVALID_PAYMENT"
	ErrCodeVerificationFailed = "VERIFICATION_FAILED"
	ErrCodeSettlementFailed   = "SETTLEMENT_FAILED"
	ErrCodeInvalidConfig      = "INVALID_CONFIG"
	ErrCodeNetworkNotSupported = "NETWORK_NOT_SUPPORTED"
	ErrCodeInsufficientAmount = "INSUFFICIENT_AMOUNT"
	ErrCodeExpiredPayment     = "EXPIRED_PAYMENT"
)

// NewPaymentError creates a new PaymentError.
func NewPaymentError(code, message string, cause error) *PaymentError {
	return &PaymentError{
		Code:    code,
		Message: message,
		Cause:   cause,
	}
}

// IsPaymentError checks if an error is a PaymentError.
func IsPaymentError(err error) bool {
	_, ok := err.(*PaymentError)
	return ok
}

// GetPaymentErrorCode extracts the error code from a PaymentError.
func GetPaymentErrorCode(err error) string {
	if pe, ok := err.(*PaymentError); ok {
		return pe.Code
	}
	return ""
}
