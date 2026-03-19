package mcp

import (
	"github.com/mark3labs/x402-go"
)

// PaymentRequirements represents the data structure returned in a 402 error response in MCP.
// This is MCP-specific and wraps the standard x402 payment requirements.
type PaymentRequirements struct {
	X402Version int                       `json:"x402Version"`
	Error       string                    `json:"error"`
	Accepts     []x402.PaymentRequirement `json:"accepts"`
}
