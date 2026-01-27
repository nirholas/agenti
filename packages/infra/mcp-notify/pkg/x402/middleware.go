// Package x402 provides payment gating middleware for MCP servers
// using the x402 payment protocol.
package x402

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
)

// Config holds x402 payment configuration
type Config struct {
	Price       string `json:"price"`
	Token       string `json:"token"`
	Chain       string `json:"chain"`
	Recipient   string `json:"recipient"`
	Description string `json:"description,omitempty"`
	FreeTier    struct {
		Calls  int `json:"calls"`
		Period int `json:"period"` // seconds
	} `json:"freeTier"`
}

// PaymentProof represents a verified payment
type PaymentProof struct {
	Signature string  `json:"signature"`
	Timestamp int64   `json:"timestamp"`
	Amount    string  `json:"amount"`
	Token     string  `json:"token"`
	Payer     string  `json:"payer"`
}

// PaymentRequired represents a 402 response
type PaymentRequired struct {
	Error struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		X402    struct {
			Version     string   `json:"version"`
			Price       string   `json:"price"`
			Token       string   `json:"token"`
			Chain       string   `json:"chain"`
			Recipient   string   `json:"recipient"`
			Description string   `json:"description,omitempty"`
			Accepts     []string `json:"accepts"`
		} `json:"x402"`
	} `json:"error"`
}

// Middleware handles x402 payment verification
type Middleware struct {
	config     Config
	usageCache map[string]*usage
	mu         sync.RWMutex
}

type usage struct {
	count       int
	periodStart time.Time
}

// DefaultConfig returns default x402 configuration
func DefaultConfig() Config {
	recipient := os.Getenv("X402_RECIPIENT")
	if recipient == "" {
		recipient = "0x1234567890123456789012345678901234567890"
	}
	
	return Config{
		Price:     "0.001",
		Token:     "USDC",
		Chain:     "base",
		Recipient: recipient,
		FreeTier: struct {
			Calls  int `json:"calls"`
			Period int `json:"period"`
		}{
			Calls:  10,
			Period: 3600,
		},
	}
}

// New creates a new x402 middleware
func New(config Config) *Middleware {
	return &Middleware{
		config:     config,
		usageCache: make(map[string]*usage),
	}
}

// CheckFreeTier checks if client is within free tier limits
func (m *Middleware) CheckFreeTier(clientID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	now := time.Now()
	u, exists := m.usageCache[clientID]
	
	if !exists || now.Sub(u.periodStart).Seconds() > float64(m.config.FreeTier.Period) {
		m.usageCache[clientID] = &usage{
			count:       1,
			periodStart: now,
		}
		return true
	}
	
	if u.count < m.config.FreeTier.Calls {
		u.count++
		return true
	}
	
	return false
}

// VerifyPayment verifies a payment proof
func (m *Middleware) VerifyPayment(proof *PaymentProof) bool {
	if proof == nil {
		return false
	}
	
	// Check timestamp (within 5 minutes)
	now := time.Now().Unix()
	if abs(now-proof.Timestamp) > 300 {
		return false
	}
	
	// Check token
	if proof.Token != m.config.Token {
		return false
	}
	
	// In production, verify cryptographic signature
	return true
}

// CreatePaymentRequired creates a 402 response
func (m *Middleware) CreatePaymentRequired() PaymentRequired {
	var resp PaymentRequired
	resp.Error.Code = 402
	resp.Error.Message = "Payment Required"
	resp.Error.X402.Version = "1.0"
	resp.Error.X402.Price = m.config.Price
	resp.Error.X402.Token = m.config.Token
	resp.Error.X402.Chain = m.config.Chain
	resp.Error.X402.Recipient = m.config.Recipient
	resp.Error.X402.Description = m.config.Description
	resp.Error.X402.Accepts = []string{"x402-payment"}
	return resp
}

// PricingInfo returns a pricing description string
func (m *Middleware) PricingInfo() string {
	return fmt.Sprintf("💰 %s %s per call (%s)", m.config.Price, m.config.Token, m.config.Chain)
}

// ToJSON converts config to JSON
func (c Config) ToJSON() ([]byte, error) {
	return json.Marshal(c)
}

func abs(n int64) int64 {
	if n < 0 {
		return -n
	}
	return n
}
