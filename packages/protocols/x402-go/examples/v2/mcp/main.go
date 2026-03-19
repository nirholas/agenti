package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	mcpclient "github.com/mark3labs/mcp-go/client"
	"github.com/mark3labs/mcp-go/mcp"
	v2 "github.com/mark3labs/x402-go/v2"
	"github.com/mark3labs/x402-go/v2/mcp/client"
	"github.com/mark3labs/x402-go/v2/mcp/server"
	"github.com/mark3labs/x402-go/v2/signers/evm"
	"github.com/mark3labs/x402-go/v2/signers/svm"
)

func main() {
	// Subcommand handling
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "server":
		runServer(os.Args[2:])
	case "client":
		runClient(os.Args[2:])
	default:
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("mcp-v2 - Example x402 v2 MCP client and server")
	fmt.Println()
	fmt.Println("This example demonstrates the x402 v2 protocol with MCP (Model Context Protocol)")
	fmt.Println("and CAIP-2 network identifiers.")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  mcp-v2 server [flags]  - Run an MCP server with paywalled tools")
	fmt.Println("  mcp-v2 client [flags]  - Run client to call paywalled MCP tools")
	fmt.Println()
	fmt.Println("Run 'mcp-v2 server --help' or 'mcp-v2 client --help' for more information.")
}

func runServer(args []string) {
	fs := flag.NewFlagSet("server", flag.ExitOnError)
	port := fs.String("port", "8080", "Server port")
	network := fs.String("network", "eip155:84532", "Network to accept payments on (CAIP-2 format, e.g., eip155:8453, eip155:84532)")
	payTo := fs.String("pay-to", "", "Address to receive payments (required)")
	tokenAddr := fs.String("token", "", "Token address (auto-detected based on network if not specified)")
	amount := fs.String("amount", "10000", "Payment amount in atomic units (default: 10000 = 0.01 USDC)")
	facilitatorURL := fs.String("facilitator", "https://facilitator.x402.rs", "Facilitator URL")
	verifyOnly := fs.Bool("verify-only", false, "Verify only, don't settle payments")
	verbose := fs.Bool("verbose", false, "Enable verbose debug output")

	_ = fs.Parse(args)

	// Validate required flags
	if *payTo == "" {
		fmt.Println("Error: --pay-to is required")
		fmt.Println()
		fs.PrintDefaults()
		os.Exit(1)
	}

	// Get chain config based on CAIP-2 network identifier
	chainConfig, err := v2.GetChainConfig(*network)
	if err != nil {
		fmt.Printf("Warning: Unknown network %s, using provided token address\n", *network)
		if *tokenAddr == "" {
			fmt.Println("Error: --token is required for unknown networks")
			os.Exit(1)
		}
		chainConfig = v2.ChainConfig{
			Network:     *network,
			USDCAddress: *tokenAddr,
			Decimals:    6,
		}
	}

	// Override token address if provided
	if *tokenAddr != "" {
		chainConfig.USDCAddress = *tokenAddr
	}

	fmt.Printf("Starting MCP x402 v2 server on port %s\n", *port)
	fmt.Printf("Network: %s (CAIP-2)\n", *network)
	fmt.Printf("Payment recipient: %s\n", *payTo)
	fmt.Printf("Payment amount: %s atomic units\n", *amount)
	fmt.Printf("Token: %s\n", chainConfig.USDCAddress)
	fmt.Printf("Facilitator: %s\n", *facilitatorURL)
	if *verifyOnly {
		fmt.Printf("Verify-only mode: ENABLED\n")
	}
	if *verbose {
		fmt.Printf("Verbose mode: ENABLED\n")
	}
	fmt.Println()

	// Create payment requirement for v2
	requirement := v2.PaymentRequirements{
		Scheme:            "exact",
		Network:           *network,
		Amount:            *amount,
		Asset:             chainConfig.USDCAddress,
		PayTo:             *payTo,
		MaxTimeoutSeconds: 60,
		Extra: map[string]interface{}{
			"name":    chainConfig.EIP3009Name,
			"version": chainConfig.EIP3009Version,
		},
	}

	// Create x402 v2 MCP server config
	config := &server.Config{
		FacilitatorURL: *facilitatorURL,
		VerifyOnly:     *verifyOnly,
		Verbose:        *verbose,
	}

	srv := server.NewX402Server("x402-mcp-v2-example", "1.0.0", config)

	// Enrich payment requirements with facilitator-specific data (like feePayer for Solana)
	enrichedRequirement, err := enrichRequirement(requirement, *facilitatorURL)
	if err != nil {
		log.Printf("Warning: failed to enrich payment requirement: %v", err)
		log.Printf("Continuing with original requirement (may fail for Solana networks)")
		enrichedRequirement = requirement
	} else if *verbose {
		fmt.Printf("Payment requirement enriched from facilitator\n")
	}

	// Add free tool: echo
	echoTool := mcp.NewTool(
		"echo",
		mcp.WithDescription("Echo back the input message (free)"),
		mcp.WithString("message", mcp.Required(), mcp.Description("Message to echo")),
	)
	srv.AddTool(echoTool, echoHandler)

	// Add paid tool: search
	searchTool := mcp.NewTool(
		"search",
		mcp.WithDescription("Premium search service (requires x402 v2 payment)"),
		mcp.WithString("query", mcp.Required(), mcp.Description("Search query")),
		mcp.WithNumber("max_results", mcp.Description("Maximum number of results")),
	)

	// Add as payable tool with resource info
	err = srv.AddPayableTool(
		searchTool,
		v2.ResourceInfo{
			Description: "Premium search service - " + *amount + " atomic units",
			MimeType:    "application/json",
		},
		[]v2.PaymentRequirements{enrichedRequirement},
		searchHandler,
	)
	if err != nil {
		log.Fatalf("Failed to add payable tool: %v", err)
	}

	// Start server
	addr := ":" + *port
	fmt.Println("Server tools:")
	fmt.Printf("  echo   - Free tool that echoes messages\n")
	fmt.Printf("  search - Paywalled tool (requires %s atomic units payment)\n", *amount)
	fmt.Println()
	fmt.Printf("Protocol: x402 version 2 with CAIP-2 network identifiers\n")
	fmt.Println()
	fmt.Println("Server is ready!")

	// Handle graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		<-sigChan
		log.Println("Shutting down server...")
		os.Exit(0)
	}()

	if err := srv.Start(addr); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

