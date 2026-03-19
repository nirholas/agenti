package validation

import (
	"strings"
	"testing"

	"github.com/mark3labs/x402-go"
)

func TestValidateAmount(t *testing.T) {
	tests := []struct {
		name    string
		amount  string
		wantErr bool
	}{
		{
			name:    "valid positive amount",
			amount:  "10000",
			wantErr: false,
		},
		{
			name:    "valid large amount",
			amount:  "999999999999999999999",
			wantErr: false,
		},
		{
			name:    "empty amount",
			amount:  "",
			wantErr: true,
		},
		{
			name:    "zero amount",
			amount:  "0",
			wantErr: true,
		},
		{
			name:    "negative amount",
			amount:  "-100",
			wantErr: true,
		},
		{
			name:    "invalid format - letters",
			amount:  "abc",
			wantErr: true,
		},
		{
			name:    "invalid format - mixed",
			amount:  "123abc",
			wantErr: true,
		},
		{
			name:    "invalid format - decimal",
			amount:  "100.50",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateAmount(tt.amount)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateAmount() error = %v, wantErr %v", err, tt.wantErr)
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
	}{
		{
			name:    "valid EVM address",
			address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
			network: "base",
			wantErr: false,
		},
		{
			name:    "valid EVM address uppercase",
			address: "0x833589FCD6EDB6E08F4C7C32D4F71B54BDA02913",
			network: "base-sepolia",
			wantErr: false,
		},
		{
			name:    "valid Solana address",
			address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
			network: "solana",
			wantErr: false,
		},
		{
			name:    "valid Solana address devnet",
			address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
			network: "solana-devnet",
			wantErr: false,
		},
		{
			name:    "empty address",
			address: "",
			network: "base",
			wantErr: true,
		},
		{
			name:    "invalid EVM address - missing 0x",
			address: "833589fcd6edb6e08f4c7c32d4f71b54bda02913",
			network: "base",
			wantErr: true,
		},
		{
			name:    "invalid EVM address - wrong length",
			address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda029",
			network: "base",
			wantErr: true,
		},
		{
			name:    "invalid EVM address - non-hex chars",
			address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda0291g",
			network: "base",
			wantErr: true,
		},
		{
			name:    "invalid Solana address - too short",
			address: "ABC123",
			network: "solana",
			wantErr: true,
		},
		{
			name:    "invalid Solana address - invalid chars",
			address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
			network: "solana",
			wantErr: true,
		},
		{
			name:    "invalid network",
			address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
			network: "unknown-network",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateAddress(tt.address, tt.network)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateAddress() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidatePaymentRequirement(t *testing.T) {
	tests := []struct {
		name    string
		req     x402.PaymentRequirement
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid EVM requirement",
			req: x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				MaxAmountRequired: "10000",
				Asset:             "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				Resource:          "https://api.example.com/resource",
				Description:       "Test payment",
				MaxTimeoutSeconds: 300,
			},
			wantErr: false,
		},
		{
			name: "valid Solana requirement",
			req: x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "solana",
				MaxAmountRequired: "1000000",
				Asset:             "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
				PayTo:             "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
				MaxTimeoutSeconds: 60,
			},
			wantErr: false,
		},
		{
			name: "valid with EIP-3009 extra",
			req: x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base-sepolia",
				MaxAmountRequired: "5000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 120,
				Extra: map[string]interface{}{
					"name":    "USD Coin",
					"version": "2",
				},
			},
			wantErr: false,
		},
		{
			name: "invalid amount - empty",
			req: x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				MaxAmountRequired: "",
				Asset:             "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
			},
			wantErr: true,
			errMsg:  "amount cannot be empty",
		},
		{
			name: "invalid amount - zero",
			req: x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				MaxAmountRequired: "0",
				Asset:             "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
			},
			wantErr: true,
			errMsg:  "amount must be greater than 0",
		},
		{
			name: "invalid network - empty",
			req: x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "",
				MaxAmountRequired: "10000",
				Asset:             "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
			},
			wantErr: true,
			errMsg:  "network cannot be empty",
		},
		{
			name: "invalid network - unsupported",
			req: x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "bitcoin",
				MaxAmountRequired: "10000",
				Asset:             "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
			},
			wantErr: true,
			errMsg:  "unsupported network",
		},
		{
			name: "invalid payTo address",
			req: x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				MaxAmountRequired: "10000",
				Asset:             "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
				PayTo:             "not-an-address",
			},
			wantErr: true,
			errMsg:  "payTo",
		},
		{
			name: "empty asset address",
			req: x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				MaxAmountRequired: "10000",
				Asset:             "",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
			},
			wantErr: true,
			errMsg:  "asset address cannot be empty",
		},
		{
			name: "invalid asset address",
			req: x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				MaxAmountRequired: "10000",
				Asset:             "invalid-address",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
			},
			wantErr: true,
			errMsg:  "asset",
		},
		{
			name: "empty scheme",
			req: x402.PaymentRequirement{
				Scheme:            "",
				Network:           "base",
				MaxAmountRequired: "10000",
				Asset:             "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
			},
			wantErr: true,
			errMsg:  "scheme cannot be empty",
		},
		{
			name: "unsupported scheme",
			req: x402.PaymentRequirement{
				Scheme:            "invalid-scheme",
				Network:           "base",
				MaxAmountRequired: "10000",
				Asset:             "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
			},
			wantErr: true,
			errMsg:  "unsupported scheme",
		},
		{
			name: "negative timeout",
			req: x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				MaxAmountRequired: "10000",
				Asset:             "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: -1,
			},
			wantErr: true,
			errMsg:  "timeout cannot be negative",
		},
		{
			name: "empty EIP-3009 name",
			req: x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				MaxAmountRequired: "10000",
				Asset:             "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				Extra: map[string]interface{}{
					"name":    "",
					"version": "2",
				},
			},
			wantErr: true,
			errMsg:  "EIP-3009 name cannot be empty",
		},
		{
			name: "empty EIP-3009 version",
			req: x402.PaymentRequirement{
				Scheme:            "exact",
				Network:           "base",
				MaxAmountRequired: "10000",
				Asset:             "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				Extra: map[string]interface{}{
					"name":    "USD Coin",
					"version": "",
				},
			},
			wantErr: true,
			errMsg:  "EIP-3009 version cannot be empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePaymentRequirement(tt.req)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidatePaymentRequirement() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && tt.errMsg != "" {
				if err == nil || !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("ValidatePaymentRequirement() error = %v, want error containing %q", err, tt.errMsg)
				}
			}
		})
	}
}

