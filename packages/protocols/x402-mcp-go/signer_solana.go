package x402

import (
	"context"
	"encoding/base64"
	"fmt"
	"math/big"
	"sort"
	"strings"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/token"
	"github.com/gagliardetto/solana-go/rpc"
)

type SolanaPrivateKeySigner struct {
	privateKey     solana.PrivateKey
	publicKey      solana.PublicKey
	paymentOptions []ClientPaymentOption
	priority       int
}

// NewSolanaPrivateKeySigner creates a signer from a base58-encoded Solana private key with explicit payment options
func NewSolanaPrivateKeySigner(privateKeyBase58 string, options ...ClientPaymentOption) (*SolanaPrivateKeySigner, error) {
	privateKey, err := solana.PrivateKeyFromBase58(privateKeyBase58)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidPrivateKey, err)
	}

	if len(options) == 0 {
		return nil, fmt.Errorf("at least one payment option must be configured")
	}

	sort.Slice(options, func(i, j int) bool {
		return options[i].Priority < options[j].Priority
	})

	publicKey := privateKey.PublicKey()

	return &SolanaPrivateKeySigner{
		privateKey:     privateKey,
		publicKey:      publicKey,
		paymentOptions: options,
	}, nil
}

// GetAddress returns the signer's Solana address
func (s *SolanaPrivateKeySigner) GetAddress() string {
	return s.publicKey.String()
}

// SupportsNetwork returns true if the signer supports the given network
func (s *SolanaPrivateKeySigner) SupportsNetwork(network string) bool {
	for _, opt := range s.paymentOptions {
		if opt.Network == network {
			return true
		}
	}
	return false
}

// HasAsset returns true if the signer has the given asset on the network
func (s *SolanaPrivateKeySigner) HasAsset(asset, network string) bool {
	for _, opt := range s.paymentOptions {
		if opt.Network == network && strings.EqualFold(opt.Asset, asset) && opt.Scheme == "exact" {
			return true
		}
	}
	return false
}

// GetPaymentOption returns the client payment option that matches the network and asset
func (s *SolanaPrivateKeySigner) GetPaymentOption(network, asset string) *ClientPaymentOption {
	for _, opt := range s.paymentOptions {
		if opt.Network == network && opt.Asset == asset {
			optCopy := opt
			return &optCopy
		}
	}
	return nil
}

// GetPriority returns the signer's priority (lower = higher precedence)
func (s *SolanaPrivateKeySigner) GetPriority() int {
	return s.priority
}

// WithPriority sets the signer's priority for multi-signer configurations
func (s *SolanaPrivateKeySigner) WithPriority(priority int) *SolanaPrivateKeySigner {
	s.priority = priority
	return s
}

