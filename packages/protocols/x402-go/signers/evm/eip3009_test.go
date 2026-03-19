package evm

import (
	"math/big"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

func TestCreateEIP3009Authorization(t *testing.T) {
	from := common.HexToAddress("0x1111111111111111111111111111111111111111")
	to := common.HexToAddress("0x2222222222222222222222222222222222222222")
	value := big.NewInt(1000000)
	timeout := 60

	auth, err := CreateEIP3009Authorization(from, to, value, timeout)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Validate fields
	if auth.From != from {
		t.Errorf("expected from %s, got %s", from.Hex(), auth.From.Hex())
	}
	if auth.To != to {
		t.Errorf("expected to %s, got %s", to.Hex(), auth.To.Hex())
	}
	if auth.Value.Cmp(value) != 0 {
		t.Errorf("expected value %s, got %s", value.String(), auth.Value.String())
	}

	// Validate timing
	if auth.ValidAfter == nil {
		t.Fatal("expected validAfter to be set")
	}
	if auth.ValidBefore == nil {
		t.Fatal("expected validBefore to be set")
	}

	// ValidBefore should be approximately ValidAfter + timeout + 10 seconds (clock drift buffer)
	// We subtract 10 seconds from validAfter for clock drift, so the actual window is timeout + 10
	expectedBefore := new(big.Int).Add(auth.ValidAfter, big.NewInt(int64(timeout+10)))
	if auth.ValidBefore.Cmp(expectedBefore) != 0 {
		t.Errorf("expected validBefore %s, got %s", expectedBefore.String(), auth.ValidBefore.String())
	}

	// Nonce should be non-zero
	if auth.Nonce == (common.Hash{}) {
		t.Error("expected nonce to be non-zero")
	}
}

func TestGenerateNonce(t *testing.T) {
	// Generate multiple nonces and ensure they're unique
	nonces := make(map[common.Hash]bool)
	for i := 0; i < 100; i++ {
		nonce, err := generateNonce()
		if err != nil {
			t.Fatalf("failed to generate nonce: %v", err)
		}

		if nonce == (common.Hash{}) {
			t.Error("generated nonce is zero")
		}

		if nonces[nonce] {
			t.Error("duplicate nonce generated")
		}
		nonces[nonce] = true
	}
}

func TestSignTransferAuthorization(t *testing.T) {
	// Create test private key
	privateKey, err := crypto.HexToECDSA(testPrivateKeyHex)
	if err != nil {
		t.Fatalf("failed to parse private key: %v", err)
	}

	tokenAddress := common.HexToAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
	chainID := big.NewInt(8453) // Base
	from := crypto.PubkeyToAddress(privateKey.PublicKey)
	to := common.HexToAddress("0x2222222222222222222222222222222222222222")
	value := big.NewInt(1000000)

	auth, err := CreateEIP3009Authorization(from, to, value, 60)
	if err != nil {
		t.Fatalf("failed to create authorization: %v", err)
	}

	signature, err := SignTransferAuthorization(privateKey, tokenAddress, chainID, auth, "USD Coin", "2")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Validate signature format
	if !strings.HasPrefix(signature, "0x") {
		t.Error("signature should have 0x prefix")
	}

	// Remove 0x prefix and validate length
	sigHex := strings.TrimPrefix(signature, "0x")
	if len(sigHex) != 130 { // 65 bytes * 2 hex chars
		t.Errorf("expected signature length 130, got %d", len(sigHex))
	}

	// Validate signature is not empty bytes
	if sigHex == strings.Repeat("0", 130) {
		t.Error("signature is all zeros")
	}
}

func TestSignTransferAuthorization_DifferentNetworks(t *testing.T) {
	privateKey, err := crypto.HexToECDSA(testPrivateKeyHex)
	if err != nil {
		t.Fatalf("failed to parse private key: %v", err)
	}

	tokenAddress := common.HexToAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
	from := crypto.PubkeyToAddress(privateKey.PublicKey)
	to := common.HexToAddress("0x2222222222222222222222222222222222222222")
	value := big.NewInt(1000000)

	auth, err := CreateEIP3009Authorization(from, to, value, 60)
	if err != nil {
		t.Fatalf("failed to create authorization: %v", err)
	}

	networks := map[string]*big.Int{
		"base":         big.NewInt(8453),
		"base-sepolia": big.NewInt(84532),
		"ethereum":     big.NewInt(1),
		"sepolia":      big.NewInt(11155111),
	}

	signatures := make(map[string]string)

	for network, chainID := range networks {
		sig, err := SignTransferAuthorization(privateKey, tokenAddress, chainID, auth, "USD Coin", "2")
		if err != nil {
			t.Fatalf("failed to sign for network %s: %v", network, err)
		}

		signatures[network] = sig

		// Validate format
		if !strings.HasPrefix(sig, "0x") {
			t.Errorf("signature for %s missing 0x prefix", network)
		}
	}

	// Signatures should be different for different chain IDs
	for network1, sig1 := range signatures {
		for network2, sig2 := range signatures {
			if network1 != network2 && sig1 == sig2 {
				t.Errorf("signatures for %s and %s should differ", network1, network2)
			}
		}
	}
}

func TestSignTransferAuthorization_DifferentAuthorizations(t *testing.T) {
	privateKey, err := crypto.HexToECDSA(testPrivateKeyHex)
	if err != nil {
		t.Fatalf("failed to parse private key: %v", err)
	}

	tokenAddress := common.HexToAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
	chainID := big.NewInt(8453)
	from := crypto.PubkeyToAddress(privateKey.PublicKey)
	to := common.HexToAddress("0x2222222222222222222222222222222222222222")

	// Create two different authorizations
	auth1, err := CreateEIP3009Authorization(from, to, big.NewInt(1000000), 60)
	if err != nil {
		t.Fatalf("failed to create auth1: %v", err)
	}

	auth2, err := CreateEIP3009Authorization(from, to, big.NewInt(2000000), 60)
	if err != nil {
		t.Fatalf("failed to create auth2: %v", err)
	}

	sig1, err := SignTransferAuthorization(privateKey, tokenAddress, chainID, auth1, "USD Coin", "2")
	if err != nil {
		t.Fatalf("failed to sign auth1: %v", err)
	}

	sig2, err := SignTransferAuthorization(privateKey, tokenAddress, chainID, auth2, "USD Coin", "2")
	if err != nil {
		t.Fatalf("failed to sign auth2: %v", err)
	}

	// Signatures should be different for different amounts
	if sig1 == sig2 {
		t.Error("signatures should differ for different amounts")
	}
}

func TestSignTransferAuthorization_DeterministicWithSameAuth(t *testing.T) {
	privateKey, err := crypto.HexToECDSA(testPrivateKeyHex)
	if err != nil {
		t.Fatalf("failed to parse private key: %v", err)
	}

	tokenAddress := common.HexToAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
	chainID := big.NewInt(8453)
	from := crypto.PubkeyToAddress(privateKey.PublicKey)
	to := common.HexToAddress("0x2222222222222222222222222222222222222222")

	// Create authorization with fixed nonce
	auth := &EIP3009Authorization{
		From:        from,
		To:          to,
		Value:       big.NewInt(1000000),
		ValidAfter:  big.NewInt(1700000000),
		ValidBefore: big.NewInt(1700000060),
		Nonce:       common.HexToHash("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"),
	}

	// Sign the same authorization multiple times
	sig1, err := SignTransferAuthorization(privateKey, tokenAddress, chainID, auth, "USD Coin", "2")
	if err != nil {
		t.Fatalf("failed to sign (1): %v", err)
	}

	sig2, err := SignTransferAuthorization(privateKey, tokenAddress, chainID, auth, "USD Coin", "2")
	if err != nil {
		t.Fatalf("failed to sign (2): %v", err)
	}

	// Signatures should be identical with same inputs
	if sig1 != sig2 {
		t.Error("signatures should be deterministic with same inputs")
	}
}

func TestSignTransferAuthorization_DifferentTokenAddresses(t *testing.T) {
	// Test that different token addresses produce different signatures
	privateKey, err := crypto.HexToECDSA(testPrivateKeyHex)
	if err != nil {
		t.Fatalf("failed to parse private key: %v", err)
	}

	chainID := big.NewInt(8453)
	from := crypto.PubkeyToAddress(privateKey.PublicKey)
	to := common.HexToAddress("0x2222222222222222222222222222222222222222")

	auth := &EIP3009Authorization{
		From:        from,
		To:          to,
		Value:       big.NewInt(1000000),
		ValidAfter:  big.NewInt(1700000000),
		ValidBefore: big.NewInt(1700000060),
		Nonce:       common.HexToHash("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"),
	}

	tokenAddress1 := common.HexToAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
	tokenAddress2 := common.HexToAddress("0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb")

	sig1, err := SignTransferAuthorization(privateKey, tokenAddress1, chainID, auth, "USD Coin", "2")
	if err != nil {
		t.Fatalf("failed to sign with token1: %v", err)
	}

	sig2, err := SignTransferAuthorization(privateKey, tokenAddress2, chainID, auth, "USD Coin", "2")
	if err != nil {
		t.Fatalf("failed to sign with token2: %v", err)
	}

	// Signatures should differ for different token addresses
	if sig1 == sig2 {
		t.Error("signatures should differ for different token addresses")
	}
}
