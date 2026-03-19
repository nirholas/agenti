// Package x402 provides helper functions and constants for configuring x402 payments
// with USDC across multiple blockchain networks. This package simplifies client and
// middleware setup by providing verified USDC addresses, EIP-3009 parameters, and
// utility functions for creating payment requirements and token configurations.
//
// See quickstart.md in specs/003-helpers-constants/ for detailed examples and usage.
package x402

import (
	"fmt"
	"math"
	"strconv"
)

// NetworkType represents the blockchain virtual machine type.
type NetworkType int

const (
	// NetworkTypeUnknown represents an unrecognized network.
	NetworkTypeUnknown NetworkType = iota
	// NetworkTypeEVM represents Ethereum Virtual Machine chains.
	NetworkTypeEVM
	// NetworkTypeSVM represents Solana Virtual Machine chains.
	NetworkTypeSVM
)

// ChainConfig contains chain-specific configuration for USDC tokens and payment requirements.
// All USDC addresses and EIP-3009 parameters were verified on 2025-10-28.
type ChainConfig struct {
	// NetworkID is the x402 protocol network identifier (e.g., "base", "solana").
	NetworkID string

	// USDCAddress is the official Circle USDC contract address or mint address.
	USDCAddress string

	// Decimals is the number of decimal places for USDC (always 6).
	Decimals uint8

	// EIP3009Name is the EIP-3009 domain parameter "name" (empty for non-EVM chains).
	EIP3009Name string

	// EIP3009Version is the EIP-3009 domain parameter "version" (empty for non-EVM chains).
	EIP3009Version string
}

// USDCRequirementConfig is the configuration for creating a USDC PaymentRequirement.
// This is a convenience helper for USDC payments. For other tokens, construct
// PaymentRequirement directly.
type USDCRequirementConfig struct {
	// Chain is the chain configuration with USDC details (required).
	Chain ChainConfig

	// Amount is the human-readable USDC amount (e.g., "1.5" = 1.5 USDC).
	// Zero amounts ("0" or "0.0") are allowed for free-with-signature authorization flows.
	Amount string

	// RecipientAddress is the payment recipient address (required).
	RecipientAddress string

	// Description is a human-readable description of the payment (optional).
	Description string

	// Scheme is the payment scheme (optional, defaults to "exact").
	Scheme string

	// MaxTimeoutSeconds is the maximum payment timeout (optional, defaults to 300).
	MaxTimeoutSeconds uint32

	// MimeType is the response MIME type (optional, defaults to "application/json").
	MimeType string
}

// Mainnet chain configurations
var (
	// SolanaMainnet is the configuration for Solana mainnet.
	// USDC address verified 2025-10-28.
	SolanaMainnet = ChainConfig{
		NetworkID:      "solana",
		USDCAddress:    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
		Decimals:       6,
		EIP3009Name:    "",
		EIP3009Version: "",
	}

	// BaseMainnet is the configuration for Base mainnet.
	// USDC address and EIP-3009 parameters verified 2025-10-28.
	BaseMainnet = ChainConfig{
		NetworkID:      "base",
		USDCAddress:    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		Decimals:       6,
		EIP3009Name:    "USD Coin",
		EIP3009Version: "2",
	}

	// PolygonMainnet is the configuration for Polygon PoS mainnet.
	// USDC address and EIP-3009 parameters verified 2025-10-28.
	PolygonMainnet = ChainConfig{
		NetworkID:      "polygon",
		USDCAddress:    "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
		Decimals:       6,
		EIP3009Name:    "USD Coin",
		EIP3009Version: "2",
	}

	// AvalancheMainnet is the configuration for Avalanche C-Chain mainnet.
	// USDC address and EIP-3009 parameters verified 2025-10-28.
	AvalancheMainnet = ChainConfig{
		NetworkID:      "avalanche",
		USDCAddress:    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
		Decimals:       6,
		EIP3009Name:    "USD Coin",
		EIP3009Version: "2",
	}
)

// Testnet chain configurations
var (
	// SolanaDevnet is the configuration for Solana devnet.
	// USDC address verified 2025-10-28.
	SolanaDevnet = ChainConfig{
		NetworkID:      "solana-devnet",
		USDCAddress:    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
		Decimals:       6,
		EIP3009Name:    "",
		EIP3009Version: "",
	}

	// BaseSepolia is the configuration for Base Sepolia testnet.
	// USDC address and EIP-3009 parameters verified 2025-10-30 via on-chain contract read.
	BaseSepolia = ChainConfig{
		NetworkID:      "base-sepolia",
		USDCAddress:    "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
		Decimals:       6,
		EIP3009Name:    "USDC",
		EIP3009Version: "2",
	}

	// PolygonAmoy is the configuration for Polygon Amoy testnet.
	// USDC address and EIP-3009 parameters verified 2025-10-28.
	PolygonAmoy = ChainConfig{
		NetworkID:      "polygon-amoy",
		USDCAddress:    "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
		Decimals:       6,
		EIP3009Name:    "USDC",
		EIP3009Version: "2",
	}

	// AvalancheFuji is the configuration for Avalanche Fuji testnet.
	// USDC address and EIP-3009 parameters verified 2025-10-28.
	AvalancheFuji = ChainConfig{
		NetworkID:      "avalanche-fuji",
		USDCAddress:    "0x5425890298aed601595a70AB815c96711a31Bc65",
		Decimals:       6,
		EIP3009Name:    "USD Coin",
		EIP3009Version: "2",
	}
)

