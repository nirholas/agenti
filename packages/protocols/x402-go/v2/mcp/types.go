// Package mcp provides x402 v2 payment integration for MCP (Model Context Protocol).
package mcp

import (
	v2 "github.com/mark3labs/x402-go/v2"
)

// PaymentRequirements represents the data structure returned in a 402 error response in MCP.
// This is MCP-specific and wraps the standard x402 v2 payment requirements with v2 structure.
//
// Unlike v1, v2 includes:
// - Resource object (URL, description, mimeType) at the root level
// - CAIP-2 network identifiers in each accept option
// - Extensions support for protocol extensibility
type PaymentRequirements struct {
	// X402Version is the protocol version (always 2 for v2).
	X402Version int `json:"x402Version"`

	// Error is a human-readable error message.
	Error string `json:"error"`

	// Resource describes the protected resource.
	Resource v2.ResourceInfo `json:"resource"`

	// Accepts is an array of payment options the server will accept.
	Accepts []v2.PaymentRequirements `json:"accepts"`

	// Extensions contains protocol extensions (passthrough, not validated).
	Extensions map[string]v2.Extension `json:"extensions,omitempty"`
}