func echoHandler(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	args := req.GetArguments()
	message, _ := args["message"].(string)
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			mcp.NewTextContent(fmt.Sprintf("Echo (x402 v2): %s", message)),
		},
	}, nil
}

func searchHandler(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	args := req.GetArguments()
	query, _ := args["query"].(string)
	maxResults := 5
	if mr, ok := args["max_results"].(float64); ok {
		maxResults = int(mr)
	}

	// Simulate search results
	results := fmt.Sprintf("Premium search results (x402 v2) for '%s' (max %d results):\n", query, maxResults)
	results += fmt.Sprintf("1. Result about %s\n", query)
	results += fmt.Sprintf("2. Another result for %s\n", query)
	results += fmt.Sprintf("3. More information on %s\n", query)

	return &mcp.CallToolResult{
		Content: []mcp.Content{
			mcp.NewTextContent(results),
		},
	}, nil
}

func runClient(args []string) {
	fs := flag.NewFlagSet("client", flag.ExitOnError)
	network := fs.String("network", "eip155:84532", "Network to use (CAIP-2 format, e.g., eip155:8453, eip155:84532)")
	key := fs.String("key", "", "Private key (hex for EVM, base58 for Solana)")
	keyFile := fs.String("key-file", "", "Solana keygen JSON file (alternative to --key for Solana)")
	serverURL := fs.String("server", "http://localhost:8080", "MCP server URL")
	tokenAddr := fs.String("token", "", "Token address (auto-detected based on network if not specified)")
	maxAmount := fs.String("max-amount", "", "Maximum amount per call in atomic units (optional)")
	verbose := fs.Bool("verbose", false, "Enable verbose debug output")

	_ = fs.Parse(args)

	// Validate inputs
	if *key == "" && *keyFile == "" {
		fmt.Println("Error: --key or --key-file is required")
		fmt.Println()
		fs.PrintDefaults()
		os.Exit(1)
	}

	// Get chain config for the network
	chainConfig, err := v2.GetChainConfig(*network)
	if err != nil {
		fmt.Printf("Warning: Unknown network %s\n", *network)
		if *tokenAddr == "" {
			fmt.Println("Error: --token is required for unknown networks")
			os.Exit(1)
		}
		chainConfig = v2.ChainConfig{
			Network:     *network,
			USDCAddress: *tokenAddr,
			Decimals:    6,
		}
	}

	// Override token address if provided
	if *tokenAddr != "" {
		chainConfig.USDCAddress = *tokenAddr
	}

	var signer v2.Signer
	var signerAddress string

	// Determine network type from CAIP-2 identifier
	networkType, err := v2.ValidateNetwork(*network)
	if err != nil {
		log.Fatalf("Invalid network: %v", err)
	}

	// Create appropriate signer based on network type
	if networkType == v2.NetworkTypeSVM {
		// Create Solana signer
		tokens := []v2.TokenConfig{{
			Address:  chainConfig.USDCAddress,
			Symbol:   "USDC",
			Decimals: 6,
		}}

		var svmSigner *svm.Signer
		var svmErr error

		if *keyFile != "" {
			svmSigner, svmErr = svm.NewSignerFromKeygenFile(*network, *keyFile, tokens)
		} else {
			svmSigner, svmErr = svm.NewSigner(*network, *key, tokens)
		}
		if svmErr != nil {
			log.Fatalf("Failed to create Solana signer: %v", svmErr)
		}

		signer = svmSigner
		signerAddress = svmSigner.Address().String()
		fmt.Printf("Created Solana signer for address: %s\n", signerAddress)
	} else {
		// Create EVM signer
		tokens := []v2.TokenConfig{{
			Address:  chainConfig.USDCAddress,
			Symbol:   "USDC",
			Decimals: 6,
		}}

		var evmOpts []evm.Option
		if *maxAmount != "" {
			maxAmountBig, ok := new(big.Int).SetString(*maxAmount, 10)
			if !ok {
				log.Fatalf("Invalid max amount: %s", *maxAmount)
			}
			evmOpts = append(evmOpts, evm.WithMaxAmount(maxAmountBig))
		}

		evmSigner, evmErr := evm.NewSigner(*network, *key, tokens, evmOpts...)
		if evmErr != nil {
			log.Fatalf("Failed to create EVM signer: %v", evmErr)
		}

		signer = evmSigner
		signerAddress = evmSigner.Address().Hex()
		fmt.Printf("Created EVM signer for address: %s\n", signerAddress)
	}

	fmt.Printf("Network: %s (CAIP-2)\n", *network)
	fmt.Printf("Token: %s\n", chainConfig.USDCAddress)
	fmt.Printf("Protocol: x402 v2\n")
	fmt.Printf("\nConnecting to MCP server at %s\n", *serverURL)

	// Create x402 v2 transport
	transport, err := client.NewTransport(
		*serverURL,
		client.WithSigner(signer),
		client.WithPaymentCallback(paymentLogger),
	)
	if err != nil {
		log.Fatalf("Failed to create transport: %v", err)
	}

	// Create MCP client
	mcpClient := mcpclient.NewClient(transport)

	ctx := context.Background()

	// Start connection
	if err := mcpClient.Start(ctx); err != nil {
		log.Fatalf("Failed to start client: %v", err)
	}
	defer mcpClient.Close()

	log.Printf("Connected to MCP server at %s", *serverURL)

	// Initialize session
	initResp, err := mcpClient.Initialize(ctx, mcp.InitializeRequest{
		Params: mcp.InitializeParams{
			ProtocolVersion: "2024-11-05",
			ClientInfo: mcp.Implementation{
				Name:    "x402-v2-example-client",
				Version: "1.0.0",
			},
			Capabilities: mcp.ClientCapabilities{},
		},
	})
	if err != nil {
		log.Fatalf("Failed to initialize: %v", err)
	}

	log.Printf("Session initialized: %s v%s", initResp.ServerInfo.Name, initResp.ServerInfo.Version)

	// List available tools
	toolsResp, err := mcpClient.ListTools(ctx, mcp.ListToolsRequest{})
	if err != nil {
		log.Fatalf("Failed to list tools: %v", err)
	}

	log.Printf("\nAvailable tools:")
	for _, tool := range toolsResp.Tools {
		log.Printf("  - %s: %s", tool.Name, tool.Description)
	}

	// Call free tool (echo)
	log.Println("\n=== Calling free tool: echo ===")
	echoResult, err := mcpClient.CallTool(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Name: "echo",
			Arguments: map[string]interface{}{
				"message": "Hello from x402 v2 MCP client!",
			},
		},
	})
	if err != nil {
		log.Fatalf("Echo call failed: %v", err)
	}
	log.Printf("Echo result: %v", echoResult.Content[0])

	// Call paid tool (search) - payment handled automatically
	log.Println("\n=== Calling paid tool: search (requires x402 v2 payment) ===")
	searchResult, err := mcpClient.CallTool(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Name: "search",
			Arguments: map[string]interface{}{
				"query":       "blockchain",
				"max_results": 3,
			},
		},
	})
	if err != nil {
		log.Fatalf("Search call failed: %v", err)
	}
	log.Printf("Search result: %v", searchResult.Content[0])

	log.Println("\n=== Example completed successfully ===")

	if *verbose {
		fmt.Println("\n=== DEBUG: Session Details ===")
		fmt.Printf("Server: %s\n", *serverURL)
		fmt.Printf("Signer: %s\n", signerAddress)
		fmt.Printf("Network: %s (CAIP-2)\n", *network)
		fmt.Printf("Protocol: x402 v2\n")
		fmt.Println("==============================")
	}
}

