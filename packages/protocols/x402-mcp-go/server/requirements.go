package server

import (
	"sync"

	"github.com/mark3labs/mcp-go-x402"
)

// Helper functions for common payment requirements with USDC on Base network

var (
	// supportedPaymentsCache stores supported payment info by network
	supportedPaymentsCache      = make(map[string]SupportedKind)
	supportedPaymentsCacheMutex sync.RWMutex
)

// SetSupportedPayments caches the supported payment methods from the facilitator
// This is called automatically when the server initializes
func SetSupportedPayments(supported []SupportedKind) {
	supportedPaymentsCacheMutex.Lock()
	defer supportedPaymentsCacheMutex.Unlock()

	for _, kind := range supported {
		supportedPaymentsCache[kind.Network] = kind
	}
}

// cloneStringMap creates a deep copy of a string map
func cloneStringMap(in map[string]string) map[string]string {
	if in == nil {
		return nil
	}
	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

// getExtraForNetwork retrieves cached extra data for a network
func getExtraForNetwork(network string) map[string]string {
	supportedPaymentsCacheMutex.RLock()
	defer supportedPaymentsCacheMutex.RUnlock()

	if kind, ok := supportedPaymentsCache[network]; ok {
		return cloneStringMap(kind.Extra)
	}
	return nil
}

// RequireUSDCBase creates a payment requirement for USDC on Base mainnet
func RequireUSDCBase(payTo, amount, description string) PaymentRequirement {
	return PaymentRequirement{
		Scheme:            "exact",
		Network:           "base",
		Asset:             x402.USDCAddressBase,
		PayTo:             payTo,
		MaxAmountRequired: amount,
		Description:       description,
		MimeType:          "application/json",
		MaxTimeoutSeconds: 60,
		Extra: map[string]string{
			"name":    "USD Coin",
			"version": "2",
		},
	}
}

// RequireUSDCBaseSepolia creates a payment requirement for USDC on Base Sepolia testnet
func RequireUSDCBaseSepolia(payTo, amount, description string) PaymentRequirement {
	return PaymentRequirement{
		Scheme:            "exact",
		Network:           "base-sepolia",
		Asset:             x402.USDCAddressBaseSepolia,
		PayTo:             payTo,
		MaxAmountRequired: amount,
		Description:       description,
		MimeType:          "application/json",
		MaxTimeoutSeconds: 60,
		Extra: map[string]string{
			"name":    "USDC",
			"version": "2",
		},
	}
}

// RequireUSDCPolygon creates a payment requirement for USDC on Polygon mainnet
func RequireUSDCPolygon(payTo, amount, description string) PaymentRequirement {
	return PaymentRequirement{
		Scheme:            "exact",
		Network:           "polygon",
		Asset:             x402.USDCAddressPolygon,
		PayTo:             payTo,
		MaxAmountRequired: amount,
		Description:       description,
		MimeType:          "application/json",
		MaxTimeoutSeconds: 60,
		Extra: map[string]string{
			"name":    "USD Coin",
			"version": "2",
		},
	}
}

// RequireUSDCPolygonAmoy creates a payment requirement for USDC on Polygon Amoy testnet
func RequireUSDCPolygonAmoy(payTo, amount, description string) PaymentRequirement {
	return PaymentRequirement{
		Scheme:            "exact",
		Network:           "polygon-amoy",
		Asset:             x402.USDCAddressPolygonAmoy,
		PayTo:             payTo,
		MaxAmountRequired: amount,
		Description:       description,
		MimeType:          "application/json",
		MaxTimeoutSeconds: 60,
		Extra: map[string]string{
			"name":    "USDC",
			"version": "2",
		},
	}
}

// RequireUSDCAvalanche creates a payment requirement for USDC on Avalanche C-Chain mainnet
func RequireUSDCAvalanche(payTo, amount, description string) PaymentRequirement {
	return PaymentRequirement{
		Scheme:            "exact",
		Network:           "avalanche",
		Asset:             x402.USDCAddressAvalanche,
		PayTo:             payTo,
		MaxAmountRequired: amount,
		Description:       description,
		MimeType:          "application/json",
		MaxTimeoutSeconds: 60,
		Extra: map[string]string{
			"name":    "USD Coin",
			"version": "2",
		},
	}
}

// RequireUSDCAvalancheFuji creates a payment requirement for USDC on Avalanche Fuji testnet
func RequireUSDCAvalancheFuji(payTo, amount, description string) PaymentRequirement {
	return PaymentRequirement{
		Scheme:            "exact",
		Network:           "avalanche-fuji",
		Asset:             x402.USDCAddressAvalancheFuji,
		PayTo:             payTo,
		MaxAmountRequired: amount,
		Description:       description,
		MimeType:          "application/json",
		MaxTimeoutSeconds: 60,
		Extra: map[string]string{
			"name":    "USDC",
			"version": "2",
		},
	}
}

// RequireUSDCSolana creates a payment requirement for USDC on Solana mainnet
// The feePayer is automatically populated from the facilitator's /supported endpoint
func RequireUSDCSolana(payTo, amount, description string) PaymentRequirement {
	extra := map[string]string{
		"decimals": "6",
		"name":     "USD Coin",
	}

	// Merge in any extra fields from facilitator's supported payments (including feePayer)
	if facilitatorExtra := getExtraForNetwork("solana"); facilitatorExtra != nil {
		for k, v := range facilitatorExtra {
			extra[k] = v
		}
	}

	return PaymentRequirement{
		Scheme:            "exact",
		Network:           "solana",
		MaxAmountRequired: amount,
		Asset:             x402.USDCMintSolana,
		PayTo:             payTo,
		Description:       description,
		MimeType:          "application/json",
		MaxTimeoutSeconds: 60,
		Extra:             extra,
	}
}

// RequireUSDCSolanaDevnet creates a payment requirement for USDC on Solana devnet
// The feePayer is automatically populated from the facilitator's /supported endpoint
func RequireUSDCSolanaDevnet(payTo, amount, description string) PaymentRequirement {
	extra := map[string]string{
		"decimals": "6",
		"name":     "USDC (Devnet)",
	}

	// Merge in any extra fields from facilitator's supported payments (including feePayer)
	if facilitatorExtra := getExtraForNetwork("solana-devnet"); facilitatorExtra != nil {
		for k, v := range facilitatorExtra {
			extra[k] = v
		}
	}

	return PaymentRequirement{
		Scheme:            "exact",
		Network:           "solana-devnet",
		MaxAmountRequired: amount,
		Asset:             x402.USDCMintSolanaDevnet,
		PayTo:             payTo,
		Description:       description,
		MimeType:          "application/json",
		MaxTimeoutSeconds: 60,
		Extra:             extra,
	}
}
