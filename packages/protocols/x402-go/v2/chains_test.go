package v2

import (
	"errors"
	"testing"
)

func TestNetworkConstants(t *testing.T) {
	tests := []struct {
		name    string
		network string
		want    string
	}{
		{"Base", NetworkBase, "eip155:8453"},
		{"Polygon", NetworkPolygon, "eip155:137"},
		{"Avalanche", NetworkAvalanche, "eip155:43114"},
		{"Ethereum", NetworkEthereum, "eip155:1"},
		{"BaseSepolia", NetworkBaseSepolia, "eip155:84532"},
		{"PolygonAmoy", NetworkPolygonAmoy, "eip155:80002"},
		{"AvalancheFuji", NetworkAvalancheFuji, "eip155:43113"},
		{"Sepolia", NetworkSepolia, "eip155:11155111"},
		{"SolanaMainnet", NetworkSolanaMainnet, "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"},
		{"SolanaDevnet", NetworkSolanaDevnet, "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.network != tt.want {
				t.Errorf("%s = %s; want %s", tt.name, tt.network, tt.want)
			}
		})
	}
}

func TestChainConfigUSDCAddresses(t *testing.T) {
	tests := []struct {
		name   string
		config ChainConfig
	}{
		{"BaseMainnet", BaseMainnet},
		{"PolygonMainnet", PolygonMainnet},
		{"AvalancheMainnet", AvalancheMainnet},
		{"EthereumMainnet", EthereumMainnet},
		{"BaseSepolia", BaseSepolia},
		{"PolygonAmoy", PolygonAmoy},
		{"AvalancheFuji", AvalancheFuji},
		{"Sepolia", Sepolia},
		{"SolanaMainnet", SolanaMainnet},
		{"SolanaDevnet", SolanaDevnet},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.config.USDCAddress == "" {
				t.Error("USDCAddress should not be empty")
			}
			if tt.config.Decimals != 6 {
				t.Errorf("Decimals = %d; want 6", tt.config.Decimals)
			}
			if tt.config.Network == "" {
				t.Error("Network should not be empty")
			}
		})
	}
}

func TestValidateNetwork(t *testing.T) {
	tests := []struct {
		name        string
		network     string
		wantType    NetworkType
		wantErr     bool
		errContains string
	}{
		{
			name:     "valid EVM mainnet",
			network:  "eip155:8453",
			wantType: NetworkTypeEVM,
		},
		{
			name:     "valid EVM testnet",
			network:  "eip155:84532",
			wantType: NetworkTypeEVM,
		},
		{
			name:     "valid Solana mainnet",
			network:  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
			wantType: NetworkTypeSVM,
		},
		{
			name:     "valid Solana devnet",
			network:  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
			wantType: NetworkTypeSVM,
		},
		{
			name:        "empty network",
			network:     "",
			wantType:    NetworkTypeUnknown,
			wantErr:     true,
			errContains: "cannot be empty",
		},
		{
			name:        "invalid format - no colon",
			network:     "eip1558453",
			wantType:    NetworkTypeUnknown,
			wantErr:     true,
			errContains: "invalid CAIP-2 format",
		},
		{
			name:        "invalid format - missing reference",
			network:     "eip155:",
			wantType:    NetworkTypeUnknown,
			wantErr:     true,
			errContains: "missing network reference",
		},
		{
			name:        "invalid EVM chain ID",
			network:     "eip155:abc",
			wantType:    NetworkTypeUnknown,
			wantErr:     true,
			errContains: "invalid EIP-155 chain ID",
		},
		{
			name:        "unsupported namespace",
			network:     "cosmos:cosmoshub-4",
			wantType:    NetworkTypeUnknown,
			wantErr:     true,
			errContains: "unsupported namespace",
		},
		{
			name:        "invalid Solana genesis hash - too short",
			network:     "solana:short",
			wantType:    NetworkTypeUnknown,
			wantErr:     true,
			errContains: "invalid Solana genesis hash length",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotType, err := ValidateNetwork(tt.network)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateNetwork() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if gotType != tt.wantType {
				t.Errorf("ValidateNetwork() type = %v, want %v", gotType, tt.wantType)
			}
			if tt.wantErr && tt.errContains != "" {
				if err == nil || !containsString(err.Error(), tt.errContains) {
					t.Errorf("ValidateNetwork() error = %v, want error containing %q", err, tt.errContains)
				}
			}
		})
	}
}

