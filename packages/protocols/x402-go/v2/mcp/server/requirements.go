package server

import (
	"fmt"

	v2 "github.com/mark3labs/x402-go/v2"
	"github.com/mark3labs/x402-go/v2/validation"
)

// ValidateRequirement validates a complete payment requirement.
// This function delegates to the shared validation package but enforces
// MCP-specific restrictions (e.g., only 'exact' scheme is supported).
func ValidateRequirement(req v2.PaymentRequirements) error {
	// Use shared validation for most fields
	if err := validation.ValidatePaymentRequirements(req); err != nil {
		return err
	}

	// MCP-specific validation: only 'exact' scheme is supported
	if req.Scheme != "exact" {
		return fmt.Errorf("invalid requirement: unsupported scheme %s (only 'exact' is supported in MCP)", req.Scheme)
	}

	return nil
}

// SetToolResource sets the resource URL based on the tool name.
// Returns a ResourceInfo with the standard MCP tool URL format.
func SetToolResource(toolName string) v2.ResourceInfo {
	return v2.ResourceInfo{
		URL: fmt.Sprintf("mcp://tools/%s", toolName),
	}
}
