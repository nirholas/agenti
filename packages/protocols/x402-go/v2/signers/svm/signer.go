// Package svm provides a Solana signer for the x402 v2 protocol.
package svm

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"os"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"

	v2 "github.com/mark3labs/x402-go/v2"
	solutil "github.com/mark3labs/x402-go/v2/internal/solana"
)

// RPCClient is the interface for Solana RPC operations needed by the signer.
// This allows for dependency injection and easier testing.
type RPCClient interface {
	GetLatestBlockhash(ctx context.Context, commitment rpc.CommitmentType) (*rpc.GetLatestBlockhashResult, error)
}

// Signer implements the v2.Signer interface for Solana (SVM).
type Signer struct {
	privateKey solana.PrivateKey
	publicKey  solana.PublicKey
	network    string // CAIP-2 format (e.g., "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")
	tokens     []v2.TokenConfig
	priority   int
	maxAmount  *big.Int
	rpcClient  RPCClient
}

// Option configures a Signer.
type Option func(*Signer) error

// NewSigner creates a new Solana signer from a base58-encoded private key.
func NewSigner(network string, privateKeyBase58 string, tokens []v2.TokenConfig, opts ...Option) (*Signer, error) {
	privateKey, err := solana.PrivateKeyFromBase58(privateKeyBase58)
	if err != nil {
		return nil, v2.ErrInvalidKey
	}

	return NewSignerFromKey(network, privateKey, tokens, opts...)
}

// NewSignerFromKey creates a new Solana signer from an existing private key.
func NewSignerFromKey(network string, key solana.PrivateKey, tokens []v2.TokenConfig, opts ...Option) (*Signer, error) {
	// Validate network is a Solana CAIP-2 identifier
	networkType, err := v2.ValidateNetwork(network)
	if err != nil {
		return nil, err
	}
	if networkType != v2.NetworkTypeSVM {
		return nil, fmt.Errorf("%w: expected Solana network, got %s", v2.ErrInvalidNetwork, network)
	}

	if len(tokens) == 0 {
		return nil, v2.ErrInvalidToken
	}

	s := &Signer{
		privateKey: key,
		publicKey:  key.PublicKey(),
		network:    network,
		tokens:     tokens,
		priority:   0,
	}

	for _, opt := range opts {
		if err := opt(s); err != nil {
			return nil, err
		}
	}

	return s, nil
}

// NewSignerFromKeygenFile creates a new Solana signer from a Solana keygen JSON file.
// The file should contain a JSON array of 64 bytes (the ed25519 private key).
func NewSignerFromKeygenFile(network string, path string, tokens []v2.TokenConfig, opts ...Option) (*Signer, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", v2.ErrInvalidKey, err)
	}

	// Parse JSON array format: [1, 2, 3, ...]
	var keyBytes []byte
	if err := json.Unmarshal(data, &keyBytes); err != nil {
		return nil, fmt.Errorf("%w: invalid JSON format", v2.ErrInvalidKey)
	}

	if len(keyBytes) != 64 {
		return nil, fmt.Errorf("%w: invalid key length (expected 64 bytes)", v2.ErrInvalidKey)
	}

	privateKey := solana.PrivateKey(keyBytes)
	return NewSignerFromKey(network, privateKey, tokens, opts...)
}

// WithMaxAmount sets the maximum amount per payment call.
func WithMaxAmount(amount *big.Int) Option {
	return func(s *Signer) error {
		s.maxAmount = amount
		return nil
	}
}

// WithPriority sets the signer priority.
func WithPriority(priority int) Option {
	return func(s *Signer) error {
		s.priority = priority
		return nil
	}
}

// WithRPCClient sets a custom RPC client.
// The client must implement the RPCClient interface.
func WithRPCClient(client RPCClient) Option {
	return func(s *Signer) error {
		s.rpcClient = client
		return nil
	}
}

// Network returns the CAIP-2 network identifier.
func (s *Signer) Network() string {
	return s.network
}

// Scheme returns the payment scheme identifier.
func (s *Signer) Scheme() string {
	return "exact"
}

