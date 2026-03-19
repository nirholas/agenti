package caddyx402

import "errors"

var (
	errMissingPayTo         = errors.New("x402: pay_to is required")
	errInvalidPayTo         = errors.New("x402: pay_to must be a valid EVM address (0x + 40 hex chars)")
	errMissingPrice         = errors.New("x402: price is required")
	errUnsupportedNetwork   = errors.New("x402: unsupported network (supported: base, base-sepolia)")
	errInsecureFacilitator  = errors.New("x402: facilitator_url must use HTTPS (HTTP allowed only for localhost)")
	errInvalidMaxTimeout    = errors.New("x402: max_timeout must be a positive integer")
	errPaymentHeaderTooLarge = errors.New("x402: X-PAYMENT header exceeds maximum size")
)