func TestValidatePaymentPayload(t *testing.T) {
	tests := []struct {
		name    string
		payment x402.PaymentPayload
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid payment payload",
			payment: x402.PaymentPayload{
				X402Version: 1,
				Scheme:      "exact",
				Network:     "base",
				Payload: map[string]interface{}{
					"signature": "0x1234...",
				},
			},
			wantErr: false,
		},
		{
			name: "unsupported version",
			payment: x402.PaymentPayload{
				X402Version: 2,
				Scheme:      "exact",
				Network:     "base",
				Payload:     map[string]interface{}{},
			},
			wantErr: true,
			errMsg:  "unsupported x402 version",
		},
		{
			name: "empty scheme",
			payment: x402.PaymentPayload{
				X402Version: 1,
				Scheme:      "",
				Network:     "base",
				Payload:     map[string]interface{}{},
			},
			wantErr: true,
			errMsg:  "scheme cannot be empty",
		},
		{
			name: "empty network",
			payment: x402.PaymentPayload{
				X402Version: 1,
				Scheme:      "exact",
				Network:     "",
				Payload:     map[string]interface{}{},
			},
			wantErr: true,
			errMsg:  "network cannot be empty",
		},
		{
			name: "invalid network",
			payment: x402.PaymentPayload{
				X402Version: 1,
				Scheme:      "exact",
				Network:     "unknown",
				Payload:     map[string]interface{}{},
			},
			wantErr: true,
			errMsg:  "invalid network",
		},
		{
			name: "nil payload",
			payment: x402.PaymentPayload{
				X402Version: 1,
				Scheme:      "exact",
				Network:     "base",
				Payload:     nil,
			},
			wantErr: true,
			errMsg:  "payload cannot be nil",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePaymentPayload(tt.payment)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidatePaymentPayload() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && tt.errMsg != "" {
				if err == nil || !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("ValidatePaymentPayload() error = %v, want error containing %q", err, tt.errMsg)
				}
			}
		})
	}
}
