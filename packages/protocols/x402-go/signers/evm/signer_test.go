package evm

import (
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/mark3labs/x402-go"
)

// Test private key (DO NOT use in production)
const testPrivateKeyHex = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

func TestNewSigner(t *testing.T) {
	tests := []struct {
		name    string
		opts    []SignerOption
		wantErr error
	}{
		{
			name: "valid signer with all options",
			opts: []SignerOption{
				WithPrivateKey(testPrivateKeyHex),
				WithNetwork("base"),
				WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
				WithPriority(1),
				WithMaxAmountPerCall("1000000"),
			},
			wantErr: nil,
		},
		{
			name: "valid signer with 0x prefix",
			opts: []SignerOption{
				WithPrivateKey("0x" + testPrivateKeyHex),
				WithNetwork("base"),
				WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
			},
			wantErr: nil,
		},
		{
			name: "valid signer with multiple tokens",
			opts: []SignerOption{
				WithPrivateKey(testPrivateKeyHex),
				WithNetwork("base"),
				WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
				WithTokenPriority("0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", "DAI", 18, 2),
			},
			wantErr: nil,
		},
		{
			name: "missing private key",
			opts: []SignerOption{
				WithNetwork("base"),
				WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
			},
			wantErr: x402.ErrInvalidKey,
		},
		{
			name: "missing network",
			opts: []SignerOption{
				WithPrivateKey(testPrivateKeyHex),
				WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
			},
			wantErr: x402.ErrInvalidNetwork,
		},
		{
			name: "missing tokens",
			opts: []SignerOption{
				WithPrivateKey(testPrivateKeyHex),
				WithNetwork("base"),
			},
			wantErr: x402.ErrNoTokens,
		},
		{
			name: "invalid private key",
			opts: []SignerOption{
				WithPrivateKey("invalid"),
				WithNetwork("base"),
				WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
			},
			wantErr: x402.ErrInvalidKey,
		},
		{
			name: "invalid max amount",
			opts: []SignerOption{
				WithPrivateKey(testPrivateKeyHex),
				WithNetwork("base"),
				WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
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
		WithPrivateKey(testPrivateKeyHex),
		WithNetwork("base"),
		WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
		WithPriority(5),
		WithMaxAmountPerCall("1000000"),
	)
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	// Test Network()
	if network := signer.Network(); network != "base" {
		t.Errorf("expected network 'base', got '%s'", network)
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
	expectedAddress := crypto.PubkeyToAddress(signer.privateKey.PublicKey)
	if signer.Address() != expectedAddress {
		t.Errorf("expected address %s, got %s", expectedAddress.Hex(), signer.Address().Hex())
	}
}

func TestCanSign(t *testing.T) {
	signer, err := NewSigner(
		WithPrivateKey(testPrivateKeyHex),
		WithNetwork("base"),
		WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
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
				Network:           "base",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				MaxAmountRequired: "100000",
				PayTo:             "0x1234567890123456789012345678901234567890",
			},
			want: true,
		},
		{
			name: "case insensitive token address",
			requirements: &x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				Asset:             "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // lowercase
				MaxAmountRequired: "100000",
				PayTo:             "0x1234567890123456789012345678901234567890",
			},
			want: true,
		},
		{
			name: "wrong network",
			requirements: &x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "ethereum",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				MaxAmountRequired: "100000",
				PayTo:             "0x1234567890123456789012345678901234567890",
			},
			want: false,
		},
		{
			name: "wrong scheme",
			requirements: &x402.PaymentRequirement{
				Scheme:            "streaming",
				Network:           "base",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				MaxAmountRequired: "100000",
				PayTo:             "0x1234567890123456789012345678901234567890",
			},
			want: false,
		},
		{
			name: "wrong token",
			requirements: &x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				Asset:             "0x0000000000000000000000000000000000000000",
				MaxAmountRequired: "100000",
				PayTo:             "0x1234567890123456789012345678901234567890",
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

func TestSign(t *testing.T) {
	signer, err := NewSigner(
		WithPrivateKey(testPrivateKeyHex),
		WithNetwork("base"),
		WithToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6),
		WithMaxAmountPerCall("1000000"),
	)
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	tests := []struct {
		name         string
		requirements *x402.PaymentRequirement
		wantErr      error
	}{
		{
			name: "valid payment request",
			requirements: &x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				MaxAmountRequired: "500000",
				PayTo:             "0x1234567890123456789012345678901234567890",
				MaxTimeoutSeconds: 60,
				Extra: map[string]interface{}{
					"name":    "USD Coin",
					"version": "2",
				},
			},
			wantErr: nil,
		},
		{
			name: "amount exceeds max",
			requirements: &x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				MaxAmountRequired: "2000000", // exceeds max of 1000000
				PayTo:             "0x1234567890123456789012345678901234567890",
				MaxTimeoutSeconds: 60,
			},
			wantErr: x402.ErrAmountExceeded,
		},
		{
			name: "invalid network",
			requirements: &x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "ethereum",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				MaxAmountRequired: "500000",
				PayTo:             "0x1234567890123456789012345678901234567890",
				MaxTimeoutSeconds: 60,
			},
			wantErr: x402.ErrNoValidSigner,
		},
		{
			name: "invalid amount format",
			requirements: &x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				MaxAmountRequired: "invalid",
				PayTo:             "0x1234567890123456789012345678901234567890",
				MaxTimeoutSeconds: 60,
			},
			wantErr: x402.ErrInvalidAmount,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, err := signer.Sign(tt.requirements)

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

			if payload == nil {
				t.Fatal("expected payload to be non-nil")
			}

			// Validate payload structure
			if payload.X402Version != 1 {
				t.Errorf("expected version 1, got %d", payload.X402Version)
			}
			if payload.Scheme != "exact" {
				t.Errorf("expected scheme 'exact', got '%s'", payload.Scheme)
			}
			if payload.Network != "base" {
				t.Errorf("expected network 'base', got '%s'", payload.Network)
			}

			// Validate EVM payload
			evmPayload, ok := payload.Payload.(x402.EVMPayload)
			if !ok {
				t.Fatalf("expected EVMPayload, got %T", payload.Payload)
			}

			if evmPayload.Signature == "" {
				t.Error("expected signature to be non-empty")
			}
			if evmPayload.Authorization.From == "" {
				t.Error("expected authorization.from to be non-empty")
			}
			if evmPayload.Authorization.To == "" {
				t.Error("expected authorization.to to be non-empty")
			}
			if evmPayload.Authorization.Value == "" {
				t.Error("expected authorization.value to be non-empty")
			}
		})
	}
}

