package x402

import (
	"errors"
	"fmt"
)

var (
	// Payment errors
	ErrPaymentRequired     = errors.New("payment required")
	ErrNoAcceptablePayment = errors.New("no acceptable payment method found")
	ErrSigningFailed       = errors.New("failed to sign payment")
	ErrInvalidPaymentReqs  = errors.New("invalid payment requirements")

	// Network errors
	ErrUnsupportedNetwork = errors.New("unsupported network")
	ErrUnsupportedAsset   = errors.New("unsupported asset")

	// Signer errors
	ErrInvalidPrivateKey     = errors.New("invalid private key")
	ErrInvalidMnemonic       = errors.New("invalid mnemonic phrase")
	ErrInvalidKeystore       = errors.New("invalid keystore file")
	ErrWrongPassword         = errors.New("wrong keystore password")
	ErrNoSignerConfigured    = errors.New("no payment signer configured")
	ErrNoViablePaymentOption = errors.New("no viable payment option found across all signers")
)

// PaymentError provides detailed payment error information
type PaymentError struct {
	Code     string
	Message  string
	Resource string
	Amount   string
	Network  string
	Wrapped  error
}

// Error returns the formatted error message
func (e *PaymentError) Error() string {
	if e.Wrapped != nil {
		return fmt.Sprintf("%s: %s (resource: %s, amount: %s, network: %s): %v",
			e.Code, e.Message, e.Resource, e.Amount, e.Network, e.Wrapped)
	}
	return fmt.Sprintf("%s: %s (resource: %s, amount: %s, network: %s)",
		e.Code, e.Message, e.Resource, e.Amount, e.Network)
}

// Unwrap returns the underlying wrapped error
func (e *PaymentError) Unwrap() error {
	return e.Wrapped
}

// NewPaymentError creates a new PaymentError
func NewPaymentError(code, message, resource, amount, network string, wrapped error) *PaymentError {
	return &PaymentError{
		Code:     code,
		Message:  message,
		Resource: resource,
		Amount:   amount,
		Network:  network,
		Wrapped:  wrapped,
	}
}

// SignerFailure represents a single signer's failure details
type SignerFailure struct {
	SignerIndex    int
	SignerPriority int
	SignerAddress  string
	Reason         string
	WrappedError   error
}

// MultiSignerError aggregates failures from multiple signers
type MultiSignerError struct {
	Message        string
	SignerFailures []SignerFailure
}

// Error returns the formatted error message with details from all signer failures
func (e *MultiSignerError) Error() string {
	var result string
	result = e.Message
	result += fmt.Sprintf(" across %d signers:\n", len(e.SignerFailures))
	for _, failure := range e.SignerFailures {
		result += fmt.Sprintf("  Signer[%d] (priority=%d, address=%s): %s\n",
			failure.SignerIndex, failure.SignerPriority, failure.SignerAddress, failure.Reason)
	}
	return result
}

// Unwrap returns the first signer's wrapped error if available
func (e *MultiSignerError) Unwrap() error {
	if len(e.SignerFailures) > 0 && e.SignerFailures[0].WrappedError != nil {
		return e.SignerFailures[0].WrappedError
	}
	return nil
}
