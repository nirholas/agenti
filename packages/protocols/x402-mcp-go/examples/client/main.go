package main

import (
	"context"
	"flag"
	"log"
	"os"

	x402 "github.com/mark3labs/mcp-go-x402"
	"github.com/mark3labs/mcp-go/client"
	"github.com/mark3labs/mcp-go/mcp"
)

func main() {
	// Define command-line flags
	var (
		privateKeyFlag = flag.String("key", "", "Private key hex (or set WALLET_PRIVATE_KEY env var)")
		serverURL      = flag.String("server", "http://localhost:8080", "MCP server URL")
		network        = flag.String("network", "testnet", "Network to use: testnet or mainnet")
		verbose        = flag.Bool("v", false, "Verbose output")
	)
	flag.Parse()

	// Get private key from flag or environment
	privateKey := *privateKeyFlag
	if privateKey == "" {
		privateKey = os.Getenv("WALLET_PRIVATE_KEY")
		if privateKey == "" {
			log.Fatal("Private key required: use -key flag or set WALLET_PRIVATE_KEY environment variable")
		}
	}

	// Create signer with explicit payment options based on network
	var signer x402.PaymentSigner
	var err error

	if *network == "mainnet" {
		log.Println("Configuring for mainnet...")
		signer, err = x402.NewPrivateKeySigner(
			privateKey,
			// Accept USDC on Base mainnet with priority and limits
			x402.AcceptUSDCBase().
				WithPriority(1).           // Prefer Base for lower fees
				WithMaxAmount("500000").   // Max 0.5 USDC per payment
				WithMinBalance("1000000"), // Keep 1 USDC as reserve
		)
	} else {
		log.Println("Configuring for testnet...")
		// For testing, accept USDC on Base Sepolia
		signer, err = x402.NewPrivateKeySigner(
			privateKey,
			x402.AcceptUSDCBaseSepolia(), // Accept USDC on Base Sepolia testnet
		)
	}

	if err != nil {
		log.Fatal("Failed to create signer:", err)
	}

	log.Printf("Using wallet address: %s", signer.GetAddress())
	if *verbose {
		log.Printf("Payment options configured:")
		if signer.SupportsNetwork("base") {
			log.Printf("  - Base mainnet: USDC")
		}
		if signer.SupportsNetwork("base-sepolia") {
			log.Printf("  - Base Sepolia: USDC (testnet)")
		}
	}

	// Create x402 transport with optional verbose logging
	config := x402.Config{
		ServerURL: *serverURL,
		Signers:   []x402.PaymentSigner{signer},
	}

	if *verbose {
		config.OnPaymentAttempt = func(event x402.PaymentEvent) {
			log.Printf("Attempting payment of %s %s to %s",
				event.Amount, event.Asset, event.Recipient)
		}
		config.OnPaymentSuccess = func(event x402.PaymentEvent) {
			log.Printf("Payment successful! Transaction: %s", event.Transaction)
		}
		config.OnPaymentFailure = func(event x402.PaymentEvent, err error) {
			log.Printf("Payment failed: %v", err)
		}
	}

	x402transport, err := x402.New(config)
	if err != nil {
		log.Fatal("Failed to create transport:", err)
	}

	// Create MCP client with x402 transport
	mcpClient := client.NewClient(x402transport)

	ctx := context.Background()
	if err := mcpClient.Start(ctx); err != nil {
		log.Fatal("Failed to start client:", err)
	}
	defer mcpClient.Close()

	// Initialize MCP session
	initResp, err := mcpClient.Initialize(ctx, mcp.InitializeRequest{
		Params: mcp.InitializeParams{
			ProtocolVersion: "1.0.0",
			ClientInfo: mcp.Implementation{
				Name:    "x402-example",
				Version: "1.0.0",
			},
		},
	})
	if err != nil {
		log.Fatal("Failed to initialize:", err)
	}

	log.Printf("Connected to server: %s v%s",
		initResp.ServerInfo.Name, initResp.ServerInfo.Version)

	// List all available tools
	log.Println("\nListing available tools...")
	toolsResp, err := mcpClient.ListTools(ctx, mcp.ListToolsRequest{})
	if err != nil {
		log.Printf("Failed to list tools: %v", err)
	} else {
		log.Println("Available tools:")
		for _, tool := range toolsResp.Tools {
			log.Printf("  - %s: %s", tool.Name, tool.Description)
		}
	}

	// Call the free echo tool first
	log.Println("\nCalling echo tool (free)...")
	echoResp, err := mcpClient.CallTool(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Name: "echo",
			Arguments: map[string]any{
				"message": "Hello from x402 client!",
			},
		},
	})

	if err != nil {
		log.Printf("Echo failed: %v", err)
	} else {
		log.Println("Echo response:")
		if len(echoResp.Content) > 0 {
			if textContent, ok := mcp.AsTextContent(echoResp.Content[0]); ok {
				log.Println(textContent.Text)
			}
		}
	}

	// Call the search tool (paid)
	log.Println("\nSearching for 'x402' (paid tool)...")
	searchResp, err := mcpClient.CallTool(ctx, mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Name: "search",
			Arguments: map[string]any{
				"query":       "x402",
				"max_results": 5,
			},
		},
	})

	if err != nil {
		log.Fatalf("Search failed: %v", err)
	}

	log.Println("Search results:")
	if len(searchResp.Content) > 0 {
		if textContent, ok := mcp.AsTextContent(searchResp.Content[0]); ok {
			log.Println(textContent.Text)
		}
	}
}
