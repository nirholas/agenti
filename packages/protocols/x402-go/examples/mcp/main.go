package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	mcpclient "github.com/mark3labs/mcp-go/client"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/x402-go"
	"github.com/mark3labs/x402-go/mcp/client"
	"github.com/mark3labs/x402-go/mcp/server"
	"github.com/mark3labs/x402-go/signers/evm"
	"github.com/mark3labs/x402-go/signers/svm"
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
	fmt.Println("mcp - Example x402 MCP client and server")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  mcp server [flags]  - Run an MCP server with paywalled tools")
	fmt.Println("  mcp client [flags]  - Run client to call paywalled MCP tools")
	fmt.Println()
	fmt.Println("Run 'mcp server --help' or 'mcp client --help' for more information.")
}

func runServer(args []string) {
	fs := flag.NewFlagSet("server", flag.ExitOnError)
	port := fs.String("port", "8080", "Server port")
	network := fs.String("network", "base-sepolia", "Network to accept payments on (base, base-sepolia, solana, solana-devnet, polygon, polygon-amoy, avalanche, avalanche-fuji)")
	payTo := fs.String("pay-to", "", "Address to receive payments (required)")
	tokenAddr := fs.String("token", "", "Token address (auto-detected based on network if not specified)")
	amount := fs.String("amount", "0.01", "Payment amount in USDC")
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

	// Get chain config based on network
	var chainConfig x402.ChainConfig
	switch strings.ToLower(*network) {
	case "solana":
		chainConfig = x402.SolanaMainnet
	case "solana-devnet":
		chainConfig = x402.SolanaDevnet
	case "base":
		chainConfig = x402.BaseMainnet
	case "base-sepolia":
		chainConfig = x402.BaseSepolia
	case "polygon":
		chainConfig = x402.PolygonMainnet
	case "polygon-amoy":
		chainConfig = x402.PolygonAmoy
	case "avalanche":
		chainConfig = x402.AvalancheMainnet
	case "avalanche-fuji":
		chainConfig = x402.AvalancheFuji
	default:
		chainConfig = x402.BaseSepolia // Default to Base Sepolia (safer for testing)
	}

	// Override token address if provided
	if *tokenAddr != "" {
		chainConfig.USDCAddress = *tokenAddr
	}

	fmt.Printf("Starting MCP x402 server on port %s\n", *port)
	fmt.Printf("Network: %s\n", *network)
	fmt.Printf("Payment recipient: %s\n", *payTo)
	fmt.Printf("Payment amount: %s USDC\n", *amount)
	fmt.Printf("Token: %s\n", chainConfig.USDCAddress)
	fmt.Printf("Facilitator: %s\n", *facilitatorURL)
	if *verifyOnly {
		fmt.Printf("Verify-only mode: ENABLED\n")
	}
	if *verbose {
		fmt.Printf("Verbose mode: ENABLED\n")
	}
	fmt.Println()

	// Create payment requirement using helper function
	requirement, err := x402.NewUSDCPaymentRequirement(x402.USDCRequirementConfig{
		Chain:             chainConfig,
		Amount:            *amount,
		RecipientAddress:  *payTo,
		Description:       "Premium search - " + *amount + " USDC",
		MaxTimeoutSeconds: 60,
	})
	if err != nil {
		log.Fatalf("Failed to create payment requirement: %v", err)
	}

	// Create x402 MCP server
	config := &server.Config{
		FacilitatorURL: *facilitatorURL,
		VerifyOnly:     *verifyOnly,
		Verbose:        *verbose,
	}

	srv := server.NewX402Server("x402-mcp-example", "1.0.0", config)

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
		mcp.WithDescription("Echo back the input message"),
		mcp.WithString("message", mcp.Required(), mcp.Description("Message to echo")),
	)
	srv.AddTool(echoTool, echoHandler)

	// Add paid tool: search
	searchTool := mcp.NewTool(
		"search",
		mcp.WithDescription("Premium search service"),
		mcp.WithString("query", mcp.Required(), mcp.Description("Search query")),
		mcp.WithNumber("max_results", mcp.Description("Maximum number of results")),
	)
	err = srv.AddPayableTool(
		searchTool,
		searchHandler,
		enrichedRequirement,
	)
	if err != nil {
		log.Fatalf("Failed to add payable tool: %v", err)
	}

	// Start server
	addr := ":" + *port
	fmt.Println("Server tools:")
	fmt.Printf("  echo   - Free tool that echoes messages\n")
	fmt.Printf("  search - Paywalled tool (requires %s USDC payment)\n", *amount)
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
			mcp.NewTextContent(fmt.Sprintf("Echo: %s", message)),
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
	results := fmt.Sprintf("Premium search results for '%s' (max %d results):\n", query, maxResults)
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
	network := fs.String("network", "base-sepolia", "Network to use (base, base-sepolia, solana, solana-devnet, polygon, polygon-amoy, avalanche, avalanche-fuji)")
	key := fs.String("key", "", "Private key (hex for EVM, base58 for Solana)")
	keyFile := fs.String("key-file", "", "Solana keygen JSON file (alternative to --key for Solana)")
	serverURL := fs.String("server", "http://localhost:8080", "MCP server URL")
	tokenAddr := fs.String("token", "", "Token address (auto-detected based on network if not specified)")
	maxAmount := fs.String("max-amount", "", "Maximum amount per call (optional)")
	verbose := fs.Bool("verbose", false, "Enable verbose debug output")

	_ = fs.Parse(args)

	// Validate inputs
	if *key == "" && *keyFile == "" {
		fmt.Println("Error: --key or --key-file is required")
		fmt.Println()
		fs.PrintDefaults()
		os.Exit(1)
	}

	// Get chain config based on network
	var chainConfig x402.ChainConfig
	switch strings.ToLower(*network) {
	case "solana":
		chainConfig = x402.SolanaMainnet
	case "solana-devnet":
		chainConfig = x402.SolanaDevnet
	case "base":
		chainConfig = x402.BaseMainnet
	case "base-sepolia":
		chainConfig = x402.BaseSepolia
	case "polygon":
		chainConfig = x402.PolygonMainnet
	case "polygon-amoy":
		chainConfig = x402.PolygonAmoy
	case "avalanche":
		chainConfig = x402.AvalancheMainnet
	case "avalanche-fuji":
		chainConfig = x402.AvalancheFuji
	default:
		chainConfig = x402.BaseSepolia // Default to Base Sepolia (safer for testing)
	}

	// Override token address if provided
	if *tokenAddr != "" {
		chainConfig.USDCAddress = *tokenAddr
	}

	var signer x402.Signer
	var signerAddress string
	var err error

	// Create appropriate signer based on network
	if strings.HasPrefix(strings.ToLower(*network), "solana") {
		// Create Solana signer
		var svmOpts []svm.SignerOption

		if *keyFile != "" {
			svmOpts = append(svmOpts, svm.WithKeygenFile(*keyFile))
		} else {
			svmOpts = append(svmOpts, svm.WithPrivateKey(*key))
		}

		svmOpts = append(svmOpts,
			svm.WithNetwork(*network),
			svm.WithToken(chainConfig.USDCAddress, "USDC", 6),
		)

		if *maxAmount != "" {
			svmOpts = append(svmOpts, svm.WithMaxAmountPerCall(*maxAmount))
		}

		svmSigner, err := svm.NewSigner(svmOpts...)
		if err != nil {
			log.Fatalf("Failed to create Solana signer: %v", err)
		}

		signer = svmSigner
		signerAddress = svmSigner.Address()
		fmt.Printf("Created Solana signer for address: %s\n", signerAddress)
	} else {
		// Create EVM signer
		signerOpts := []evm.SignerOption{
			evm.WithPrivateKey(*key),
			evm.WithNetwork(chainConfig.NetworkID),
			evm.WithToken(chainConfig.USDCAddress, "USDC", 6),
		}

		if *maxAmount != "" {
			signerOpts = append(signerOpts, evm.WithMaxAmountPerCall(*maxAmount))
		}

		evmSigner, err := evm.NewSigner(signerOpts...)
		if err != nil {
			log.Fatalf("Failed to create EVM signer: %v", err)
		}

		signer = evmSigner
		signerAddress = evmSigner.Address().Hex()
		fmt.Printf("Created EVM signer for address: %s\n", signerAddress)
	}

	fmt.Printf("Network: %s\n", *network)
	fmt.Printf("Token: %s\n", chainConfig.USDCAddress)
	fmt.Printf("\nConnecting to MCP server at %s\n", *serverURL)

	// Create x402 transport
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
				Name:    "x402-example-client",
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
				"message": "Hello from x402 MCP client!",
			},
		},
	})
	if err != nil {
		log.Fatalf("Echo call failed: %v", err)
	}
	log.Printf("Echo result: %v", echoResult.Content[0])

	// Call paid tool (search) - payment handled automatically
	log.Println("\n=== Calling paid tool: search (requires payment) ===")
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
		fmt.Printf("Network: %s\n", *network)
		fmt.Println("==============================")
	}
}

