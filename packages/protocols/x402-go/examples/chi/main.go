package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/mark3labs/x402-go"
	"github.com/mark3labs/x402-go/facilitator"
	x402http "github.com/mark3labs/x402-go/http"
)

func main() {
	// Parse command line flags
	port := flag.String("port", "8080", "Server port")
	network := flag.String("network", "base-sepolia", "Network to accept payments on (base, base-sepolia, solana, solana-devnet)")
	payTo := flag.String("pay-to", "", "Address to receive payments (required)")
	tokenAddr := flag.String("token", "", "Token address (auto-detected based on network if not specified)")
	amount := flag.String("amount", "", "Payment amount in USDC (default: 0.001)")
	facilitatorURL := flag.String("facilitator", "https://facilitator.x402.rs", "Facilitator URL")

	flag.Parse()

	// Validate required flags
	if *payTo == "" {
		fmt.Println("Error: --pay-to is required")
		fmt.Println()
		flag.PrintDefaults()
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

	if *amount == "" {
		*amount = "0.001" // Default: 0.001 USDC
	}

	fmt.Printf("Starting Chi server with x402 on port %s\n", *port)
	fmt.Printf("Network: %s\n", *network)
	fmt.Printf("Payment recipient: %s\n", *payTo)
	fmt.Printf("Payment amount: %s USDC\n", *amount)
	fmt.Printf("Token: %s\n", chainConfig.USDCAddress)
	fmt.Printf("Facilitator: %s\n", *facilitatorURL)
	fmt.Println()

	// Create Chi router
	r := chi.NewRouter()

	// Add standard Chi middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

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

	// Create x402 middleware config
	config := &x402http.Config{
		FacilitatorURL:      *facilitatorURL,
		PaymentRequirements: []x402.PaymentRequirement{requirement},
		VerifyOnly:          false,
	}

	// Public endpoint (no payment required)
	r.Get("/public", func(w http.ResponseWriter, r *http.Request) {
		response := map[string]interface{}{
			"message": "This is a free public endpoint",
			"info":    "Try /data endpoint to test x402 payments",
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	})

	// Paywalled endpoint group
	r.Route("/", func(r chi.Router) {
		// Apply x402 middleware to this group
		r.Use(x402http.NewX402Middleware(config))

		r.Get("/data", func(w http.ResponseWriter, r *http.Request) {
			// Access payment information from context
			response := map[string]interface{}{
				"message":   "Successfully accessed paywalled content!",
				"timestamp": time.Now().Format(time.RFC3339),
				"data": map[string]interface{}{
					"premium": true,
					"secret":  "This is premium data that requires payment",
				},
			}

			// Get payment info from context
			if paymentInfo := r.Context().Value(x402http.PaymentContextKey); paymentInfo != nil {
				verifyResp := paymentInfo.(*facilitator.VerifyResponse)
				response["payer"] = verifyResp.Payer
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)
		})
	})

	// Info endpoint (public)
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprintf(w, "Chi x402 Demo Server\n\nEndpoints:\n  GET /data    - Paywalled endpoint (requires x402 payment)\n  GET /public  - Free public endpoint\n")
	})

	fmt.Println("Server endpoints:")
	fmt.Printf("  http://localhost:%s/       - Server info\n", *port)
	fmt.Printf("  http://localhost:%s/data   - Paywalled endpoint (requires payment)\n", *port)
	fmt.Printf("  http://localhost:%s/public - Free public endpoint\n", *port)
	fmt.Println()
	fmt.Println("Server is ready!")

	// Start server
	if err := http.ListenAndServe(":"+*port, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
