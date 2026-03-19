package validation

import (
	"strings"
	"testing"

	v2 "github.com/mark3labs/x402-go/v2"
)

func TestValidateAmount(t *testing.T) {
	tests := []struct {
		name    string
		amount  string
		wantErr bool
		errMsg  string
	}{
		{
			name:   "valid positive amount",
			amount: "1000000",
		},
		{
			name:   "valid zero amount",
			amount: "0",
		},
		{
			name:   "valid large amount",
			amount: "999999999999999999999999999",
		},
		{
			name:    "empty amount",
			amount:  "",
			wantErr: true,
			errMsg:  "cannot be empty",
		},
		{
			name:    "negative amount",
			amount:  "-100",
			wantErr: true,
			errMsg:  "cannot be negative",
		},
		{
			name:    "invalid format - letters",
			amount:  "abc",
			wantErr: true,
			errMsg:  "invalid amount format",
		},
		{
			name:    "invalid format - decimal",
			amount:  "1.5",
			wantErr: true,
			errMsg:  "invalid amount format",
		},
		{
			name:    "invalid format - hex",
			amount:  "0x100",
			wantErr: true,
			errMsg:  "invalid amount format",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateAmount(tt.amount)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateAmount() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr && err != nil && tt.errMsg != "" {
				if !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("ValidateAmount() error = %v, want error containing %q", err, tt.errMsg)
				}
			}
		})
	}
}

func TestValidateNetwork(t *testing.T) {
	tests := []struct {
		name    string
		network string
		wantErr bool
	}{
		{
			name:    "valid EVM mainnet",
			network: "eip155:8453",
		},
		{
			name:    "valid EVM testnet",
			network: "eip155:84532",
		},
		{
			name:    "valid Solana mainnet",
			network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
		},
		{
			name:    "valid Solana devnet",
			network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
		},
		{
			name:    "empty network",
			network: "",
			wantErr: true,
		},
		{
			name:    "invalid format - no colon",
			network: "eip1558453",
			wantErr: true,
		},
		{
			name:    "invalid format - v1 style",
			network: "base-sepolia",
			wantErr: true,
		},
		{
			name:    "unsupported namespace",
			network: "cosmos:cosmoshub-4",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateNetwork(tt.network)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateNetwork() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateAddress(t *testing.T) {
	tests := []struct {
		name    string
		address string
		network string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid EVM address",
			address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			network: "eip155:8453",
		},
		{
			name:    "valid EVM address lowercase",
			address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
			network: "eip155:8453",
		},
		{
			name:    "valid Solana address",
			address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
			network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
		},
		{
			name:    "empty address",
			address: "",
			network: "eip155:8453",
			wantErr: true,
			errMsg:  "cannot be empty",
		},
		{
			name:    "invalid EVM address - too short",
			address: "0x1234",
			network: "eip155:8453",
			wantErr: true,
			errMsg:  "invalid EVM address",
		},
		{
			name:    "invalid EVM address - no 0x prefix",
			address: "833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			network: "eip155:8453",
			wantErr: true,
			errMsg:  "invalid EVM address",
		},
		{
			name:    "invalid Solana address - too short",
			address: "short",
			network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
			wantErr: true,
			errMsg:  "invalid Solana address",
		},
		{
			name:    "invalid network",
			address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			network: "invalid",
			wantErr: true,
			errMsg:  "cannot validate address",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateAddress(tt.address, tt.network)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateAddress() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr && err != nil && tt.errMsg != "" {
				if !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("ValidateAddress() error = %v, want error containing %q", err, tt.errMsg)
				}
			}
		})
	}
}

