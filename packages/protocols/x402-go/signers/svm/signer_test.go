package svm

import (
	"encoding/json"
	"math/big"
	"os"
	"path/filepath"
	"testing"

	"github.com/gagliardetto/solana-go"
	"github.com/mark3labs/x402-go"
)

// Test private key (DO NOT use in production)
// This is a randomly generated Solana key for testing purposes only
const testPrivateKeyBase58 = "4Z7cXSyeFR8wNGMVXUE1TwtKn5D5Vu7FzEv69dokLv8KrQk7h2ByqYCKQBWUrbXdqeqSHXv2YvPRzYMNL8hFmjXu"

func TestNewSigner(t *testing.T) {
	tests := []struct {
		name    string
		opts    []SignerOption
		wantErr error
	}{
		{
			name: "valid signer with all options",
			opts: []SignerOption{
				WithPrivateKey(testPrivateKeyBase58),
				WithNetwork("solana"),
				WithToken("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC", 6),
				WithPriority(1),
				WithMaxAmountPerCall("1000000"),
			},
			wantErr: nil,
		},
		{
			name: "valid signer with multiple tokens",
			opts: []SignerOption{
				WithPrivateKey(testPrivateKeyBase58),
				WithNetwork("solana"),
				WithToken("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC", 6),
				WithTokenPriority("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", "USDT", 6, 2),
			},
			wantErr: nil,
		},
		{
			name: "missing private key",
			opts: []SignerOption{
				WithNetwork("solana"),
				WithToken("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC", 6),
			},
			wantErr: x402.ErrInvalidKey,
		},
		{
			name: "missing network",
			opts: []SignerOption{
				WithPrivateKey(testPrivateKeyBase58),
				WithToken("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC", 6),
			},
			wantErr: x402.ErrInvalidNetwork,
		},
		{
			name: "missing tokens",
			opts: []SignerOption{
				WithPrivateKey(testPrivateKeyBase58),
				WithNetwork("solana"),
			},
			wantErr: x402.ErrNoTokens,
		},
		{
			name: "invalid private key",
			opts: []SignerOption{
				WithPrivateKey("invalid"),
				WithNetwork("solana"),
				WithToken("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC", 6),
			},
			wantErr: x402.ErrInvalidKey,
		},
		{
			name: "invalid max amount",
			opts: []SignerOption{
				WithPrivateKey(testPrivateKeyBase58),
				WithNetwork("solana"),
				WithToken("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC", 6),
				WithMaxAmountPerCall("invalid"),
			},
			wantErr: x402.ErrInvalidAmount,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signer, err := NewSigner(tt.opts...)
			if tt.wantErr != nil {
				if err == nil {
					t.Fatalf("expected error %v, got nil", tt.wantErr)
				}
				if err != tt.wantErr {
					t.Fatalf("expected error %v, got %v", tt.wantErr, err)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if signer == nil {
				t.Fatal("expected signer to be non-nil")
			}
		})
	}
}

func TestSignerInterface(t *testing.T) {
	signer, err := NewSigner(
		WithPrivateKey(testPrivateKeyBase58),
		WithNetwork("solana"),
		WithToken("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC", 6),
		WithPriority(5),
		WithMaxAmountPerCall("1000000"),
	)
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	// Test Network()
	if network := signer.Network(); network != "solana" {
		t.Errorf("expected network 'solana', got '%s'", network)
	}

	// Test Scheme()
	if scheme := signer.Scheme(); scheme != "exact" {
		t.Errorf("expected scheme 'exact', got '%s'", scheme)
	}

	// Test GetPriority()
	if priority := signer.GetPriority(); priority != 5 {
		t.Errorf("expected priority 5, got %d", priority)
	}

	// Test GetTokens()
	tokens := signer.GetTokens()
	if len(tokens) != 1 {
		t.Fatalf("expected 1 token, got %d", len(tokens))
	}
	if tokens[0].Symbol != "USDC" {
		t.Errorf("expected token symbol 'USDC', got '%s'", tokens[0].Symbol)
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
	if address == "" {
		t.Error("expected non-empty address")
	}
}

func TestCanSign(t *testing.T) {
	signer, err := NewSigner(
		WithPrivateKey(testPrivateKeyBase58),
		WithNetwork("solana"),
		WithToken("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC", 6),
	)
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	tests := []struct {
		name         string
		requirements *x402.PaymentRequirement
		want         bool
	}{
		{
			name: "matching network and token",
			requirements: &x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "solana",
				Asset:             "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
				MaxAmountRequired: "100000",
				PayTo:             "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
			},
			want: true,
		},
		{
			name: "case insensitive token address",
			requirements: &x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "solana",
				Asset:             "epjfwdd5aufqssqem2qn1xzybapC8G4wEGGkZwyTDt1v", // mixed case
				MaxAmountRequired: "100000",
				PayTo:             "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
			},
			want: true,
		},
		{
			name: "wrong network",
			requirements: &x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				Asset:             "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
				MaxAmountRequired: "100000",
				PayTo:             "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
			},
			want: false,
		},
		{
			name: "wrong scheme",
			requirements: &x402.PaymentRequirement{
				Scheme:            "streaming",
				Network:           "solana",
				Asset:             "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
				MaxAmountRequired: "100000",
				PayTo:             "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
			},
			want: false,
		},
		{
			name: "wrong token",
			requirements: &x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "solana",
				Asset:             "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
				MaxAmountRequired: "100000",
				PayTo:             "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
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
	signer, err := NewSigner(
		WithPrivateKey(testPrivateKeyBase58),
		WithNetwork("solana"),
		WithToken("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC", 6),
		WithMaxAmountPerCall("1000000"),
	)
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	tests := []struct {
		name         string
		requirements *x402.PaymentRequirement
		wantErr      error
		skipReason   string
	}{
		{
			name: "valid payment request",
			requirements: &x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "solana",
				Asset:             "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
				MaxAmountRequired: "500000",
				PayTo:             "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
				MaxTimeoutSeconds: 60,
				Extra: map[string]interface{}{
					"feePayer": "EwWqGE4ZFKLofuestmU4LDdK7XM1N4ALgdZccwYugwGd",
				},
			},
			wantErr: nil,
		},
		{
			name: "amount exceeds max",
			requirements: &x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "solana",
				Asset:             "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
				MaxAmountRequired: "2000000", // exceeds max of 1000000
				PayTo:             "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
				MaxTimeoutSeconds: 60,
				Extra: map[string]interface{}{
					"feePayer": "EwWqGE4ZFKLofuestmU4LDdK7XM1N4ALgdZccwYugwGd",
				},
			},
			wantErr: x402.ErrAmountExceeded,
		},
		{
			name: "invalid network",
			requirements: &x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				Asset:             "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
				MaxAmountRequired: "500000",
				PayTo:             "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
				MaxTimeoutSeconds: 60,
				Extra: map[string]interface{}{
					"feePayer": "EwWqGE4ZFKLofuestmU4LDdK7XM1N4ALgdZccwYugwGd",
				},
			},
			wantErr: x402.ErrNoValidSigner,
		},
		{
			name: "invalid amount format",
			requirements: &x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "solana",
				Asset:             "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
				MaxAmountRequired: "invalid",
				PayTo:             "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
				MaxTimeoutSeconds: 60,
				Extra: map[string]interface{}{
					"feePayer": "EwWqGE4ZFKLofuestmU4LDdK7XM1N4ALgdZccwYugwGd",
				},
			},
			wantErr: x402.ErrInvalidAmount,
		},
		{
			name: "missing feePayer in extra",
			requirements: &x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "solana",
				Asset:             "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
				MaxAmountRequired: "500000",
				PayTo:             "9B5XszUGdMaxCZ7uSQhPzdks5ZQSmWxrmzCSvtJ6Ns6g",
				MaxTimeoutSeconds: 60,
				Extra:             map[string]interface{}{},
			},
			wantErr: nil, // Will check error message contains "feePayer"
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.skipReason != "" {
				t.Skip(tt.skipReason)
			}

			payload, err := signer.Sign(tt.requirements)

			// Special handling for missing feePayer test
			if tt.name == "missing feePayer in extra" {
				if err == nil {
					t.Fatal("expected error for missing feePayer, got nil")
				}
				if !errorContains(err, "feePayer") {
					t.Fatalf("expected error to contain 'feePayer', got: %v", err)
				}
				return
			}

			if tt.wantErr != nil {
				if err == nil {
					t.Fatalf("expected error %v, got nil", tt.wantErr)
				}
				if err != tt.wantErr && !errorContains(err, tt.wantErr.Error()) {
					t.Fatalf("expected error %v, got %v", tt.wantErr, err)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			// Validate payload structure
			if payload == nil {
				t.Fatal("expected non-nil payload")
			}
			if payload.X402Version != 1 {
				t.Errorf("expected x402Version 1, got %d", payload.X402Version)
			}
			if payload.Scheme != "exact" {
				t.Errorf("expected scheme 'exact', got '%s'", payload.Scheme)
			}
			if payload.Network != "solana" {
				t.Errorf("expected network 'solana', got '%s'", payload.Network)
			}

			// Validate SVM payload
			svmPayload, ok := payload.Payload.(map[string]any)
			if !ok {
				t.Fatalf("expected map[string]any type, got %T", payload.Payload)
			}
			transaction, ok := svmPayload["transaction"].(string)
			if !ok {
				t.Fatal("expected transaction field to be a string")
			}
			if transaction == "" {
				t.Error("expected non-empty transaction")
			}
		})
	}
}

