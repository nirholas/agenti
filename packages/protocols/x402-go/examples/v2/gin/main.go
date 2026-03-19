package main

import (
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	v2 "github.com/mark3labs/x402-go/v2"
	v2http "github.com/mark3labs/x402-go/v2/http"
	ginx402 "github.com/mark3labs/x402-go/v2/http/gin"
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
	fmt.Println("gin-v2 - Gin-based x402 v2 payment client and server")
	fmt.Println()
	fmt.Println("This example demonstrates the x402 v2 protocol with Gin framework")
	fmt.Println("and CAIP-2 network identifiers.")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  gin-v2 server [flags]  - Run a Gin server with paywalled endpoints")
	fmt.Println("  gin-v2 client [flags]  - Run client to access paywalled resources")
	fmt.Println()
	fmt.Println("Run 'gin-v2 server --help' or 'gin-v2 client --help' for more information.")
}

func runServer(args []string) {
	fs := flag.NewFlagSet("server", flag.ExitOnError)
	port := fs.String("port", "8080", "Server port")
	network := fs.String("network", "eip155:84532", "Network to accept payments on (CAIP-2 format, e.g., eip155:8453, eip155:84532)")
	payTo := fs.String("pay-to", "", "Address to receive payments (required)")
	tokenAddr := fs.String("token", "", "Token address (auto-detected based on network if not specified)")
	amount := fs.String("amount", "", "Payment amount in atomic units (default: 1000 = 0.001 USDC)")
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

	if *amount == "" {
		*amount = "1000" // Default: 1000 atomic units = 0.001 USDC
	}

	fmt.Printf("Starting Gin server with x402 v2 on port %s\n", *port)
	fmt.Printf("Network: %s (CAIP-2)\n", *network)
	fmt.Printf("Payment recipient: %s\n", *payTo)
	fmt.Printf("Payment amount: %s atomic units\n", *amount)
	fmt.Printf("Token: %s\n", chainConfig.USDCAddress)
	fmt.Printf("Facilitator: %s\n", *facilitatorURL)
	if *verbose {
		fmt.Printf("Verbose mode: ENABLED\n")
	}
	fmt.Println()

	// Set Gin mode
	if !*verbose {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create Gin router
	r := gin.Default()

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

	// Create x402 v2 middleware config
	config := v2http.Config{
		FacilitatorURL:      *facilitatorURL,
		PaymentRequirements: []v2.PaymentRequirements{requirement},
		Resource: v2.ResourceInfo{
			Description: "Access to paywalled content",
			MimeType:    "application/json",
		},
		VerifyOnly: false,
	}

	// Public endpoint (no payment required)
	r.GET("/public", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message":  "This is a free public endpoint",
			"protocol": "x402 v2",
			"info":     "Try /data endpoint to test x402 v2 payments",
		})
	})

	// Paywalled endpoint
	r.GET("/data", ginx402.NewX402Middleware(config), func(c *gin.Context) {
		// Access payment information from Gin context
		response := gin.H{
			"message":   "Successfully accessed paywalled content!",
			"timestamp": time.Now().Format(time.RFC3339),
			"protocol":  "x402 v2",
			"data": gin.H{
				"premium": true,
				"secret":  "This is premium data that requires payment",
			},
		}

		if paymentInfo := ginx402.GetPaymentFromContext(c); paymentInfo != nil {
			response["payer"] = paymentInfo.Payer
		}

		c.JSON(http.StatusOK, response)
	})

	// Info endpoint
	r.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "Gin x402 v2 Demo Server\n\nProtocol: x402 version 2 with CAIP-2 network identifiers\n\nEndpoints:\n  GET /data    - Paywalled endpoint (requires x402 v2 payment)\n  GET /public  - Free public endpoint\n")
	})

	fmt.Println("Server endpoints:")
	fmt.Printf("  http://localhost:%s/       - Server info\n", *port)
	fmt.Printf("  http://localhost:%s/data   - Paywalled endpoint (requires payment)\n", *port)
	fmt.Printf("  http://localhost:%s/public - Free public endpoint\n", *port)
	fmt.Println()
	fmt.Println("Server is ready!")

	// Start server
	if err := r.Run(":" + *port); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func runClient(args []string) {
	fs := flag.NewFlagSet("client", flag.ExitOnError)
	network := fs.String("network", "eip155:84532", "Network to use (CAIP-2 format, e.g., eip155:8453, eip155:84532)")
	key := fs.String("key", "", "Private key (hex for EVM, base58 for Solana)")
	keyFile := fs.String("key-file", "", "Solana keygen JSON file (alternative to --key for Solana)")
	url := fs.String("url", "", "URL to fetch (must be paywalled with x402 v2)")
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

	if *url == "" {
		fmt.Println("Error: --url is required")
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

	var client *v2http.Client
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

		signerAddress = svmSigner.Address().String()
		fmt.Printf("Created Solana signer for address: %s\n", signerAddress)

		// Create x402 v2-enabled HTTP client with Solana signer
		client, err = v2http.NewClient(
			v2http.WithSigner(svmSigner),
		)
		if err != nil {
			log.Fatalf("Failed to create client: %v", err)
		}
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

		signerAddress = evmSigner.Address().Hex()
		fmt.Printf("Created EVM signer for address: %s\n", signerAddress)

		// Create x402 v2-enabled HTTP client with EVM signer
		client, err = v2http.NewClient(
			v2http.WithSigner(evmSigner),
		)
		if err != nil {
			log.Fatalf("Failed to create client: %v", err)
		}
	}

	fmt.Printf("Network: %s (CAIP-2)\n", *network)
	fmt.Printf("Token: %s\n", chainConfig.USDCAddress)
	fmt.Printf("Protocol: x402 v2\n")

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
	if settlement := v2http.GetSettlement(resp); settlement != nil {
		if settlement.Success {
			fmt.Printf("\n[SUCCESS] Payment successful!\n")
			fmt.Printf("  Transaction: %s\n", settlement.Transaction)
			fmt.Printf("  Network: %s\n", settlement.Network)
			fmt.Printf("  Payer: %s\n", settlement.Payer)
		} else {
			fmt.Printf("\n[FAILED] Payment failed: %s\n", settlement.ErrorReason)
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
