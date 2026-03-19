package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"

	x402 "github.com/becomeliminal/grpc-gateway-x402"
	"github.com/becomeliminal/grpc-gateway-x402/evm"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// This is a minimal example showing grpc-gateway x402 integration
// In a real application, you would import your generated proto code

const (
	grpcPort    = 9090
	gatewayPort = 8080
)

func main() {
	// Get configuration from environment
	facilitatorURL := os.Getenv("FACILITATOR_URL")
	if facilitatorURL == "" {
		facilitatorURL = "https://facilitator.x402.org"
	}

	recipientAddress := os.Getenv("RECIPIENT_ADDRESS")
	if recipientAddress == "" {
		log.Fatal("RECIPIENT_ADDRESS environment variable is required")
	}

	// Create EVM verifier
	verifier, err := evm.NewEVMVerifier(facilitatorURL)
	if err != nil {
		log.Fatalf("Failed to create EVM verifier: %v", err)
	}

	// Configure x402 middleware
	x402Config := x402.Config{
		Verifier: verifier,
		EndpointPricing: map[string]x402.PricingRule{
			"/v1/hello": {
				Amount:      "0.01", // 1 cent
				Description: "Get a personalized greeting",
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

	// Start gRPC server
	go startGRPCServer()

	// Start gateway with x402 middleware
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

	// In a real app, you would register your generated service here:
	// pb.RegisterYourServiceServer(grpcServer, &yourServiceImpl{})

	log.Printf("gRPC server listening on :%d", grpcPort)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("Failed to serve gRPC: %v", err)
	}
}

func startGateway(x402Config x402.Config) error {
	ctx := context.Background()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Create gRPC-gateway mux
	mux := runtime.NewServeMux(
		// Add payment metadata propagation to gRPC context
		x402.WithPaymentMetadata(),
	)

	// Connect to gRPC server
	_ = []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}
	_ = fmt.Sprintf("localhost:%d", grpcPort)

	// In a real app, you would register your handlers here:
	// err := pb.RegisterYourServiceHandlerFromEndpoint(ctx, mux, endpoint, opts)
	// if err != nil {
	//     return err
	// }

	// Create HTTP server with x402 middleware
	handler := x402.PaymentMiddleware(x402Config)(mux)

	// Add a simple health check endpoint that doesn't require payment
	healthMux := http.NewServeMux()
	healthMux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	healthMux.Handle("/", handler)

	httpServer := &http.Server{
		Addr:    fmt.Sprintf(":%d", gatewayPort),
		Handler: healthMux,
	}

	log.Printf("Gateway listening on :%d", gatewayPort)
	log.Printf("Try: curl http://localhost:%d/v1/hello", gatewayPort)
	log.Printf("Health check: curl http://localhost:%d/health", gatewayPort)

	return httpServer.ListenAndServe()
}
