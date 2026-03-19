package encoding

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"

	"github.com/mark3labs/x402-go"
)

func TestEncodePayment(t *testing.T) {
	tests := []struct {
		name    string
		payment x402.PaymentPayload
		wantErr bool
	}{
		{
			name: "valid payment",
			payment: x402.PaymentPayload{
				X402Version: 1,
				Network:     "base",
				Scheme:      "eip3009",
				Payload:     map[string]interface{}{"key": "value"},
			},
			wantErr: false,
		},
		{
			name: "minimal payment",
			payment: x402.PaymentPayload{
				X402Version: 1,
				Network:     "solana",
				Scheme:      "exact",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encoded, err := EncodePayment(tt.payment)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error but got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			// Verify it's valid base64
			decoded, err := base64.StdEncoding.DecodeString(encoded)
			if err != nil {
				t.Fatalf("encoded value is not valid base64: %v", err)
			}

			// Verify it's valid JSON
			var payment x402.PaymentPayload
			if err := json.Unmarshal(decoded, &payment); err != nil {
				t.Fatalf("decoded value is not valid JSON: %v", err)
			}

			// Verify content matches
			if payment.X402Version != tt.payment.X402Version {
				t.Errorf("version mismatch: got %d, want %d", payment.X402Version, tt.payment.X402Version)
			}
			if payment.Network != tt.payment.Network {
				t.Errorf("network mismatch: got %s, want %s", payment.Network, tt.payment.Network)
			}
		})
	}
}

func TestDecodePayment(t *testing.T) {
	tests := []struct {
		name    string
		encoded string
		want    x402.PaymentPayload
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid encoded payment",
			encoded: base64.StdEncoding.EncodeToString([]byte(`{"x402Version":1,"network":"base","scheme":"eip3009","payload":null}`)),
			want: x402.PaymentPayload{
				X402Version: 1,
				Network:     "base",
				Scheme:      "eip3009",
				Payload:     nil,
			},
			wantErr: false,
		},
		{
			name:    "invalid base64",
			encoded: "not-valid-base64!!!",
			wantErr: true,
			errMsg:  "failed to decode base64",
		},
		{
			name:    "invalid JSON",
			encoded: base64.StdEncoding.EncodeToString([]byte(`{invalid json`)),
			wantErr: true,
			errMsg:  "failed to unmarshal payment",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payment, err := DecodePayment(tt.encoded)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error but got nil")
				}
				if !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("error message should contain %q, got %q", tt.errMsg, err.Error())
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if payment.X402Version != tt.want.X402Version {
				t.Errorf("version mismatch: got %d, want %d", payment.X402Version, tt.want.X402Version)
			}
			if payment.Network != tt.want.Network {
				t.Errorf("network mismatch: got %s, want %s", payment.Network, tt.want.Network)
			}
			if payment.Scheme != tt.want.Scheme {
				t.Errorf("scheme mismatch: got %s, want %s", payment.Scheme, tt.want.Scheme)
			}
		})
	}
}

func TestEncodeSettlement(t *testing.T) {
	tests := []struct {
		name       string
		settlement x402.SettlementResponse
		wantErr    bool
	}{
		{
			name: "valid settlement",
			settlement: x402.SettlementResponse{
				Success:     true,
				Transaction: "0xtxhash",
				Payer:       "0xpayer",
				Network:     "base",
			},
			wantErr: false,
		},
		{
			name: "failed settlement",
			settlement: x402.SettlementResponse{
				Success:     false,
				ErrorReason: "Payment rejected",
				Network:     "base",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encoded, err := EncodeSettlement(tt.settlement)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error but got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			// Verify it's valid base64
			decoded, err := base64.StdEncoding.DecodeString(encoded)
			if err != nil {
				t.Fatalf("encoded value is not valid base64: %v", err)
			}

			// Verify it's valid JSON
			var settlement x402.SettlementResponse
			if err := json.Unmarshal(decoded, &settlement); err != nil {
				t.Fatalf("decoded value is not valid JSON: %v", err)
			}

			// Verify content matches
			if settlement.Success != tt.settlement.Success {
				t.Errorf("success mismatch: got %v, want %v", settlement.Success, tt.settlement.Success)
			}
			if settlement.Transaction != tt.settlement.Transaction {
				t.Errorf("transaction mismatch: got %s, want %s", settlement.Transaction, tt.settlement.Transaction)
			}
		})
	}
}

