package evm

import (
	"math/big"
	"testing"

	v2 "github.com/mark3labs/x402-go/v2"
)

// testPrivateKey is the Foundry/Anvil first default account private key.
// This is a well-known test key - NEVER use in production.
const testPrivateKey = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

// testAddress is the address derived from testPrivateKey.
const testAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

func TestNewSigner(t *testing.T) {
	network := "eip155:84532"
	tokens := []v2.TokenConfig{
		{Address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", Symbol: "USDC", Decimals: 6},
	}

	signer, err := NewSigner(network, testPrivateKey, tokens)
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}

	if signer.Network() != network {
		t.Errorf("Expected network %s, got %s", network, signer.Network())
	}

	if signer.Address().Hex() != testAddress {
		t.Errorf("Expected address %s, got %s", testAddress, signer.Address().Hex())
	}
}

func TestCanSign(t *testing.T) {
	network := "eip155:84532"
	tokens := []v2.TokenConfig{
		{Address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", Symbol: "USDC", Decimals: 6},
	}

	signer, err := NewSigner(network, testPrivateKey, tokens)
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}

	tests := []struct {
		name         string
		requirements *v2.PaymentRequirements
		expected     bool
	}{
		{
			name: "valid requirements",
			requirements: &v2.PaymentRequirements{
				Scheme:            "exact",
				Network:           "eip155:84532",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Amount:            "1000000",
				PayTo:             "0x receiver",
				MaxTimeoutSeconds: 300,
			},
			expected: true,
		},
		{
			name: "wrong network",
			requirements: &v2.PaymentRequirements{
				Scheme:            "exact",
				Network:           "eip155:1",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Amount:            "1000000",
				PayTo:             "0x receiver",
				MaxTimeoutSeconds: 300,
			},
			expected: false,
		},
		{
			name: "wrong scheme",
			requirements: &v2.PaymentRequirements{
				Scheme:            "any",
				Network:           "eip155:84532",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Amount:            "1000000",
				PayTo:             "0x receiver",
				MaxTimeoutSeconds: 300,
			},
			expected: false,
		},
		{
			name: "wrong asset",
			requirements: &v2.PaymentRequirements{
				Scheme:            "exact",
				Network:           "eip155:84532",
				Asset:             "0xwrong",
				Amount:            "1000000",
				PayTo:             "0x receiver",
				MaxTimeoutSeconds: 300,
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := signer.CanSign(tt.requirements)
			if result != tt.expected {
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestSign(t *testing.T) {
	network := "eip155:84532"
	tokens := []v2.TokenConfig{
		{Address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", Symbol: "USDC", Decimals: 6},
	}

	signer, err := NewSigner(network, testPrivateKey, tokens)
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}

	requirements := &v2.PaymentRequirements{
		Scheme:            "exact",
		Network:           "eip155:84532",
		Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		Amount:            "1000000",
		PayTo:             "0x receiver",
		MaxTimeoutSeconds: 300,
		Extra: map[string]interface{}{
			"name":    "USD Coin",
			"version": "2",
		},
	}

	payload, err := signer.Sign(requirements)
	if err != nil {
		t.Fatalf("Failed to sign: %v", err)
	}

	if payload.X402Version != 2 {
		t.Errorf("Expected x402 version 2, got %d", payload.X402Version)
	}

	evmPayload, ok := payload.Payload.(v2.EVMPayload)
	if !ok {
		t.Fatal("Expected EVMPayload")
	}

	if evmPayload.Signature == "" {
		t.Error("Expected non-empty signature")
	}

	if evmPayload.Authorization.From == "" {
		t.Error("Expected non-empty from address")
	}
}

func TestSignAmountExceeded(t *testing.T) {
	network := "eip155:84532"
	tokens := []v2.TokenConfig{
		{Address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", Symbol: "USDC", Decimals: 6},
	}

	signer, err := NewSigner(network, testPrivateKey, tokens, WithMaxAmount(new(big.Int).SetUint64(100000)))
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}

	requirements := &v2.PaymentRequirements{
		Scheme:            "exact",
		Network:           "eip155:84532",
		Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		Amount:            "2000000",
		PayTo:             "0x receiver",
		MaxTimeoutSeconds: 300,
		Extra: map[string]interface{}{
			"name":    "USD Coin",
			"version": "2",
		},
	}

	_, err = signer.Sign(requirements)
	if err != v2.ErrAmountExceeded {
		t.Errorf("Expected ErrAmountExceeded, got %v", err)
	}
}

func TestGetChainID(t *testing.T) {
	tests := []struct {
		network   string
		expected  int64
		expectErr bool
	}{
		{"eip155:8453", 8453, false},
		{"eip155:84532", 84532, false},
		{"eip155:1", 1, false},
		{"eip155:11155111", 11155111, false},
		{"eip155:137", 137, false},
		{"eip155:80002", 80002, false},
		{"eip155:43114", 43114, false},
		{"eip155:43113", 43113, false},
		{"invalid", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.network, func(t *testing.T) {
			result, err := GetChainID(tt.network)
			if tt.expectErr {
				if err == nil {
					t.Error("Expected error, got nil")
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if result != tt.expected {
					t.Errorf("Expected %d, got %d", tt.expected, result)
				}
			}
		})
	}
}