// NewUSDCTokenConfig creates a TokenConfig for USDC on the given chain with the specified priority.
// This is a convenience helper for USDC. For other tokens, construct TokenConfig directly.
// The returned TokenConfig has:
//   - Address set to the chain's USDC address
//   - Symbol set to "USDC"
//   - Decimals set to 6
//   - Priority set to the provided value (lower numbers = higher priority)
func NewUSDCTokenConfig(chain ChainConfig, priority int) TokenConfig {
	return TokenConfig{
		Address:  chain.USDCAddress,
		Symbol:   "USDC",
		Decimals: 6,
		Priority: priority,
	}
}

// NewUSDCPaymentRequirement creates a PaymentRequirement for USDC from the given configuration.
// This is a convenience helper for USDC payments. For other tokens, construct PaymentRequirement directly.
// It validates inputs, converts the amount to atomic units (assuming 6 decimals for USDC),
// applies defaults for optional fields, and populates EIP-3009 parameters for EVM chains.
//
// Amount conversion uses standard float64 rounding (banker's rounding) for precision beyond 6 decimals.
// Zero amounts ("0" or "0.0") are explicitly allowed for free-with-signature authorization flows.
//
// Default values:
//   - Scheme: "exact"
//   - MaxTimeoutSeconds: 300
//   - MimeType: "application/json"
//
// Returns an error if validation fails. Error format: "parameterName: reason"
func NewUSDCPaymentRequirement(config USDCRequirementConfig) (PaymentRequirement, error) {
	// Validate recipient address
	if config.RecipientAddress == "" {
		return PaymentRequirement{}, fmt.Errorf("recipientAddress: cannot be empty")
	}

	// Parse and validate amount
	amount, err := strconv.ParseFloat(config.Amount, 64)
	if err != nil {
		return PaymentRequirement{}, fmt.Errorf("amount: invalid format")
	}
	if amount < 0 {
		return PaymentRequirement{}, fmt.Errorf("amount: must be non-negative")
	}

	// Convert to atomic units (USDC always has 6 decimals)
	atomicUnits := uint64(math.RoundToEven(amount * 1e6))
	atomicString := strconv.FormatUint(atomicUnits, 10)

	// Apply defaults
	scheme := config.Scheme
	if scheme == "" {
		scheme = "exact"
	}

	maxTimeout := config.MaxTimeoutSeconds
	if maxTimeout == 0 {
		maxTimeout = 300
	}

	mimeType := config.MimeType
	if mimeType == "" {
		mimeType = "application/json"
	}

	// Create base payment requirement
	req := PaymentRequirement{
		Scheme:            scheme,
		Network:           config.Chain.NetworkID,
		MaxAmountRequired: atomicString,
		Asset:             config.Chain.USDCAddress,
		PayTo:             config.RecipientAddress,
		Description:       config.Description,
		MimeType:          mimeType,
		MaxTimeoutSeconds: int(maxTimeout),
	}

	// Populate EIP-3009 extra field for EVM chains
	if config.Chain.EIP3009Name != "" {
		req.Extra = map[string]interface{}{
			"name":    config.Chain.EIP3009Name,
			"version": config.Chain.EIP3009Version,
		}
	}

	return req, nil
}

// ValidateNetwork validates a network identifier and returns its type.
// Returns NetworkTypeEVM for EVM chains, NetworkTypeSVM for Solana chains,
// or NetworkTypeUnknown with an error for unrecognized networks.
//
// Supported networks:
//   - EVM: base, base-sepolia, polygon, polygon-amoy, avalanche, avalanche-fuji
//   - SVM: solana, solana-devnet
func ValidateNetwork(networkID string) (NetworkType, error) {
	if networkID == "" {
		return NetworkTypeUnknown, fmt.Errorf("networkID: cannot be empty")
	}

	// Network type lookup map
	networkTypes := map[string]NetworkType{
		// EVM chains
		"base":           NetworkTypeEVM,
		"base-sepolia":   NetworkTypeEVM,
		"polygon":        NetworkTypeEVM,
		"polygon-amoy":   NetworkTypeEVM,
		"avalanche":      NetworkTypeEVM,
		"avalanche-fuji": NetworkTypeEVM,
		// SVM chains
		"solana":        NetworkTypeSVM,
		"solana-devnet": NetworkTypeSVM,
	}

	netType, ok := networkTypes[networkID]
	if !ok {
		return NetworkTypeUnknown, fmt.Errorf("networkID: unsupported network")
	}

	return netType, nil
}
