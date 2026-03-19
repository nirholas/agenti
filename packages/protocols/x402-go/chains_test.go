package x402

import (
	"testing"
)

// TestChainConfigConstants verifies that all 8 ChainConfig constants have valid values
func TestChainConfigConstants(t *testing.T) {
	tests := []struct {
		name   string
		config ChainConfig
	}{
		{"SolanaMainnet", SolanaMainnet},
		{"SolanaDevnet", SolanaDevnet},
		{"BaseMainnet", BaseMainnet},
		{"BaseSepolia", BaseSepolia},
		{"PolygonMainnet", PolygonMainnet},
		{"PolygonAmoy", PolygonAmoy},
		{"AvalancheMainnet", AvalancheMainnet},
		{"AvalancheFuji", AvalancheFuji},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Verify NetworkID is not empty
			if tt.config.NetworkID == "" {
				t.Errorf("%s: NetworkID is empty", tt.name)
			}

			// Verify USDCAddress is not empty
			if tt.config.USDCAddress == "" {
				t.Errorf("%s: USDCAddress is empty", tt.name)
			}

			// Verify Decimals is 6
			if tt.config.Decimals != 6 {
				t.Errorf("%s: Decimals = %d, want 6", tt.name, tt.config.Decimals)
			}
		})
	}
}

// TestNewUSDCTokenConfig verifies NewUSDCTokenConfig creates correct TokenConfig for all chains
func TestNewUSDCTokenConfig(t *testing.T) {
	tests := []struct {
		name     string
		chain    ChainConfig
		priority int
	}{
		{"SolanaMainnet_Priority1", SolanaMainnet, 1},
		{"SolanaDevnet_Priority2", SolanaDevnet, 2},
		{"BaseMainnet_Priority1", BaseMainnet, 1},
		{"BaseSepolia_Priority3", BaseSepolia, 3},
		{"PolygonMainnet_Priority1", PolygonMainnet, 1},
		{"PolygonAmoy_Priority2", PolygonAmoy, 2},
		{"AvalancheMainnet_Priority1", AvalancheMainnet, 1},
		{"AvalancheFuji_Priority3", AvalancheFuji, 3},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token := NewUSDCTokenConfig(tt.chain, tt.priority)

			// Verify Address matches chain's USDC address
			if token.Address != tt.chain.USDCAddress {
				t.Errorf("Address = %s, want %s", token.Address, tt.chain.USDCAddress)
			}

			// Verify Symbol is USDC
			if token.Symbol != "USDC" {
				t.Errorf("Symbol = %s, want USDC", token.Symbol)
			}

			// Verify Decimals is 6
			if token.Decimals != 6 {
				t.Errorf("Decimals = %d, want 6", token.Decimals)
			}

			// Verify Priority matches input
			if token.Priority != tt.priority {
				t.Errorf("Priority = %d, want %d", token.Priority, tt.priority)
			}
		})
	}
}

// TestTokenConfigFields verifies TokenConfig has correct fields from ChainConfig
func TestTokenConfigFields(t *testing.T) {
	// Test with BaseMainnet
	token := NewUSDCTokenConfig(BaseMainnet, 1)

	// Verify Address is from ChainConfig.USDCAddress
	if token.Address != BaseMainnet.USDCAddress {
		t.Errorf("Address = %s, want %s", token.Address, BaseMainnet.USDCAddress)
	}

	// Verify Symbol is USDC
	if token.Symbol != "USDC" {
		t.Errorf("Symbol = %s, want USDC", token.Symbol)
	}

	// Verify Decimals is 6
	if token.Decimals != 6 {
		t.Errorf("Decimals = %d, want 6", token.Decimals)
	}

	// Verify Priority matches input
	if token.Priority != 1 {
		t.Errorf("Priority = %d, want 1", token.Priority)
	}
}

