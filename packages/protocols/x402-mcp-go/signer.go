package x402

import (
	"context"
	"crypto/ecdsa"
	"encoding/hex"
	"fmt"
	"math/big"
	"sort"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/accounts/keystore"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/math"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
	"github.com/tyler-smith/go-bip32"
	"github.com/tyler-smith/go-bip39"
)

// PaymentSigner signs x402 payment authorizations
type PaymentSigner interface {
	// SignPayment signs a payment authorization for the given requirement
	SignPayment(ctx context.Context, req PaymentRequirement) (*PaymentPayload, error)

	// GetAddress returns the signer's address
	GetAddress() string

	// SupportsNetwork returns true if the signer supports the given network
	SupportsNetwork(network string) bool

	// HasAsset returns true if the signer has the given asset on the network
	HasAsset(asset, network string) bool

	// GetPaymentOption returns the client payment option that matches the network and asset
	GetPaymentOption(network, asset string) *ClientPaymentOption

	// GetPriority returns the signer's priority (lower = higher precedence)
	GetPriority() int
}

// PrivateKeySigner signs with a raw private key
type PrivateKeySigner struct {
	privateKey     *ecdsa.PrivateKey
	address        common.Address
	paymentOptions []ClientPaymentOption
	priority       int // Signer priority (lower = higher precedence)
}

// NewPrivateKeySigner creates a signer from a hex-encoded private key with explicit payment options
func NewPrivateKeySigner(privateKeyHex string, options ...ClientPaymentOption) (*PrivateKeySigner, error) {
	// Remove 0x prefix if present
	privateKeyHex = strings.TrimPrefix(privateKeyHex, "0x")

	privateKeyBytes, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidPrivateKey, err)
	}

	privateKey, err := crypto.ToECDSA(privateKeyBytes)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidPrivateKey, err)
	}

	if len(options) == 0 {
		return nil, fmt.Errorf("at least one payment option must be configured")
	}

	// Sort by priority
	sort.Slice(options, func(i, j int) bool {
		return options[i].Priority < options[j].Priority
	})

	address := crypto.PubkeyToAddress(privateKey.PublicKey)

	return &PrivateKeySigner{
		privateKey:     privateKey,
		address:        address,
		paymentOptions: options,
	}, nil
}

// GetAddress returns the signer's Ethereum address
func (s *PrivateKeySigner) GetAddress() string {
	return s.address.Hex()
}

// SupportsNetwork returns true if the signer supports the given network
func (s *PrivateKeySigner) SupportsNetwork(network string) bool {
	for _, opt := range s.paymentOptions {
		if opt.Network == network {
			return true
		}
	}
	return false
}

// HasAsset returns true if the signer has the given asset on the network
func (s *PrivateKeySigner) HasAsset(asset, network string) bool {
	for _, opt := range s.paymentOptions {
		if opt.Network == network && strings.EqualFold(opt.Asset, asset) && opt.Scheme == "exact" {
			return true
		}
	}
	return false
}

// GetPaymentOption returns the client payment option that matches the network and asset
func (s *PrivateKeySigner) GetPaymentOption(network, asset string) *ClientPaymentOption {
	for _, opt := range s.paymentOptions {
		if opt.Network == network && opt.Asset == asset {
			optCopy := opt
			return &optCopy
		}
	}
	return nil
}

// GetPriority returns the signer's priority (lower value = higher priority)
func (s *PrivateKeySigner) GetPriority() int {
	return s.priority
}

// WithPriority sets the signer's priority for multi-signer configurations
func (s *PrivateKeySigner) WithPriority(priority int) *PrivateKeySigner {
	s.priority = priority
	return s
}

