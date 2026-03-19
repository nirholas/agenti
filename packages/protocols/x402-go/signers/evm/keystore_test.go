package evm

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/ethereum/go-ethereum/accounts/keystore"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/mark3labs/x402-go"
)

// Valid BIP39 test mnemonic (DO NOT use in production)
const testMnemonic = "test test test test test test test test test test test junk"

func TestWithMnemonic(t *testing.T) {
	tests := []struct {
		name         string
		mnemonic     string
		accountIndex uint32
		wantErr      error
	}{
		{
			name:         "valid mnemonic account 0",
			mnemonic:     testMnemonic,
			accountIndex: 0,
			wantErr:      nil,
		},
		{
			name:         "valid mnemonic account 1",
			mnemonic:     testMnemonic,
			accountIndex: 1,
			wantErr:      nil,
		},
		{
			name:         "invalid mnemonic",
			mnemonic:     "invalid mnemonic phrase",
			accountIndex: 0,
			wantErr:      x402.ErrInvalidMnemonic,
		},
		{
			name:         "empty mnemonic",
			mnemonic:     "",
			accountIndex: 0,
			wantErr:      x402.ErrInvalidMnemonic,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signer, err := NewSigner(
				WithMnemonic(tt.mnemonic, tt.accountIndex),
				WithNetwork("base"),
				WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
			)

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

			// Verify private key was derived
			if signer.privateKey == nil {
				t.Fatal("expected private key to be set")
			}
		})
	}
}

func TestWithMnemonic_DifferentAccounts(t *testing.T) {
	// Derive two different accounts from the same mnemonic
	signer0, err := NewSigner(
		WithMnemonic(testMnemonic, 0),
		WithNetwork("base"),
		WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
	)
	if err != nil {
		t.Fatalf("failed to create signer for account 0: %v", err)
	}

	signer1, err := NewSigner(
		WithMnemonic(testMnemonic, 1),
		WithNetwork("base"),
		WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
	)
	if err != nil {
		t.Fatalf("failed to create signer for account 1: %v", err)
	}

	// Addresses should be different
	addr0 := signer0.Address()
	addr1 := signer1.Address()

	if addr0 == addr1 {
		t.Error("different account indices should produce different addresses")
	}
}

func TestWithMnemonic_Deterministic(t *testing.T) {
	// Same mnemonic and account index should always produce same address
	signer1, err := NewSigner(
		WithMnemonic(testMnemonic, 0),
		WithNetwork("base"),
		WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
	)
	if err != nil {
		t.Fatalf("failed to create signer1: %v", err)
	}

	signer2, err := NewSigner(
		WithMnemonic(testMnemonic, 0),
		WithNetwork("base"),
		WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
	)
	if err != nil {
		t.Fatalf("failed to create signer2: %v", err)
	}

	addr1 := signer1.Address()
	addr2 := signer2.Address()

	if addr1 != addr2 {
		t.Errorf("same mnemonic should produce same address, got %s and %s", addr1.Hex(), addr2.Hex())
	}
}

