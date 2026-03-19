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

// StreamServerInterceptor creates a gRPC stream server interceptor that enforces x402 payments.
// Payment is verified BEFORE the stream begins (upfront payment).
func StreamServerInterceptor(cfg x402.Config) grpc.StreamServerInterceptor {
	if err := cfg.Validate(); err != nil {
		panic(fmt.Sprintf("invalid x402 config: %v", err))
	}

	return func(srv interface{}, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		ctx := ss.Context()

		rule, requiresPayment := cfg.MatchMethod(info.FullMethod)
		if !requiresPayment {
			return handler(srv, ss)
		}

		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return sendPaymentRequired(rule, info.FullMethod, &cfg)
		}

		payload, isV2, err := ExtractPaymentFromMetadata(md)
		if err != nil {
			return sendPaymentRequired(rule, info.FullMethod, &cfg)
		}

		accepts := BuildPaymentRequirements(rule, info.FullMethod, cfg.ValidityDuration)
		if len(accepts) == 0 {
			return status.Error(codes.Internal, "no payment requirements configured")
		}
		requirements := &accepts[0]

		// Match client's chosen token against accepted tokens.
		var tokenSymbol string
		if payload != nil {
			if matched, symbol := x402.MatchClientToken(rule, payload); matched != nil {
				requirements = matched
				tokenSymbol = symbol
			}
		}

		verifyResult, err := cfg.Verifier.Verify(ctx, payload, requirements)
		if err != nil {
			return status.Error(codes.Internal, fmt.Sprintf("payment verification error: %v", err))
		}

		if !verifyResult.Valid {
			return sendPaymentRequired(rule, info.FullMethod, &cfg)
		}

		settlementResult, err := cfg.Verifier.Settle(ctx, payload, requirements)
		if err != nil {
			return status.Error(codes.Unavailable, fmt.Sprintf("payment settlement failed: %v", err))
		}

		if tokenSymbol == "" {
			tokenSymbol = verifyResult.TokenSymbol
		}

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

		wrappedStream := &paymentServerStream{
			ServerStream: ss,
			ctx:          ctx,
		}

		handlerErr := handler(srv, wrappedStream)

		if handlerErr == nil {
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
					wrappedStream.SetTrailer(trailer)
				} else {
					trailer := metadata.Pairs(MetadataKeyLegacyPaymentResponse, encoded)
					wrappedStream.SetTrailer(trailer)
				}
			}
		}

		return handlerErr
	}
}

type paymentServerStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (s *paymentServerStream) Context() context.Context {
	return s.ctx
}

func (s *paymentServerStream) SendHeader(md metadata.MD) error {
	return s.ServerStream.SendHeader(md)
}

func (s *paymentServerStream) SetTrailer(md metadata.MD) {
	s.ServerStream.SetTrailer(md)
}