func TestDecodeSettlement(t *testing.T) {
	tests := []struct {
		name    string
		encoded string
		want    x402.SettlementResponse
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid settlement",
			encoded: base64.StdEncoding.EncodeToString([]byte(`{"success":true,"transaction":"0xtxhash","payer":"0xpayer","network":"base"}`)),
			want: x402.SettlementResponse{
				Success:     true,
				Transaction: "0xtxhash",
				Payer:       "0xpayer",
				Network:     "base",
			},
			wantErr: false,
		},
		{
			name:    "invalid base64",
			encoded: "not valid base64!!!",
			wantErr: true,
			errMsg:  "failed to decode base64",
		},
		{
			name:    "invalid JSON",
			encoded: base64.StdEncoding.EncodeToString([]byte(`{not valid json`)),
			wantErr: true,
			errMsg:  "failed to unmarshal settlement",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			settlement, err := DecodeSettlement(tt.encoded)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error but got nil")
				}
				if !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("error message should contain %q, got %q", tt.errMsg, err.Error())
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if settlement.Success != tt.want.Success {
				t.Errorf("success mismatch: got %v, want %v", settlement.Success, tt.want.Success)
			}
			if settlement.Transaction != tt.want.Transaction {
				t.Errorf("transaction mismatch: got %s, want %s", settlement.Transaction, tt.want.Transaction)
			}
		})
	}
}

func TestEncodeRequirements(t *testing.T) {
	requirements := x402.PaymentRequirementsResponse{
		X402Version: 1,
		Error:       "Payment required",
		Accepts: []x402.PaymentRequirement{
			{
				Network:           "base",
				Scheme:            "eip3009",
				Asset:             "0xtoken",
				PayTo:             "0xrecipient",
				MaxAmountRequired: "1000000",
			},
		},
	}

	encoded, err := EncodeRequirements(requirements)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify it's valid base64
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatalf("encoded value is not valid base64: %v", err)
	}

	// Verify it's valid JSON
	var req x402.PaymentRequirementsResponse
	if err := json.Unmarshal(decoded, &req); err != nil {
		t.Fatalf("decoded value is not valid JSON: %v", err)
	}

	// Verify content matches
	if req.X402Version != requirements.X402Version {
		t.Errorf("version mismatch: got %d, want %d", req.X402Version, requirements.X402Version)
	}
	if len(req.Accepts) != len(requirements.Accepts) {
		t.Errorf("accepts length mismatch: got %d, want %d", len(req.Accepts), len(requirements.Accepts))
	}
}

func TestDecodeRequirements(t *testing.T) {
	tests := []struct {
		name    string
		encoded string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid requirements",
			encoded: base64.StdEncoding.EncodeToString([]byte(`{"x402Version":1,"error":"Payment required","accepts":[]}`)),
			wantErr: false,
		},
		{
			name:    "invalid base64",
			encoded: "!!!not valid base64",
			wantErr: true,
			errMsg:  "failed to decode base64",
		},
		{
			name:    "invalid JSON",
			encoded: base64.StdEncoding.EncodeToString([]byte(`{bad json`)),
			wantErr: true,
			errMsg:  "failed to unmarshal requirements",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requirements, err := DecodeRequirements(tt.encoded)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error but got nil")
				}
				if !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("error message should contain %q, got %q", tt.errMsg, err.Error())
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if requirements.X402Version != 1 {
				t.Errorf("version mismatch: got %d, want 1", requirements.X402Version)
			}
		})
	}
}

// TestRoundTrip verifies that encoding followed by decoding returns the same value
func TestRoundTrip(t *testing.T) {
	t.Run("payment round trip", func(t *testing.T) {
		original := x402.PaymentPayload{
			X402Version: 1,
			Network:     "base",
			Scheme:      "eip3009",
			Payload:     map[string]interface{}{"test": "value"},
		}

		encoded, err := EncodePayment(original)
		if err != nil {
			t.Fatalf("encode error: %v", err)
		}

		decoded, err := DecodePayment(encoded)
		if err != nil {
			t.Fatalf("decode error: %v", err)
		}

		if decoded.X402Version != original.X402Version {
			t.Errorf("version mismatch after round trip")
		}
		if decoded.Network != original.Network {
			t.Errorf("network mismatch after round trip")
		}
		if decoded.Scheme != original.Scheme {
			t.Errorf("scheme mismatch after round trip")
		}
	})

	t.Run("settlement round trip", func(t *testing.T) {
		original := x402.SettlementResponse{
			Success:     true,
			Transaction: "0xtx",
			Payer:       "0xpayer",
			Network:     "base",
		}

		encoded, err := EncodeSettlement(original)
		if err != nil {
			t.Fatalf("encode error: %v", err)
		}

		decoded, err := DecodeSettlement(encoded)
		if err != nil {
			t.Fatalf("decode error: %v", err)
		}

		if decoded.Success != original.Success {
			t.Errorf("success mismatch after round trip")
		}
		if decoded.Transaction != original.Transaction {
			t.Errorf("transaction mismatch after round trip")
		}
	})
}
