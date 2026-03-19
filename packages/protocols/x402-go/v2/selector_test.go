package v2

import (
	"errors"
	"math/big"
	"testing"
)

// mockSigner implements Signer for testing
type mockSigner struct {
	network   string
	scheme    string
	tokens    []TokenConfig
	priority  int
	maxAmount *big.Int
	signErr   error
}

func (m *mockSigner) Network() string { return m.network }
func (m *mockSigner) Scheme() string  { return m.scheme }
func (m *mockSigner) CanSign(req *PaymentRequirements) bool {
	if req.Network != m.network || req.Scheme != m.scheme {
		return false
	}
	for _, token := range m.tokens {
		if token.Address == req.Asset {
			return true
		}
	}
	return false
}
func (m *mockSigner) Sign(req *PaymentRequirements) (*PaymentPayload, error) {
	if m.signErr != nil {
		return nil, m.signErr
	}
	return &PaymentPayload{
		X402Version: 2,
		Accepted: PaymentRequirements{
			Scheme:            req.Scheme,
			Network:           req.Network,
			Amount:            req.Amount,
			Asset:             req.Asset,
			PayTo:             req.PayTo,
			MaxTimeoutSeconds: req.MaxTimeoutSeconds,
		},
		Payload: EVMPayload{
			Signature: "0xmocksignature",
			Authorization: EVMAuthorization{
				From:  "0xpayer",
				To:    req.PayTo,
				Value: req.Amount,
			},
		},
	}, nil
}
func (m *mockSigner) GetPriority() int         { return m.priority }
func (m *mockSigner) GetTokens() []TokenConfig { return m.tokens }
func (m *mockSigner) GetMaxAmount() *big.Int   { return m.maxAmount }

func TestNewDefaultPaymentSelector(t *testing.T) {
	selector := NewDefaultPaymentSelector()
	if selector == nil {
		t.Error("NewDefaultPaymentSelector() returned nil")
	}
}

func TestDefaultPaymentSelector_SelectAndSign(t *testing.T) {
	baseSigner := &mockSigner{
		network:  "eip155:8453",
		scheme:   "exact",
		tokens:   []TokenConfig{{Address: "0xUSDC", Symbol: "USDC", Decimals: 6, Priority: 1}},
		priority: 1,
	}

	solanaSigner := &mockSigner{
		network:  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
		scheme:   "exact",
		tokens:   []TokenConfig{{Address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", Symbol: "USDC", Decimals: 6, Priority: 1}},
		priority: 2,
	}

	tests := []struct {
		name         string
		signers      []Signer
		requirements []PaymentRequirements
		wantNetwork  string
		wantErr      bool
		errCode      ErrorCode
	}{
		{
			name:    "single matching signer",
			signers: []Signer{baseSigner},
			requirements: []PaymentRequirements{
				{
					Scheme:  "exact",
					Network: "eip155:8453",
					Amount:  "1000000",
					Asset:   "0xUSDC",
					PayTo:   "0xrecipient",
				},
			},
			wantNetwork: "eip155:8453",
		},
		{
			name:    "multiple signers - selects by priority",
			signers: []Signer{solanaSigner, baseSigner}, // base has lower priority number = higher priority
			requirements: []PaymentRequirements{
				{
					Scheme:  "exact",
					Network: "eip155:8453",
					Amount:  "1000000",
					Asset:   "0xUSDC",
					PayTo:   "0xrecipient",
				},
				{
					Scheme:  "exact",
					Network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
					Amount:  "1000000",
					Asset:   "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
					PayTo:   "SolanaRecipient",
				},
			},
			wantNetwork: "eip155:8453", // base has priority 1, solana has priority 2
		},
		{
			name:    "no signers",
			signers: []Signer{},
			requirements: []PaymentRequirements{
				{
					Scheme:  "exact",
					Network: "eip155:8453",
					Amount:  "1000000",
					Asset:   "0xUSDC",
					PayTo:   "0xrecipient",
				},
			},
			wantErr: true,
			errCode: ErrCodeNoValidSigner,
		},
		{
			name:         "no requirements",
			signers:      []Signer{baseSigner},
			requirements: []PaymentRequirements{},
			wantErr:      true,
			errCode:      ErrCodeInvalidRequirements,
		},
		{
			name:    "no matching signer",
			signers: []Signer{baseSigner},
			requirements: []PaymentRequirements{
				{
					Scheme:  "exact",
					Network: "eip155:137", // Different network
					Amount:  "1000000",
					Asset:   "0xOtherUSDC",
					PayTo:   "0xrecipient",
				},
			},
			wantErr: true,
			errCode: ErrCodeNoValidSigner,
		},
		{
			name:    "invalid amount format",
			signers: []Signer{baseSigner},
			requirements: []PaymentRequirements{
				{
					Scheme:  "exact",
					Network: "eip155:8453",
					Amount:  "invalid",
					Asset:   "0xUSDC",
					PayTo:   "0xrecipient",
				},
			},
			wantErr: true,
			errCode: ErrCodeInvalidRequirements,
		},
	}

	selector := NewDefaultPaymentSelector()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payment, err := selector.SelectAndSign(tt.signers, tt.requirements)
			if (err != nil) != tt.wantErr {
				t.Errorf("SelectAndSign() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr {
				var paymentErr *PaymentError
				if errors.As(err, &paymentErr) {
					if paymentErr.Code != tt.errCode {
						t.Errorf("SelectAndSign() error code = %s, want %s", paymentErr.Code, tt.errCode)
					}
				}
				return
			}
			if payment.Accepted.Network != tt.wantNetwork {
				t.Errorf("SelectAndSign() network = %s, want %s", payment.Accepted.Network, tt.wantNetwork)
			}
		})
	}
}