func TestChainIDMapping(t *testing.T) {
	tests := []struct {
		network   string
		chainID   int64
		expectErr bool
	}{
		{"base", 8453, false},
		{"base-sepolia", 84532, false},
		{"ethereum", 1, false},
		{"sepolia", 11155111, false},
		{"unknown", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.network, func(t *testing.T) {
			chainID, err := getChainID(tt.network)
			if tt.expectErr {
				if err == nil {
					t.Error("expected error for unknown network, got nil")
				}
				return
			}
			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}
			if chainID.Int64() != tt.chainID {
				t.Errorf("expected chain ID %d, got %d", tt.chainID, chainID.Int64())
			}
		})
	}
}

func TestTokenPriority(t *testing.T) {
	signer, err := NewSigner(
		WithPrivateKey(testPrivateKeyHex),
		WithNetwork("base"),
		WithTokenPriority("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC", 6, 1),
		WithTokenPriority("0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", "DAI", 18, 2),
		WithToken("0x0000000000000000000000000000000000000000", "ETH", 18), // default priority 0
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
	if priorities["DAI"] != 2 {
		t.Errorf("expected DAI priority 2, got %d", priorities["DAI"])
	}
	if priorities["ETH"] != 0 {
		t.Errorf("expected ETH priority 0, got %d", priorities["ETH"])
	}
}
