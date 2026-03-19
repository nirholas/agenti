package x402

import (
	"testing"
)

func TestMatchEndpoint(t *testing.T) {
	tests := []struct {
		name          string
		config        Config
		path          string
		shouldMatch   bool
		expectedAmount string
	}{
		{
			name: "exact match",
			config: Config{
				EndpointPricing: map[string]PricingRule{
					"/v1/hello": {
						Amount: "0.01",
						AcceptedTokens: []TokenRequirement{
							{Network: "base-sepolia", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc"},
						},
					},
				},
			},
			path:          "/v1/hello",
			shouldMatch:   true,
			expectedAmount: "0.01",
		},
		{
			name: "wildcard match",
			config: Config{
				EndpointPricing: map[string]PricingRule{
					"/v1/premium/*": {
						Amount: "1.00",
						AcceptedTokens: []TokenRequirement{
							{Network: "base-mainnet", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc"},
						},
					},
				},
			},
			path:          "/v1/premium/content",
			shouldMatch:   true,
			expectedAmount: "1.00",
		},
		{
			name: "skip path",
			config: Config{
				EndpointPricing: map[string]PricingRule{
					"/*": {
						Amount: "0.10",
						AcceptedTokens: []TokenRequirement{
							{Network: "base-mainnet", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc"},
						},
					},
				},
				SkipPaths: []string{"/health"},
			},
			path:        "/health",
			shouldMatch: false,
		},
		{
			name: "no match, use default",
			config: Config{
				EndpointPricing: map[string]PricingRule{
					"/v1/specific": {
						Amount: "0.50",
						AcceptedTokens: []TokenRequirement{
							{Network: "base-mainnet", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc"},
						},
					},
				},
				DefaultPricing: &PricingRule{
					Amount: "0.05",
					AcceptedTokens: []TokenRequirement{
						{Network: "base-mainnet", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc"},
					},
				},
			},
			path:          "/v1/other",
			shouldMatch:   true,
			expectedAmount: "0.05",
		},
		{
			name: "no match, no default",
			config: Config{
				EndpointPricing: map[string]PricingRule{
					"/v1/specific": {
						Amount: "0.50",
						AcceptedTokens: []TokenRequirement{
							{Network: "base-mainnet", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc"},
						},
					},
				},
			},
			path:        "/v1/other",
			shouldMatch: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule, matched := tt.config.MatchEndpoint(tt.path)

			if matched != tt.shouldMatch {
				t.Errorf("expected match=%v, got %v", tt.shouldMatch, matched)
			}

			if tt.shouldMatch && rule.Amount != tt.expectedAmount {
				t.Errorf("expected amount=%s, got %s", tt.expectedAmount, rule.Amount)
			}
		})
	}
}

func TestPricingRuleValidation(t *testing.T) {
	tests := []struct {
		name    string
		rule    PricingRule
		wantErr bool
	}{
		{
			name: "valid rule",
			rule: PricingRule{
				Amount: "1.00",
				AcceptedTokens: []TokenRequirement{
					{
						Network:       "base-mainnet",
						Symbol:        "USDC",
						AssetContract: "0x123",
						Recipient:     "0xabc",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "missing amount",
			rule: PricingRule{
				AcceptedTokens: []TokenRequirement{
					{
						Network:       "base-mainnet",
						Symbol:        "USDC",
						AssetContract: "0x123",
						Recipient:     "0xabc",
					},
				},
			},
			wantErr: true,
		},
		{
			name: "no accepted tokens",
			rule: PricingRule{
				Amount:         "1.00",
				AcceptedTokens: []TokenRequirement{},
			},
			wantErr: true,
		},
		{
			name: "invalid token requirement",
			rule: PricingRule{
				Amount: "1.00",
				AcceptedTokens: []TokenRequirement{
					{
						Network: "base-mainnet",
						// Missing required fields
					},
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.rule.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
