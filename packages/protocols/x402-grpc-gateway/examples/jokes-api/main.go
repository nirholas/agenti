package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"net"
	"net/http"
	"os"
	"time"

	x402 "github.com/becomeliminal/grpc-gateway-x402"
	"github.com/becomeliminal/grpc-gateway-x402/evm"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

const (
	grpcPort    = 9090
	gatewayPort = 8080
)

// Programming jokes collection
var jokes = []string{
	"Why do programmers prefer dark mode? Because light attracts bugs!",
	"How many programmers does it take to change a lightbulb? None, that's a hardware problem.",
	"A SQL query walks into a bar, walks up to two tables and asks... 'Can I join you?'",
	"Why do Java developers wear glasses? Because they don't C#.",
	"There are 10 types of people in the world: those who understand binary and those who don't.",
	"Why did the programmer quit his job? Because he didn't get arrays.",
	"What's a programmer's favorite hangout place? Foo Bar.",
	"Why do programmers always mix up Halloween and Christmas? Because Oct 31 == Dec 25.",
	"A programmer's wife tells him: 'Run to the store and pick up a loaf of bread. If they have eggs, get a dozen.' He comes back with 12 loaves of bread.",
	"How do you comfort a JavaScript bug? You console it.",
}

func main() {
	facilitatorURL := os.Getenv("FACILITATOR_URL")
	if facilitatorURL == "" {
		facilitatorURL = "https://facilitator.x402.org"
	}

	recipientAddress := os.Getenv("RECIPIENT_ADDRESS")
	if recipientAddress == "" {
		log.Fatal("RECIPIENT_ADDRESS environment variable is required")
	}

	verifier, err := evm.NewEVMVerifier(facilitatorURL)
	if err != nil {
		log.Fatalf("Failed to create EVM verifier: %v", err)
	}

	// Configure x402 for joke endpoint - only 0.0001 USDC!
	x402Config := x402.Config{
		Verifier: verifier,
		EndpointPricing: map[string]x402.PricingRule{
			"/v1/joke": {
				Amount:      "0.0001", // One hundredth of a cent!
				Description: "Get a programming joke",
				MimeType:    "application/json",
				AcceptedTokens: []x402.TokenRequirement{
					{
						Network:       "base-sepolia",
						AssetContract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
						Symbol:        "USDC",
						Recipient:     recipientAddress,
						TokenName:     "USD Coin",
						TokenDecimals: 6,
					},
				},
			},
		},
		SkipPaths: []string{
			"/health",
		},
	}

	go startGRPCServer()

	if err := startGateway(x402Config); err != nil {
		log.Fatalf("Failed to start gateway: %v", err)
	}
}

func startGRPCServer() {
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", grpcPort))
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer()

	log.Printf("gRPC server listening on :%d", grpcPort)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("Failed to serve gRPC: %v", err)
	}
}

func startGateway(x402Config x402.Config) error {
	ctx := context.Background()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	mux := runtime.NewServeMux(x402.WithPaymentMetadata())

	_ = []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}
	_ = fmt.Sprintf("localhost:%d", grpcPort)

	// Wrap with x402 payment middleware
	handler := x402.PaymentMiddleware(x402Config)(mux)

	// Create root mux for health and joke endpoints
	rootMux := http.NewServeMux()

	// Health check - free!
	rootMux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","message":"Server is running!"}`))
	})

	// Joke endpoint - requires payment!
	rootMux.HandleFunc("/v1/joke", func(w http.ResponseWriter, r *http.Request) {
		// This handler is wrapped by x402 middleware
		// If we get here, payment was successful!

		payment, ok := x402.GetPaymentFromContext(r.Context())
		if !ok || !payment.Verified {
			// This shouldn't happen if middleware is working correctly
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error":"Payment verification failed"}`))
			return
		}

		// Get a random joke
		rand.Seed(time.Now().UnixNano())
		joke := jokes[rand.Intn(len(jokes))]

		// Return the joke with payment info
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		response := fmt.Sprintf(`{
  "joke": "%s",
  "paid": true,
  "payer": "%s",
  "amount": "%s",
  "token": "%s",
  "txHash": "%s",
  "message": "Thanks for supporting bad jokes! 😄"
}`, joke, payment.PayerAddress, payment.Amount, payment.TokenSymbol, payment.TransactionHash)
		w.Write([]byte(response))

		log.Printf("💰 Joke delivered! Paid %s %s by %s (tx: %s)",
			payment.Amount, payment.TokenSymbol, payment.PayerAddress, payment.TransactionHash)
	})

	// Apply x402 middleware to the joke endpoint only
	finalHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/joke" {
			// Apply payment middleware
			handler.ServeHTTP(w, r)
		} else {
			// No payment required for other paths
			rootMux.ServeHTTP(w, r)
		}
	})

	httpServer := &http.Server{
		Addr:    fmt.Sprintf(":%d", gatewayPort),
		Handler: finalHandler,
	}

	log.Printf("🚀 Jokes API listening on :%d", gatewayPort)
	log.Printf("")
	log.Printf("Try it out:")
	log.Printf("  Free:  curl http://localhost:%d/health", gatewayPort)
	log.Printf("  Paid:  curl http://localhost:%d/v1/joke", gatewayPort)
	log.Printf("")
	log.Printf("💡 The /v1/joke endpoint costs $0.0001 USDC")
	log.Printf("   That's 10,000 jokes for $1 - what a deal!")
	log.Printf("")

	return httpServer.ListenAndServe()
}
