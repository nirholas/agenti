package grpc

import (
	"context"
	"fmt"

	"github.com/becomeliminal/grpc-gateway-x402"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// UnaryServerInterceptor creates a gRPC unary server interceptor that enforces x402 payments
// It implements the x402 protocol flow using gRPC metadata for payment signaling
func UnaryServerInterceptor(cfg x402.Config) grpc.UnaryServerInterceptor {
	// Validate configuration at creation time
	if err := cfg.Validate(); err != nil {
		panic(fmt.Sprintf("invalid x402 config: %v", err))
	}

	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		// Check if this method requires payment
		rule, requiresPayment := cfg.MatchMethod(info.FullMethod)
		if !requiresPayment {
			// No payment required, proceed normally
			return handler(ctx, req)
		}

		// Extract metadata from incoming context
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			// No metadata at all, return payment required
			return nil, sendPaymentRequired(rule, info.FullMethod, &cfg)
		}

		// Check for payment in metadata
		paymentValues := md.Get(MetadataKeyPayment)
		if len(paymentValues) == 0 {
			// No payment provided, return payment required
			return nil, sendPaymentRequired(rule, info.FullMethod, &cfg)
		}

		// Decode payment from metadata
		payment, err := DecodePayment(paymentValues[0])
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, fmt.Sprintf("invalid payment: %v", err))
		}

		// Verify the payment
		verifyResult, err := cfg.Verifier.Verify(ctx, payment)
		if err != nil {
			return nil, status.Error(codes.Internal, fmt.Sprintf("payment verification error: %v", err))
		}

		if !verifyResult.Valid {
			// Payment is invalid, return payment required with reason
			return nil, sendPaymentRequiredWithReason(rule, info.FullMethod, &cfg, verifyResult.Reason)
		}

		// Settle the payment on-chain
		settlementResult, err := cfg.Verifier.Settle(ctx, payment)
		if err != nil {
			return nil, status.Error(codes.Unavailable, fmt.Sprintf("payment settlement failed: %v", err))
		}

		// Create payment context for downstream handlers
		paymentCtx := &x402.PaymentContext{
			Verified:        true,
			PayerAddress:    verifyResult.PayerAddress,
			Amount:          verifyResult.Amount,
			TokenSymbol:     verifyResult.TokenSymbol,
			Network:         payment.Network,
			TransactionHash: settlementResult.TransactionHash,
			SettledAt:       settlementResult.SettledAt,
		}

		// Inject payment context into the gRPC context
		ctx = context.WithValue(ctx, x402.PaymentContextKey, paymentCtx)

		// Call the actual handler
		resp, err := handler(ctx, req)
		if err != nil {
			return nil, err
		}

		// Add settlement response to trailing metadata
		paymentResponse := x402.PaymentResponse{
			TransactionHash: settlementResult.TransactionHash,
			Status:          settlementResult.Status,
		}

		encoded, encErr := EncodePaymentResponse(&paymentResponse)
		if encErr != nil {
			// Don't fail the request if we can't encode the response
			// The payment succeeded, so we should return the response
			// Log this error in production
		} else {
			trailer := metadata.Pairs(MetadataKeyPaymentResponse, encoded)
			grpc.SetTrailer(ctx, trailer)
		}

		return resp, nil
	}
}

// sendPaymentRequired returns a FAILED_PRECONDITION status with payment requirements in metadata
func sendPaymentRequired(rule *x402.PricingRule, fullMethod string, cfg *x402.Config) error {
	return sendPaymentRequiredWithReason(rule, fullMethod, cfg, "")
}

// sendPaymentRequiredWithReason returns a FAILED_PRECONDITION status with payment requirements and an optional reason
func sendPaymentRequiredWithReason(rule *x402.PricingRule, fullMethod string, cfg *x402.Config, reason string) error {
	// Build payment requirements from the pricing rule
	requirements := BuildPaymentRequirements(rule, fullMethod, cfg.ValidityDuration)

	// Encode requirements as base64 JSON
	encoded, err := EncodePaymentRequirements(requirements)
	if err != nil {
		return status.Error(codes.Internal, fmt.Sprintf("failed to encode payment requirements: %v", err))
	}

	// Return error with encoded requirements in the error message
	// Clients decode the message as base64 JSON to extract PaymentRequirementsResponse
	// Uses RESOURCE_EXHAUSTED to signal payment required, following Google Cloud's precedent
	// for billing/quota enforcement (semantically: "you've exhausted free access quota")
	_ = reason
	return status.Error(codes.ResourceExhausted, encoded)
}

// GetPaymentFromContext extracts payment information from the gRPC context
// This can be used in gRPC service handlers to access payment details
func GetPaymentFromContext(ctx context.Context) (*x402.PaymentContext, bool) {
	payment, ok := ctx.Value(x402.PaymentContextKey).(*x402.PaymentContext)
	return payment, ok
}

// RequirePayment is a helper that extracts payment from context and returns error if not found
// Useful for gRPC handlers that must have valid payment
func RequirePayment(ctx context.Context) (*x402.PaymentContext, error) {
	payment, ok := GetPaymentFromContext(ctx)
	if !ok {
		return nil, status.Error(codes.ResourceExhausted, "payment context not found")
	}
	if !payment.Verified {
		return nil, status.Error(codes.ResourceExhausted, "payment not verified")
	}
	return payment, nil
}