func paymentLogger(event v2.PaymentEvent) {
	switch event.Type {
	case v2.PaymentEventAttempt:
		log.Printf("[PAYMENT v2] Attempting payment for tool: %s (network: %s)",
			event.Tool, event.Network)
	case v2.PaymentEventSuccess:
		log.Printf("[PAYMENT v2] Payment successful on %s", event.Network)
		if event.Transaction != "" {
			log.Printf("[PAYMENT v2] Transaction: %s", event.Transaction)
		}
	case v2.PaymentEventFailure:
		log.Printf("[PAYMENT v2] Payment failed: %v", event.Error)
	}
}

// enrichRequirement enriches a payment requirement with facilitator-specific data (like feePayer for Solana)
func enrichRequirement(req v2.PaymentRequirements, facilitatorURL string) (v2.PaymentRequirements, error) {
	// Create facilitator client
	httpClient := &http.Client{Timeout: 10 * time.Second}

	// Fetch supported payment types from facilitator
	resp, err := httpClient.Get(facilitatorURL + "/supported")
	if err != nil {
		return req, fmt.Errorf("failed to fetch supported types: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return req, fmt.Errorf("facilitator returned status %d", resp.StatusCode)
	}

	// Parse response (v2 SupportedResponse)
	var supported v2.SupportedResponse

	if err := json.NewDecoder(resp.Body).Decode(&supported); err != nil {
		return req, fmt.Errorf("failed to decode response: %w", err)
	}

	// Find matching network+scheme from the supported kinds
	for _, kind := range supported.Kinds {
		if kind.Network == req.Network && kind.Scheme == req.Scheme {
			// Merge extra fields
			if len(kind.Extra) > 0 {
				if req.Extra == nil {
					req.Extra = make(map[string]interface{})
				}
				for k, v := range kind.Extra {
					req.Extra[k] = v
				}
			}
			break
		}
	}

	return req, nil
}
