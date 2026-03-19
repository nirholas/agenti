package v2

import "errors"

// Sentinel errors for x402 v2 payment operations.
var (
	// ErrNoValidSigner indicates no signer can satisfy the payment requirements.
	ErrNoValidSigner = errors.New("x402: no signer can satisfy payment requirements")

	// ErrAmountExceeded indicates the payment amount exceeds the per-call limit.
	ErrAmountExceeded = errors.New("x402: payment amount exceeds per-call limit")

	// ErrInvalidRequirements indicates the payment requirements from the server are invalid.
	ErrInvalidRequirements = errors.New("x402: invalid payment requirements")

	// ErrSigningFailed indicates the payment signing operation failed.
	ErrSigningFailed = errors.New("x402: payment signing failed")

	// ErrNetworkError indicates a network error occurred during payment.
	ErrNetworkError = errors.New("x402: network error during payment")

	// ErrInvalidAmount indicates an invalid amount string.
	ErrInvalidAmount = errors.New("x402: invalid amount")

	// ErrInvalidKey indicates an invalid private key.
	ErrInvalidKey = errors.New("x402: invalid private key")

	// ErrInvalidNetwork indicates an unsupported network.
	ErrInvalidNetwork = errors.New("x402: invalid or unsupported network")

	// ErrInvalidToken indicates invalid token configuration.
	ErrInvalidToken = errors.New("x402: invalid token configuration")

	// ErrInvalidKeystore indicates an invalid or corrupted keystore file.
	ErrInvalidKeystore = errors.New("x402: invalid keystore file")

	// ErrInvalidMnemonic indicates an invalid BIP39 mnemonic phrase.
	ErrInvalidMnemonic = errors.New("x402: invalid mnemonic phrase")

	// ErrNoTokens indicates no tokens are configured for the signer.
	ErrNoTokens = errors.New("x402: no tokens configured")

	// ErrFacilitatorUnavailable indicates the facilitator service is unavailable.
	ErrFacilitatorUnavailable = errors.New("x402: facilitator service unavailable")

	// ErrVerificationFailed indicates payment verification failed.
	ErrVerificationFailed = errors.New("x402: payment verification failed")

	// ErrSettlementFailed indicates payment settlement failed.
	ErrSettlementFailed = errors.New("x402: payment settlement failed")

	// ErrMalformedHeader indicates the X-PAYMENT header is malformed.
	ErrMalformedHeader = errors.New("x402: malformed payment header")

	// ErrUnsupportedVersion indicates an unsupported x402 protocol version.
	ErrUnsupportedVersion = errors.New("x402: unsupported protocol version")

	// ErrUnsupportedScheme indicates an unsupported payment scheme.
	ErrUnsupportedScheme = errors.New("x402: unsupported payment scheme")
)

// ErrorCode represents payment error codes for programmatic handling.
type ErrorCode string

const (
	// ErrCodeNoValidSigner indicates no signer can satisfy requirements.
	ErrCodeNoValidSigner ErrorCode = "NO_VALID_SIGNER"

	// ErrCodeAmountExceeded indicates payment exceeds limits.
	ErrCodeAmountExceeded ErrorCode = "AMOUNT_EXCEEDED"

	// ErrCodeInvalidRequirements indicates invalid server requirements.
	ErrCodeInvalidRequirements ErrorCode = "INVALID_REQUIREMENTS"

	// ErrCodeSigningFailed indicates signing operation failed.
	ErrCodeSigningFailed ErrorCode = "SIGNING_FAILED"

	// ErrCodeNetworkError indicates network communication error.
	ErrCodeNetworkError ErrorCode = "NETWORK_ERROR"

	// ErrCodeUnsupportedScheme indicates unsupported payment scheme or network.
	ErrCodeUnsupportedScheme ErrorCode = "UNSUPPORTED_SCHEME"

	// ErrCodeUnsupportedVersion indicates unsupported x402 protocol version.
	ErrCodeUnsupportedVersion ErrorCode = "UNSUPPORTED_VERSION"
)

// PaymentError provides structured error information.
type PaymentError struct {
	// Code is the error code for programmatic handling.
	Code ErrorCode

	// Message is the human-readable error message.
	Message string

	// Details contains additional error context.
	Details map[string]interface{}

	// Err is the underlying error.
	Err error
}

// Error implements the error interface.
func (e *PaymentError) Error() string {
	if e.Err != nil {
		return e.Message + ": " + e.Err.Error()
	}
	return e.Message
}

// Unwrap returns the underlying error.
func (e *PaymentError) Unwrap() error {
	return e.Err
}

// NewPaymentError creates a new PaymentError with the given code and message.
func NewPaymentError(code ErrorCode, message string, err error) *PaymentError {
	return &PaymentError{
		Code:    code,
		Message: message,
		Err:     err,
		Details: make(map[string]interface{}),
	}
}

// WithDetails adds additional context to the error.
// Lazily initializes the Details map if nil.
func (e *PaymentError) WithDetails(key string, value interface{}) *PaymentError {
	if e.Details == nil {
		e.Details = make(map[string]interface{})
	}
	e.Details[key] = value
	return e
}
