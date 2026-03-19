package server

import (
	"fmt"
	"net/http"

	mcpproto "github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
	v2 "github.com/mark3labs/x402-go/v2"
)

// X402Server wraps an MCP server and adds x402 v2 payment protection.
type X402Server struct {
	mcpServer *mcpserver.MCPServer
	config    *Config
}

// NewX402Server creates a new MCP server with x402 v2 payment support.
func NewX402Server(name, version string, config *Config) *X402Server {
	if config == nil {
		config = DefaultConfig()
	}

	// Initialize PaymentTools map if nil
	if config.PaymentTools == nil {
		config.PaymentTools = make(map[string]ToolPaymentConfig)
	}

	// Create base MCP server
	mcpServer := mcpserver.NewMCPServer(name, version)

	return &X402Server{
		mcpServer: mcpServer,
		config:    config,
	}
}

// AddTool adds a free tool (no payment required).
func (s *X402Server) AddTool(tool mcpproto.Tool, handler mcpserver.ToolHandlerFunc) {
	// Add tool to MCP server without payment requirements
	s.mcpServer.AddTool(tool, handler)
}

// AddPayableTool adds a paid tool with payment requirements.
// The resource and requirements specify what payment options the server will accept.
func (s *X402Server) AddPayableTool(tool mcpproto.Tool, resource v2.ResourceInfo, requirements []v2.PaymentRequirements, handler mcpserver.ToolHandlerFunc) error {
	if len(requirements) == 0 {
		return fmt.Errorf("at least one payment requirement must be provided for payable tool %s", tool.Name)
	}

	// Validate each requirement
	for i, req := range requirements {
		if err := ValidateRequirement(req); err != nil {
			return fmt.Errorf("invalid requirement %d for tool %s: %w", i, tool.Name, err)
		}
	}

	// Set resource URL if not specified
	if resource.URL == "" {
		resource = SetToolResource(tool.Name)
	}

	// Add payment configuration to config
	s.config.PaymentTools[tool.Name] = ToolPaymentConfig{
		Resource:     resource,
		Requirements: requirements,
	}

	// Add tool to MCP server
	s.mcpServer.AddTool(tool, handler)
	return nil
}

// Handler returns an HTTP handler wrapped with x402 v2 payment middleware.
// Returns an error if the handler cannot be created (e.g., invalid configuration).
func (s *X402Server) Handler() (http.Handler, error) {
	// Get the base MCP HTTP handler
	httpServer := mcpserver.NewStreamableHTTPServer(s.mcpServer)

	// Wrap with x402 payment handler
	return NewX402Handler(httpServer, s.config)
}

// Start starts the MCP server on the given address.
func (s *X402Server) Start(addr string) error {
	handler, err := s.Handler()
	if err != nil {
		return fmt.Errorf("failed to create handler: %w", err)
	}
	if s.config.Verbose {
		fmt.Printf("Starting x402 v2 MCP server on %s\n", addr)
		fmt.Printf("Facilitator URL: %s\n", s.config.FacilitatorURL)
		fmt.Printf("Verify-only mode: %v\n", s.config.VerifyOnly)
		fmt.Printf("Protected tools: %d\n", len(s.config.PaymentTools))
	}
	return http.ListenAndServe(addr, handler)
}

// GetMCPServer returns the underlying MCP server (for advanced usage).
func (s *X402Server) GetMCPServer() *mcpserver.MCPServer {
	return s.mcpServer
}
