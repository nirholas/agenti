package svm

import (
	"context"
	"encoding/json"
	"errors"
	"math/big"
	"os"
	"path/filepath"
	"testing"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"

	v2 "github.com/mark3labs/x402-go/v2"
	solutil "github.com/mark3labs/x402-go/v2/internal/solana"
)

// newTestWallet generates a fresh Solana wallet for testing.
// This avoids hardcoding private keys in the repository.
func newTestWallet() *solana.Wallet {
	return solana.NewWallet()
}

// mockRPCClient implements the RPCClient interface for testing.
// It returns a deterministic blockhash without making real network calls.
type mockRPCClient struct {
	blockhash solana.Hash
	err       error
}

// newMockRPCClient creates a mock RPC client with a deterministic blockhash.
func newMockRPCClient() *mockRPCClient {
	// Use a deterministic hash for reproducible tests
	return &mockRPCClient{
		blockhash: solana.MustHashFromBase58("4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZAMdL4VZHirAn"),
	}
}

// GetLatestBlockhash returns a mock blockhash result.
func (m *mockRPCClient) GetLatestBlockhash(ctx context.Context, commitment rpc.CommitmentType) (*rpc.GetLatestBlockhashResult, error) {
	if m.err != nil {
		return nil, m.err
	}
	return &rpc.GetLatestBlockhashResult{
		Value: &rpc.LatestBlockhashResult{
			Blockhash:            m.blockhash,
			LastValidBlockHeight: 100000,
		},
	}, nil
}