func TestDefaultPaymentSelector_MaxAmountLimit(t *testing.T) {
	maxAmount := big.NewInt(500000) // 0.5 USDC
	signer := &mockSigner{
		network:   "eip155:8453",
		scheme:    "exact",
		tokens:    []TokenConfig{{Address: "0xUSDC", Symbol: "USDC", Decimals: 6, Priority: 1}},
		priority:  1,
		maxAmount: maxAmount,
	}

	selector := NewDefaultPaymentSelector()

	// Request exceeds max amount
	requirements := []PaymentRequirements{
		{
			Scheme:  "exact",
			Network: "eip155:8453",
			Amount:  "1000000", // 1 USDC > 0.5 USDC limit
			Asset:   "0xUSDC",
			PayTo:   "0xrecipient",
		},
	}

	_, err := selector.SelectAndSign([]Signer{signer}, requirements)
	if err == nil {
		t.Error("SelectAndSign() should fail when amount exceeds limit")
	}

	// Request within max amount
	requirements[0].Amount = "400000" // 0.4 USDC < 0.5 USDC limit
	payment, err := selector.SelectAndSign([]Signer{signer}, requirements)
	if err != nil {
		t.Errorf("SelectAndSign() error = %v, want nil", err)
	}
	if payment == nil {
		t.Error("SelectAndSign() returned nil payment")
	}
}

func TestDefaultPaymentSelector_SigningError(t *testing.T) {
	signer := &mockSigner{
		network:  "eip155:8453",
		scheme:   "exact",
		tokens:   []TokenConfig{{Address: "0xUSDC", Symbol: "USDC", Decimals: 6, Priority: 1}},
		priority: 1,
		signErr:  errors.New("signing failed"),
	}

	selector := NewDefaultPaymentSelector()
	requirements := []PaymentRequirements{
		{
			Scheme:  "exact",
			Network: "eip155:8453",
			Amount:  "1000000",
			Asset:   "0xUSDC",
			PayTo:   "0xrecipient",
		},
	}

	_, err := selector.SelectAndSign([]Signer{signer}, requirements)
	if err == nil {
		t.Error("SelectAndSign() should fail when signing fails")
	}

	var paymentErr *PaymentError
	if errors.As(err, &paymentErr) {
		if paymentErr.Code != ErrCodeSigningFailed {
			t.Errorf("error code = %s, want %s", paymentErr.Code, ErrCodeSigningFailed)
		}
	} else {
		t.Error("error should be PaymentError")
	}
}

func TestFindMatchingRequirement(t *testing.T) {
	requirements := []PaymentRequirements{
		{
			Scheme:  "exact",
			Network: "eip155:8453",
			Amount:  "1000000",
			Asset:   "0xUSDC",
			PayTo:   "0xrecipient",
		},
		{
			Scheme:  "exact",
			Network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
			Amount:  "1000000",
			Asset:   "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
			PayTo:   "SolanaRecipient",
		},
	}

	tests := []struct {
		name        string
		payment     *PaymentPayload
		wantNetwork string
		wantErr     bool
	}{
		{
			name: "match EVM",
			payment: &PaymentPayload{
				Accepted: PaymentRequirements{
					Scheme:  "exact",
					Network: "eip155:8453",
				},
			},
			wantNetwork: "eip155:8453",
		},
		{
			name: "match Solana",
			payment: &PaymentPayload{
				Accepted: PaymentRequirements{
					Scheme:  "exact",
					Network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
				},
			},
			wantNetwork: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
		},
		{
			name: "no match - wrong network",
			payment: &PaymentPayload{
				Accepted: PaymentRequirements{
					Scheme:  "exact",
					Network: "eip155:137",
				},
			},
			wantErr: true,
		},
		{
			name: "no match - wrong scheme",
			payment: &PaymentPayload{
				Accepted: PaymentRequirements{
					Scheme:  "streaming",
					Network: "eip155:8453",
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := FindMatchingRequirement(tt.payment, requirements)
			if (err != nil) != tt.wantErr {
				t.Errorf("FindMatchingRequirement() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && req.Network != tt.wantNetwork {
				t.Errorf("FindMatchingRequirement() network = %s, want %s", req.Network, tt.wantNetwork)
			}
		})
	}
}
