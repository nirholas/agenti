package server

import (
	"fmt"

	"github.com/mark3labs/x402-go"
	"github.com/mark3labs/x402-go/validation"
)

// ValidateRequirement validates a complete payment requirement.
// This function delegates to the shared validation package but enforces
// MCP-specific restrictions (e.g., only 'exact' scheme is supported).
func ValidateRequirement(req x402.PaymentRequirement) error {
	// Use shared validation for most fields
	if err := validation.ValidatePaymentRequirement(req); err != nil {
		return err
	}

	// MCP-specific validation: only 'exact' scheme is supported
	if req.Scheme != "exact" {
		return fmt.Errorf("invalid requirement: unsupported scheme %s (only 'exact' is supported in MCP)", req.Scheme)
	}

	return nil
}

// SetToolResource sets the resource field for a payment requirement based on tool name
func SetToolResource(req *x402.PaymentRequirement, toolName string) {
	if req != nil && toolName != "" {
		req.Resource = fmt.Sprintf("mcp://tools/%s", toolName)
	}
}