func TestNewSigner(t *testing.T) {
	// Generate a fresh wallet for testing
	testWallet := newTestWallet()
	testKeyBase58 := testWallet.PrivateKey.String()

	tests := []struct {
		name      string
		network   string
		key       string
		tokens    []v2.TokenConfig
		opts      []Option
		wantErr   bool
		errTarget error
	}{
		{
			name:    "valid signer",
			network: v2.NetworkSolanaMainnet,
			key:     testKeyBase58,
			tokens: []v2.TokenConfig{
				{Address: v2.SolanaMainnet.USDCAddress, Symbol: "USDC", Decimals: 6},
			},
			wantErr: false,
		},
		{
			name:    "valid signer with options",
			network: v2.NetworkSolanaMainnet,
			key:     testKeyBase58,
			tokens: []v2.TokenConfig{
				{Address: v2.SolanaMainnet.USDCAddress, Symbol: "USDC", Decimals: 6},
			},
			opts: []Option{
				WithPriority(5),
				WithMaxAmount(big.NewInt(1000000)),
			},
			wantErr: false,
		},
		{
			name:    "valid devnet signer",
			network: v2.NetworkSolanaDevnet,
			key:     testKeyBase58,
			tokens: []v2.TokenConfig{
				{Address: v2.SolanaDevnet.USDCAddress, Symbol: "USDC", Decimals: 6},
			},
			wantErr: false,
		},
		{
			name:      "invalid private key",
			network:   v2.NetworkSolanaMainnet,
			key:       "invalid",
			tokens:    []v2.TokenConfig{{Address: v2.SolanaMainnet.USDCAddress, Symbol: "USDC", Decimals: 6}},
			wantErr:   true,
			errTarget: v2.ErrInvalidKey,
		},
		{
			name:      "invalid network - EVM",
			network:   v2.NetworkBaseSepolia,
			key:       testKeyBase58,
			tokens:    []v2.TokenConfig{{Address: v2.SolanaMainnet.USDCAddress, Symbol: "USDC", Decimals: 6}},
			wantErr:   true,
			errTarget: v2.ErrInvalidNetwork,
		},
		{
			name:      "invalid network - empty",
			network:   "",
			key:       testKeyBase58,
			tokens:    []v2.TokenConfig{{Address: v2.SolanaMainnet.USDCAddress, Symbol: "USDC", Decimals: 6}},
			wantErr:   true,
			errTarget: v2.ErrInvalidNetwork,
		},
		{
			name:      "no tokens",
			network:   v2.NetworkSolanaMainnet,
			key:       testKeyBase58,
			tokens:    []v2.TokenConfig{},
			wantErr:   true,
			errTarget: v2.ErrInvalidToken,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signer, err := NewSigner(tt.network, tt.key, tt.tokens, tt.opts...)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.errTarget != nil && !errors.Is(err, tt.errTarget) {
					t.Fatalf("expected error %v, got %v", tt.errTarget, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if signer == nil {
				t.Fatal("expected signer, got nil")
			}
		})
	}
}

func TestSignerInterface(t *testing.T) {
	testWallet := newTestWallet()
	tokens := []v2.TokenConfig{
		{Address: v2.SolanaMainnet.USDCAddress, Symbol: "USDC", Decimals: 6, Priority: 1},
	}
	signer, err := NewSigner(
		v2.NetworkSolanaMainnet,
		testWallet.PrivateKey.String(),
		tokens,
		WithPriority(5),
		WithMaxAmount(big.NewInt(1000000)),
	)
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	// Test Network()
	if network := signer.Network(); network != v2.NetworkSolanaMainnet {
		t.Errorf("expected network %q, got %q", v2.NetworkSolanaMainnet, network)
	}

	// Test Scheme()
	if scheme := signer.Scheme(); scheme != "exact" {
		t.Errorf("expected scheme 'exact', got %q", scheme)
	}

	// Test GetPriority()
	if priority := signer.GetPriority(); priority != 5 {
		t.Errorf("expected priority 5, got %d", priority)
	}

	// Test GetTokens()
	gotTokens := signer.GetTokens()
	if len(gotTokens) != 1 {
		t.Fatalf("expected 1 token, got %d", len(gotTokens))
	}
	if gotTokens[0].Symbol != "USDC" {
		t.Errorf("expected token symbol 'USDC', got %q", gotTokens[0].Symbol)
	}

	// Test GetMaxAmount()
	maxAmount := signer.GetMaxAmount()
	if maxAmount == nil {
		t.Fatal("expected max amount to be set")
	}
	expected := big.NewInt(1000000)
	if maxAmount.Cmp(expected) != 0 {
		t.Errorf("expected max amount %s, got %s", expected.String(), maxAmount.String())
	}

	// Test Address()
	address := signer.Address()
	if address.IsZero() {
		t.Error("expected non-zero address")
	}
}

func TestCanSign(t *testing.T) {
	testWallet := newTestWallet()
	tokens := []v2.TokenConfig{
		{Address: v2.SolanaMainnet.USDCAddress, Symbol: "USDC", Decimals: 6},
	}
	signer, err := NewSigner(v2.NetworkSolanaMainnet, testWallet.PrivateKey.String(), tokens)
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	tests := []struct {
		name         string
		requirements *v2.PaymentRequirements
		want         bool
	}{
		{
			name: "matching network and token",
			requirements: &v2.PaymentRequirements{
				Scheme:  "exact",
				Network: v2.NetworkSolanaMainnet,
				Asset:   v2.SolanaMainnet.USDCAddress,
				Amount:  "100000",
				PayTo:   "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
			},
			want: true,
		},
		{
			name: "case sensitive token address - lowercase should not match",
			requirements: &v2.PaymentRequirements{
				Scheme:  "exact",
				Network: v2.NetworkSolanaMainnet,
				Asset:   "epjfwdd5aufqssqem2qn1xzybapC8G4wEGGkZwyTDt1v", // lowercase - should NOT match
				Amount:  "100000",
				PayTo:   "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
			},
			want: false, // Changed from true - Solana base58 is case-sensitive
		},
		{
			name: "wrong network",
			requirements: &v2.PaymentRequirements{
				Scheme:  "exact",
				Network: v2.NetworkBaseSepolia,
				Asset:   v2.SolanaMainnet.USDCAddress,
				Amount:  "100000",
				PayTo:   "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
			},
			want: false,
		},
		{
			name: "wrong scheme",
			requirements: &v2.PaymentRequirements{
				Scheme:  "streaming",
				Network: v2.NetworkSolanaMainnet,
				Asset:   v2.SolanaMainnet.USDCAddress,
				Amount:  "100000",
				PayTo:   "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
			},
			want: false,
		},
		{
			name: "wrong token",
			requirements: &v2.PaymentRequirements{
				Scheme:  "exact",
				Network: v2.NetworkSolanaMainnet,
				Asset:   "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
				Amount:  "100000",
				PayTo:   "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := signer.CanSign(tt.requirements)
			if got != tt.want {
				t.Errorf("CanSign() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSign_Validation(t *testing.T) {
	testWallet := newTestWallet()
	tokens := []v2.TokenConfig{
		{Address: v2.SolanaMainnet.USDCAddress, Symbol: "USDC", Decimals: 6},
	}
	signer, err := NewSigner(
		v2.NetworkSolanaMainnet,
		testWallet.PrivateKey.String(),
		tokens,
		WithMaxAmount(big.NewInt(1000000)),
	)
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	tests := []struct {
		name         string
		requirements *v2.PaymentRequirements
		wantErr      error
		errContains  string
	}{
		{
			name: "amount exceeds max",
			requirements: &v2.PaymentRequirements{
				Scheme:            "exact",
				Network:           v2.NetworkSolanaMainnet,
				Asset:             v2.SolanaMainnet.USDCAddress,
				Amount:            "2000000", // exceeds max of 1000000
				PayTo:             "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
				MaxTimeoutSeconds: 60,
				Extra: map[string]interface{}{
					"feePayer": "EwWqGE4ZFKLofuestmU4LDdK7XM1N4ALgdZccwYugwGd",
				},
			},
			wantErr: v2.ErrAmountExceeded,
		},
		{
			name: "invalid network",
			requirements: &v2.PaymentRequirements{
				Scheme:            "exact",
				Network:           v2.NetworkBaseSepolia,
				Asset:             v2.SolanaMainnet.USDCAddress,
				Amount:            "500000",
				PayTo:             "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
				MaxTimeoutSeconds: 60,
				Extra: map[string]interface{}{
					"feePayer": "EwWqGE4ZFKLofuestmU4LDdK7XM1N4ALgdZccwYugwGd",
				},
			},
			wantErr: v2.ErrNoValidSigner,
		},
		{
			name: "invalid amount format",
			requirements: &v2.PaymentRequirements{
				Scheme:            "exact",
				Network:           v2.NetworkSolanaMainnet,
				Asset:             v2.SolanaMainnet.USDCAddress,
				Amount:            "invalid",
				PayTo:             "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
				MaxTimeoutSeconds: 60,
				Extra: map[string]interface{}{
					"feePayer": "EwWqGE4ZFKLofuestmU4LDdK7XM1N4ALgdZccwYugwGd",
				},
			},
			wantErr: v2.ErrInvalidAmount,
		},
		{
			name: "missing feePayer in extra",
			requirements: &v2.PaymentRequirements{
				Scheme:            "exact",
				Network:           v2.NetworkSolanaMainnet,
				Asset:             v2.SolanaMainnet.USDCAddress,
				Amount:            "500000",
				PayTo:             "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
				MaxTimeoutSeconds: 60,
				Extra:             map[string]interface{}{},
			},
			errContains: "feePayer",
		},
		{
			name: "nil extra field",
			requirements: &v2.PaymentRequirements{
				Scheme:            "exact",
				Network:           v2.NetworkSolanaMainnet,
				Asset:             v2.SolanaMainnet.USDCAddress,
				Amount:            "500000",
				PayTo:             "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
				MaxTimeoutSeconds: 60,
				Extra:             nil,
			},
			errContains: "extra field",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := signer.Sign(tt.requirements)

			if tt.errContains != "" {
				if err == nil {
					t.Fatalf("expected error containing %q, got nil", tt.errContains)
				}
				if !containsString(err.Error(), tt.errContains) {
					t.Fatalf("expected error containing %q, got %v", tt.errContains, err)
				}
				return
			}

			if tt.wantErr != nil {
				if err == nil {
					t.Fatalf("expected error %v, got nil", tt.wantErr)
				}
				if err != tt.wantErr && !containsString(err.Error(), tt.wantErr.Error()) {
					t.Fatalf("expected error %v, got %v", tt.wantErr, err)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

func TestSign_ValidPayment(t *testing.T) {
	testWallet := newTestWallet()
	tokens := []v2.TokenConfig{
		{Address: v2.SolanaMainnet.USDCAddress, Symbol: "USDC", Decimals: 6},
	}
	mockClient := newMockRPCClient()
	signer, err := NewSigner(v2.NetworkSolanaMainnet, testWallet.PrivateKey.String(), tokens, WithRPCClient(mockClient))
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	requirements := &v2.PaymentRequirements{
		Scheme:            "exact",
		Network:           v2.NetworkSolanaMainnet,
		Asset:             v2.SolanaMainnet.USDCAddress,
		Amount:            "1000000", // 1 USDC
		PayTo:             "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
		MaxTimeoutSeconds: 60,
		Extra: map[string]interface{}{
			"feePayer": "EwWqGE4ZFKLofuestmU4LDdK7XM1N4ALgdZccwYugwGd",
		},
	}

	payload, err := signer.Sign(requirements)
	if err != nil {
		t.Fatalf("failed to sign: %v", err)
	}

	// Validate payload structure
	if payload == nil {
		t.Fatal("expected non-nil payload")
	}
	if payload.X402Version != v2.X402Version {
		t.Errorf("expected x402Version %d, got %d", v2.X402Version, payload.X402Version)
	}
	if payload.Accepted.Scheme != "exact" {
		t.Errorf("expected scheme 'exact', got %q", payload.Accepted.Scheme)
	}
	if payload.Accepted.Network != v2.NetworkSolanaMainnet {
		t.Errorf("expected network %q, got %q", v2.NetworkSolanaMainnet, payload.Accepted.Network)
	}

	// Validate SVM payload
	svmPayload, ok := payload.Payload.(v2.SVMPayload)
	if !ok {
		t.Fatalf("expected SVMPayload type, got %T", payload.Payload)
	}
	if svmPayload.Transaction == "" {
		t.Error("expected non-empty transaction")
	}

	// Verify transaction can be decoded
	var tx solana.Transaction
	err = tx.UnmarshalBase64(svmPayload.Transaction)
	if err != nil {
		t.Fatalf("failed to unmarshal transaction: %v", err)
	}
}

func TestTransactionStructure(t *testing.T) {
	testWallet := newTestWallet()
	tokens := []v2.TokenConfig{
		{Address: v2.SolanaMainnet.USDCAddress, Symbol: "USDC", Decimals: 6},
	}
	mockClient := newMockRPCClient()
	signer, err := NewSigner(v2.NetworkSolanaMainnet, testWallet.PrivateKey.String(), tokens, WithRPCClient(mockClient))
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	requirements := &v2.PaymentRequirements{
		Scheme:            "exact",
		Network:           v2.NetworkSolanaMainnet,
		Asset:             v2.SolanaMainnet.USDCAddress,
		Amount:            "1000000", // 1 USDC
		PayTo:             "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
		MaxTimeoutSeconds: 60,
		Extra: map[string]interface{}{
			"feePayer": "EwWqGE4ZFKLofuestmU4LDdK7XM1N4ALgdZccwYugwGd",
		},
	}

	payload, err := signer.Sign(requirements)
	if err != nil {
		t.Fatalf("failed to sign: %v", err)
	}

	svmPayload := payload.Payload.(v2.SVMPayload)

	// Deserialize the transaction from base64
	var tx solana.Transaction
	err = tx.UnmarshalBase64(svmPayload.Transaction)
	if err != nil {
		t.Fatalf("failed to unmarshal transaction: %v", err)
	}

	// Verify transaction structure
	// Now expects 4 instructions: SetComputeUnitLimit, SetComputeUnitPrice, CreateATA, TransferChecked
	if len(tx.Message.Instructions) != 4 {
		t.Fatalf("expected 4 instructions, got %d", len(tx.Message.Instructions))
	}

	// Verify instruction 0: SetComputeUnitLimit
	inst0 := tx.Message.Instructions[0]
	programID0, err := tx.Message.Program(inst0.ProgramIDIndex)
	if err != nil {
		t.Fatalf("failed to get program ID for instruction 0: %v", err)
	}
	if !programID0.Equals(solutil.ComputeBudgetProgramID) {
		t.Errorf("instruction 0: expected ComputeBudget program, got %s", programID0)
	}
	if len(inst0.Data) != 5 {
		t.Errorf("instruction 0: expected 5 bytes of data, got %d", len(inst0.Data))
	}
	if inst0.Data[0] != 2 {
		t.Errorf("instruction 0: expected discriminator 2 (SetComputeUnitLimit), got %d", inst0.Data[0])
	}

	// Verify instruction 1: SetComputeUnitPrice
	inst1 := tx.Message.Instructions[1]
	programID1, err := tx.Message.Program(inst1.ProgramIDIndex)
	if err != nil {
		t.Fatalf("failed to get program ID for instruction 1: %v", err)
	}
	if !programID1.Equals(solutil.ComputeBudgetProgramID) {
		t.Errorf("instruction 1: expected ComputeBudget program, got %s", programID1)
	}
	if len(inst1.Data) != 9 {
		t.Errorf("instruction 1: expected 9 bytes of data, got %d", len(inst1.Data))
	}
	if inst1.Data[0] != 3 {
		t.Errorf("instruction 1: expected discriminator 3 (SetComputeUnitPrice), got %d", inst1.Data[0])
	}

	// Verify instruction 2: CreateIdempotent Associated Token Account
	inst2 := tx.Message.Instructions[2]
	programID2, err := tx.Message.Program(inst2.ProgramIDIndex)
	if err != nil {
		t.Fatalf("failed to get program ID for instruction 2: %v", err)
	}
	if !programID2.Equals(solana.SPLAssociatedTokenAccountProgramID) {
		t.Errorf("instruction 2: expected AssociatedTokenAccount program, got %s", programID2)
	}
	// The CreateIdempotent instruction has 1 byte of data (instruction discriminator = 1)
	if len(inst2.Data) != 1 {
		t.Errorf("instruction 2: expected 1 byte of data for CreateIdempotent instruction, got %d", len(inst2.Data))
	}
	if len(inst2.Data) == 1 && inst2.Data[0] != 1 {
		t.Errorf("instruction 2: expected discriminator 1 (CreateIdempotent), got %d", inst2.Data[0])
	}

	// Verify instruction 3: TransferChecked
	inst3 := tx.Message.Instructions[3]
	programID3, err := tx.Message.Program(inst3.ProgramIDIndex)
	if err != nil {
		t.Fatalf("failed to get program ID for instruction 3: %v", err)
	}
	if !programID3.Equals(solana.TokenProgramID) {
		t.Errorf("instruction 3: expected Token program, got %s", programID3)
	}
	if len(inst3.Data) != 10 {
		t.Errorf("instruction 3: expected 10 bytes of data, got %d", len(inst3.Data))
	}
	if inst3.Data[0] != 12 {
		t.Errorf("instruction 3: expected discriminator 12 (TransferChecked), got %d", inst3.Data[0])
	}
	// Verify decimals (last byte)
	if inst3.Data[9] != 6 {
		t.Errorf("instruction 3: expected decimals 6, got %d", inst3.Data[9])
	}

	// Verify amount (bytes 1-8, little-endian u64)
	amount := uint64(inst3.Data[1]) |
		uint64(inst3.Data[2])<<8 |
		uint64(inst3.Data[3])<<16 |
		uint64(inst3.Data[4])<<24 |
		uint64(inst3.Data[5])<<32 |
		uint64(inst3.Data[6])<<40 |
		uint64(inst3.Data[7])<<48 |
		uint64(inst3.Data[8])<<56
	if amount != 1000000 {
		t.Errorf("instruction 3: expected amount 1000000, got %d", amount)
	}

	// Verify CreateATA has the correct accounts (payer, associated account, wallet, mint, system program, token program)
	if len(inst2.Accounts) != 6 {
		t.Errorf("instruction 2: expected 6 accounts for CreateATA, got %d", len(inst2.Accounts))
	}

	// Verify TransferChecked has 4 accounts (source, mint, destination, authority)
	if len(inst3.Accounts) != 4 {
		t.Errorf("instruction 3: expected 4 accounts, got %d", len(inst3.Accounts))
	}

	t.Logf("Transaction structure validated successfully")
}

func TestNewSignerFromKeygenFile(t *testing.T) {
	// Create a temporary directory for test files
	tmpDir, err := os.MkdirTemp("", "x402-v2-svm-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Generate a test private key
	privateKey := solana.NewWallet()

	// Create a valid keygen file
	validPath := filepath.Join(tmpDir, "valid.json")
	keyData, err := json.Marshal(privateKey.PrivateKey)
	if err != nil {
		t.Fatalf("failed to marshal key: %v", err)
	}
	err = os.WriteFile(validPath, keyData, 0600)
	if err != nil {
		t.Fatalf("failed to write valid keyfile: %v", err)
	}

	tokens := []v2.TokenConfig{
		{Address: v2.SolanaMainnet.USDCAddress, Symbol: "USDC", Decimals: 6},
	}

	tests := []struct {
		name    string
		path    string
		wantErr bool
	}{
		{
			name:    "valid keygen file",
			path:    validPath,
			wantErr: false,
		},
		{
			name:    "non-existent file",
			path:    filepath.Join(tmpDir, "nonexistent.json"),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signer, err := NewSignerFromKeygenFile(v2.NetworkSolanaMainnet, tt.path, tokens)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if signer == nil {
				t.Fatal("expected signer, got nil")
			}
		})
	}
}

func TestNewSignerFromKeygenFile_InvalidJSON(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "x402-v2-svm-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	invalidPath := filepath.Join(tmpDir, "invalid.json")
	err = os.WriteFile(invalidPath, []byte("not valid json"), 0600)
	if err != nil {
		t.Fatalf("failed to write invalid file: %v", err)
	}

	tokens := []v2.TokenConfig{
		{Address: v2.SolanaMainnet.USDCAddress, Symbol: "USDC", Decimals: 6},
	}

	_, err = NewSignerFromKeygenFile(v2.NetworkSolanaMainnet, invalidPath, tokens)
	if err == nil {
		t.Fatal("expected error for invalid JSON, got nil")
	}
}

func TestNewSignerFromKeygenFile_InvalidKeyLength(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "x402-v2-svm-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create file with wrong key length
	wrongLengthPath := filepath.Join(tmpDir, "wronglength.json")
	shortKey := make([]byte, 32) // Should be 64
	data, _ := json.Marshal(shortKey)
	err = os.WriteFile(wrongLengthPath, data, 0600)
	if err != nil {
		t.Fatalf("failed to write file: %v", err)
	}

	tokens := []v2.TokenConfig{
		{Address: v2.SolanaMainnet.USDCAddress, Symbol: "USDC", Decimals: 6},
	}

	_, err = NewSignerFromKeygenFile(v2.NetworkSolanaMainnet, wrongLengthPath, tokens)
	if err == nil {
		t.Fatal("expected error for invalid key length, got nil")
	}
}

func TestMultipleTokens(t *testing.T) {
	testWallet := newTestWallet()
	tokens := []v2.TokenConfig{
		{Address: v2.SolanaMainnet.USDCAddress, Symbol: "USDC", Decimals: 6, Priority: 1},
		{Address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", Symbol: "USDT", Decimals: 6, Priority: 2},
	}
	signer, err := NewSigner(v2.NetworkSolanaMainnet, testWallet.PrivateKey.String(), tokens)
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	gotTokens := signer.GetTokens()
	if len(gotTokens) != 2 {
		t.Fatalf("expected 2 tokens, got %d", len(gotTokens))
	}

	// Check priorities
	priorities := make(map[string]int)
	for _, token := range gotTokens {
		priorities[token.Symbol] = token.Priority
	}

	if priorities["USDC"] != 1 {
		t.Errorf("expected USDC priority 1, got %d", priorities["USDC"])
	}
	if priorities["USDT"] != 2 {
		t.Errorf("expected USDT priority 2, got %d", priorities["USDT"])
	}

	// Test CanSign for both tokens
	usdcReq := &v2.PaymentRequirements{
		Scheme:  "exact",
		Network: v2.NetworkSolanaMainnet,
		Asset:   v2.SolanaMainnet.USDCAddress,
		Amount:  "100000",
		PayTo:   "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
	}
	if !signer.CanSign(usdcReq) {
		t.Error("expected CanSign to return true for USDC")
	}

	usdtReq := &v2.PaymentRequirements{
		Scheme:  "exact",
		Network: v2.NetworkSolanaMainnet,
		Asset:   "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
		Amount:  "100000",
		PayTo:   "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
	}
	if !signer.CanSign(usdtReq) {
		t.Error("expected CanSign to return true for USDT")
	}
}

// Helper function to check if error message contains expected string
func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 || indexOfSubstring(s, substr) >= 0)
}

func indexOfSubstring(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
