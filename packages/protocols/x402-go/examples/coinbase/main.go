package main

import (
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/mark3labs/x402-go"
	x402http "github.com/mark3labs/x402-go/http"
	"github.com/mark3labs/x402-go/signers/coinbase"
)

const CdPFacilitatorURL = "https://api.cdp.coinbase.com/platform/v2/x402"

func main() {
	// Load environment variables from .env file if present
	_ = godotenv.Load()

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
	fmt.Println("coinbase-demo - Example x402 payment client and server using Coinbase CDP")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  coinbase-demo server [flags]  - Run a test server with paywalled endpoints")
	fmt.Println("  coinbase-demo client [flags]  - Run client to access paywalled resources")
	fmt.Println()
	fmt.Println("Run 'coinbase-demo server --help' or 'coinbase-demo client --help' for more information.")
}

func runServer(args []string) {
	fs := flag.NewFlagSet("server", flag.ExitOnError)
	port := fs.String("port", "8080", "Server port")
	network := fs.String("network", "base-sepolia", "Network to accept payments on (base, base-sepolia, ethereum, ethereum-sepolia, polygon)")
	payTo := fs.String("pay-to", "", "Address to receive payments (required)")
	tokenAddr := fs.String("token", "", "Token address (auto-detected based on network if not specified)")
	amount := fs.String("amount", "", "Payment amount in USDC (default: 0.001)")
	apiKeyName := fs.String("api-key-name", "", "CDP API Key Name (or set CDP_API_KEY_NAME env var)")
	apiKeySecret := fs.String("api-key-secret", "", "CDP API Key Secret (or set CDP_API_KEY_SECRET env var)")
	facilitatorURL := fs.String("facilitator", "https://facilitator.x402.rs", "Facilitator URL")
	verbose := fs.Bool("verbose", false, "Enable verbose debug output")

	_ = fs.Parse(args)

	// Validate required flags
	if *payTo == "" {
		fmt.Println("Error: --pay-to is required")
		fmt.Println()
		fs.PrintDefaults()
		os.Exit(1)
	}

	if *apiKeyName == "" {
		*apiKeyName = os.Getenv("CDP_API_KEY_NAME")
	}
	if *apiKeySecret == "" {
		*apiKeySecret = os.Getenv("CDP_API_KEY_SECRET")
	}
	if *apiKeyName != "" && *apiKeySecret != "" {
		*facilitatorURL = CdPFacilitatorURL
	}

	// Get chain configuration for the network
	var chainConfig x402.ChainConfig
	switch strings.ToLower(*network) {
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
	case "solana", "mainnet-beta":
		chainConfig = x402.SolanaMainnet
	case "solana-devnet", "devnet":
		chainConfig = x402.SolanaDevnet
	default:
		log.Fatalf("Unsupported network: %s", *network)
	}

	// Override token address if provided
	if *tokenAddr != "" {
		chainConfig.USDCAddress = *tokenAddr
	}

	if *amount == "" {
		*amount = "0.001" // Default: 0.001 USDC
	}

	fmt.Printf("Starting Coinbase CDP x402 demo server on port %s\n", *port)
	fmt.Printf("Network: %s\n", *network)
	fmt.Printf("Payment recipient: %s\n", *payTo)
	fmt.Printf("Payment amount: %s USDC\n", *amount)
	fmt.Printf("Token: %s\n", chainConfig.USDCAddress)
	fmt.Printf("Facilitator: %s\n", *facilitatorURL)
	if *verbose {
		fmt.Printf("Verbose mode: ENABLED\n")
	}
	fmt.Println()

	// Create payment requirement using helper function
	requirement, err := x402.NewUSDCPaymentRequirement(x402.USDCRequirementConfig{
		Chain:             chainConfig,
		Amount:            *amount,
		RecipientAddress:  *payTo,
		Description:       "Access to paywalled content",
		MaxTimeoutSeconds: 60,
	})
	if err != nil {
		log.Fatalf("Failed to create payment requirement: %v", err)
	}

	requirements := []x402.PaymentRequirement{requirement}

	var cfg *x402http.Config
	if *apiKeyName != "" && *apiKeySecret != "" {
		fmt.Println("Using Coinbase CDP facilitator with provided API credentials")

		auth, err := coinbase.NewCDPAuth(*apiKeyName, *apiKeySecret, "")
		if err != nil {
			log.Fatalf("failed to create CDP auth: %s", err)
		}

		cfg = &x402http.Config{
			FacilitatorURL:      CdPFacilitatorURL,
			PaymentRequirements: requirements,
			VerifyOnly:          false,
			FacilitatorAuthorizationProvider: func(r *http.Request) string {
				token, err := auth.GenerateBearerToken(r.Method, r.URL.Path)
				if err != nil {
					log.Fatalf("failed to generate auth token: %v", err)
					return ""
				}
				return "Bearer " + token
			},
		}
	} else {
		// Create x402 middleware
		cfg = &x402http.Config{
			FacilitatorURL:      *facilitatorURL,
			PaymentRequirements: requirements,
			VerifyOnly:          false,
		}
	}
	middleware := x402http.NewX402Middleware(cfg)

	// Create paywalled data handler
	dataHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// This endpoint requires payment
		response := map[string]interface{}{
			"message":   "Successfully accessed paywalled content!",
			"timestamp": time.Now().Format(time.RFC3339),
			"data": map[string]interface{}{
				"premium": true,
				"secret":  "This is premium data that requires payment via Coinbase CDP",
			},
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	})

	// Create free public handler
	publicHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := map[string]interface{}{
			"message": "This is a free public endpoint",
			"info":    "Try /data endpoint to test x402 payments with Coinbase CDP",
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	})

	// Setup routes
	mux := http.NewServeMux()
	mux.Handle("/data", middleware(dataHandler)) // Paywalled endpoint
	mux.Handle("/public", publicHandler)         // Free endpoint
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprintf(w, "Coinbase CDP x402 Demo Server\n\n")
		fmt.Fprintf(w, "Endpoints:\n")
		fmt.Fprintf(w, "  GET /data    - Paywalled endpoint (requires x402 payment)\n")
		fmt.Fprintf(w, "  GET /public  - Free public endpoint\n")
	})

	fmt.Println("Server endpoints:")
	fmt.Printf("  http://localhost:%s/       - Server info\n", *port)
	fmt.Printf("  http://localhost:%s/data   - Paywalled endpoint (requires payment)\n", *port)
	fmt.Printf("  http://localhost:%s/public - Free public endpoint\n", *port)
	fmt.Println()
	fmt.Println("Server is ready!")

	// Start server
	if err := http.ListenAndServe(":"+*port, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func runClient(args []string) {
	fs := flag.NewFlagSet("client", flag.ExitOnError)
	network := fs.String("network", "base-sepolia", "Network to use (base, base-sepolia, ethereum, ethereum-sepolia, polygon)")
	apiKeyName := fs.String("api-key-name", "", "CDP API Key Name (or set CDP_API_KEY_NAME env var)")
	apiKeySecret := fs.String("api-key-secret", "", "CDP API Key Secret (or set CDP_API_KEY_SECRET env var)")
	walletSecret := fs.String("wallet-secret", "", "CDP Wallet Secret (optional, or set CDP_WALLET_SECRET env var)")
	accountName := fs.String("account-name", "x402-payment-wallet", "CDP account name (unique identifier for your wallet)")
	url := fs.String("url", "", "URL to fetch (must be paywalled with x402)")
	tokenAddr := fs.String("token", "", "Token address (auto-detected based on network if not specified)")
	maxAmount := fs.String("max-amount", "", "Maximum amount per call (optional)")
	verbose := fs.Bool("verbose", false, "Enable verbose debug output")

	_ = fs.Parse(args)

	// Get credentials from flags or environment
	if *apiKeyName == "" {
		*apiKeyName = os.Getenv("CDP_API_KEY_NAME")
	}
	if *apiKeySecret == "" {
		*apiKeySecret = os.Getenv("CDP_API_KEY_SECRET")
	}
	if *walletSecret == "" {
		*walletSecret = os.Getenv("CDP_WALLET_SECRET")
	}

	// Validate inputs
	if *apiKeyName == "" {
		fmt.Println("Error: --api-key-name is required (or set CDP_API_KEY_NAME env var)")
		fmt.Println()
		fs.PrintDefaults()
		os.Exit(1)
	}

	if *apiKeySecret == "" {
		fmt.Println("Error: --api-key-secret is required (or set CDP_API_KEY_SECRET env var)")
		fmt.Println()
		fs.PrintDefaults()
		os.Exit(1)
	}

	if *url == "" {
		fmt.Println("Error: --url is required")
		fmt.Println()
		fs.PrintDefaults()
		os.Exit(1)
	}

	// Get chain configuration for the network
	var chainConfig x402.ChainConfig
	switch strings.ToLower(*network) {
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
	case "solana", "mainnet-beta":
		chainConfig = x402.SolanaMainnet
	case "solana-devnet", "devnet":
		chainConfig = x402.SolanaDevnet
	default:
		log.Fatalf("Unsupported network: %s", *network)
	}

	// Use token address from config if not specified
	if *tokenAddr == "" {
		*tokenAddr = chainConfig.USDCAddress
	}

	fmt.Println("Initializing Coinbase CDP signer...")

	// Create CDP signer options
	signerOpts := []coinbase.SignerOption{
		coinbase.WithCDPCredentials(*apiKeyName, *apiKeySecret, *walletSecret),
		coinbase.WithNetwork(chainConfig.NetworkID),
		coinbase.WithToken(*tokenAddr, "USDC", int(chainConfig.Decimals)),
	}

	if *maxAmount != "" {
		signerOpts = append(signerOpts, coinbase.WithMaxAmountPerCall(*maxAmount))
	}

	// Create Coinbase CDP signer with account name
	cdpSigner, err := coinbase.NewSigner(*accountName, signerOpts...)
	if err != nil {
		log.Fatalf("Failed to create Coinbase CDP signer: %v", err)
	}

	signerAddress := cdpSigner.Address()
	fmt.Printf("Created Coinbase CDP signer for address: %s\n", signerAddress)
	fmt.Printf("Account name: %s\n", *accountName)
	fmt.Printf("Network: %s\n", *network)
	fmt.Printf("Token: %s\n", *tokenAddr)

	// Create x402-enabled HTTP client with CDP signer
	client, err := x402http.NewClient(
		x402http.WithSigner(cdpSigner),
	)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}

	fmt.Printf("\nFetching: %s\n", *url)

	// Make the request
	resp, err := client.Get(*url)
	if err != nil {
		log.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	// Verbose output: show payment header if sent
	if *verbose && resp.Request.Header.Get("X-PAYMENT") != "" {
		fmt.Println("\n=== DEBUG: Payment Header ===")
		paymentHeader := resp.Request.Header.Get("X-PAYMENT")
		fmt.Printf("X-PAYMENT (base64): %s\n", paymentHeader)
		fmt.Printf("Length: %d bytes\n", len(paymentHeader))

		// Decode and show the actual payload
		if decoded, err := base64.StdEncoding.DecodeString(paymentHeader); err == nil {
			var payload map[string]interface{}
			if err := json.Unmarshal(decoded, &payload); err == nil {
				prettyJSON, _ := json.MarshalIndent(payload, "", "  ")
				fmt.Printf("\nDecoded Payload:\n%s\n", string(prettyJSON))
			}
		}
		fmt.Println("=============================")
	}

	// Check for settlement info
	if settlement := x402http.GetSettlement(resp); settlement != nil {
		if settlement.Success {
			fmt.Printf("\n✓ Payment successful!\n")
			fmt.Printf("  Transaction: %s\n", settlement.Transaction)
			fmt.Printf("  Network: %s\n", settlement.Network)
			fmt.Printf("  Payer: %s\n", settlement.Payer)
		} else {
			fmt.Printf("\n✗ Payment failed: %s\n", settlement.ErrorReason)
		}
	}

	// Display response
	fmt.Printf("\nResponse Status: %d %s\n", resp.StatusCode, resp.Status)
	fmt.Printf("Content-Type: %s\n", resp.Header.Get("Content-Type"))

	// Show X-PAYMENT-RESPONSE header if present
	if paymentResp := resp.Header.Get("X-PAYMENT-RESPONSE"); paymentResp != "" {
		fmt.Printf("X-PAYMENT-RESPONSE: %s\n", paymentResp)
	}

	fmt.Println()

	// Read and display body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalf("Failed to read response body: %v", err)
	}

	fmt.Println("Response Body:")
	fmt.Println(string(body))

	// Verbose: Show raw payment details if available
	if *verbose {
		fmt.Println("\n=== DEBUG: Request Details ===")
		fmt.Printf("Final URL: %s\n", resp.Request.URL)
		fmt.Printf("Method: %s\n", resp.Request.Method)
		fmt.Println("Headers:")
		for k, v := range resp.Request.Header {
			if k == "X-PAYMENT" {
				fmt.Printf("  %s: [PRESENT - %d bytes]\n", k, len(v[0]))
			} else {
				fmt.Printf("  %s: %v\n", k, v)
			}
		}
		fmt.Println("==============================")
	}
}
