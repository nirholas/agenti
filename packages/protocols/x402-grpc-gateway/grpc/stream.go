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

// StreamServerInterceptor creates a gRPC stream server interceptor that enforces x402 payments
// For streaming RPCs, payment is verified BEFORE the stream begins (upfront payment)
// Per-message payment is not supported in this version
func StreamServerInterceptor(cfg x402.Config) grpc.StreamServerInterceptor {
	// Validate configuration at creation time
	if err := cfg.Validate(); err != nil {
		panic(fmt.Sprintf("invalid x402 config: %v", err))
	}

	return func(srv interface{}, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		ctx := ss.Context()

		// Check if this method requires payment
		rule, requiresPayment := cfg.MatchMethod(info.FullMethod)
		if !requiresPayment {
			// No payment required, proceed normally
			return handler(srv, ss)
		}

		// Extract metadata from incoming context
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			// No metadata at all, return payment required
			return sendPaymentRequired(rule, info.FullMethod, &cfg)
		}

		// Check for payment in metadata
		paymentValues := md.Get(MetadataKeyPayment)
		if len(paymentValues) == 0 {
			// No payment provided, return payment required
			return sendPaymentRequired(rule, info.FullMethod, &cfg)
		}

		// Decode payment from metadata
		payment, err := DecodePayment(paymentValues[0])
		if err != nil {
			return status.Error(codes.InvalidArgument, fmt.Sprintf("invalid payment: %v", err))
		}

		// Verify the payment
		verifyResult, err := cfg.Verifier.Verify(ctx, payment)
		if err != nil {
			return status.Error(codes.Internal, fmt.Sprintf("payment verification error: %v", err))
		}

		if !verifyResult.Valid {
			// Payment is invalid, return payment required with reason
			return sendPaymentRequiredWithReason(rule, info.FullMethod, &cfg, verifyResult.Reason)
		}

		// Settle the payment on-chain
		settlementResult, err := cfg.Verifier.Settle(ctx, payment)
		if err != nil {
			return status.Error(codes.Unavailable, fmt.Sprintf("payment settlement failed: %v", err))
		}

		// Create payment context
		paymentCtx := &x402.PaymentContext{
			Verified:        true,
			PayerAddress:    verifyResult.PayerAddress,
			Amount:          verifyResult.Amount,
			TokenSymbol:     verifyResult.TokenSymbol,
			Network:         payment.Network,
			TransactionHash: settlementResult.TransactionHash,
			SettledAt:       settlementResult.SettledAt,
		}

		// Create new context with payment information
		ctx = context.WithValue(ctx, x402.PaymentContextKey, paymentCtx)

		// Wrap the server stream with updated context and settlement response
		wrappedStream := &paymentServerStream{
			ServerStream:     ss,
			ctx:              ctx,
			settlementResult: settlementResult,
		}

		// Call the handler with the wrapped stream
		err = handler(srv, wrappedStream)

		// Add settlement response to trailing metadata
		if err == nil {
			paymentResponse := x402.PaymentResponse{
				TransactionHash: settlementResult.TransactionHash,
				Status:          settlementResult.Status,
			}

			encoded, encErr := EncodePaymentResponse(&paymentResponse)
			if encErr == nil {
				trailer := metadata.Pairs(MetadataKeyPaymentResponse, encoded)
				wrappedStream.SetTrailer(trailer)
			}
		}

		return err
	}
}

// paymentServerStream wraps grpc.ServerStream to provide updated context with payment info
type paymentServerStream struct {
	grpc.ServerStream
	ctx              context.Context
	settlementResult *x402.SettlementResult
}

// Context returns the wrapped context with payment information
func (s *paymentServerStream) Context() context.Context {
	return s.ctx
}

// SendHeader sends the initial metadata (delegates to wrapped stream)
func (s *paymentServerStream) SendHeader(md metadata.MD) error {
	return s.ServerStream.SendHeader(md)
}

// SetTrailer sets the trailer metadata (delegates to wrapped stream)
func (s *paymentServerStream) SetTrailer(md metadata.MD) {
	s.ServerStream.SetTrailer(md)
}