// TestNewUSDCPaymentRequirementValidInputs tests NewUSDCPaymentRequirement with valid inputs across all chains
func TestNewUSDCPaymentRequirementValidInputs(t *testing.T) {
	tests := []struct {
		name              string
		config            USDCRequirementConfig
		wantNetwork       string
		wantAsset         string
		wantMaxAmount     string
		wantScheme        string
		wantTimeout       int
		wantMimeType      string
		wantExtraNotEmpty bool
	}{
		{
			name: "BaseMainnet_1USDC",
			config: USDCRequirementConfig{
				Chain:            BaseMainnet,
				Amount:           "1.0",
				RecipientAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
			},
			wantNetwork:       "base",
			wantAsset:         BaseMainnet.USDCAddress,
			wantMaxAmount:     "1000000",
			wantScheme:        "exact",
			wantTimeout:       300,
			wantMimeType:      "application/json",
			wantExtraNotEmpty: true,
		},
		{
			name: "SolanaMainnet_10.5USDC",
			config: USDCRequirementConfig{
				Chain:            SolanaMainnet,
				Amount:           "10.5",
				RecipientAddress: "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK",
			},
			wantNetwork:       "solana",
			wantAsset:         SolanaMainnet.USDCAddress,
			wantMaxAmount:     "10500000",
			wantScheme:        "exact",
			wantTimeout:       300,
			wantMimeType:      "application/json",
			wantExtraNotEmpty: false,
		},
		{
			name: "PolygonMainnet_2.5USDC",
			config: USDCRequirementConfig{
				Chain:            PolygonMainnet,
				Amount:           "2.5",
				RecipientAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
			},
			wantNetwork:       "polygon",
			wantAsset:         PolygonMainnet.USDCAddress,
			wantMaxAmount:     "2500000",
			wantScheme:        "exact",
			wantTimeout:       300,
			wantMimeType:      "application/json",
			wantExtraNotEmpty: true,
		},
		{
			name: "BaseSepolia_0.1USDC",
			config: USDCRequirementConfig{
				Chain:            BaseSepolia,
				Amount:           "0.1",
				RecipientAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
			},
			wantNetwork:       "base-sepolia",
			wantAsset:         BaseSepolia.USDCAddress,
			wantMaxAmount:     "100000",
			wantScheme:        "exact",
			wantTimeout:       300,
			wantMimeType:      "application/json",
			wantExtraNotEmpty: true,
		},
		{
			name: "AvalancheMainnet_100USDC",
			config: USDCRequirementConfig{
				Chain:            AvalancheMainnet,
				Amount:           "100",
				RecipientAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
			},
			wantNetwork:       "avalanche",
			wantAsset:         AvalancheMainnet.USDCAddress,
			wantMaxAmount:     "100000000",
			wantScheme:        "exact",
			wantTimeout:       300,
			wantMimeType:      "application/json",
			wantExtraNotEmpty: true,
		},
		{
			name: "SolanaDevnet_5.123456USDC",
			config: USDCRequirementConfig{
				Chain:            SolanaDevnet,
				Amount:           "5.123456",
				RecipientAddress: "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK",
			},
			wantNetwork:       "solana-devnet",
			wantAsset:         SolanaDevnet.USDCAddress,
			wantMaxAmount:     "5123456",
			wantScheme:        "exact",
			wantTimeout:       300,
			wantMimeType:      "application/json",
			wantExtraNotEmpty: false,
		},
		{
			name: "PolygonAmoy_0.000001USDC",
			config: USDCRequirementConfig{
				Chain:            PolygonAmoy,
				Amount:           "0.000001",
				RecipientAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
			},
			wantNetwork:       "polygon-amoy",
			wantAsset:         PolygonAmoy.USDCAddress,
			wantMaxAmount:     "1",
			wantScheme:        "exact",
			wantTimeout:       300,
			wantMimeType:      "application/json",
			wantExtraNotEmpty: true,
		},
		{
			name: "AvalancheFuji_999.999999USDC",
			config: USDCRequirementConfig{
				Chain:            AvalancheFuji,
				Amount:           "999.999999",
				RecipientAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
			},
			wantNetwork:       "avalanche-fuji",
			wantAsset:         AvalancheFuji.USDCAddress,
			wantMaxAmount:     "999999999",
			wantScheme:        "exact",
			wantTimeout:       300,
			wantMimeType:      "application/json",
			wantExtraNotEmpty: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := NewUSDCPaymentRequirement(tt.config)
			if err != nil {
				t.Fatalf("NewUSDCPaymentRequirement() error = %v", err)
			}

			if req.Network != tt.wantNetwork {
				t.Errorf("Network = %s, want %s", req.Network, tt.wantNetwork)
			}

			if req.Asset != tt.wantAsset {
				t.Errorf("Asset = %s, want %s", req.Asset, tt.wantAsset)
			}

			if req.MaxAmountRequired != tt.wantMaxAmount {
				t.Errorf("MaxAmountRequired = %s, want %s", req.MaxAmountRequired, tt.wantMaxAmount)
			}

			if req.Scheme != tt.wantScheme {
				t.Errorf("Scheme = %s, want %s", req.Scheme, tt.wantScheme)
			}

			if req.MaxTimeoutSeconds != tt.wantTimeout {
				t.Errorf("MaxTimeoutSeconds = %d, want %d", req.MaxTimeoutSeconds, tt.wantTimeout)
			}

			if req.MimeType != tt.wantMimeType {
				t.Errorf("MimeType = %s, want %s", req.MimeType, tt.wantMimeType)
			}

			if tt.wantExtraNotEmpty && len(req.Extra) == 0 {
				t.Errorf("Extra is empty, expected EIP-3009 parameters")
			}

			if !tt.wantExtraNotEmpty && len(req.Extra) != 0 {
				t.Errorf("Extra is not empty, expected no EIP-3009 parameters")
			}
		})
	}
}

