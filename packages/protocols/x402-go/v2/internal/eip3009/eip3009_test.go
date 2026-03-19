package eip3009

import (
	"bytes"
	"encoding/hex"
	"math/big"
	"strings"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

// testPrivateKey is the Foundry/Anvil first default account private key.
// This is a well-known test key - NEVER use in production.
const testPrivateKey = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

// testAddress is the address derived from testPrivateKey.
const testAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

func TestGenerateNonce(t *testing.T) {
	t.Run("returns 32 byte nonce", func(t *testing.T) {
		nonce, err := GenerateNonce()
		if err != nil {
			t.Fatalf("Failed to generate nonce: %v", err)
		}
		if len(nonce[:]) != 32 {
			t.Errorf("Expected 32 byte nonce, got %d bytes", len(nonce[:]))
		}
	})

	t.Run("generates unique nonces", func(t *testing.T) {
		nonces := make(map[string]bool)
		for i := 0; i < 100; i++ {
			nonce, err := GenerateNonce()
			if err != nil {
				t.Fatalf("Failed to generate nonce: %v", err)
			}
			key := hex.EncodeToString(nonce[:])
			if nonces[key] {
				t.Errorf("Duplicate nonce generated: %s", key)
			}
			nonces[key] = true
		}
	})

	t.Run("generates non-zero nonces", func(t *testing.T) {
		for i := 0; i < 10; i++ {
			nonce, err := GenerateNonce()
			if err != nil {
				t.Fatalf("Failed to generate nonce: %v", err)
			}
			var zeroNonce [32]byte
			if bytes.Equal(nonce[:], zeroNonce[:]) {
				t.Error("Generated zero nonce")
			}
		}
	})
}

func TestCreateAuthorization(t *testing.T) {
	from := common.HexToAddress(testAddress)
	to := common.HexToAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
	value := big.NewInt(1000000)
	timeoutSeconds := 300

	t.Run("creates valid authorization", func(t *testing.T) {
		auth, err := CreateAuthorization(from, to, value, timeoutSeconds)
		if err != nil {
			t.Fatalf("Failed to create authorization: %v", err)
		}

		if auth.From != from {
			t.Errorf("Expected from %s, got %s", from.Hex(), auth.From.Hex())
		}
		if auth.To != to {
			t.Errorf("Expected to %s, got %s", to.Hex(), auth.To.Hex())
		}
		if auth.Value.Cmp(value) != 0 {
			t.Errorf("Expected value %s, got %s", value.String(), auth.Value.String())
		}
	})

	t.Run("sets valid time bounds", func(t *testing.T) {
		before := time.Now().Unix()
		auth, err := CreateAuthorization(from, to, value, timeoutSeconds)
		if err != nil {
			t.Fatalf("Failed to create authorization: %v", err)
		}
		after := time.Now().Unix()

		// validAfter should be slightly before now (now - 10)
		expectedValidAfterMin := before - 11
		expectedValidAfterMax := after - 9
		if auth.ValidAfter.Int64() < expectedValidAfterMin || auth.ValidAfter.Int64() > expectedValidAfterMax {
			t.Errorf("ValidAfter %d not in expected range [%d, %d]",
				auth.ValidAfter.Int64(), expectedValidAfterMin, expectedValidAfterMax)
		}

		// validBefore should be now + timeout
		expectedValidBeforeMin := before + int64(timeoutSeconds) - 1
		expectedValidBeforeMax := after + int64(timeoutSeconds) + 1
		if auth.ValidBefore.Int64() < expectedValidBeforeMin || auth.ValidBefore.Int64() > expectedValidBeforeMax {
			t.Errorf("ValidBefore %d not in expected range [%d, %d]",
				auth.ValidBefore.Int64(), expectedValidBeforeMin, expectedValidBeforeMax)
		}
	})

	t.Run("generates unique nonces per authorization", func(t *testing.T) {
		auth1, err := CreateAuthorization(from, to, value, timeoutSeconds)
		if err != nil {
			t.Fatalf("Failed to create authorization 1: %v", err)
		}

		auth2, err := CreateAuthorization(from, to, value, timeoutSeconds)
		if err != nil {
			t.Fatalf("Failed to create authorization 2: %v", err)
		}

		if bytes.Equal(auth1.Nonce[:], auth2.Nonce[:]) {
			t.Error("Two authorizations have the same nonce")
		}
	})

	t.Run("handles zero value", func(t *testing.T) {
		auth, err := CreateAuthorization(from, to, big.NewInt(0), timeoutSeconds)
		if err != nil {
			t.Fatalf("Failed to create authorization with zero value: %v", err)
		}
		if auth.Value.Cmp(big.NewInt(0)) != 0 {
			t.Errorf("Expected zero value, got %s", auth.Value.String())
		}
	})

	t.Run("handles large value", func(t *testing.T) {
		largeValue := new(big.Int)
		largeValue.SetString("1000000000000000000000000", 10) // 1M with 18 decimals
		auth, err := CreateAuthorization(from, to, largeValue, timeoutSeconds)
		if err != nil {
			t.Fatalf("Failed to create authorization with large value: %v", err)
		}
		if auth.Value.Cmp(largeValue) != 0 {
			t.Errorf("Expected value %s, got %s", largeValue.String(), auth.Value.String())
		}
	})

	t.Run("handles short timeout", func(t *testing.T) {
		auth, err := CreateAuthorization(from, to, value, 1)
		if err != nil {
			t.Fatalf("Failed to create authorization with short timeout: %v", err)
		}
		// validBefore should be only ~1 second after validAfter + 10
		diff := auth.ValidBefore.Int64() - auth.ValidAfter.Int64()
		expectedDiff := int64(1 + 10) // timeout + the 10 second buffer
		if diff < expectedDiff-1 || diff > expectedDiff+1 {
			t.Errorf("Time diff %d not close to expected %d", diff, expectedDiff)
		}
	})
}

func TestSignAuthorization(t *testing.T) {
	privateKey, err := crypto.HexToECDSA(testPrivateKey)
	if err != nil {
		t.Fatalf("Failed to parse private key: %v", err)
	}

	from := crypto.PubkeyToAddress(privateKey.PublicKey)
	to := common.HexToAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
	tokenAddress := common.HexToAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
	chainID := big.NewInt(84532) // Base Sepolia
	name := "USD Coin"
	version := "2"

	t.Run("creates valid signature", func(t *testing.T) {
		auth, err := CreateAuthorization(from, to, big.NewInt(1000000), 300)
		if err != nil {
			t.Fatalf("Failed to create authorization: %v", err)
		}

		sig, err := SignAuthorization(privateKey, tokenAddress, chainID, auth, name, version)
		if err != nil {
			t.Fatalf("Failed to sign authorization: %v", err)
		}

		// Signature should be 0x-prefixed
		if !strings.HasPrefix(sig, "0x") {
			t.Error("Signature should have 0x prefix")
		}

		// Signature should be 65 bytes (130 hex chars + 2 for 0x)
		if len(sig) != 132 {
			t.Errorf("Expected signature length 132, got %d", len(sig))
		}

		// Parse signature
		sigBytes, err := hex.DecodeString(sig[2:])
		if err != nil {
			t.Fatalf("Failed to decode signature: %v", err)
		}

		// v should be 27 or 28
		v := sigBytes[64]
		if v != 27 && v != 28 {
			t.Errorf("Expected v to be 27 or 28, got %d", v)
		}
	})

	t.Run("signatures are deterministic for same input", func(t *testing.T) {
		// Create a fixed nonce authorization manually
		auth := &Authorization{
			From:        from,
			To:          to,
			Value:       big.NewInt(1000000),
			ValidAfter:  big.NewInt(1000),
			ValidBefore: big.NewInt(2000),
			Nonce:       [32]byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32},
		}

		sig1, err := SignAuthorization(privateKey, tokenAddress, chainID, auth, name, version)
		if err != nil {
			t.Fatalf("Failed to sign authorization 1: %v", err)
		}

		sig2, err := SignAuthorization(privateKey, tokenAddress, chainID, auth, name, version)
		if err != nil {
			t.Fatalf("Failed to sign authorization 2: %v", err)
		}

		if sig1 != sig2 {
			t.Error("Same input should produce same signature")
		}
	})

	t.Run("different nonces produce different signatures", func(t *testing.T) {
		auth1, err := CreateAuthorization(from, to, big.NewInt(1000000), 300)
		if err != nil {
			t.Fatalf("Failed to create authorization 1: %v", err)
		}

		auth2, err := CreateAuthorization(from, to, big.NewInt(1000000), 300)
		if err != nil {
			t.Fatalf("Failed to create authorization 2: %v", err)
		}

		sig1, err := SignAuthorization(privateKey, tokenAddress, chainID, auth1, name, version)
		if err != nil {
			t.Fatalf("Failed to sign authorization 1: %v", err)
		}

		sig2, err := SignAuthorization(privateKey, tokenAddress, chainID, auth2, name, version)
		if err != nil {
			t.Fatalf("Failed to sign authorization 2: %v", err)
		}

		if sig1 == sig2 {
			t.Error("Different nonces should produce different signatures")
		}
	})

	t.Run("different chain IDs produce different signatures", func(t *testing.T) {
		auth := &Authorization{
			From:        from,
			To:          to,
			Value:       big.NewInt(1000000),
			ValidAfter:  big.NewInt(1000),
			ValidBefore: big.NewInt(2000),
			Nonce:       [32]byte{1, 2, 3, 4},
		}

		sigBase, err := SignAuthorization(privateKey, tokenAddress, big.NewInt(84532), auth, name, version)
		if err != nil {
			t.Fatalf("Failed to sign for Base Sepolia: %v", err)
		}

		sigMainnet, err := SignAuthorization(privateKey, tokenAddress, big.NewInt(1), auth, name, version)
		if err != nil {
			t.Fatalf("Failed to sign for Mainnet: %v", err)
		}

		if sigBase == sigMainnet {
			t.Error("Different chain IDs should produce different signatures")
		}
	})

	t.Run("different token addresses produce different signatures", func(t *testing.T) {
		auth := &Authorization{
			From:        from,
			To:          to,
			Value:       big.NewInt(1000000),
			ValidAfter:  big.NewInt(1000),
			ValidBefore: big.NewInt(2000),
			Nonce:       [32]byte{1, 2, 3, 4},
		}

		token1 := common.HexToAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
		token2 := common.HexToAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")

		sig1, err := SignAuthorization(privateKey, token1, chainID, auth, name, version)
		if err != nil {
			t.Fatalf("Failed to sign for token 1: %v", err)
		}

		sig2, err := SignAuthorization(privateKey, token2, chainID, auth, name, version)
		if err != nil {
			t.Fatalf("Failed to sign for token 2: %v", err)
		}

		if sig1 == sig2 {
			t.Error("Different token addresses should produce different signatures")
		}
	})

	t.Run("different amounts produce different signatures", func(t *testing.T) {
		baseAuth := &Authorization{
			From:        from,
			To:          to,
			ValidAfter:  big.NewInt(1000),
			ValidBefore: big.NewInt(2000),
			Nonce:       [32]byte{1, 2, 3, 4},
		}

		auth1 := *baseAuth
		auth1.Value = big.NewInt(1000000)

		auth2 := *baseAuth
		auth2.Value = big.NewInt(2000000)

		sig1, err := SignAuthorization(privateKey, tokenAddress, chainID, &auth1, name, version)
		if err != nil {
			t.Fatalf("Failed to sign auth 1: %v", err)
		}

		sig2, err := SignAuthorization(privateKey, tokenAddress, chainID, &auth2, name, version)
		if err != nil {
			t.Fatalf("Failed to sign auth 2: %v", err)
		}

		if sig1 == sig2 {
			t.Error("Different amounts should produce different signatures")
		}
	})

	t.Run("different recipients produce different signatures", func(t *testing.T) {
		baseAuth := &Authorization{
			From:        from,
			Value:       big.NewInt(1000000),
			ValidAfter:  big.NewInt(1000),
			ValidBefore: big.NewInt(2000),
			Nonce:       [32]byte{1, 2, 3, 4},
		}

		auth1 := *baseAuth
		auth1.To = common.HexToAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8")

		auth2 := *baseAuth
		auth2.To = common.HexToAddress("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC")

		sig1, err := SignAuthorization(privateKey, tokenAddress, chainID, &auth1, name, version)
		if err != nil {
			t.Fatalf("Failed to sign auth 1: %v", err)
		}

		sig2, err := SignAuthorization(privateKey, tokenAddress, chainID, &auth2, name, version)
		if err != nil {
			t.Fatalf("Failed to sign auth 2: %v", err)
		}

		if sig1 == sig2 {
			t.Error("Different recipients should produce different signatures")
		}
	})

	t.Run("different name/version produce different signatures", func(t *testing.T) {
		auth := &Authorization{
			From:        from,
			To:          to,
			Value:       big.NewInt(1000000),
			ValidAfter:  big.NewInt(1000),
			ValidBefore: big.NewInt(2000),
			Nonce:       [32]byte{1, 2, 3, 4},
		}

		sig1, err := SignAuthorization(privateKey, tokenAddress, chainID, auth, "USD Coin", "2")
		if err != nil {
			t.Fatalf("Failed to sign with name/version 1: %v", err)
		}

		sig2, err := SignAuthorization(privateKey, tokenAddress, chainID, auth, "USDC", "1")
		if err != nil {
			t.Fatalf("Failed to sign with name/version 2: %v", err)
		}

		if sig1 == sig2 {
			t.Error("Different name/version should produce different signatures")
		}
	})

	t.Run("handles zero value authorization", func(t *testing.T) {
		auth, err := CreateAuthorization(from, to, big.NewInt(0), 300)
		if err != nil {
			t.Fatalf("Failed to create authorization: %v", err)
		}

		sig, err := SignAuthorization(privateKey, tokenAddress, chainID, auth, name, version)
		if err != nil {
			t.Fatalf("Failed to sign zero value authorization: %v", err)
		}

		if sig == "" {
			t.Error("Expected non-empty signature")
		}
	})
}

func TestAuthorizationFields(t *testing.T) {
	t.Run("Authorization struct has all required fields", func(t *testing.T) {
		auth := Authorization{}

		// Verify field types by assignment
		auth.From = common.Address{}
		auth.To = common.Address{}
		auth.Value = big.NewInt(0)
		auth.ValidAfter = big.NewInt(0)
		auth.ValidBefore = big.NewInt(0)
		auth.Nonce = [32]byte{}

		// If this compiles, the struct has all required fields with correct types
	})
}
