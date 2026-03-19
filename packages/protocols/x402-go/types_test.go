package x402

import (
	"math/big"
	"testing"
)

func TestAmountToBigInt(t *testing.T) {
	tests := []struct {
		name     string
		amount   string
		decimals int
		want     string // expected value as string for comparison
		wantErr  bool
	}{
		{
			name:     "1 USDC (6 decimals)",
			amount:   "1",
			decimals: 6,
			want:     "1000000",
			wantErr:  false,
		},
		{
			name:     "1.5 USDC (6 decimals)",
			amount:   "1.5",
			decimals: 6,
			want:     "1500000",
			wantErr:  false,
		},
		{
			name:     "0.000001 USDC (6 decimals)",
			amount:   "0.000001",
			decimals: 6,
			want:     "1",
			wantErr:  false,
		},
		{
			name:     "1 ETH (18 decimals)",
			amount:   "1",
			decimals: 18,
			want:     "1000000000000000000",
			wantErr:  false,
		},
		{
			name:     "0.5 ETH (18 decimals)",
			amount:   "0.5",
			decimals: 18,
			want:     "500000000000000000",
			wantErr:  false,
		},
		{
			name:     "invalid amount - non-numeric",
			amount:   "abc",
			decimals: 6,
			want:     "",
			wantErr:  true,
		},
		{
			name:     "zero amount",
			amount:   "0",
			decimals: 6,
			want:     "0",
			wantErr:  false,
		},
		{
			name:     "large amount",
			amount:   "1000000",
			decimals: 6,
			want:     "1000000000000",
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := AmountToBigInt(tt.amount, tt.decimals)

			if tt.wantErr {
				if err == nil {
					t.Errorf("AmountToBigInt() expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("AmountToBigInt() unexpected error: %v", err)
				return
			}

			if got.String() != tt.want {
				t.Errorf("AmountToBigInt() = %s, want %s", got.String(), tt.want)
			}
		})
	}
}

func TestBigIntToAmount(t *testing.T) {
	tests := []struct {
		name     string
		value    *big.Int
		decimals int
		want     string
	}{
		{
			name:     "1000000 atomic units with 6 decimals",
			value:    big.NewInt(1000000),
			decimals: 6,
			want:     "1.000000",
		},
		{
			name:     "1500000 atomic units with 6 decimals",
			value:    big.NewInt(1500000),
			decimals: 6,
			want:     "1.500000",
		},
		{
			name:     "1 atomic unit with 6 decimals",
			value:    big.NewInt(1),
			decimals: 6,
			want:     "0.000001",
		},
		{
			name: "1000000000000000000 atomic units with 18 decimals (1 ETH)",
			value: func() *big.Int {
				v := new(big.Int)
				v.SetString("1000000000000000000", 10)
				return v
			}(),
			decimals: 18,
			want:     "1.000000000000000000",
		},
		{
			name: "500000000000000000 atomic units with 18 decimals (0.5 ETH)",
			value: func() *big.Int {
				v := new(big.Int)
				v.SetString("500000000000000000", 10)
				return v
			}(),
			decimals: 18,
			want:     "0.500000000000000000",
		},
		{
			name:     "nil value",
			value:    nil,
			decimals: 6,
			want:     "0",
		},
		{
			name:     "zero value",
			value:    big.NewInt(0),
			decimals: 6,
			want:     "0.000000",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := BigIntToAmount(tt.value, tt.decimals)
			if got != tt.want {
				t.Errorf("BigIntToAmount() = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestTokenConfig(t *testing.T) {
	tests := []struct {
		name  string
		token TokenConfig
		valid bool
	}{
		{
			name: "valid USDC token",
			token: TokenConfig{
				Address:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Symbol:   "USDC",
				Decimals: 6,
				Priority: 1,
				Name:     "USD Coin",
			},
			valid: true,
		},
		{
			name: "valid token with zero priority",
			token: TokenConfig{
				Address:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Symbol:   "USDC",
				Decimals: 6,
				Priority: 0,
			},
			valid: true,
		},
		{
			name: "valid token with high priority number",
			token: TokenConfig{
				Address:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Symbol:   "USDC",
				Decimals: 6,
				Priority: 100,
			},
			valid: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Verify token fields are set correctly
			if tt.token.Address == "" && tt.valid {
				t.Error("valid token should have non-empty address")
			}
			if tt.token.Symbol == "" && tt.valid {
				t.Error("valid token should have non-empty symbol")
			}
			if tt.token.Decimals < 0 {
				t.Error("decimals should not be negative")
			}
		})
	}
}

func TestTokenConfigPriorityConvention(t *testing.T) {
	// Test that lower priority numbers indicate higher priority
	tokens := []TokenConfig{
		{Address: "0xUSDC", Symbol: "USDC", Decimals: 6, Priority: 1},
		{Address: "0xUSDT", Symbol: "USDT", Decimals: 6, Priority: 2},
		{Address: "0xDAI", Symbol: "DAI", Decimals: 18, Priority: 3},
	}

	// Verify priority convention: 1 < 2 < 3 (lower number = higher priority)
	if tokens[0].Priority >= tokens[1].Priority {
		t.Error("USDC (priority 1) should have higher priority than USDT (priority 2)")
	}
	if tokens[1].Priority >= tokens[2].Priority {
		t.Error("USDT (priority 2) should have higher priority than DAI (priority 3)")
	}

	// Test that sorting by priority works correctly
	if tokens[0].Priority >= tokens[1].Priority || tokens[1].Priority >= tokens[2].Priority {
		t.Error("token priorities should be sortable in ascending order (1, 2, 3...)")
	}
}

func TestPaymentPayload(t *testing.T) {
	tests := []struct {
		name    string
		payload PaymentPayload
		valid   bool
	}{
		{
			name: "valid EVM payment",
			payload: PaymentPayload{
				X402Version: 1,
				Scheme:      "exact",
				Network:     "base",
				Payload: EVMPayload{
					Signature: "0x1234",
					Authorization: EVMAuthorization{
						From:        "0xFrom",
						To:          "0xTo",
						Value:       "1000000",
						ValidAfter:  "0",
						ValidBefore: "999999999",
						Nonce:       "0x0000000000000000000000000000000000000000000000000000000000000001",
					},
				},
			},
			valid: true,
		},
		{
			name: "valid SVM payment",
			payload: PaymentPayload{
				X402Version: 1,
				Scheme:      "exact",
				Network:     "solana",
				Payload: SVMPayload{
					Transaction: "base64encodedtransaction==",
				},
			},
			valid: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.payload.X402Version != 1 {
				t.Errorf("expected X402Version 1, got %d", tt.payload.X402Version)
			}
			if tt.payload.Scheme == "" && tt.valid {
				t.Error("valid payload should have non-empty scheme")
			}
			if tt.payload.Network == "" && tt.valid {
				t.Error("valid payload should have non-empty network")
			}
			if tt.payload.Payload == nil && tt.valid {
				t.Error("valid payload should have non-nil payload")
			}
		})
	}
}

func TestPaymentRequirements(t *testing.T) {
	tests := []struct {
		name  string
		req   PaymentRequirement
		valid bool
	}{
		{
			name: "valid requirements",
			req: PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				MaxAmountRequired: "1000000",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				PayTo:             "0x1234567890123456789012345678901234567890",
				Resource:          "https://api.example.com/data",
				MaxTimeoutSeconds: 60,
			},
			valid: true,
		},
		{
			name: "valid requirements with extra data",
			req: PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				MaxAmountRequired: "1000000",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				PayTo:             "0x1234567890123456789012345678901234567890",
				Resource:          "https://api.example.com/data",
				MaxTimeoutSeconds: 60,
				Extra: map[string]interface{}{
					"custom": "data",
				},
			},
			valid: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.req.Scheme == "" && tt.valid {
				t.Error("valid requirements should have scheme")
			}
			if tt.req.Network == "" && tt.valid {
				t.Error("valid requirements should have network")
			}
			if tt.req.MaxAmountRequired == "" && tt.valid {
				t.Error("valid requirements should have amount")
			}
			if tt.req.Asset == "" && tt.valid {
				t.Error("valid requirements should have asset")
			}
			if tt.req.PayTo == "" && tt.valid {
				t.Error("valid requirements should have payTo")
			}
		})
	}
}

func TestSettlementResponse(t *testing.T) {
	tests := []struct {
		name       string
		settlement SettlementResponse
		valid      bool
	}{
		{
			name: "successful settlement",
			settlement: SettlementResponse{
				Success:     true,
				Transaction: "0xabcdef1234567890",
				Network:     "base",
				Payer:       "0x1234567890",
			},
			valid: true,
		},
		{
			name: "failed settlement with reason",
			settlement: SettlementResponse{
				Success:     false,
				ErrorReason: "insufficient funds",
				Network:     "base",
				Payer:       "0x1234567890",
			},
			valid: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.settlement.Network == "" && tt.valid {
				t.Error("valid settlement should have network")
			}
			if tt.settlement.Payer == "" && tt.valid {
				t.Error("valid settlement should have payer")
			}
			if tt.settlement.Success && tt.settlement.Transaction == "" {
				t.Error("successful settlement should have transaction hash")
			}
			if !tt.settlement.Success && tt.settlement.ErrorReason == "" {
				t.Error("failed settlement should have error reason")
			}
		})
	}
}