func TestWithKeystore(t *testing.T) {
	// Create a temporary directory for test keystore files
	tmpDir, err := os.MkdirTemp("", "x402-keystore-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create a test keystore file
	password := "testpassword123"
	privateKey, err := crypto.HexToECDSA(testPrivateKeyHex)
	if err != nil {
		t.Fatalf("failed to parse test private key: %v", err)
	}

	// Create keystore using go-ethereum
	ks := keystore.NewKeyStore(tmpDir, keystore.StandardScryptN, keystore.StandardScryptP)
	account, err := ks.ImportECDSA(privateKey, password)
	if err != nil {
		t.Fatalf("failed to create keystore: %v", err)
	}

	keystorePath := account.URL.Path

	tests := []struct {
		name         string
		keystorePath string
		password     string
		wantErr      error
		checkAddress *common.Address
	}{
		{
			name:         "valid keystore with correct password",
			keystorePath: keystorePath,
			password:     password,
			wantErr:      nil,
			checkAddress: &account.Address,
		},
		{
			name:         "valid keystore with wrong password",
			keystorePath: keystorePath,
			password:     "wrongpassword",
			wantErr:      x402.ErrInvalidKeystore,
		},
		{
			name:         "non-existent keystore file",
			keystorePath: filepath.Join(tmpDir, "nonexistent.json"),
			password:     password,
			wantErr:      x402.ErrInvalidKeystore,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signer, err := NewSigner(
				WithKeystore(tt.keystorePath, tt.password),
				WithNetwork("base"),
				WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
			)

			if tt.wantErr != nil {
				if err == nil {
					t.Fatalf("expected error %v, got nil", tt.wantErr)
				}
				// Check error type/message contains the expected error
				if err != tt.wantErr && !errorContains(err, tt.wantErr) {
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

			// Verify address matches
			if tt.checkAddress != nil {
				if signer.Address() != *tt.checkAddress {
					t.Errorf("expected address %s, got %s", tt.checkAddress.Hex(), signer.Address().Hex())
				}
			}
		})
	}
}

func TestWithKeystore_InvalidJSON(t *testing.T) {
	// Create a temporary directory
	tmpDir, err := os.MkdirTemp("", "x402-keystore-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create an invalid JSON file
	invalidPath := filepath.Join(tmpDir, "invalid.json")
	err = os.WriteFile(invalidPath, []byte("not valid json"), 0600)
	if err != nil {
		t.Fatalf("failed to write invalid keystore: %v", err)
	}

	_, err = NewSigner(
		WithKeystore(invalidPath, "password"),
		WithNetwork("base"),
		WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
	)

	if err == nil {
		t.Fatal("expected error for invalid JSON, got nil")
	}

	if !errorContains(err, x402.ErrInvalidKeystore) {
		t.Errorf("expected ErrInvalidKeystore, got %v", err)
	}
}

func TestWithKeystore_MalformedKeystore(t *testing.T) {
	// Create a temporary directory
	tmpDir, err := os.MkdirTemp("", "x402-keystore-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create a valid JSON but malformed keystore
	malformedPath := filepath.Join(tmpDir, "malformed.json")
	malformedData := map[string]interface{}{
		"crypto": map[string]interface{}{
			"cipher": "invalid",
		},
	}
	data, _ := json.Marshal(malformedData)
	err = os.WriteFile(malformedPath, data, 0600)
	if err != nil {
		t.Fatalf("failed to write malformed keystore: %v", err)
	}

	_, err = NewSigner(
		WithKeystore(malformedPath, "password"),
		WithNetwork("base"),
		WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
	)

	if err == nil {
		t.Fatal("expected error for malformed keystore, got nil")
	}

	if !errorContains(err, x402.ErrInvalidKeystore) {
		t.Errorf("expected ErrInvalidKeystore, got %v", err)
	}
}

func TestDeriveEthereumKey(t *testing.T) {
	// Generate seed from test mnemonic
	seed := []byte("test seed for BIP32 derivation - DO NOT USE IN PRODUCTION - this is just for testing")

	// Derive multiple accounts
	key0, err := deriveEthereumKey(seed, 0)
	if err != nil {
		t.Fatalf("failed to derive key 0: %v", err)
	}

	key1, err := deriveEthereumKey(seed, 1)
	if err != nil {
		t.Fatalf("failed to derive key 1: %v", err)
	}

	// Keys should be different
	addr0 := crypto.PubkeyToAddress(key0.PublicKey)
	addr1 := crypto.PubkeyToAddress(key1.PublicKey)

	if addr0 == addr1 {
		t.Error("different indices should produce different keys")
	}

	// Same index should be deterministic
	key0Again, err := deriveEthereumKey(seed, 0)
	if err != nil {
		t.Fatalf("failed to derive key 0 again: %v", err)
	}

	addr0Again := crypto.PubkeyToAddress(key0Again.PublicKey)
	if addr0 != addr0Again {
		t.Error("same seed and index should produce same key")
	}
}

// Helper function to check if error contains expected error
func errorContains(err, target error) bool {
	if err == nil || target == nil {
		return false
	}
	return err == target || (err.Error() != "" && contains(err.Error(), target.Error()))
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