// SignPayment signs a payment authorization for the given requirement
func (s *PrivateKeySigner) SignPayment(ctx context.Context, req PaymentRequirement) (*PaymentPayload, error) {
	// Find the matching payment option to get chain ID
	paymentOption := s.GetPaymentOption(req.Network, req.Asset)
	if paymentOption == nil {
		return nil, fmt.Errorf("no payment option configured for network %s and asset %s", req.Network, req.Asset)
	}

	chainID := paymentOption.ChainID
	if chainID == nil {
		return nil, fmt.Errorf("chain ID not configured for network %s", req.Network)
	}

	// Generate nonce
	nonceBytes := crypto.Keccak256([]byte(fmt.Sprintf("%d-%s-%s",
		time.Now().UnixNano(), req.Resource, s.address.Hex())))
	nonce := "0x" + hex.EncodeToString(nonceBytes)

	// Create time window with configurable buffer for clock skew
	// Default to 30 seconds in the past to account for larger clock differences
	// This is more lenient than the original 5 seconds
	const clockSkewBuffer = 30 * time.Second
	validAfter := time.Now().Add(-clockSkewBuffer).Unix()

	// Ensure timeout is reasonable (at least 60 seconds, max 1 hour)
	timeout := req.MaxTimeoutSeconds
	if timeout < 60 {
		timeout = 60
	} else if timeout > 3600 {
		timeout = 3600
	}
	validBefore := time.Now().Add(time.Duration(timeout) * time.Second).Unix()

	// Create EIP-712 typed data

	// Parse value
	value := new(big.Int)
	if _, ok := value.SetString(req.MaxAmountRequired, 10); !ok {
		return nil, fmt.Errorf("invalid payment amount: %s", req.MaxAmountRequired)
	}

	// Validate amount is positive
	if value.Sign() <= 0 {
		return nil, fmt.Errorf("payment amount must be positive: %s", req.MaxAmountRequired)
	}

	typedData := apitypes.TypedData{
		Types: apitypes.Types{
			"EIP712Domain": []apitypes.Type{
				{Name: "name", Type: "string"},
				{Name: "version", Type: "string"},
				{Name: "chainId", Type: "uint256"},
				{Name: "verifyingContract", Type: "address"},
			},
			"TransferWithAuthorization": []apitypes.Type{
				{Name: "from", Type: "address"},
				{Name: "to", Type: "address"},
				{Name: "value", Type: "uint256"},
				{Name: "validAfter", Type: "uint256"},
				{Name: "validBefore", Type: "uint256"},
				{Name: "nonce", Type: "bytes32"},
			},
		},
		PrimaryType: "TransferWithAuthorization",
		Domain: apitypes.TypedDataDomain{
			Name:              req.Extra["name"],
			Version:           req.Extra["version"],
			ChainId:           (*math.HexOrDecimal256)(chainID),
			VerifyingContract: req.Asset,
		},
		Message: apitypes.TypedDataMessage{
			"from":        s.address.Hex(),
			"to":          common.HexToAddress(req.PayTo).Hex(),
			"value":       (*math.HexOrDecimal256)(value),
			"validAfter":  (*math.HexOrDecimal256)(big.NewInt(validAfter)),
			"validBefore": (*math.HexOrDecimal256)(big.NewInt(validBefore)),
			"nonce":       nonce,
		},
	}

	// Sign the typed data
	sigHash, _, err := apitypes.TypedDataAndHash(typedData)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrSigningFailed, err)
	}

	signature, err := crypto.Sign(sigHash, s.privateKey)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrSigningFailed, err)
	}

	// Adjust V value for Ethereum signature standard
	signature[64] += 27

	return &PaymentPayload{
		X402Version: 1,
		Scheme:      req.Scheme,
		Network:     req.Network,
		Payload: PaymentPayloadData{
			Signature: "0x" + hex.EncodeToString(signature),
			Authorization: PaymentAuthorization{
				From:        s.address.Hex(),
				To:          req.PayTo,
				Value:       req.MaxAmountRequired,
				ValidAfter:  fmt.Sprintf("%d", validAfter),
				ValidBefore: fmt.Sprintf("%d", validBefore),
				Nonce:       nonce,
			},
		},
	}, nil
}

