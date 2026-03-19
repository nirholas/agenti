package x402

import (
	"testing"
	"time"
)

func TestMatchEndpoint(t *testing.T) {
	tests := []struct {
		name           string
		config         Config
		path           string
		shouldMatch    bool
		expectedAmount string
	}{
		{
			name: "exact match",
			config: Config{
				EndpointPricing: map[string]PricingRule{
					"/v1/hello": {
						AcceptedTokens: []TokenRequirement{
							{Network: "eip155:84532", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc", Amount: "1000000"},
						},
					},
				},
			},
			path:           "/v1/hello",
			shouldMatch:    true,
			expectedAmount: "1000000",
		},
		{
			name: "wildcard match",
			config: Config{
				EndpointPricing: map[string]PricingRule{
					"/v1/premium/*": {
						AcceptedTokens: []TokenRequirement{
							{Network: "eip155:8453", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc", Amount: "5000000"},
						},
					},
				},
			},
			path:           "/v1/premium/content",
			shouldMatch:    true,
			expectedAmount: "5000000",
		},
		{
			name: "skip path",
			config: Config{
				EndpointPricing: map[string]PricingRule{
					"/*": {
						AcceptedTokens: []TokenRequirement{
							{Network: "eip155:8453", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc", Amount: "100000"},
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
						AcceptedTokens: []TokenRequirement{
							{Network: "eip155:8453", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc", Amount: "500000"},
						},
					},
				},
				DefaultPricing: &PricingRule{
					AcceptedTokens: []TokenRequirement{
						{Network: "eip155:8453", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc", Amount: "50000"},
					},
				},
			},
			path:           "/v1/other",
			shouldMatch:    true,
			expectedAmount: "50000",
		},
		{
			name: "no match, no default",
			config: Config{
				EndpointPricing: map[string]PricingRule{
					"/v1/specific": {
						AcceptedTokens: []TokenRequirement{
							{Network: "eip155:8453", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc", Amount: "500000"},
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

			if tt.shouldMatch && rule.AcceptedTokens[0].Amount != tt.expectedAmount {
				t.Errorf("expected amount=%s, got %s", tt.expectedAmount, rule.AcceptedTokens[0].Amount)
			}
		})
	}
}

func TestMatchMethod(t *testing.T) {
	tests := []struct {
		name           string
		config         Config
		method         string
		shouldMatch    bool
		expectedAmount string
	}{
		{
			name: "exact method match",
			config: Config{
				MethodPricing: map[string]PricingRule{
					"/test.v1.TestService/GetData": {
						AcceptedTokens: []TokenRequirement{
							{Network: "eip155:84532", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc", Amount: "1000000"},
						},
					},
				},
			},
			method:         "/test.v1.TestService/GetData",
			shouldMatch:    true,
			expectedAmount: "1000000",
		},
		{
			name: "wildcard method match",
			config: Config{
				MethodPricing: map[string]PricingRule{
					"/test.v1.TestService/*": {
						AcceptedTokens: []TokenRequirement{
							{Network: "eip155:84532", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc", Amount: "2000000"},
						},
					},
				},
			},
			method:         "/test.v1.TestService/AnyMethod",
			shouldMatch:    true,
			expectedAmount: "2000000",
		},
		{
			name: "skip method",
			config: Config{
				MethodPricing: map[string]PricingRule{
					"/test.v1.TestService/*": {
						AcceptedTokens: []TokenRequirement{
							{Network: "eip155:84532", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc", Amount: "1000000"},
						},
					},
				},
				SkipMethods: []string{"/test.v1.TestService/HealthCheck"},
			},
			method:      "/test.v1.TestService/HealthCheck",
			shouldMatch: false,
		},
		{
			name: "no match, use default",
			config: Config{
				MethodPricing: map[string]PricingRule{},
				DefaultPricing: &PricingRule{
					AcceptedTokens: []TokenRequirement{
						{Network: "eip155:84532", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc", Amount: "100000"},
					},
				},
			},
			method:         "/other.v1.Service/Method",
			shouldMatch:    true,
			expectedAmount: "100000",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule, matched := tt.config.MatchMethod(tt.method)

			if matched != tt.shouldMatch {
				t.Errorf("expected match=%v, got %v", tt.shouldMatch, matched)
			}

			if tt.shouldMatch && rule.AcceptedTokens[0].Amount != tt.expectedAmount {
				t.Errorf("expected amount=%s, got %s", tt.expectedAmount, rule.AcceptedTokens[0].Amount)
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
				AcceptedTokens: []TokenRequirement{
					{Network: "eip155:8453", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc", Amount: "1000000"},
				},
			},
			wantErr: false,
		},
		{
			name: "missing amount",
			rule: PricingRule{
				AcceptedTokens: []TokenRequirement{
					{Network: "eip155:8453", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc"},
				},
			},
			wantErr: true,
		},
		{
			name: "no accepted tokens",
			rule: PricingRule{
				AcceptedTokens: []TokenRequirement{},
			},
			wantErr: true,
		},
		{
			name: "invalid token - missing symbol",
			rule: PricingRule{
				AcceptedTokens: []TokenRequirement{
					{Network: "eip155:8453", AssetContract: "0x123", Recipient: "0xabc", Amount: "1000000"},
				},
			},
			wantErr: true,
		},
		{
			name: "invalid token - missing network",
			rule: PricingRule{
				AcceptedTokens: []TokenRequirement{
					{Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc", Amount: "1000000"},
				},
			},
			wantErr: true,
		},
		{
			name: "invalid token - missing recipient",
			rule: PricingRule{
				AcceptedTokens: []TokenRequirement{
					{Network: "eip155:8453", Symbol: "USDC", AssetContract: "0x123", Amount: "1000000"},
				},
			},
			wantErr: true,
		},
		{
			name: "invalid token - missing asset contract",
			rule: PricingRule{
				AcceptedTokens: []TokenRequirement{
					{Network: "eip155:8453", Symbol: "USDC", Recipient: "0xabc", Amount: "1000000"},
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

func TestConfigValidation(t *testing.T) {
	tests := []struct {
		name    string
		config  Config
		wantErr bool
	}{
		{
			name: "valid config",
			config: Config{
				Verifier: &MockVerifier{},
				EndpointPricing: map[string]PricingRule{
					"/v1/paid": {
						AcceptedTokens: []TokenRequirement{
							{Network: "eip155:84532", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc", Amount: "1000000"},
						},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "missing verifier",
			config: Config{
				EndpointPricing: map[string]PricingRule{},
			},
			wantErr: true,
		},
		{
			name: "invalid endpoint pricing rule",
			config: Config{
				Verifier: &MockVerifier{},
				EndpointPricing: map[string]PricingRule{
					"/v1/paid": {
						// Missing amount on token
						AcceptedTokens: []TokenRequirement{
							{Network: "eip155:84532", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc"},
						},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "invalid method pricing rule",
			config: Config{
				Verifier: &MockVerifier{},
				MethodPricing: map[string]PricingRule{
					"/test.Service/Method": {
						AcceptedTokens: []TokenRequirement{}, // Empty
					},
				},
			},
			wantErr: true,
		},
		{
			name: "invalid default pricing rule",
			config: Config{
				Verifier: &MockVerifier{},
				DefaultPricing: &PricingRule{
					// Missing amount on token
					AcceptedTokens: []TokenRequirement{
						{Network: "eip155:84532", Symbol: "USDC", AssetContract: "0x123", Recipient: "0xabc"},
					},
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestConfigValidation_SetsDefaultValidityDuration(t *testing.T) {
	cfg := Config{
		Verifier: &MockVerifier{},
	}

	if err := cfg.Validate(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.ValidityDuration != 5*time.Minute {
		t.Errorf("expected default validity duration 5m, got %v", cfg.ValidityDuration)
	}
}

func TestBuildRequirementsFromRule(t *testing.T) {
	rule := &PricingRule{
		AcceptedTokens: []TokenRequirement{
			{
				Network:       "eip155:84532",
				Symbol:        "USDC",
				AssetContract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				Recipient:     "0xRecipient",
				Amount:        "1000000",
			},
		},
	}

	requirements := buildRequirementsFromRule(rule)

	if requirements == nil {
		t.Fatal("expected non-nil requirements")
	}
	if requirements.Scheme != "exact" {
		t.Errorf("expected scheme 'exact', got %s", requirements.Scheme)
	}
	if requirements.Network != "eip155:84532" {
		t.Errorf("expected network 'eip155:84532', got %s", requirements.Network)
	}
	if requirements.Amount != "1000000" {
		t.Errorf("expected amount '1000000', got %s", requirements.Amount)
	}
	if requirements.Asset != "0x036CbD53842c5426634e7929541eC2318f3dCF7e" {
		t.Errorf("expected asset contract, got %s", requirements.Asset)
	}
	if requirements.PayTo != "0xRecipient" {
		t.Errorf("expected payTo '0xRecipient', got %s", requirements.PayTo)
	}
}

func TestBuildRequirementsFromRule_EmptyTokens(t *testing.T) {
	rule := &PricingRule{
		AcceptedTokens: []TokenRequirement{},
	}

	requirements := buildRequirementsFromRule(rule)
	if requirements != nil {
		t.Error("expected nil requirements for empty tokens")
	}
}

func TestBuildAcceptsFromRule(t *testing.T) {
	rule := &PricingRule{
		AcceptedTokens: []TokenRequirement{
			{
				Network:       "eip155:84532",
				Symbol:        "USDC",
				AssetContract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				Recipient:     "0xRecipient",
				Amount:        "1000000",
			},
			{
				Network:       "eip155:42161",
				Symbol:        "USDC",
				AssetContract: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
				Recipient:     "0xRecipient",
				Amount:        "1000000",
			},
		},
	}

	accepts := buildAcceptsFromRule(rule, 5*time.Minute)

	if len(accepts) != 2 {
		t.Fatalf("expected 2 accepts, got %d", len(accepts))
	}

	// First token
	if accepts[0].Scheme != "exact" {
		t.Errorf("expected scheme 'exact', got %s", accepts[0].Scheme)
	}
	if accepts[0].Network != "eip155:84532" {
		t.Errorf("expected network 'eip155:84532', got %s", accepts[0].Network)
	}
	if accepts[0].Amount != "1000000" {
		t.Errorf("expected amount '1000000', got %s", accepts[0].Amount)
	}
	if accepts[0].MaxTimeoutSeconds != 300 {
		t.Errorf("expected maxTimeoutSeconds 300, got %d", accepts[0].MaxTimeoutSeconds)
	}

	// Second token
	if accepts[1].Network != "eip155:42161" {
		t.Errorf("expected network 'eip155:42161', got %s", accepts[1].Network)
	}
}