// TestNewUSDCPaymentRequirementEVMExtra tests EIP-3009 extra field for EVM chains
func TestNewUSDCPaymentRequirementEVMExtra(t *testing.T) {
	tests := []struct {
		name        string
		chain       ChainConfig
		wantName    string
		wantVersion string
	}{
		{"BaseMainnet", BaseMainnet, "USD Coin", "2"},
		{"BaseSepolia", BaseSepolia, "USDC", "2"},
		{"PolygonMainnet", PolygonMainnet, "USD Coin", "2"},
		{"PolygonAmoy", PolygonAmoy, "USDC", "2"},
		{"AvalancheMainnet", AvalancheMainnet, "USD Coin", "2"},
		{"AvalancheFuji", AvalancheFuji, "USD Coin", "2"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := NewUSDCPaymentRequirement(USDCRequirementConfig{
				Chain:            tt.chain,
				Amount:           "1.0",
				RecipientAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
			})
			if err != nil {
				t.Fatalf("NewUSDCPaymentRequirement() error = %v", err)
			}

			if req.Extra == nil {
				t.Fatal("Extra is nil, expected EIP-3009 parameters")
			}

			name, ok := req.Extra["name"].(string)
			if !ok {
				t.Errorf("Extra[name] is not a string")
			}
			if name != tt.wantName {
				t.Errorf("Extra[name] = %s, want %s", name, tt.wantName)
			}

			version, ok := req.Extra["version"].(string)
			if !ok {
				t.Errorf("Extra[version] is not a string")
			}
			if version != tt.wantVersion {
				t.Errorf("Extra[version] = %s, want %s", version, tt.wantVersion)
			}
		})
	}
}

// TestNewUSDCPaymentRequirementSVMExtra tests that SVM chains have empty Extra field
func TestNewUSDCPaymentRequirementSVMExtra(t *testing.T) {
	tests := []struct {
		name  string
		chain ChainConfig
	}{
		{"SolanaMainnet", SolanaMainnet},
		{"SolanaDevnet", SolanaDevnet},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := NewUSDCPaymentRequirement(USDCRequirementConfig{
				Chain:            tt.chain,
				Amount:           "1.0",
				RecipientAddress: "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK",
			})
			if err != nil {
				t.Fatalf("NewUSDCPaymentRequirement() error = %v", err)
			}

			if len(req.Extra) != 0 {
				t.Errorf("Extra has %d items, want 0", len(req.Extra))
			}
		})
	}
}