// CanSign checks if this signer can satisfy the given payment requirements.
func (s *Signer) CanSign(requirements *v2.PaymentRequirements) bool {
	if requirements == nil {
		return false
	}

	// Check scheme match
	if requirements.Scheme != "exact" {
		return false
	}

	// Check network match
	if requirements.Network != s.network {
		return false
	}

	// Check if we have the required token (case-sensitive for Solana base58)
	for _, token := range s.tokens {
		if token.Address == requirements.Asset {
			return true
		}
	}

	return false
}

// Sign creates a signed PaymentPayload for the given requirements.
func (s *Signer) Sign(requirements *v2.PaymentRequirements) (*v2.PaymentPayload, error) {
	// Verify we can sign
	if !s.CanSign(requirements) {
		return nil, v2.ErrNoValidSigner
	}

	// Parse amount
	amount := new(big.Int)
	if _, ok := amount.SetString(requirements.Amount, 10); !ok {
		return nil, v2.ErrInvalidAmount
	}

	// Check for negative or zero amounts
	if amount.Sign() <= 0 {
		return nil, v2.ErrInvalidAmount
	}

	// Check max amount limit
	if s.maxAmount != nil && amount.Cmp(s.maxAmount) > 0 {
		return nil, v2.ErrAmountExceeded
	}

	// Check for uint64 overflow before conversion
	maxUint64 := new(big.Int).SetUint64(^uint64(0))
	if amount.Cmp(maxUint64) > 0 {
		return nil, v2.ErrAmountExceeded
	}

	// Get mint address
	mintAddress, err := solana.PublicKeyFromBase58(requirements.Asset)
	if err != nil {
		return nil, fmt.Errorf("invalid mint address: %w", err)
	}

	// Get recipient address
	recipient, err := solana.PublicKeyFromBase58(requirements.PayTo)
	if err != nil {
		return nil, fmt.Errorf("invalid recipient address: %w", err)
	}

	// Get decimals for this token (case-sensitive for Solana base58)
	var decimals uint8
	var found bool
	for _, token := range s.tokens {
		if token.Address == requirements.Asset {
			if token.Decimals < 0 || token.Decimals > 255 {
				return nil, fmt.Errorf("%w: invalid token decimals %d", v2.ErrInvalidToken, token.Decimals)
			}
			decimals = uint8(token.Decimals)
			found = true
			break
		}
	}
	if !found {
		return nil, v2.ErrInvalidToken
	}

	// Extract fee payer from requirements.Extra
	feePayer, err := extractFeePayer(requirements)
	if err != nil {
		return nil, fmt.Errorf("invalid fee payer: %w", err)
	}

	// Get or create RPC client
	client := s.rpcClient
	if client == nil {
		rpcURL, err := solutil.GetRPCURL(s.network)
		if err != nil {
			return nil, fmt.Errorf("failed to get RPC URL: %w", err)
		}
		client = rpc.New(rpcURL)
	}

	// Fetch recent blockhash from the network with timeout
	ctx, cancel := context.WithTimeout(context.Background(), v2.DefaultTimeouts.VerifyTimeout)
	defer cancel()
	recent, err := client.GetLatestBlockhash(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return nil, fmt.Errorf("failed to get blockhash: %w", err)
	}

	// Build the partially signed transaction
	txBase64, err := buildPartiallySignedTransfer(
		s.privateKey,
		s.publicKey,
		mintAddress,
		recipient,
		amount.Uint64(),
		decimals,
		feePayer,
		recent.Value.Blockhash,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to build transaction: %w", err)
	}

	// Build payment payload
	payload := &v2.PaymentPayload{
		X402Version: v2.X402Version,
		Accepted:    *requirements,
		Payload: v2.SVMPayload{
			Transaction: txBase64,
		},
	}

	return payload, nil
}

// GetPriority returns the signer's priority level.
func (s *Signer) GetPriority() int {
	return s.priority
}

// GetTokens returns the list of tokens supported by this signer.
func (s *Signer) GetTokens() []v2.TokenConfig {
	return s.tokens
}

