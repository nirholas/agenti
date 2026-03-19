package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// X402Server wraps an MCP server with x402 payment support
type X402Server struct {
	mcpServer *server.MCPServer
	config    *Config
}

// NewX402Server creates a new x402-enabled MCP server
func NewX402Server(name, version string, config *Config) *X402Server {
	// Create base MCP server
	mcpServer := server.NewMCPServer(name, version)

	srv := &X402Server{
		mcpServer: mcpServer,
		config:    config,
	}

	// Fetch supported payment methods from facilitator on init
	if config.FacilitatorURL != "" {
		srv.fetchSupportedPayments()
	}

	return srv
}

// fetchSupportedPayments fetches and caches supported payment methods from the facilitator
func (s *X402Server) fetchSupportedPayments() {
	facilitator := NewHTTPFacilitator(s.config.FacilitatorURL)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	supported, err := facilitator.GetSupported(ctx)
	if err != nil {
		log.Printf("Warning: failed to fetch supported payments from facilitator: %v", err)
		log.Printf("  Solana payments may not work correctly without feePayer information")
		return
	}

	// Cache supported payment info (including feePayer for Solana networks)
	SetSupportedPayments(supported)

	if s.config.Verbose {
		log.Printf("Fetched supported payment methods from facilitator:")
		for _, kind := range supported {
			log.Printf("  - %s on %s", kind.Scheme, kind.Network)
		}
	}
}

// AddTool adds a regular (non-paid) tool to the server
func (s *X402Server) AddTool(tool mcp.Tool, handler server.ToolHandlerFunc) {
	s.mcpServer.AddTool(tool, handler)
}

// AddPayableTool adds a tool that requires payment with one or more payment options
// If no requirements are provided, the tool is added as a regular non-paid tool and an error is logged
func (s *X402Server) AddPayableTool(
	tool mcp.Tool,
	handler server.ToolHandlerFunc,
	requirements ...PaymentRequirement,
) {
	// Validate we have at least one requirement
	if len(requirements) == 0 {
		// Log error and add as regular tool instead of panicking
		log.Printf("ERROR: AddPayableTool called for tool %s without payment requirements. Adding as regular tool instead.", tool.Name)
		s.mcpServer.AddTool(tool, handler)
		return
	}

	// Add tool to MCP server
	s.mcpServer.AddTool(tool, handler)

	// Register payment requirements
	if s.config.PaymentTools == nil {
		s.config.PaymentTools = make(map[string][]PaymentRequirement)
	}
	s.config.PaymentTools[tool.Name] = requirements
}

// Handler returns the http.Handler for the x402 server
func (s *X402Server) Handler() http.Handler {
	// Wrap MCP HTTP server with x402 payment handler
	httpServer := server.NewStreamableHTTPServer(s.mcpServer)
	return NewX402Handler(httpServer, s.config)
}

// Start starts the x402 server on the specified address
func (s *X402Server) Start(addr string) error {
	fmt.Printf("Starting X402 MCP Server on %s\n", addr)
	fmt.Printf("MCP endpoint: http://localhost%s\n", addr)

	return http.ListenAndServe(addr, s.Handler())
}