// TestNewUSDCPaymentRequirementAmountConversion tests amount conversion to atomic units
func TestNewUSDCPaymentRequirementAmountConversion(t *testing.T) {
	tests := []struct {
		name       string
		amount     string
		wantAtomic string
	}{
		{"1.5_USDC", "1.5", "1500000"},
		{"10.50_USDC", "10.50", "10500000"},
		{"0.123456_USDC", "0.123456", "123456"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := NewUSDCPaymentRequirement(USDCRequirementConfig{
				Chain:            BaseMainnet,
				Amount:           tt.amount,
				RecipientAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
			})
			if err != nil {
				t.Fatalf("NewUSDCPaymentRequirement() error = %v", err)
			}

			if req.MaxAmountRequired != tt.wantAtomic {
				t.Errorf("MaxAmountRequired = %s, want %s", req.MaxAmountRequired, tt.wantAtomic)
			}
		})
	}
}

// TestNewUSDCPaymentRequirementRounding tests float64 banker's rounding behavior
func TestNewUSDCPaymentRequirementRounding(t *testing.T) {
	tests := []struct {
		name       string
		amount     string
		wantAtomic string
	}{
		{"1.1234567", "1.1234567", "1123457"}, // > .5 → up
		{"1.1234565", "1.1234565", "1123456"}, // .5 → even (down)
		{"1.1234575", "1.1234575", "1123458"}, // .5 → even (up)
		{"2.5555555", "2.5555555", "2555556"}, // .5 → even
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := NewUSDCPaymentRequirement(USDCRequirementConfig{
				Chain:            BaseMainnet,
				Amount:           tt.amount,
				RecipientAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
			})
			if err != nil {
				t.Fatalf("NewUSDCPaymentRequirement() error = %v", err)
			}

			if req.MaxAmountRequired != tt.wantAtomic {
				t.Errorf("MaxAmountRequired = %s, want %s", req.MaxAmountRequired, tt.wantAtomic)
			}
		})
	}
}

// TestNewUSDCPaymentRequirementZeroAmounts tests that zero amounts are allowed
func TestNewUSDCPaymentRequirementZeroAmounts(t *testing.T) {
	tests := []struct {
		name   string
		amount string
	}{
		{"Zero", "0"},
		{"Zero_Decimal", "0.0"},
		{"Zero_SixDecimals", "0.000000"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := NewUSDCPaymentRequirement(USDCRequirementConfig{
				Chain:            BaseMainnet,
				Amount:           tt.amount,
				RecipientAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
			})
			if err != nil {
				t.Fatalf("NewUSDCPaymentRequirement() error = %v, want nil", err)
			}

			if req.MaxAmountRequired != "0" {
				t.Errorf("MaxAmountRequired = %s, want 0", req.MaxAmountRequired)
			}
		})
	}
}

// TestNewUSDCPaymentRequirementErrors tests error cases
func TestNewUSDCPaymentRequirementErrors(t *testing.T) {
	tests := []struct {
		name      string
		config    USDCRequirementConfig
		wantError string
	}{
		{
			name: "NegativeAmount",
			config: USDCRequirementConfig{
				Chain:            BaseMainnet,
				Amount:           "-5",
				RecipientAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
			},
			wantError: "amount: must be non-negative",
		},
		{
			name: "EmptyRecipient",
			config: USDCRequirementConfig{
				Chain:            BaseMainnet,
				Amount:           "1.0",
				RecipientAddress: "",
			},
			wantError: "recipientAddress: cannot be empty",
		},
		{
			name: "InvalidAmount",
			config: USDCRequirementConfig{
				Chain:            BaseMainnet,
				Amount:           "abc",
				RecipientAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
			},
			wantError: "amount: invalid format",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewUSDCPaymentRequirement(tt.config)
			if err == nil {
				t.Fatal("NewUSDCPaymentRequirement() error = nil, want error")
			}

			if err.Error() != tt.wantError {
				t.Errorf("error = %v, want %v", err.Error(), tt.wantError)
			}
		})
	}
}

