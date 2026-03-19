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

const (
	grpcPort    = 9090
	gatewayPort = 8080
)

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

	// Multi-token, multi-network configuration
	x402Config := x402.Config{
		Verifier: verifier,
		EndpointPricing: map[string]x402.PricingRule{
			// Premium tier - $1.00
			"/v1/premium/*": {
				Amount:      "1.00",
				Description: "Premium content access",
				AcceptedTokens: []x402.TokenRequirement{
					{
						Network:       "base-mainnet",
						AssetContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
						Symbol:        "USDC",
						Recipient:     recipientAddress,
						TokenDecimals: 6,
					},
					{
						Network:       "ethereum-mainnet",
						AssetContract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
						Symbol:        "USDC",
						Recipient:     recipientAddress,
						TokenDecimals: 6,
					},
					{
						Network:       "ethereum-mainnet",
						AssetContract: "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI on Ethereum
						Symbol:        "DAI",
						Recipient:     recipientAddress,
						TokenDecimals: 18,
					},
				},
			},
			// Basic tier - $0.10
			"/v1/basic/*": {
				Amount:      "0.10",
				Description: "Basic content access",
				AcceptedTokens: []x402.TokenRequirement{
					{
						Network:       "base-mainnet",
						AssetContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
						Symbol:        "USDC",
						Recipient:     recipientAddress,
						TokenDecimals: 6,
					},
					{
						Network:       "polygon-mainnet",
						AssetContract: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // USDC on Polygon
						Symbol:        "USDC",
						Recipient:     recipientAddress,
						TokenDecimals: 6,
					},
				},
			},
			// Micro tier - $0.01
			"/v1/micro/*": {
				Amount:      "0.01",
				Description: "Micro-transaction content",
				MimeType:    "application/json",
				AcceptedTokens: []x402.TokenRequirement{
					{
						Network:       "base-mainnet",
						AssetContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
						Symbol:        "USDC",
						Recipient:     recipientAddress,
						TokenDecimals: 6,
					},
				},
			},
		},
		SkipPaths: []string{
			"/health",
			"/metrics",
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

	// Register your services here
	// Example: pb.RegisterContentServiceServer(grpcServer, &contentServer{})

	log.Printf("gRPC server listening on :%d", grpcPort)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("Failed to serve gRPC: %v", err)
	}
}

func startGateway(x402Config x402.Config) error {
	ctx := context.Background()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	mux := runtime.NewServeMux(
		x402.WithPaymentMetadata(),
	)

	_ = []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}
	_ = fmt.Sprintf("localhost:%d", grpcPort)

	// Register handlers
	// err := pb.RegisterContentServiceHandlerFromEndpoint(ctx, mux, endpoint, opts)

	handler := x402.PaymentMiddleware(x402Config)(mux)

	rootMux := http.NewServeMux()
	rootMux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy"}`))
	})
	rootMux.Handle("/", handler)

	httpServer := &http.Server{
		Addr:    fmt.Sprintf(":%d", gatewayPort),
		Handler: rootMux,
	}

	log.Printf("🚀 Gateway listening on :%d", gatewayPort)
	log.Printf("")
	log.Printf("Try these endpoints:")
	log.Printf("  Premium ($1.00): curl http://localhost:%d/v1/premium/article", gatewayPort)
	log.Printf("  Basic ($0.10):   curl http://localhost:%d/v1/basic/post", gatewayPort)
	log.Printf("  Micro ($0.01):   curl http://localhost:%d/v1/micro/data", gatewayPort)
	log.Printf("  Health (free):   curl http://localhost:%d/health", gatewayPort)
	log.Printf("")
	log.Printf("Accepted tokens: USDC (Base, Ethereum, Polygon), DAI (Ethereum)")

	return httpServer.ListenAndServe()
}

// Example of a gRPC service implementation that accesses payment info
/*
type contentServer struct {
	pb.UnimplementedContentServiceServer
}

func (s *contentServer) GetPremiumContent(ctx context.Context, req *pb.GetContentRequest) (*pb.ContentResponse, error) {
	// Access payment information
	payment, ok := x402.GetPaymentFromGRPCContext(ctx)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "payment required")
	}

	log.Printf("Payment received: %s %s from %s (tx: %s)",
		payment.Amount,
		payment.TokenSymbol,
		payment.PayerAddress,
		payment.TransactionHash,
	)

	// Return premium content
	return &pb.ContentResponse{
		Content: fmt.Sprintf("Premium content for payer %s", payment.PayerAddress),
		Paid:    true,
	}, nil
}
*/
