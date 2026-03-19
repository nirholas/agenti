// Package validation provides validation utilities for x402 v2 payment data.
// It validates addresses, amounts, networks (CAIP-2 format), and payment structures.
package validation

import (
	"fmt"
	"math/big"
	"net/url"
	"regexp"

	v2 "github.com/mark3labs/x402-go/v2"
)

var (
	// evmAddressRegex matches Ethereum-style addresses (0x followed by 40 hex chars)
	evmAddressRegex = regexp.MustCompile(`^0x[a-fA-F0-9]{40}$`)

	// solanaAddressRegex matches Solana base58 addresses (32-44 chars, base58 charset)
	solanaAddressRegex = regexp.MustCompile(`^[1-9A-HJ-NP-Za-km-z]{32,44}$`)

	// caip2Regex matches CAIP-2 network identifiers (namespace:reference)
	caip2Regex = regexp.MustCompile(`^[a-z0-9]+:[a-zA-Z0-9]+$`)
)

// ValidateAmount validates that an amount string is a valid non-negative integer.
// Zero amounts are allowed for free-with-signature authorization flows.
// Returns an error if the amount is empty, malformed, or negative.
func ValidateAmount(amount string) error {
	if amount == "" {
		return fmt.Errorf("amount cannot be empty")
	}

	// Parse as big.Int to handle large values
	amt := new(big.Int)
	amt, ok := amt.SetString(amount, 10)
	if !ok {
		return fmt.Errorf("invalid amount format: %s", amount)
	}

	if amt.Sign() < 0 {
		return fmt.Errorf("amount cannot be negative, got: %s", amount)
	}

	return nil
}

// ValidateNetwork validates a CAIP-2 network identifier.
// Returns an error if the network is empty or not in valid CAIP-2 format.
func ValidateNetwork(network string) error {
	if network == "" {
		return fmt.Errorf("network cannot be empty")
	}

	if !caip2Regex.MatchString(network) {
		return fmt.Errorf("invalid CAIP-2 network format: %s (expected namespace:reference)", network)
	}

	// Use the v2 package's ValidateNetwork for full validation
	_, err := v2.ValidateNetwork(network)
	return err
}

// ValidateAddress validates an address based on the network type.
// It uses ValidateNetwork to determine the network type and then applies
// network-specific address validation rules.
func ValidateAddress(address string, network string) error {
	if address == "" {
		return fmt.Errorf("address cannot be empty")
	}

	networkType, err := v2.ValidateNetwork(network)
	if err != nil {
		return fmt.Errorf("cannot validate address: %w", err)
	}

	switch networkType {
	case v2.NetworkTypeEVM:
		if !evmAddressRegex.MatchString(address) {
			return fmt.Errorf("invalid EVM address format: %s (expected 0x followed by 40 hex characters)", address)
		}
		return nil

	case v2.NetworkTypeSVM:
		if !solanaAddressRegex.MatchString(address) {
			return fmt.Errorf("invalid Solana address format: %s (expected base58 string 32-44 chars)", address)
		}
		return nil

	default:
		return fmt.Errorf("unsupported network type for address validation: %d", networkType)
	}
}

// ValidateResourceInfo validates a ResourceInfo structure.
// The URL field is required and must be a valid URL.
func ValidateResourceInfo(resource v2.ResourceInfo) error {
	if resource.URL == "" {
		return fmt.Errorf("resource URL cannot be empty")
	}

	// Validate URL format
	if _, err := url.Parse(resource.URL); err != nil {
		return fmt.Errorf("invalid resource URL: %w", err)
	}

	return nil
}

// ValidatePaymentRequirements performs comprehensive validation of payment requirements.
// It validates the amount, network, addresses, scheme, and other required fields.
func ValidatePaymentRequirements(req v2.PaymentRequirements) error {
	// Validate amount (allow zero for free-with-signature flows)
	if err := ValidateAmount(req.Amount); err != nil {
		return fmt.Errorf("invalid requirements: %w", err)
	}

	// Validate network (CAIP-2 format)
	if err := ValidateNetwork(req.Network); err != nil {
		return fmt.Errorf("invalid requirements: %w", err)
	}

	// Validate recipient address
	if err := ValidateAddress(req.PayTo, req.Network); err != nil {
		return fmt.Errorf("invalid requirements: payTo %w", err)
	}

	// Validate asset address (required)
	if req.Asset == "" {
		return fmt.Errorf("invalid requirements: asset address cannot be empty")
	}

	if err := ValidateAddress(req.Asset, req.Network); err != nil {
		return fmt.Errorf("invalid requirements: asset %w", err)
	}

	// Validate scheme
	switch req.Scheme {
	case "exact":
		// Valid scheme for v2
	case "":
		return fmt.Errorf("invalid requirements: scheme cannot be empty")
	default:
		return fmt.Errorf("invalid requirements: unsupported scheme %s", req.Scheme)
	}

	// Validate timeout (must be non-negative)
	if req.MaxTimeoutSeconds < 0 {
		return fmt.Errorf("invalid requirements: timeout cannot be negative: %d", req.MaxTimeoutSeconds)
	}

	// Validate EIP-3009 parameters for EVM chains
	networkType, _ := v2.ValidateNetwork(req.Network)
	if networkType == v2.NetworkTypeEVM && req.Extra != nil {
		if name, ok := req.Extra["name"].(string); ok {
			if name == "" {
				return fmt.Errorf("invalid requirements: EIP-3009 name cannot be empty")
			}
		}
		if version, ok := req.Extra["version"].(string); ok {
			if version == "" {
				return fmt.Errorf("invalid requirements: EIP-3009 version cannot be empty")
			}
		}
	}

	return nil
}

// ValidatePaymentPayload validates a payment payload structure.
// It checks the version, accepted requirements, and payload fields.
func ValidatePaymentPayload(payload v2.PaymentPayload) error {
	if payload.X402Version != v2.X402Version {
		return fmt.Errorf("unsupported x402 version: %d (expected %d)", payload.X402Version, v2.X402Version)
	}

	// Validate accepted requirements
	if payload.Accepted.Scheme == "" {
		return fmt.Errorf("accepted scheme cannot be empty")
	}

	if payload.Accepted.Network == "" {
		return fmt.Errorf("accepted network cannot be empty")
	}

	if _, err := v2.ValidateNetwork(payload.Accepted.Network); err != nil {
		return fmt.Errorf("invalid accepted network: %w", err)
	}

	if payload.Payload == nil {
		return fmt.Errorf("payload cannot be nil")
	}

	// Validate resource if present
	if payload.Resource != nil {
		if err := ValidateResourceInfo(*payload.Resource); err != nil {
			return fmt.Errorf("invalid resource: %w", err)
		}
	}

	return nil
}

// ValidatePaymentRequired validates a complete 402 response structure.
func ValidatePaymentRequired(pr v2.PaymentRequired) error {
	if pr.X402Version != v2.X402Version {
		return fmt.Errorf("unsupported x402 version: %d (expected %d)", pr.X402Version, v2.X402Version)
	}

	// Resource is optional but if present, must be valid
	if pr.Resource != nil {
		if err := ValidateResourceInfo(*pr.Resource); err != nil {
			return fmt.Errorf("invalid payment required: %w", err)
		}
	}

	if len(pr.Accepts) == 0 {
		return fmt.Errorf("invalid payment required: accepts cannot be empty")
	}

	for i, req := range pr.Accepts {
		if err := ValidatePaymentRequirements(req); err != nil {
			return fmt.Errorf("invalid payment required: accepts[%d] %w", i, err)
		}
	}

	return nil
}