// TestNewUSDCPaymentRequirementCustomConfig tests custom config overrides
func TestNewUSDCPaymentRequirementCustomConfig(t *testing.T) {
	req, err := NewUSDCPaymentRequirement(USDCRequirementConfig{
		Chain:             BaseMainnet,
		Amount:            "5.0",
		RecipientAddress:  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
		Scheme:            "estimate",
		MaxTimeoutSeconds: 600,
		MimeType:          "text/plain",
	})
	if err != nil {
		t.Fatalf("NewUSDCPaymentRequirement() error = %v", err)
	}

	if req.Scheme != "estimate" {
		t.Errorf("Scheme = %s, want estimate", req.Scheme)
	}

	if req.MaxTimeoutSeconds != 600 {
		t.Errorf("MaxTimeoutSeconds = %d, want 600", req.MaxTimeoutSeconds)
	}

	if req.MimeType != "text/plain" {
		t.Errorf("MimeType = %s, want text/plain", req.MimeType)
	}
}

// TestMultiChainTokenConfig tests multi-chain TokenConfig creation with different priorities
func TestMultiChainTokenConfig(t *testing.T) {
	// Create configs for multiple chains with different priorities
	baseToken := NewUSDCTokenConfig(BaseMainnet, 1)
	polygonToken := NewUSDCTokenConfig(PolygonMainnet, 2)
	solanaToken := NewUSDCTokenConfig(SolanaMainnet, 3)

	// Verify BaseMainnet has priority 1
	if baseToken.Priority != 1 {
		t.Errorf("BaseMainnet Priority = %d, want 1", baseToken.Priority)
	}

	// Verify PolygonMainnet has priority 2
	if polygonToken.Priority != 2 {
		t.Errorf("PolygonMainnet Priority = %d, want 2", polygonToken.Priority)
	}

	// Verify SolanaMainnet has priority 3
	if solanaToken.Priority != 3 {
		t.Errorf("SolanaMainnet Priority = %d, want 3", solanaToken.Priority)
	}

	// Verify all have USDC symbol
	if baseToken.Symbol != "USDC" || polygonToken.Symbol != "USDC" || solanaToken.Symbol != "USDC" {
		t.Errorf("Not all tokens have USDC symbol")
	}

	// Verify all have correct addresses
	if baseToken.Address != BaseMainnet.USDCAddress {
		t.Errorf("BaseMainnet address mismatch")
	}
	if polygonToken.Address != PolygonMainnet.USDCAddress {
		t.Errorf("PolygonMainnet address mismatch")
	}
	if solanaToken.Address != SolanaMainnet.USDCAddress {
		t.Errorf("SolanaMainnet address mismatch")
	}
}

// TestTestnetTokenConfig tests testnet TokenConfig creation
func TestTestnetTokenConfig(t *testing.T) {
	tests := []struct {
		name     string
		chain    ChainConfig
		priority int
	}{
		{"BaseSepolia", BaseSepolia, 1},
		{"PolygonAmoy", PolygonAmoy, 2},
		{"SolanaDevnet", SolanaDevnet, 3},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token := NewUSDCTokenConfig(tt.chain, tt.priority)

			// Verify correct testnet address used
			if token.Address != tt.chain.USDCAddress {
				t.Errorf("Address = %s, want %s", token.Address, tt.chain.USDCAddress)
			}

			// Verify priority matches
			if token.Priority != tt.priority {
				t.Errorf("Priority = %d, want %d", token.Priority, tt.priority)
			}

			// Verify Symbol is USDC
			if token.Symbol != "USDC" {
				t.Errorf("Symbol = %s, want USDC", token.Symbol)
			}

			// Verify Decimals is 6
			if token.Decimals != 6 {
				t.Errorf("Decimals = %d, want 6", token.Decimals)
			}
		})
	}
}

