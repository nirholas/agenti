package x402

import (
	"context"
	"net/http"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc/metadata"
)

// WithPaymentMetadata returns a ServeMuxOption that propagates payment information
// from HTTP context to gRPC metadata, making it accessible in gRPC handlers
func WithPaymentMetadata() runtime.ServeMuxOption {
	return runtime.WithMetadata(func(ctx context.Context, r *http.Request) metadata.MD {
		md := metadata.MD{}

		// Extract payment context
		payment, ok := GetPaymentFromContext(ctx)
		if !ok || payment == nil {
			return md
		}

		// Add payment information to gRPC metadata
		if payment.Verified {
			md.Set("x-payment-verified", "true")
			md.Set("x-payment-payer", payment.PayerAddress)
			md.Set("x-payment-amount", payment.Amount)
			md.Set("x-payment-network", payment.Network)

			if payment.TokenSymbol != "" {
				md.Set("x-payment-token", payment.TokenSymbol)
			}

			if payment.TransactionHash != "" {
				md.Set("x-payment-tx-hash", payment.TransactionHash)
			}
		}

		return md
	})
}

// GetPaymentFromGRPCContext extracts payment information from gRPC metadata
// Use this in gRPC handlers to access payment details
func GetPaymentFromGRPCContext(ctx context.Context) (*PaymentContext, bool) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, false
	}

	// Check if payment was verified
	verified := md.Get("x-payment-verified")
	if len(verified) == 0 || verified[0] != "true" {
		return nil, false
	}

	// Extract payment details
	payment := &PaymentContext{
		Verified: true,
	}

	if payer := md.Get("x-payment-payer"); len(payer) > 0 {
		payment.PayerAddress = payer[0]
	}

	if amount := md.Get("x-payment-amount"); len(amount) > 0 {
		payment.Amount = amount[0]
	}

	if network := md.Get("x-payment-network"); len(network) > 0 {
		payment.Network = network[0]
	}

	if token := md.Get("x-payment-token"); len(token) > 0 {
		payment.TokenSymbol = token[0]
	}

	if txHash := md.Get("x-payment-tx-hash"); len(txHash) > 0 {
		payment.TransactionHash = txHash[0]
	}

	return payment, true
}

// GetHTTPPathPattern extracts the HTTP path pattern from grpc-gateway context
// This is useful if you need to make payment decisions based on the matched route
func GetHTTPPathPattern(ctx context.Context) (string, bool) {
	pattern, ok := runtime.HTTPPathPattern(ctx)
	return pattern, ok
}
