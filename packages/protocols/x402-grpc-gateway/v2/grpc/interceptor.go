package grpc

import (
	"context"
	"fmt"

	x402 "github.com/becomeliminal/grpc-gateway-x402/v2"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// UnaryServerInterceptor creates a gRPC unary server interceptor that enforces x402 payments.
// Detects V2 metadata (payment-signature) first, falls back to V1 (x402-payment).
func UnaryServerInterceptor(cfg x402.Config) grpc.UnaryServerInterceptor {
	if err := cfg.Validate(); err != nil {
		panic(fmt.Sprintf("invalid x402 config: %v", err))
	}

	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		rule, requiresPayment := cfg.MatchMethod(info.FullMethod)
		if !requiresPayment {
			return handler(ctx, req)
		}

		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, sendPaymentRequired(rule, info.FullMethod, &cfg)
		}

		// Extract payment (V2 first, V1 fallback).
		payload, isV2, err := ExtractPaymentFromMetadata(md)
		if err != nil {
			return nil, sendPaymentRequired(rule, info.FullMethod, &cfg)
		}

		// Build requirements from the matched pricing rule.
		accepts := BuildPaymentRequirements(rule, info.FullMethod, cfg.ValidityDuration)
		if len(accepts) == 0 {
			return nil, status.Error(codes.Internal, "no payment requirements configured")
		}
		requirements := &accepts[0]

		// Match the client's chosen token against accepted tokens.
		var tokenSymbol string
		if payload != nil {
			if matched, symbol := x402.MatchClientToken(rule, payload); matched != nil {
				requirements = matched
				tokenSymbol = symbol
			}
		}

		// Verify the payment.
		verifyResult, err := cfg.Verifier.Verify(ctx, payload, requirements)
		if err != nil {
			return nil, status.Error(codes.Internal, fmt.Sprintf("payment verification error: %v", err))
		}

		if !verifyResult.Valid {
			return nil, sendPaymentRequired(rule, info.FullMethod, &cfg)
		}

		// Settle the payment on-chain.
		settlementResult, err := cfg.Verifier.Settle(ctx, payload, requirements)
		if err != nil {
			return nil, status.Error(codes.Unavailable, fmt.Sprintf("payment settlement failed: %v", err))
		}

		// Resolve token symbol from rule match or verifier.
		if tokenSymbol == "" {
			tokenSymbol = verifyResult.TokenSymbol
		}

		// Create payment context.
		paymentCtx := &x402.PaymentContext{
			Verified:        true,
			PayerAddress:    verifyResult.PayerAddress,
			Amount:          verifyResult.Amount,
			TokenSymbol:     tokenSymbol,
			Network:         requirements.Network,
			TransactionHash: settlementResult.TransactionHash,
			SettledAt:       settlementResult.SettledAt,
		}

		ctx = context.WithValue(ctx, x402.PaymentContextKey, paymentCtx)

		resp, err := handler(ctx, req)
		if err != nil {
			return nil, err
		}

		// Set response metadata (version-aware).
		paymentResponse := x402.PaymentResponse{
			Success:     true,
			Transaction: settlementResult.TransactionHash,
			Network:     settlementResult.Network,
			Payer:       settlementResult.PayerAddress,
		}

		encoded, encErr := EncodePaymentResponse(&paymentResponse)
		if encErr == nil {
			if isV2 {
				trailer := metadata.Pairs(MetadataKeyPaymentResponse, encoded)
				grpc.SetTrailer(ctx, trailer)
			} else {
				trailer := metadata.Pairs(MetadataKeyLegacyPaymentResponse, encoded)
				grpc.SetTrailer(ctx, trailer)
			}
		}

		return resp, nil
	}
}

func sendPaymentRequired(rule *x402.PricingRule, fullMethod string, cfg *x402.Config) error {
	accepts := BuildPaymentRequirements(rule, fullMethod, cfg.ValidityDuration)

	encoded, err := EncodePaymentRequirements(accepts)
	if err != nil {
		return status.Error(codes.Internal, fmt.Sprintf("failed to encode payment requirements: %v", err))
	}

	return status.Error(codes.ResourceExhausted, encoded)
}

// GetPaymentFromContext extracts payment information from the gRPC context.
func GetPaymentFromContext(ctx context.Context) (*x402.PaymentContext, bool) {
	payment, ok := ctx.Value(x402.PaymentContextKey).(*x402.PaymentContext)
	return payment, ok
}

// RequirePayment extracts payment from context and returns error if not found.
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
