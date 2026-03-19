package x402

import "math/big"

// Signer represents a payment signer for a specific blockchain.
// Implementations handle blockchain-specific signing for EVM (Ethereum-compatible chains)
// and SVM (Solana) networks.
type Signer interface {
	// Network returns the blockchain network identifier (e.g., "base", "solana").
	Network() string

	// Scheme returns the payment scheme identifier (currently "exact").
	Scheme() string

	// CanSign checks if this signer can satisfy the given payment requirements.
	// Returns true if the signer supports the required network and has the required token.
	CanSign(requirements *PaymentRequirement) bool

	// Sign creates a signed payment payload for the given requirements.
	// Returns an error if signing fails or if the payment exceeds configured limits.
	Sign(requirements *PaymentRequirement) (*PaymentPayload, error)

	// GetPriority returns the signer's priority level.
	// Lower numbers indicate higher priority (1 > 2 > 3).
	GetPriority() int

	// GetTokens returns the list of tokens supported by this signer.
	GetTokens() []TokenConfig

	// GetMaxAmount returns the per-call spending limit, or nil if no limit is set.
	GetMaxAmount() *big.Int
}