func TestGetChainID(t *testing.T) {
	tests := []struct {
		name    string
		network string
		want    int64
		wantErr bool
	}{
		{
			name:    "Base mainnet",
			network: "eip155:8453",
			want:    8453,
		},
		{
			name:    "Ethereum mainnet",
			network: "eip155:1",
			want:    1,
		},
		{
			name:    "Base Sepolia",
			network: "eip155:84532",
			want:    84532,
		},
		{
			name:    "Sepolia",
			network: "eip155:11155111",
			want:    11155111,
		},
		{
			name:    "Polygon",
			network: "eip155:137",
			want:    137,
		},
		{
			name:    "Polygon Amoy",
			network: "eip155:80002",
			want:    80002,
		},
		{
			name:    "Avalanche",
			network: "eip155:43114",
			want:    43114,
		},
		{
			name:    "Avalanche Fuji",
			network: "eip155:43113",
			want:    43113,
		},
		{
			name:    "not EVM",
			network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
			wantErr: true,
		},
		{
			name:    "invalid format",
			network: "invalid",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := GetChainID(tt.network)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetChainID() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("GetChainID() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestGetSolanaGenesisHash(t *testing.T) {
	tests := []struct {
		name    string
		network string
		want    string
		wantErr bool
	}{
		{
			name:    "Solana mainnet",
			network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
			want:    "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
		},
		{
			name:    "Solana devnet",
			network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
			want:    "EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
		},
		{
			name:    "not Solana",
			network: "eip155:8453",
			wantErr: true,
		},
		{
			name:    "invalid format",
			network: "invalid",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := GetSolanaGenesisHash(tt.network)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetSolanaGenesisHash() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("GetSolanaGenesisHash() = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestGetChainConfig(t *testing.T) {
	tests := []struct {
		name    string
		network string
		wantErr bool
	}{
		{"Base", NetworkBase, false},
		{"Polygon", NetworkPolygon, false},
		{"Avalanche", NetworkAvalanche, false},
		{"Ethereum", NetworkEthereum, false},
		{"BaseSepolia", NetworkBaseSepolia, false},
		{"PolygonAmoy", NetworkPolygonAmoy, false},
		{"AvalancheFuji", NetworkAvalancheFuji, false},
		{"Sepolia", NetworkSepolia, false},
		{"SolanaMainnet", NetworkSolanaMainnet, false},
		{"SolanaDevnet", NetworkSolanaDevnet, false},
		{"Unknown", "eip155:99999", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config, err := GetChainConfig(tt.network)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetChainConfig() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				if config.Network != tt.network {
					t.Errorf("GetChainConfig().Network = %s, want %s", config.Network, tt.network)
				}
				if config.USDCAddress == "" {
					t.Error("GetChainConfig().USDCAddress should not be empty")
				}
			}
			if tt.wantErr && err != nil {
				if !errors.Is(err, ErrInvalidNetwork) {
					t.Errorf("GetChainConfig() error should wrap ErrInvalidNetwork, got %v", err)
				}
			}
		})
	}
}

func TestNewUSDCTokenConfig(t *testing.T) {
	config := NewUSDCTokenConfig(BaseMainnet, 1)

	if config.Address != BaseMainnet.USDCAddress {
		t.Errorf("Address = %s; want %s", config.Address, BaseMainnet.USDCAddress)
	}
	if config.Symbol != "USDC" {
		t.Errorf("Symbol = %s; want USDC", config.Symbol)
	}
	if config.Decimals != 6 {
		t.Errorf("Decimals = %d; want 6", config.Decimals)
	}
	if config.Priority != 1 {
		t.Errorf("Priority = %d; want 1", config.Priority)
	}
}

func TestEIP3009Parameters(t *testing.T) {
	// EVM chains should have EIP3009 parameters
	evmChains := []ChainConfig{
		BaseMainnet, PolygonMainnet, AvalancheMainnet, EthereumMainnet,
		BaseSepolia, PolygonAmoy, AvalancheFuji, Sepolia,
	}

	for _, chain := range evmChains {
		if chain.EIP3009Name == "" {
			t.Errorf("%s: EIP3009Name should not be empty", chain.Network)
		}
		if chain.EIP3009Version == "" {
			t.Errorf("%s: EIP3009Version should not be empty", chain.Network)
		}
	}

	// Solana chains should NOT have EIP3009 parameters
	solanaChains := []ChainConfig{SolanaMainnet, SolanaDevnet}
	for _, chain := range solanaChains {
		if chain.EIP3009Name != "" {
			t.Errorf("%s: EIP3009Name should be empty for Solana", chain.Network)
		}
		if chain.EIP3009Version != "" {
			t.Errorf("%s: EIP3009Version should be empty for Solana", chain.Network)
		}
	}
}

// Helper function
func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsSubstring(s, substr))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
