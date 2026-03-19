package v2

import "math/big"

// Signer creates signed payment payloads for a specific network.
// Implementations handle blockchain-specific signing for EVM (Ethereum-compatible chains)
// and SVM (Solana) networks.
type Signer interface {
	// Network returns the CAIP-2 network identifier (e.g., "eip155:8453").
	Network() string

	// Scheme returns the payment scheme identifier (e.g., "exact").
	Scheme() string

	// CanSign checks if this signer can satisfy the given payment requirements.
	// Returns true if the signer supports the required network and has the required token.
	CanSign(requirements *PaymentRequirements) bool

	// Sign creates a signed PaymentPayload for the given requirements.
	// Returns an error if signing fails or if the payment exceeds configured limits.
	Sign(requirements *PaymentRequirements) (*PaymentPayload, error)

	// GetPriority returns the signer's priority level.
	// Lower numbers indicate higher priority (1 > 2 > 3).
	GetPriority() int

	// GetTokens returns the list of tokens supported by this signer.
	GetTokens() []TokenConfig

	// GetMaxAmount returns the per-call spending limit, or nil if no limit is set.
	GetMaxAmount() *big.Int
}
