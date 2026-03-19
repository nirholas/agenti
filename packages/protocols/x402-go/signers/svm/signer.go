package svm

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"strings"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/token"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/mark3labs/x402-go"
)

// Signer implements the x402.Signer interface for Solana (SVM).
type Signer struct {
	privateKey solana.PrivateKey
	publicKey  solana.PublicKey
	network    string
	tokens     []x402.TokenConfig
	priority   int
	maxAmount  *big.Int
}

// SignerOption configures a Signer.
type SignerOption func(*Signer) error

// NewSigner creates a new Solana signer with the given options.
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
	if len(s.privateKey) == 0 {
		return nil, x402.ErrInvalidKey
	}
	if s.network == "" {
		return nil, x402.ErrInvalidNetwork
	}
	if len(s.tokens) == 0 {
		return nil, x402.ErrNoTokens
	}

	// Derive public key
	s.publicKey = s.privateKey.PublicKey()

	return s, nil
}

// WithPrivateKey sets the private key from a base58 string.
func WithPrivateKey(base58Key string) SignerOption {
	return func(s *Signer) error {
		privateKey, err := solana.PrivateKeyFromBase58(base58Key)
		if err != nil {
			return x402.ErrInvalidKey
		}
		s.privateKey = privateKey
		return nil
	}
}