// GetMaxAmount returns the per-call spending limit, or nil if no limit is set.
func (s *Signer) GetMaxAmount() *big.Int {
	return s.maxAmount
}

// Address returns the signer's public key.
func (s *Signer) Address() solana.PublicKey {
	return s.publicKey
}

// extractFeePayer extracts the feePayer address from the payment requirements.
// The feePayer is specified in requirements.Extra["feePayer"] as per the exact_svm spec.
func extractFeePayer(requirements *v2.PaymentRequirements) (solana.PublicKey, error) {
	if requirements.Extra == nil {
		return solana.PublicKey{}, fmt.Errorf("missing extra field in requirements")
	}

	feePayerStr, ok := requirements.Extra["feePayer"].(string)
	if !ok {
		return solana.PublicKey{}, fmt.Errorf("feePayer not found or not a string in extra field")
	}

	feePayer, err := solana.PublicKeyFromBase58(feePayerStr)
	if err != nil {
		return solana.PublicKey{}, fmt.Errorf("invalid feePayer address: %w", err)
	}

	return feePayer, nil
}

// buildPartiallySignedTransfer creates a partially signed SPL token transfer.
// The client signs with their private key, and the facilitator will add the fee payer signature.
func buildPartiallySignedTransfer(
	clientPrivateKey solana.PrivateKey,
	clientPublicKey solana.PublicKey,
	mint solana.PublicKey,
	recipient solana.PublicKey,
	amount uint64,
	decimals uint8,
	feePayer solana.PublicKey,
	blockhash solana.Hash,
) (string, error) {
	// Get associated token accounts
	sourceATA, err := solutil.DeriveAssociatedTokenAddress(clientPublicKey, mint)
	if err != nil {
		return "", fmt.Errorf("failed to find source ATA: %w", err)
	}

	destATA, err := solutil.DeriveAssociatedTokenAddress(recipient, mint)
	if err != nil {
		return "", fmt.Errorf("failed to find destination ATA: %w", err)
	}

	// Build CreateIdempotent instruction for destination ATA
	// This is idempotent - it succeeds even if the ATA already exists
	createATAInstruction, err := solutil.BuildCreateIdempotentATAInstruction(feePayer, recipient, mint)
	if err != nil {
		return "", fmt.Errorf("failed to build ATA creation instruction: %w", err)
	}

	// Build instructions according to exact_svm spec
	instructions := []solana.Instruction{
		// Instruction 0: SetComputeUnitLimit
		solutil.BuildSetComputeUnitLimitInstruction(solutil.DefaultComputeUnits),
		// Instruction 1: SetComputeUnitPrice
		solutil.BuildSetComputeUnitPriceInstruction(solutil.DefaultComputeUnitPrice),
		// Instruction 2: Create associated token account (idempotent - won't fail if it exists)
		// The feePayer sponsors the rent-exempt balance for the destination ATA
		createATAInstruction,
		// Instruction 3: TransferChecked
		solutil.BuildTransferCheckedInstruction(sourceATA, mint, destATA, clientPublicKey, amount, decimals),
	}

	// Create transaction with recent blockhash from the network
	tx, err := solana.NewTransaction(
		instructions,
		blockhash,
		solana.TransactionPayer(feePayer), // Set fee payer from requirements
	)
	if err != nil {
		return "", fmt.Errorf("failed to create transaction: %w", err)
	}

	// Create a partially signed transaction
	// Sign only with the client key, leaving the fee payer signature empty
	// The facilitator will add their signature later
	_, err = tx.PartialSign(func(key solana.PublicKey) *solana.PrivateKey {
		if key.Equals(clientPublicKey) {
			return &clientPrivateKey
		}
		return nil
	})
	if err != nil {
		return "", fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Serialize transaction to bytes
	txBytes, err := tx.MarshalBinary()
	if err != nil {
		return "", fmt.Errorf("failed to marshal transaction: %w", err)
	}

	// Encode to base64
	return base64.StdEncoding.EncodeToString(txBytes), nil
}