func TestValidateResourceInfo(t *testing.T) {
	tests := []struct {
		name     string
		resource v2.ResourceInfo
		wantErr  bool
	}{
		{
			name: "valid resource",
			resource: v2.ResourceInfo{
				URL:         "https://example.com/api",
				Description: "Test API",
				MimeType:    "application/json",
			},
		},
		{
			name: "valid resource - URL only",
			resource: v2.ResourceInfo{
				URL: "https://example.com/api",
			},
		},
		{
			name: "empty URL",
			resource: v2.ResourceInfo{
				Description: "Test API",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateResourceInfo(tt.resource)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateResourceInfo() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidatePaymentRequirements(t *testing.T) {
	validReq := v2.PaymentRequirements{
		Scheme:            "exact",
		Network:           "eip155:8453",
		Amount:            "1000000",
		Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		PayTo:             "0x1234567890123456789012345678901234567890",
		MaxTimeoutSeconds: 300,
	}

	tests := []struct {
		name    string
		req     v2.PaymentRequirements
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid requirements",
			req:  validReq,
		},
		{
			name: "valid requirements with zero amount",
			req: func() v2.PaymentRequirements {
				r := validReq
				r.Amount = "0"
				return r
			}(),
		},
		{
			name: "valid requirements with extra",
			req: func() v2.PaymentRequirements {
				r := validReq
				r.Extra = map[string]interface{}{
					"name":    "USD Coin",
					"version": "2",
				}
				return r
			}(),
		},
		{
			name: "empty scheme",
			req: func() v2.PaymentRequirements {
				r := validReq
				r.Scheme = ""
				return r
			}(),
			wantErr: true,
			errMsg:  "scheme cannot be empty",
		},
		{
			name: "unsupported scheme",
			req: func() v2.PaymentRequirements {
				r := validReq
				r.Scheme = "streaming"
				return r
			}(),
			wantErr: true,
			errMsg:  "unsupported scheme",
		},
		{
			name: "invalid network",
			req: func() v2.PaymentRequirements {
				r := validReq
				r.Network = "base-sepolia" // v1 format
				return r
			}(),
			wantErr: true,
		},
		{
			name: "empty amount",
			req: func() v2.PaymentRequirements {
				r := validReq
				r.Amount = ""
				return r
			}(),
			wantErr: true,
		},
		{
			name: "negative amount",
			req: func() v2.PaymentRequirements {
				r := validReq
				r.Amount = "-100"
				return r
			}(),
			wantErr: true,
		},
		{
			name: "empty asset",
			req: func() v2.PaymentRequirements {
				r := validReq
				r.Asset = ""
				return r
			}(),
			wantErr: true,
			errMsg:  "asset address cannot be empty",
		},
		{
			name: "invalid payTo address",
			req: func() v2.PaymentRequirements {
				r := validReq
				r.PayTo = "invalid"
				return r
			}(),
			wantErr: true,
			errMsg:  "payTo",
		},
		{
			name: "negative timeout",
			req: func() v2.PaymentRequirements {
				r := validReq
				r.MaxTimeoutSeconds = -1
				return r
			}(),
			wantErr: true,
			errMsg:  "timeout cannot be negative",
		},
		{
			name: "empty EIP-3009 name in extra",
			req: func() v2.PaymentRequirements {
				r := validReq
				r.Extra = map[string]interface{}{
					"name":    "",
					"version": "2",
				}
				return r
			}(),
			wantErr: true,
			errMsg:  "EIP-3009 name cannot be empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePaymentRequirements(tt.req)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidatePaymentRequirements() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr && err != nil && tt.errMsg != "" {
				if !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("ValidatePaymentRequirements() error = %v, want error containing %q", err, tt.errMsg)
				}
			}
		})
	}
}