// derivePrivateKey derives a private key from a seed using BIP-32 HD derivation
func derivePrivateKey(seed []byte, path accounts.DerivationPath) (*ecdsa.PrivateKey, error) {
	// Create master key from seed
	masterKey, err := bip32.NewMasterKey(seed)
	if err != nil {
		return nil, fmt.Errorf("failed to create master key: %w", err)
	}

	// Follow the derivation path
	key := masterKey
	for _, n := range path {
		key, err = key.NewChildKey(n)
		if err != nil {
			return nil, fmt.Errorf("failed to derive child key: %w", err)
		}
	}

	// Convert to ECDSA private key
	privateKey, err := crypto.ToECDSA(key.Key)
	if err != nil {
		return nil, fmt.Errorf("failed to convert to ECDSA key: %w", err)
	}

	return privateKey, nil
}

// MnemonicSigner signs with a key derived from a mnemonic phrase
type MnemonicSigner struct {
	*PrivateKeySigner
}

// NewMnemonicSigner creates a signer from a BIP-39 mnemonic phrase with explicit payment options
func NewMnemonicSigner(mnemonic string, derivationPath string, options ...ClientPaymentOption) (*MnemonicSigner, error) {
	if !bip39.IsMnemonicValid(mnemonic) {
		return nil, ErrInvalidMnemonic
	}

	if derivationPath == "" {
		derivationPath = "m/44'/60'/0'/0/0" // Default Ethereum path
	}

	// Parse the derivation path using go-ethereum's parser
	path, err := accounts.ParseDerivationPath(derivationPath)
	if err != nil {
		return nil, fmt.Errorf("invalid derivation path: %w", err)
	}

	// Create seed from mnemonic
	seed := bip39.NewSeed(mnemonic, "")

	// Use BIP-32 HD derivation with go-ethereum's path parser
	privateKey, err := derivePrivateKey(seed, path)
	if err != nil {
		return nil, fmt.Errorf("failed to derive private key: %w", err)
	}

	if len(options) == 0 {
		return nil, fmt.Errorf("at least one payment option must be configured")
	}

	// Sort by priority
	sort.Slice(options, func(i, j int) bool {
		return options[i].Priority < options[j].Priority
	})

	address := crypto.PubkeyToAddress(privateKey.PublicKey)

	return &MnemonicSigner{
		PrivateKeySigner: &PrivateKeySigner{
			privateKey:     privateKey,
			address:        address,
			paymentOptions: options,
		},
	}, nil
}

// GetPriority returns the signer's priority
func (s *MnemonicSigner) GetPriority() int {
	return s.PrivateKeySigner.GetPriority()
}

// WithPriority sets the signer's priority
func (s *MnemonicSigner) WithPriority(priority int) *MnemonicSigner {
	s.PrivateKeySigner.WithPriority(priority)
	return s
}

// KeystoreSigner signs with a key from an encrypted keystore file
type KeystoreSigner struct {
	*PrivateKeySigner
}

// NewKeystoreSigner creates a signer from an encrypted keystore JSON with explicit payment options
func NewKeystoreSigner(keystoreJSON []byte, password string, options ...ClientPaymentOption) (*KeystoreSigner, error) {
	key, err := keystore.DecryptKey(keystoreJSON, password)
	if err != nil {
		if err == keystore.ErrDecrypt {
			return nil, ErrWrongPassword
		}
		return nil, fmt.Errorf("%w: %v", ErrInvalidKeystore, err)
	}

	if len(options) == 0 {
		return nil, fmt.Errorf("at least one payment option must be configured")
	}

	// Sort by priority
	sort.Slice(options, func(i, j int) bool {
		return options[i].Priority < options[j].Priority
	})

	return &KeystoreSigner{
		PrivateKeySigner: &PrivateKeySigner{
			privateKey:     key.PrivateKey,
			address:        key.Address,
			paymentOptions: options,
		},
	}, nil
}

// GetPriority returns the signer's priority
func (s *KeystoreSigner) GetPriority() int {
	return s.PrivateKeySigner.GetPriority()
}