// WithKeygenFile loads a private key from a Solana keygen JSON file.
func WithKeygenFile(path string) SignerOption {
	return func(s *Signer) error {
		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("%w: %v", x402.ErrInvalidKeystore, err)
		}

		// Parse JSON array format: [1, 2, 3, ...]
		var keyBytes []byte
		if err := json.Unmarshal(data, &keyBytes); err != nil {
			return fmt.Errorf("%w: invalid JSON format", x402.ErrInvalidKeystore)
		}

		if len(keyBytes) != 64 {
			return fmt.Errorf("%w: invalid key length", x402.ErrInvalidKeystore)
		}

		s.privateKey = solana.PrivateKey(keyBytes)
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
func WithToken(mintAddress, symbol string, decimals int) SignerOption {
	return func(s *Signer) error {
		s.tokens = append(s.tokens, x402.TokenConfig{
			Address:  mintAddress,
			Symbol:   symbol,
			Decimals: decimals,
			Priority: 0,
		})
		return nil
	}
}

// WithTokenPriority adds a token configuration with a priority.
func WithTokenPriority(mintAddress, symbol string, decimals, priority int) SignerOption {
	return func(s *Signer) error {
		s.tokens = append(s.tokens, x402.TokenConfig{
			Address:  mintAddress,
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

	// Get decimals for this token
	var decimals uint8
	for _, token := range s.tokens {
		if strings.EqualFold(token.Address, requirements.Asset) {
			decimals = uint8(token.Decimals)
			break
		}
	}

	// Extract fee payer from requirements.Extra
	feePayer, err := extractFeePayer(requirements)
	if err != nil {
		return nil, fmt.Errorf("invalid fee payer: %w", err)
	}

	// Get RPC URL for the network
	rpcURL, err := getRPCURL(s.network)
	if err != nil {
		return nil, fmt.Errorf("failed to get RPC URL: %w", err)
	}

	// Fetch recent blockhash from the network
	client := rpc.New(rpcURL)
	ctx := context.Background()
	recent, err := client.GetLatestBlockhash(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return nil, fmt.Errorf("failed to get blockhash from %s: %w", rpcURL, err)
	}

	// Build the partially signed transaction
	txBase64, err := BuildPartiallySignedTransfer(
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
		return nil, x402.NewPaymentError(x402.ErrCodeSigningFailed, "failed to build transaction", err)
	}

	// Build payment payload
	payload := &x402.PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     s.network,
		Payload: map[string]any{
			"transaction": txBase64,
		},
	}

	return payload, nil
}

// getRPCURL returns the RPC URL for the given network
func getRPCURL(network string) (string, error) {
	switch strings.ToLower(network) {
	case "solana", "mainnet-beta":
		return rpc.MainNetBeta_RPC, nil
	case "solana-devnet", "devnet":
		return rpc.DevNet_RPC, nil
	case "testnet":
		return rpc.TestNet_RPC, nil
	default:
		return "", fmt.Errorf("unsupported network: %s", network)
	}
}

// extractFeePayer extracts the feePayer address from the payment requirements.
// The feePayer is specified in requirements.Extra["feePayer"] as per the exact_svm spec.
func extractFeePayer(requirements *x402.PaymentRequirement) (solana.PublicKey, error) {
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

// Address returns the signer's public key as a base58 string.
func (s *Signer) Address() string {
	return s.publicKey.String()
}

// BuildPartiallySignedTransfer creates a partially signed SPL token transfer.
// The client signs with their private key, and the facilitator will add the fee payer signature.
func BuildPartiallySignedTransfer(
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
	sourceATA, _, err := solana.FindAssociatedTokenAddress(clientPublicKey, mint)
	if err != nil {
		return "", fmt.Errorf("failed to find source ATA: %w", err)
	}

	destATA, _, err := solana.FindAssociatedTokenAddress(recipient, mint)
	if err != nil {
		return "", fmt.Errorf("failed to find destination ATA: %w", err)
	}

	// Build instruction 3: TransferChecked using official builder
	transferInst := token.NewTransferCheckedInstructionBuilder().
		SetAmount(amount).
		SetDecimals(decimals).
		SetSourceAccount(sourceATA).
		SetDestinationAccount(destATA).
		SetMintAccount(mint).
		SetOwnerAccount(clientPublicKey).
		Build()

	// Build instructions according to exact_svm spec
	instructions := []solana.Instruction{
		// Instruction 0: SetComputeUnitLimit
		buildSetComputeUnitLimitInstruction(200_000), // 200k compute units
		// Instruction 1: SetComputeUnitPrice
		buildSetComputeUnitPriceInstruction(10_000), // 10k microlamports per compute unit
		// Instruction 2: TransferChecked (use official builder from solana-go)
		transferInst,
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

// ComputeBudgetProgramID is the Solana Compute Budget program ID
var ComputeBudgetProgramID = solana.MustPublicKeyFromBase58("ComputeBudget111111111111111111111111111111")

// Token2022ProgramID is the SPL Token-2022 program ID
var Token2022ProgramID = solana.MustPublicKeyFromBase58("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb")

// buildSetComputeUnitLimitInstruction creates a SetComputeUnitLimit instruction.
// Format: [2, units (u32 little-endian)]
// Instruction discriminator 2 = SetComputeUnitLimit
func buildSetComputeUnitLimitInstruction(units uint32) solana.Instruction {
	data := make([]byte, 5)
	data[0] = 2 // SetComputeUnitLimit discriminator
	data[1] = byte(units)
	data[2] = byte(units >> 8)
	data[3] = byte(units >> 16)
	data[4] = byte(units >> 24)

	return solana.NewInstruction(
		ComputeBudgetProgramID,
		solana.AccountMetaSlice{},
		data,
	)
}

// buildSetComputeUnitPriceInstruction creates a SetComputeUnitPrice instruction.
// Format: [3, microlamports (u64 little-endian)]
// Instruction discriminator 3 = SetComputeUnitPrice
func buildSetComputeUnitPriceInstruction(microlamports uint64) solana.Instruction {
	data := make([]byte, 9)
	data[0] = 3 // SetComputeUnitPrice discriminator
	data[1] = byte(microlamports)
	data[2] = byte(microlamports >> 8)
	data[3] = byte(microlamports >> 16)
	data[4] = byte(microlamports >> 24)
	data[5] = byte(microlamports >> 32)
	data[6] = byte(microlamports >> 40)
	data[7] = byte(microlamports >> 48)
	data[8] = byte(microlamports >> 56)

	return solana.NewInstruction(
		ComputeBudgetProgramID,
		solana.AccountMetaSlice{},
		data,
	)
}