func TestWithKeygenFile(t *testing.T) {
	// Create a temporary directory for test files
	tmpDir, err := os.MkdirTemp("", "x402-svm-test-*")
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

	tests := []struct {
		name    string
		path    string
		wantErr error
	}{
		{
			name:    "valid keygen file",
			path:    validPath,
			wantErr: nil,
		},
		{
			name:    "non-existent file",
			path:    filepath.Join(tmpDir, "nonexistent.json"),
			wantErr: x402.ErrInvalidKeystore,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signer, err := NewSigner(
				WithKeygenFile(tt.path),
				WithNetwork("solana"),
				WithToken("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC", 6),
			)

			if tt.wantErr != nil {
				if err == nil {
					t.Fatalf("expected error %v, got nil", tt.wantErr)
				}
				if !errorContains(err, tt.wantErr.Error()) {
					t.Fatalf("expected error %v, got %v", tt.wantErr, err)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if signer == nil {
				t.Fatal("expected signer to be non-nil")
			}
		})
	}
}

func TestWithKeygenFile_InvalidJSON(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "x402-svm-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	invalidPath := filepath.Join(tmpDir, "invalid.json")
	err = os.WriteFile(invalidPath, []byte("not valid json"), 0600)
	if err != nil {
		t.Fatalf("failed to write invalid file: %v", err)
	}

	_, err = NewSigner(
		WithKeygenFile(invalidPath),
		WithNetwork("solana"),
		WithToken("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC", 6),
	)

	if err == nil {
		t.Fatal("expected error for invalid JSON, got nil")
	}

	if !errorContains(err, x402.ErrInvalidKeystore.Error()) {
		t.Errorf("expected ErrInvalidKeystore, got %v", err)
	}
}

func TestWithKeygenFile_InvalidKeyLength(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "x402-svm-test-*")
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

	_, err = NewSigner(
		WithKeygenFile(wrongLengthPath),
		WithNetwork("solana"),
		WithToken("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC", 6),
	)

	if err == nil {
		t.Fatal("expected error for invalid key length, got nil")
	}

	if !errorContains(err, x402.ErrInvalidKeystore.Error()) {
		t.Errorf("expected ErrInvalidKeystore, got %v", err)
	}
}

