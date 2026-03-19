package types

import "errors"

var (
	ErrInvalidPayloadFormat = errors.New("invalid_payload_format")
	ErrIncompatibleScheme   = errors.New("incompatible_payload_scheme")
	ErrNetworkMismatch      = errors.New("network_mismatch")
	ErrInvalidNetwork       = errors.New("invalid_network")
	ErrNetworkIDMismatch    = errors.New("network_id_mismatch")
	ErrInvalidSignature     = errors.New("invalid_signature")
	ErrInvalidToken         = errors.New("invalid_token")
	ErrTokenMismatch        = errors.New("token_mismatch")
	ErrInsufficientBalance  = errors.New("insufficient_balance")
)
