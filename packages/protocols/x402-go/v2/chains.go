package v2

import (
	"fmt"
	"strconv"
	"strings"
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

// CAIP-2 network identifiers
const (
	// EVM Mainnets
	NetworkBase      = "eip155:8453"
	NetworkPolygon   = "eip155:137"
	NetworkAvalanche = "eip155:43114"
	NetworkEthereum  = "eip155:1"

	// EVM Testnets
	NetworkBaseSepolia   = "eip155:84532"
	NetworkPolygonAmoy   = "eip155:80002"
	NetworkAvalancheFuji = "eip155:43113"
	NetworkSepolia       = "eip155:11155111"

	// Solana networks (using genesis hash as reference per CAIP-2)
	NetworkSolanaMainnet = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
	NetworkSolanaDevnet  = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
)

// ChainConfig holds configuration for a specific blockchain.
type ChainConfig struct {
	// Network is the CAIP-2 network identifier.
	Network string

	// USDCAddress is the official Circle USDC contract or mint address.
	USDCAddress string

	// Decimals is the number of decimal places for USDC (always 6).
	Decimals uint8

	// EIP3009Name is the EIP-3009 domain parameter "name" (empty for non-EVM chains).
	EIP3009Name string

	// EIP3009Version is the EIP-3009 domain parameter "version" (empty for non-EVM chains).
	EIP3009Version string
}

// Predefined chain configurations - EVM Mainnets
var (
	// BaseMainnet is the configuration for Base mainnet.
	// USDC address and EIP-3009 parameters verified 2025-10-28.
	BaseMainnet = ChainConfig{
		Network:        NetworkBase,
		USDCAddress:    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		Decimals:       6,
		EIP3009Name:    "USD Coin",
		EIP3009Version: "2",
	}

	// PolygonMainnet is the configuration for Polygon PoS mainnet.
	// USDC address and EIP-3009 parameters verified 2025-10-28.
	PolygonMainnet = ChainConfig{
		Network:        NetworkPolygon,
		USDCAddress:    "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
		Decimals:       6,
		EIP3009Name:    "USD Coin",
		EIP3009Version: "2",
	}

	// AvalancheMainnet is the configuration for Avalanche C-Chain mainnet.
	// USDC address and EIP-3009 parameters verified 2025-10-28.
	AvalancheMainnet = ChainConfig{
		Network:        NetworkAvalanche,
		USDCAddress:    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
		Decimals:       6,
		EIP3009Name:    "USD Coin",
		EIP3009Version: "2",
	}

	// EthereumMainnet is the configuration for Ethereum mainnet.
	// USDC address and EIP-3009 parameters verified 2025-10-28.
	EthereumMainnet = ChainConfig{
		Network:        NetworkEthereum,
		USDCAddress:    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
		Decimals:       6,
		EIP3009Name:    "USD Coin",
		EIP3009Version: "2",
	}
)

// Predefined chain configurations - EVM Testnets
var (
	// BaseSepolia is the configuration for Base Sepolia testnet.
	// USDC address and EIP-3009 parameters verified 2025-10-30.
	BaseSepolia = ChainConfig{
		Network:        NetworkBaseSepolia,
		USDCAddress:    "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
		Decimals:       6,
		EIP3009Name:    "USDC",
		EIP3009Version: "2",
	}

	// PolygonAmoy is the configuration for Polygon Amoy testnet.
	// USDC address and EIP-3009 parameters verified 2025-10-28.
	PolygonAmoy = ChainConfig{
		Network:        NetworkPolygonAmoy,
		USDCAddress:    "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
		Decimals:       6,
		EIP3009Name:    "USDC",
		EIP3009Version: "2",
	}

	// AvalancheFuji is the configuration for Avalanche Fuji testnet.
	// USDC address and EIP-3009 parameters verified 2025-10-28.
	AvalancheFuji = ChainConfig{
		Network:        NetworkAvalancheFuji,
		USDCAddress:    "0x5425890298aed601595a70AB815c96711a31Bc65",
		Decimals:       6,
		EIP3009Name:    "USD Coin",
		EIP3009Version: "2",
	}

	// Sepolia is the configuration for Ethereum Sepolia testnet.
	// USDC address and EIP-3009 parameters verified 2025-10-28.
	Sepolia = ChainConfig{
		Network:        NetworkSepolia,
		USDCAddress:    "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
		Decimals:       6,
		EIP3009Name:    "USDC",
		EIP3009Version: "2",
	}
)

// Predefined chain configurations - Solana
var (
	// SolanaMainnet is the configuration for Solana mainnet.
	// USDC address verified 2025-10-28.
	SolanaMainnet = ChainConfig{
		Network:        NetworkSolanaMainnet,
		USDCAddress:    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
		Decimals:       6,
		EIP3009Name:    "",
		EIP3009Version: "",
	}

	// SolanaDevnet is the configuration for Solana devnet.
	// USDC address verified 2025-10-28.
	SolanaDevnet = ChainConfig{
		Network:        NetworkSolanaDevnet,
		USDCAddress:    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
		Decimals:       6,
		EIP3009Name:    "",
		EIP3009Version: "",
	}
)

// chainConfigByNetwork maps CAIP-2 network identifiers to chain configurations.
var chainConfigByNetwork = map[string]ChainConfig{
	// EVM Mainnets
	NetworkBase:      BaseMainnet,
	NetworkPolygon:   PolygonMainnet,
	NetworkAvalanche: AvalancheMainnet,
	NetworkEthereum:  EthereumMainnet,
	// EVM Testnets
	NetworkBaseSepolia:   BaseSepolia,
	NetworkPolygonAmoy:   PolygonAmoy,
	NetworkAvalancheFuji: AvalancheFuji,
	NetworkSepolia:       Sepolia,
	// Solana
	NetworkSolanaMainnet: SolanaMainnet,
	NetworkSolanaDevnet:  SolanaDevnet,
}

// GetChainConfig returns the chain configuration for a CAIP-2 network identifier.
// Returns an error if the network is not recognized.
func GetChainConfig(network string) (ChainConfig, error) {
	config, ok := chainConfigByNetwork[network]
	if !ok {
		return ChainConfig{}, fmt.Errorf("%w: %s", ErrInvalidNetwork, network)
	}
	return config, nil
}

// ValidateNetwork validates a CAIP-2 network identifier and returns its type.
// Returns NetworkTypeEVM for EIP-155 chains, NetworkTypeSVM for Solana chains,
// or NetworkTypeUnknown with an error for unrecognized networks.
func ValidateNetwork(network string) (NetworkType, error) {
	if network == "" {
		return NetworkTypeUnknown, fmt.Errorf("%w: network cannot be empty", ErrInvalidNetwork)
	}

	// Parse CAIP-2 format: namespace:reference
	parts := strings.SplitN(network, ":", 2)
	if len(parts) != 2 {
		return NetworkTypeUnknown, fmt.Errorf("%w: invalid CAIP-2 format: %s", ErrInvalidNetwork, network)
	}

	namespace := parts[0]
	reference := parts[1]

	if reference == "" {
		return NetworkTypeUnknown, fmt.Errorf("%w: missing network reference: %s", ErrInvalidNetwork, network)
	}

	switch namespace {
	case "eip155":
		// Validate that reference is a valid chain ID (numeric)
		if _, err := strconv.ParseInt(reference, 10, 64); err != nil {
			return NetworkTypeUnknown, fmt.Errorf("%w: invalid EIP-155 chain ID: %s", ErrInvalidNetwork, reference)
		}
		return NetworkTypeEVM, nil
	case "solana":
		// Validate that reference is a valid base58 genesis hash (32-44 chars)
		if len(reference) < 32 || len(reference) > 44 {
			return NetworkTypeUnknown, fmt.Errorf("%w: invalid Solana genesis hash length: %s", ErrInvalidNetwork, reference)
		}
		return NetworkTypeSVM, nil
	default:
		return NetworkTypeUnknown, fmt.Errorf("%w: unsupported namespace: %s", ErrInvalidNetwork, namespace)
	}
}

// GetChainID extracts the chain ID from a CAIP-2 EVM network identifier.
// Returns an error if the network is not an EVM network or has an invalid format.
func GetChainID(network string) (int64, error) {
	parts := strings.SplitN(network, ":", 2)
	if len(parts) != 2 {
		return 0, fmt.Errorf("%w: invalid CAIP-2 format: %s", ErrInvalidNetwork, network)
	}

	if parts[0] != "eip155" {
		return 0, fmt.Errorf("%w: not an EVM network: %s", ErrInvalidNetwork, network)
	}

	chainID, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%w: invalid chain ID: %s", ErrInvalidNetwork, parts[1])
	}

	return chainID, nil
}

// GetSolanaGenesisHash extracts the genesis hash from a CAIP-2 Solana network identifier.
// Returns an error if the network is not a Solana network.
func GetSolanaGenesisHash(network string) (string, error) {
	parts := strings.SplitN(network, ":", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("%w: invalid CAIP-2 format: %s", ErrInvalidNetwork, network)
	}

	if parts[0] != "solana" {
		return "", fmt.Errorf("%w: not a Solana network: %s", ErrInvalidNetwork, network)
	}

	return parts[1], nil
}

// NewUSDCTokenConfig creates a TokenConfig for USDC on the given chain with the specified priority.
// This is a convenience helper for USDC. For other tokens, construct TokenConfig directly.
func NewUSDCTokenConfig(chain ChainConfig, priority int) TokenConfig {
	return TokenConfig{
		Address:  chain.USDCAddress,
		Symbol:   "USDC",
		Decimals: 6,
		Priority: priority,
		Name:     "USD Coin",
	}
}