func TestValidatePaymentPayload(t *testing.T) {
	validPayload := v2.PaymentPayload{
		X402Version: 2,
		Resource: &v2.ResourceInfo{
			URL: "https://example.com/api",
		},
		Accepted: v2.PaymentRequirements{
			Scheme:  "exact",
			Network: "eip155:8453",
			Amount:  "1000000",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			PayTo:   "0x1234567890123456789012345678901234567890",
		},
		Payload: map[string]interface{}{"signature": "0xabc"},
	}

	tests := []struct {
		name    string
		payload v2.PaymentPayload
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid payload",
			payload: validPayload,
		},
		{
			name: "valid payload without resource",
			payload: func() v2.PaymentPayload {
				p := validPayload
				p.Resource = nil
				return p
			}(),
		},
		{
			name: "wrong version",
			payload: func() v2.PaymentPayload {
				p := validPayload
				p.X402Version = 1
				return p
			}(),
			wantErr: true,
			errMsg:  "unsupported x402 version",
		},
		{
			name: "empty scheme",
			payload: func() v2.PaymentPayload {
				p := validPayload
				p.Accepted.Scheme = ""
				return p
			}(),
			wantErr: true,
			errMsg:  "scheme cannot be empty",
		},
		{
			name: "empty network",
			payload: func() v2.PaymentPayload {
				p := validPayload
				p.Accepted.Network = ""
				return p
			}(),
			wantErr: true,
			errMsg:  "network cannot be empty",
		},
		{
			name: "invalid network",
			payload: func() v2.PaymentPayload {
				p := validPayload
				p.Accepted.Network = "invalid"
				return p
			}(),
			wantErr: true,
			errMsg:  "invalid accepted network",
		},
		{
			name: "nil payload",
			payload: func() v2.PaymentPayload {
				p := validPayload
				p.Payload = nil
				return p
			}(),
			wantErr: true,
			errMsg:  "payload cannot be nil",
		},
		{
			name: "invalid resource URL",
			payload: func() v2.PaymentPayload {
				p := validPayload
				p.Resource = &v2.ResourceInfo{URL: ""}
				return p
			}(),
			wantErr: true,
			errMsg:  "invalid resource",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePaymentPayload(tt.payload)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidatePaymentPayload() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr && err != nil && tt.errMsg != "" {
				if !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("ValidatePaymentPayload() error = %v, want error containing %q", err, tt.errMsg)
				}
			}
		})
	}
}

func TestValidatePaymentRequired(t *testing.T) {
	validPR := v2.PaymentRequired{
		X402Version: 2,
		Error:       "Payment required",
		Resource: &v2.ResourceInfo{
			URL: "https://example.com/api",
		},
		Accepts: []v2.PaymentRequirements{
			{
				Scheme:  "exact",
				Network: "eip155:8453",
				Amount:  "1000000",
				Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				PayTo:   "0x1234567890123456789012345678901234567890",
			},
		},
	}

	tests := []struct {
		name    string
		pr      v2.PaymentRequired
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid payment required",
			pr:   validPR,
		},
		{
			name: "wrong version",
			pr: func() v2.PaymentRequired {
				p := validPR
				p.X402Version = 1
				return p
			}(),
			wantErr: true,
			errMsg:  "unsupported x402 version",
		},
		{
			name: "empty resource URL",
			pr: func() v2.PaymentRequired {
				p := validPR
				p.Resource = &v2.ResourceInfo{URL: ""}
				return p
			}(),
			wantErr: true,
			errMsg:  "invalid payment required",
		},
		{
			name: "empty accepts",
			pr: func() v2.PaymentRequired {
				p := validPR
				p.Accepts = []v2.PaymentRequirements{}
				return p
			}(),
			wantErr: true,
			errMsg:  "accepts cannot be empty",
		},
		{
			name: "invalid accepts item",
			pr: func() v2.PaymentRequired {
				p := validPR
				p.Accepts = []v2.PaymentRequirements{
					{
						Scheme:  "",
						Network: "eip155:8453",
						Amount:  "1000000",
						Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
						PayTo:   "0x1234567890123456789012345678901234567890",
					},
				}
				return p
			}(),
			wantErr: true,
			errMsg:  "accepts[0]",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePaymentRequired(tt.pr)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidatePaymentRequired() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr && err != nil && tt.errMsg != "" {
				if !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("ValidatePaymentRequired() error = %v, want error containing %q", err, tt.errMsg)
				}
			}
		})
	}
}

func TestValidateSolanaRequirements(t *testing.T) {
	req := v2.PaymentRequirements{
		Scheme:            "exact",
		Network:           "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
		Amount:            "1000000",
		Asset:             "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
		PayTo:             "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
		MaxTimeoutSeconds: 300,
	}

	err := ValidatePaymentRequirements(req)
	if err != nil {
		t.Errorf("ValidatePaymentRequirements() error = %v for valid Solana requirements", err)
	}
}
