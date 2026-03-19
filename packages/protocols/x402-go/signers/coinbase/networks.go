package coinbase

import (
	"fmt"
	"math/big"

	"github.com/mark3labs/x402-go"
)

// NetworkType represents the blockchain type for network-specific logic.
type NetworkType int

const (
	// NetworkTypeUnknown represents an unknown or unsupported network type.
	NetworkTypeUnknown NetworkType = iota
	// NetworkTypeEVM represents Ethereum Virtual Machine compatible networks.
	NetworkTypeEVM
	// NetworkTypeSVM represents Solana Virtual Machine compatible networks.
	NetworkTypeSVM
)

// String returns a human-readable representation of the NetworkType.
func (nt NetworkType) String() string {
	switch nt {
	case NetworkTypeEVM:
		return "EVM"
	case NetworkTypeSVM:
		return "SVM"
	default:
		return "Unknown"
	}
}

// networkMapping defines the relationship between x402 network names and CDP network identifiers.
var networkMapping = map[string]struct {
	cdpNetwork  string
	networkType NetworkType
	chainID     *big.Int // nil for non-EVM networks
}{
	// EVM Networks
	"base": {
		cdpNetwork:  "base-mainnet",
		networkType: NetworkTypeEVM,
		chainID:     big.NewInt(8453),
	},
	"base-sepolia": {
		cdpNetwork:  "base-sepolia",
		networkType: NetworkTypeEVM,
		chainID:     big.NewInt(84532),
	},
	"ethereum": {
		cdpNetwork:  "ethereum-mainnet",
		networkType: NetworkTypeEVM,
		chainID:     big.NewInt(1),
	},
	"sepolia": {
		cdpNetwork:  "sepolia",
		networkType: NetworkTypeEVM,
		chainID:     big.NewInt(11155111),
	},
	// SVM Networks - Solana mainnet aliases
	"solana": {
		cdpNetwork:  "solana-mainnet",
		networkType: NetworkTypeSVM,
		chainID:     nil,
	},
	"mainnet-beta": {
		cdpNetwork:  "solana-mainnet",
		networkType: NetworkTypeSVM,
		chainID:     nil,
	},
	// SVM Networks - Solana devnet aliases
	"solana-devnet": {
		cdpNetwork:  "solana-devnet",
		networkType: NetworkTypeSVM,
		chainID:     nil,
	},
	"devnet": {
		cdpNetwork:  "solana-devnet",
		networkType: NetworkTypeSVM,
		chainID:     nil,
	},
}

// getCDPNetwork maps an x402 network name to a CDP network identifier.
//
// This function translates network names used in the x402 payment protocol
// to the corresponding network identifiers expected by the Coinbase Developer
// Platform API.
//
// Supported networks:
//   - EVM: base, base-sepolia, ethereum, sepolia
//   - SVM: solana, mainnet-beta, solana-devnet, devnet
//
// Returns an error if the network is not supported.
func getCDPNetwork(x402Network string) (string, error) {
	mapping, ok := networkMapping[x402Network]
	if !ok {
		return "", fmt.Errorf("%w: %s", x402.ErrInvalidNetwork, x402Network)
	}
	return mapping.cdpNetwork, nil
}

// getNetworkType determines the blockchain type (EVM or SVM) for a given x402 network name.
//
// This function is used to select the appropriate signing logic and API endpoints:
//   - NetworkTypeEVM: Use EIP-712 typed data signing via /evm/accounts endpoints
//   - NetworkTypeSVM: Use Solana transaction signing via /solana/accounts endpoints
//   - NetworkTypeUnknown: Network not supported or unrecognized
//
// Returns NetworkTypeUnknown for unsupported networks.
func getNetworkType(x402Network string) NetworkType {
	mapping, ok := networkMapping[x402Network]
	if !ok {
		return NetworkTypeUnknown
	}
	return mapping.networkType
}

// getChainID returns the EVM chain ID for a given x402 network name.
//
// Chain IDs are required for EVM networks to construct EIP-712 typed data
// structures and prevent cross-chain replay attacks.
//
// Returns an error if:
//   - The network is not supported
//   - The network is not an EVM network (SVM networks have no chain ID)
//
// Supported EVM networks and their chain IDs:
//   - base: 8453
//   - base-sepolia: 84532
//   - ethereum: 1
//   - sepolia: 11155111
func getChainID(x402Network string) (*big.Int, error) {
	mapping, ok := networkMapping[x402Network]
	if !ok {
		return nil, fmt.Errorf("%w: %s", x402.ErrInvalidNetwork, x402Network)
	}
	if mapping.networkType != NetworkTypeEVM {
		return nil, fmt.Errorf("network %s is not an EVM network", x402Network)
	}
	if mapping.chainID == nil {
		return nil, fmt.Errorf("chain ID not configured for network %s", x402Network)
	}
	// Return a copy to prevent mutation of the shared mapping
	return new(big.Int).Set(mapping.chainID), nil
}