// SignPayment signs a payment authorization for the given requirement
func (s *SolanaPrivateKeySigner) SignPayment(ctx context.Context, req PaymentRequirement) (*PaymentPayload, error) {
	option := s.GetPaymentOption(req.Network, req.Asset)
	if option == nil {
		return nil, fmt.Errorf("no payment option for network=%s asset=%s", req.Network, req.Asset)
	}

	var rpcURL string
	switch option.NetworkID {
	case "mainnet-beta":
		rpcURL = rpc.MainNetBeta_RPC
	case "devnet":
		rpcURL = rpc.DevNet_RPC
	default:
		return nil, fmt.Errorf("unsupported network: %s", option.NetworkID)
	}
	client := rpc.New(rpcURL)

	recent, err := client.GetLatestBlockhash(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return nil, fmt.Errorf("failed to get blockhash from %s: %w", rpcURL, err)
	}

	mintAddr, err := solana.PublicKeyFromBase58(req.Asset)
	if err != nil {
		return nil, fmt.Errorf("invalid mint address: %w", err)
	}

	toAddr, err := solana.PublicKeyFromBase58(req.PayTo)
	if err != nil {
		return nil, fmt.Errorf("invalid recipient address: %w", err)
	}

	feePayerAddr, err := solana.PublicKeyFromBase58(req.Extra["feePayer"])
	if err != nil {
		return nil, fmt.Errorf("invalid fee payer address: %w", err)
	}

	fromATA, _, err := solana.FindAssociatedTokenAddress(s.publicKey, mintAddr)
	if err != nil {
		return nil, fmt.Errorf("failed to derive sender ATA: %w", err)
	}

	toATA, _, err := solana.FindAssociatedTokenAddress(toAddr, mintAddr)
	if err != nil {
		return nil, fmt.Errorf("failed to derive recipient ATA: %w", err)
	}

	amount := new(big.Int)
	if _, ok := amount.SetString(req.MaxAmountRequired, 10); !ok {
		return nil, fmt.Errorf("invalid amount: %s", req.MaxAmountRequired)
	}

	// Get decimals from requirement
	decimals := uint8(6) // Default USDC decimals
	if decStr, ok := req.Extra["decimals"]; ok {
		_, _ = fmt.Sscanf(decStr, "%d", &decimals)
	}

	var instructions []solana.Instruction

	// Add compute budget instructions required by x402 spec
	// Instruction 0: SetComputeUnitLimit
	computeLimitInst := solana.NewInstruction(
		solana.MustPublicKeyFromBase58("ComputeBudget111111111111111111111111111111"),
		solana.AccountMetaSlice{},
		[]byte{2, 0x40, 0x0d, 0x03, 0x00}, // SetComputeUnitLimit: 200,000 units
	)
	instructions = append(instructions, computeLimitInst)

	// Instruction 1: SetComputeUnitPrice
	computePriceInst := solana.NewInstruction(
		solana.MustPublicKeyFromBase58("ComputeBudget111111111111111111111111111111"),
		solana.AccountMetaSlice{},
		[]byte{3, 0x10, 0x27, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00}, // SetComputeUnitPrice: 10,000 microlamports
	)
	instructions = append(instructions, computePriceInst)

	// Instruction 2: Create TransferChecked instruction - includes mint and decimals for verification
	transferInst := token.NewTransferCheckedInstructionBuilder().
		SetAmount(amount.Uint64()).
		SetDecimals(decimals).
		SetSourceAccount(fromATA).
		SetDestinationAccount(toATA).
		SetMintAccount(mintAddr).
		SetOwnerAccount(s.publicKey).
		Build()
	instructions = append(instructions, transferInst)

	tx, err := solana.NewTransaction(
		instructions,
		recent.Value.Blockhash,
		solana.TransactionPayer(feePayerAddr),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to build transaction: %w", err)
	}

	_, err = tx.PartialSign(func(key solana.PublicKey) *solana.PrivateKey {
		if s.publicKey.Equals(key) {
			return &s.privateKey
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to partially sign transaction: %w", err)
	}

	txBytes, err := tx.MarshalBinary()
	if err != nil {
		return nil, fmt.Errorf("failed to serialize transaction: %w", err)
	}

	txBase64 := base64.StdEncoding.EncodeToString(txBytes)

	return &PaymentPayload{
		X402Version: 1,
		Scheme:      req.Scheme,
		Network:     req.Network,
		Payload: map[string]any{
			"transaction": txBase64,
		},
	}, nil
}

// NewSolanaPrivateKeySignerFromFile creates a signer from a Solana keypair file with explicit payment options
func NewSolanaPrivateKeySignerFromFile(filepath string, options ...ClientPaymentOption) (*SolanaPrivateKeySigner, error) {
	privateKey, err := solana.PrivateKeyFromSolanaKeygenFile(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to load keypair file: %w", err)
	}

	if len(options) == 0 {
		return nil, fmt.Errorf("at least one payment option must be configured")
	}

	sort.Slice(options, func(i, j int) bool {
		return options[i].Priority < options[j].Priority
	})

	return &SolanaPrivateKeySigner{
		privateKey:     privateKey,
		publicKey:      privateKey.PublicKey(),
		paymentOptions: options,
	}, nil
}

type MockSolanaSigner struct {
	address        string
	paymentOptions []ClientPaymentOption
	priority       int
}

// NewMockSolanaSigner creates a mock Solana signer for testing with explicit payment options
func NewMockSolanaSigner(address string, options ...ClientPaymentOption) *MockSolanaSigner {
	if len(options) == 0 {
		options = []ClientPaymentOption{AcceptUSDCSolanaDevnet()}
	}

	sort.Slice(options, func(i, j int) bool {
		return options[i].Priority < options[j].Priority
	})

	return &MockSolanaSigner{
		address:        address,
		paymentOptions: options,
	}
}

// GetAddress returns the mock signer's address
func (m *MockSolanaSigner) GetAddress() string {
	return m.address
}

// SupportsNetwork returns true if the mock signer supports the given network
func (m *MockSolanaSigner) SupportsNetwork(network string) bool {
	for _, opt := range m.paymentOptions {
		if opt.Network == network {
			return true
		}
	}
	return false
}

// HasAsset returns true if the mock signer has the given asset on the network
func (m *MockSolanaSigner) HasAsset(asset, network string) bool {
	for _, opt := range m.paymentOptions {
		if opt.Network == network && strings.EqualFold(opt.Asset, asset) && opt.Scheme == "exact" {
			return true
		}
	}
	return false
}

// GetPaymentOption returns the client payment option that matches the network and asset
func (m *MockSolanaSigner) GetPaymentOption(network, asset string) *ClientPaymentOption {
	for _, opt := range m.paymentOptions {
		if opt.Network == network && opt.Asset == asset {
			optCopy := opt
			return &optCopy
		}
	}
	return nil
}

// SignPayment creates a mock payment signature for testing
func (m *MockSolanaSigner) SignPayment(ctx context.Context, req PaymentRequirement) (*PaymentPayload, error) {
	value := new(big.Int)
	if _, ok := value.SetString(req.MaxAmountRequired, 10); !ok {
		return nil, fmt.Errorf("invalid payment amount: %s", req.MaxAmountRequired)
	}
	if value.Sign() <= 0 {
		return nil, fmt.Errorf("payment amount must be positive: %s", req.MaxAmountRequired)
	}

	fakeTransaction := "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="

	return &PaymentPayload{
		X402Version: 1,
		Scheme:      req.Scheme,
		Network:     req.Network,
		Payload: map[string]any{
			"transaction": fakeTransaction,
		},
	}, nil
}

// GetPriority returns the mock signer's priority (lower = higher precedence)
func (m *MockSolanaSigner) GetPriority() int {
	return m.priority
}

// WithPriority sets the mock signer's priority for multi-signer configurations
func (m *MockSolanaSigner) WithPriority(priority int) *MockSolanaSigner {
	m.priority = priority
	return m
}