// WithPriority sets the signer's priority
func (s *KeystoreSigner) WithPriority(priority int) *KeystoreSigner {
	s.PrivateKeySigner.WithPriority(priority)
	return s
}

// MockSigner is a test signer that generates fake signatures
type MockSigner struct {
	address        string
	paymentOptions []ClientPaymentOption
	priority       int // Signer priority
}

// NewMockSigner creates a mock signer for testing with explicit payment options
func NewMockSigner(address string, options ...ClientPaymentOption) *MockSigner {
	if !strings.HasPrefix(address, "0x") {
		address = "0x" + address
	}

	if len(options) == 0 {
		// Default to Base Sepolia USDC for testing
		options = []ClientPaymentOption{AcceptUSDCBaseSepolia()}
	}

	// Sort by priority
	sort.Slice(options, func(i, j int) bool {
		return options[i].Priority < options[j].Priority
	})

	return &MockSigner{
		address:        address,
		paymentOptions: options,
	}
}

// GetAddress returns the mock signer's address
func (m *MockSigner) GetAddress() string {
	return m.address
}

// SupportsNetwork returns true if the mock signer supports the given network
func (m *MockSigner) SupportsNetwork(network string) bool {
	for _, opt := range m.paymentOptions {
		if opt.Network == network {
			return true
		}
	}
	return false
}

// HasAsset returns true if the mock signer has the given asset on the network
func (m *MockSigner) HasAsset(asset, network string) bool {
	for _, opt := range m.paymentOptions {
		if opt.Network == network && strings.EqualFold(opt.Asset, asset) && opt.Scheme == "exact" {
			return true
		}
	}
	return false
}

// GetPaymentOption returns the client payment option that matches the network and asset
func (m *MockSigner) GetPaymentOption(network, asset string) *ClientPaymentOption {
	for _, opt := range m.paymentOptions {
		if opt.Network == network && opt.Asset == asset {
			optCopy := opt
			return &optCopy
		}
	}
	return nil
}

// SignPayment creates a mock payment signature for testing
func (m *MockSigner) SignPayment(ctx context.Context, req PaymentRequirement) (*PaymentPayload, error) {
	// Validate amount even in mock signer
	value := new(big.Int)
	if _, ok := value.SetString(req.MaxAmountRequired, 10); !ok {
		return nil, fmt.Errorf("invalid payment amount: %s", req.MaxAmountRequired)
	}
	if value.Sign() <= 0 {
		return nil, fmt.Errorf("payment amount must be positive: %s", req.MaxAmountRequired)
	}

	// Generate deterministic fake signature for testing
	fakeSignature := strings.Repeat("00", 65)

	// Use same time window logic as real signer
	const clockSkewBuffer = 30 * time.Second
	validAfter := time.Now().Add(-clockSkewBuffer).Unix()
	timeout := req.MaxTimeoutSeconds
	if timeout < 60 {
		timeout = 60
	} else if timeout > 3600 {
		timeout = 3600
	}
	validBefore := time.Now().Add(time.Duration(timeout) * time.Second).Unix()

	return &PaymentPayload{
		X402Version: 1,
		Scheme:      req.Scheme,
		Network:     req.Network,
		Payload: PaymentPayloadData{
			Signature: "0x" + fakeSignature,
			Authorization: PaymentAuthorization{
				From:        m.address,
				To:          req.PayTo,
				Value:       req.MaxAmountRequired,
				ValidAfter:  fmt.Sprintf("%d", validAfter),
				ValidBefore: fmt.Sprintf("%d", validBefore),
				Nonce:       "0x" + strings.Repeat("11", 32),
			},
		},
	}, nil
}

// GetPriority returns the signer's priority
func (m *MockSigner) GetPriority() int {
	return m.priority
}

// WithPriority sets the signer's priority
func (m *MockSigner) WithPriority(priority int) *MockSigner {
	m.priority = priority
	return m
}
