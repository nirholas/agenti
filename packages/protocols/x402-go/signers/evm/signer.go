package evm

import (
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/mark3labs/x402-go"
)

// Signer implements the x402.Signer interface for EVM-compatible chains.
type Signer struct {
	privateKey *ecdsa.PrivateKey
	address    common.Address
	network    string
	chainID    *big.Int
	tokens     []x402.TokenConfig
	priority   int
	maxAmount  *big.Int
}

// SignerOption configures a Signer.
type SignerOption func(*Signer) error

// NewSigner creates a new EVM signer with the given options.
func NewSigner(opts ...SignerOption) (*Signer, error) {
	s := &Signer{
		priority: 0,
	}

	for _, opt := range opts {
		if err := opt(s); err != nil {
			return nil, err
		}
	}

	// Validation
	if s.privateKey == nil {
		return nil, x402.ErrInvalidKey
	}
	if s.network == "" {
		return nil, x402.ErrInvalidNetwork
	}
	if len(s.tokens) == 0 {
		return nil, x402.ErrNoTokens
	}

	// Derive address and chain ID from network
	s.address = crypto.PubkeyToAddress(s.privateKey.PublicKey)
	chainID, err := getChainID(s.network)
	if err != nil {
		return nil, err
	}
	s.chainID = chainID

	return s, nil
}

// WithPrivateKey sets the private key from a hex string.
func WithPrivateKey(hexKey string) SignerOption {
	return func(s *Signer) error {
		// Remove 0x prefix if present
		hexKey = strings.TrimPrefix(hexKey, "0x")

		privateKey, err := crypto.HexToECDSA(hexKey)
		if err != nil {
			return x402.ErrInvalidKey
		}

		s.privateKey = privateKey
		return nil
	}
}

// WithNetwork sets the blockchain network.
func WithNetwork(network string) SignerOption {
	return func(s *Signer) error {
		s.network = network
		return nil
	}
}

// WithToken adds a token configuration.
func WithToken(address, symbol string, decimals int) SignerOption {
	return func(s *Signer) error {
		s.tokens = append(s.tokens, x402.TokenConfig{
			Address:  address,
			Symbol:   symbol,
			Decimals: decimals,
			Priority: 0,
		})
		return nil
	}
}

// WithTokenPriority adds a token configuration with a priority.
func WithTokenPriority(address, symbol string, decimals, priority int) SignerOption {
	return func(s *Signer) error {
		s.tokens = append(s.tokens, x402.TokenConfig{
			Address:  address,
			Symbol:   symbol,
			Decimals: decimals,
			Priority: priority,
		})
		return nil
	}
}

// WithPriority sets the signer priority.
func WithPriority(priority int) SignerOption {
	return func(s *Signer) error {
		s.priority = priority
		return nil
	}
}

// WithMaxAmountPerCall sets the maximum amount per payment call.
func WithMaxAmountPerCall(amount string) SignerOption {
	return func(s *Signer) error {
		maxAmount, ok := new(big.Int).SetString(amount, 10)
		if !ok {
			return x402.ErrInvalidAmount
		}
		s.maxAmount = maxAmount
		return nil
	}
}

// Network implements x402.Signer.
func (s *Signer) Network() string {
	return s.network
}

// Scheme implements x402.Signer.
func (s *Signer) Scheme() string {
	return "exact"
}

// CanSign implements x402.Signer.
func (s *Signer) CanSign(requirements *x402.PaymentRequirement) bool {
	// Check network match
	if requirements.Network != s.network {
		return false
	}

	// Check scheme match
	if requirements.Scheme != "exact" {
		return false
	}

	// Check if we have the required token
	for _, token := range s.tokens {
		if strings.EqualFold(token.Address, requirements.Asset) {
			return true
		}
	}

	return false
}

// Sign implements x402.Signer.
func (s *Signer) Sign(requirements *x402.PaymentRequirement) (*x402.PaymentPayload, error) {
	// Verify we can sign
	if !s.CanSign(requirements) {
		return nil, x402.ErrNoValidSigner
	}

	// Parse amount
	amount := new(big.Int)
	if _, ok := amount.SetString(requirements.MaxAmountRequired, 10); !ok {
		return nil, x402.ErrInvalidAmount
	}

	// Check max amount limit
	if s.maxAmount != nil && amount.Cmp(s.maxAmount) > 0 {
		return nil, x402.ErrAmountExceeded
	}

	// Find the token
	var tokenAddress common.Address
	for _, token := range s.tokens {
		if strings.EqualFold(token.Address, requirements.Asset) {
			tokenAddress = common.HexToAddress(token.Address)
			break
		}
	}

	// Extract EIP-3009 domain parameters from requirements
	name, version, err := extractEIP3009Params(requirements)
	if err != nil {
		return nil, err
	}

	// Create EIP-3009 authorization
	auth, err := CreateEIP3009Authorization(
		s.address,
		common.HexToAddress(requirements.PayTo),
		amount,
		requirements.MaxTimeoutSeconds,
	)
	if err != nil {
		return nil, err
	}

	// Sign the authorization with the correct domain parameters
	signature, err := SignTransferAuthorization(s.privateKey, tokenAddress, s.chainID, auth, name, version)
	if err != nil {
		return nil, err
	}

	// Build payment payload
	payload := &x402.PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     s.network,
		Payload: x402.EVMPayload{
			Signature: signature,
			Authorization: x402.EVMAuthorization{
				From:        auth.From.Hex(),
				To:          auth.To.Hex(),
				Value:       auth.Value.String(),
				ValidAfter:  auth.ValidAfter.String(),
				ValidBefore: auth.ValidBefore.String(),
				Nonce:       auth.Nonce.Hex(),
			},
		},
	}

	return payload, nil
}

// GetPriority implements x402.Signer.
func (s *Signer) GetPriority() int {
	return s.priority
}

// GetTokens implements x402.Signer.
func (s *Signer) GetTokens() []x402.TokenConfig {
	return s.tokens
}

// GetMaxAmount implements x402.Signer.
func (s *Signer) GetMaxAmount() *big.Int {
	return s.maxAmount
}

// Address returns the signer's Ethereum address.
func (s *Signer) Address() common.Address {
	return s.address
}

// getChainID returns the chain ID for the given network.
func getChainID(network string) (*big.Int, error) {
	switch network {
	case "base":
		return big.NewInt(8453), nil
	case "base-sepolia":
		return big.NewInt(84532), nil
	case "ethereum":
		return big.NewInt(1), nil
	case "sepolia":
		return big.NewInt(11155111), nil
	default:
		// Unknown network, return error
		return nil, x402.ErrInvalidNetwork
	}
}

// extractEIP3009Params extracts the EIP-3009 domain name and version from payment requirements.
// These parameters are required for EIP-712 signature validation.
func extractEIP3009Params(requirements *x402.PaymentRequirement) (name, version string, err error) {
	if requirements.Extra == nil {
		return "", "", fmt.Errorf("missing EIP-3009 parameters: Extra field is nil")
	}

	nameVal, ok := requirements.Extra["name"]
	if !ok {
		return "", "", fmt.Errorf("missing EIP-3009 parameter: name")
	}
	name, ok = nameVal.(string)
	if !ok {
		return "", "", fmt.Errorf("invalid EIP-3009 parameter: name is not a string")
	}

	versionVal, ok := requirements.Extra["version"]
	if !ok {
		return "", "", fmt.Errorf("missing EIP-3009 parameter: version")
	}
	version, ok = versionVal.(string)
	if !ok {
		return "", "", fmt.Errorf("invalid EIP-3009 parameter: version is not a string")
	}

	return name, version, nil
}