// TestTokenConfigSymbolAndDecimals verifies Symbol and Decimals are consistent for all chains
func TestTokenConfigSymbolAndDecimals(t *testing.T) {
	chains := []ChainConfig{
		SolanaMainnet, SolanaDevnet,
		BaseMainnet, BaseSepolia,
		PolygonMainnet, PolygonAmoy,
		AvalancheMainnet, AvalancheFuji,
	}

	for _, chain := range chains {
		token := NewUSDCTokenConfig(chain, 1)

		// Verify Symbol is always USDC
		if token.Symbol != "USDC" {
			t.Errorf("%s: Symbol = %s, want USDC", chain.NetworkID, token.Symbol)
		}

		// Verify Decimals is always 6
		if token.Decimals != 6 {
			t.Errorf("%s: Decimals = %d, want 6", chain.NetworkID, token.Decimals)
		}
	}
}

// TestValidateNetworkEVM tests ValidateNetwork for EVM chains
func TestValidateNetworkEVM(t *testing.T) {
	tests := []struct {
		name      string
		networkID string
	}{
		{"base", "base"},
		{"base-sepolia", "base-sepolia"},
		{"polygon", "polygon"},
		{"polygon-amoy", "polygon-amoy"},
		{"avalanche", "avalanche"},
		{"avalanche-fuji", "avalanche-fuji"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			netType, err := ValidateNetwork(tt.networkID)
			if err != nil {
				t.Fatalf("ValidateNetwork() error = %v, want nil", err)
			}

			if netType != NetworkTypeEVM {
				t.Errorf("NetworkType = %v, want NetworkTypeEVM", netType)
			}
		})
	}
}

// TestValidateNetworkSVM tests ValidateNetwork for SVM chains
func TestValidateNetworkSVM(t *testing.T) {
	tests := []struct {
		name      string
		networkID string
	}{
		{"solana", "solana"},
		{"solana-devnet", "solana-devnet"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			netType, err := ValidateNetwork(tt.networkID)
			if err != nil {
				t.Fatalf("ValidateNetwork() error = %v, want nil", err)
			}

			if netType != NetworkTypeSVM {
				t.Errorf("NetworkType = %v, want NetworkTypeSVM", netType)
			}
		})
	}
}

// TestValidateNetworkUnknown tests ValidateNetwork for unknown networks
func TestValidateNetworkUnknown(t *testing.T) {
	tests := []struct {
		name      string
		networkID string
		wantError string
	}{
		{"ethereum", "ethereum", "networkID: unsupported network"},
		{"arbitrum", "arbitrum", "networkID: unsupported network"},
		{"unknown", "unknown", "networkID: unsupported network"},
		{"optimism", "optimism", "networkID: unsupported network"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			netType, err := ValidateNetwork(tt.networkID)
			if err == nil {
				t.Fatal("ValidateNetwork() error = nil, want error")
			}

			if netType != NetworkTypeUnknown {
				t.Errorf("NetworkType = %v, want NetworkTypeUnknown", netType)
			}

			if err.Error() != tt.wantError {
				t.Errorf("error = %v, want %v", err.Error(), tt.wantError)
			}
		})
	}
}

// TestValidateNetworkEmpty tests ValidateNetwork with empty string
func TestValidateNetworkEmpty(t *testing.T) {
	netType, err := ValidateNetwork("")
	if err == nil {
		t.Fatal("ValidateNetwork() error = nil, want error")
	}

	if netType != NetworkTypeUnknown {
		t.Errorf("NetworkType = %v, want NetworkTypeUnknown", netType)
	}

	wantError := "networkID: cannot be empty"
	if err.Error() != wantError {
		t.Errorf("error = %v, want %v", err.Error(), wantError)
	}
}