func TestTokenPriority(t *testing.T) {
	signer, err := NewSigner(
		WithPrivateKey(testPrivateKeyBase58),
		WithNetwork("solana"),
		WithTokenPriority("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC", 6, 1),
		WithTokenPriority("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", "USDT", 6, 2),
		WithToken("So11111111111111111111111111111111111111112", "SOL", 9), // default priority 0
	)
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	tokens := signer.GetTokens()
	if len(tokens) != 3 {
		t.Fatalf("expected 3 tokens, got %d", len(tokens))
	}

	// Check priorities
	priorities := make(map[string]int)
	for _, token := range tokens {
		priorities[token.Symbol] = token.Priority
	}

	if priorities["USDC"] != 1 {
		t.Errorf("expected USDC priority 1, got %d", priorities["USDC"])
	}
	if priorities["USDT"] != 2 {
		t.Errorf("expected USDT priority 2, got %d", priorities["USDT"])
	}
	if priorities["SOL"] != 0 {
		t.Errorf("expected SOL priority 0, got %d", priorities["SOL"])
	}
}

// Helper function to check if error message contains expected string
func errorContains(err error, substr string) bool {
	if err == nil {
		return false
	}
	return contains(err.Error(), substr)
}

func contains(s, substr string) bool {
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

func TestTransactionStructure(t *testing.T) {
	signer, err := NewSigner(
		WithPrivateKey(testPrivateKeyBase58),
		WithNetwork("solana"),
		WithToken("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "USDC", 6),
	)
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	requirements := &x402.PaymentRequirement{
		Scheme:            "exact",
		Network:           "solana",
		Asset:             "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
		MaxAmountRequired: "1000000", // 1 USDC
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

	svmPayload, ok := payload.Payload.(map[string]any)
	if !ok {
		t.Fatalf("expected map[string]any type, got %T", payload.Payload)
	}

	transactionBase64, ok := svmPayload["transaction"].(string)
	if !ok {
		t.Fatal("expected transaction field to be a string")
	}

	// Deserialize the transaction from base64
	var tx solana.Transaction
	err = tx.UnmarshalBase64(transactionBase64)
	if err != nil {
		t.Fatalf("failed to unmarshal transaction: %v", err)
	}

	// Verify transaction structure
	if len(tx.Message.Instructions) != 3 {
		t.Fatalf("expected 3 instructions, got %d", len(tx.Message.Instructions))
	}

	// Verify instruction 0: SetComputeUnitLimit
	inst0 := tx.Message.Instructions[0]
	programID0, err := tx.Message.Program(inst0.ProgramIDIndex)
	if err != nil {
		t.Fatalf("failed to get program ID for instruction 0: %v", err)
	}
	if !programID0.Equals(ComputeBudgetProgramID) {
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
	if !programID1.Equals(ComputeBudgetProgramID) {
		t.Errorf("instruction 1: expected ComputeBudget program, got %s", programID1)
	}
	if len(inst1.Data) != 9 {
		t.Errorf("instruction 1: expected 9 bytes of data, got %d", len(inst1.Data))
	}
	if inst1.Data[0] != 3 {
		t.Errorf("instruction 1: expected discriminator 3 (SetComputeUnitPrice), got %d", inst1.Data[0])
	}

	// Verify instruction 2: TransferChecked
	inst2 := tx.Message.Instructions[2]
	programID2, err := tx.Message.Program(inst2.ProgramIDIndex)
	if err != nil {
		t.Fatalf("failed to get program ID for instruction 2: %v", err)
	}
	if !programID2.Equals(solana.TokenProgramID) {
		t.Errorf("instruction 2: expected Token program, got %s", programID2)
	}
	if len(inst2.Data) != 10 {
		t.Errorf("instruction 2: expected 10 bytes of data, got %d", len(inst2.Data))
	}
	if inst2.Data[0] != 12 {
		t.Errorf("instruction 2: expected discriminator 12 (TransferChecked), got %d", inst2.Data[0])
	}
	// Verify decimals (last byte)
	if inst2.Data[9] != 6 {
		t.Errorf("instruction 2: expected decimals 6, got %d", inst2.Data[9])
	}

	// Verify amount (bytes 1-8, little-endian u64)
	amount := uint64(inst2.Data[1]) |
		uint64(inst2.Data[2])<<8 |
		uint64(inst2.Data[3])<<16 |
		uint64(inst2.Data[4])<<24 |
		uint64(inst2.Data[5])<<32 |
		uint64(inst2.Data[6])<<40 |
		uint64(inst2.Data[7])<<48 |
		uint64(inst2.Data[8])<<56
	if amount != 1000000 {
		t.Errorf("instruction 2: expected amount 1000000, got %d", amount)
	}

	// Verify TransferChecked has 4 accounts (source, mint, destination, authority)
	if len(inst2.Accounts) != 4 {
		t.Errorf("instruction 2: expected 4 accounts, got %d", len(inst2.Accounts))
	}

	t.Logf("Transaction structure validated successfully")
	t.Logf("Transaction base64: %s", transactionBase64[:50]+"...")
}