func paymentLogger(event x402.PaymentEvent) {
	switch event.Type {
	case x402.PaymentEventAttempt:
		log.Printf("[PAYMENT] Attempting payment for tool: %s",
			event.Tool)
	case x402.PaymentEventSuccess:
		log.Printf("[PAYMENT] Payment successful on %s", event.Network)
		if event.Transaction != "" {
			log.Printf("[PAYMENT] Transaction: %s", event.Transaction)
		}
	case x402.PaymentEventFailure:
		log.Printf("[PAYMENT] Payment failed: %v", event.Error)
	}
}

// enrichRequirement enriches a payment requirement with facilitator-specific data (like feePayer for Solana)
func enrichRequirement(req x402.PaymentRequirement, facilitatorURL string) (x402.PaymentRequirement, error) {
	// Create facilitator client
	client := &http.Client{Timeout: 10 * time.Second}

	// Fetch supported payment types from facilitator
	resp, err := client.Get(facilitatorURL + "/supported")
	if err != nil {
		return req, fmt.Errorf("failed to fetch supported types: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return req, fmt.Errorf("facilitator returned status %d", resp.StatusCode)
	}

	// Parse response
	var supported struct {
		Kinds []struct {
			Network string                 `json:"network"`
			Scheme  string                 `json:"scheme"`
			Extra   map[string]interface{} `json:"extra"`
		} `json:"kinds"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&supported); err != nil {
		return req, fmt.Errorf("failed to decode response: %w", err)
	}

	// Find matching network+scheme
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
