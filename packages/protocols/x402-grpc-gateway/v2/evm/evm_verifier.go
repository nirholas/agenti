package evm

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	x402 "github.com/becomeliminal/grpc-gateway-x402/v2"
)

// EVMVerifier implements ChainVerifier for EVM-compatible chains using a facilitator service.
type EVMVerifier struct {
	facilitator *FacilitatorClient
	kinds       []x402.SupportedKind
}

// NewEVMVerifier creates a new EVM verifier that delegates to a facilitator service.
func NewEVMVerifier(facilitatorURL string) (*EVMVerifier, error) {
	client := NewFacilitatorClient(facilitatorURL)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	supported, err := client.GetSupported(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch supported kinds: %w", err)
	}

	kinds := make([]x402.SupportedKind, 0, len(supported.Kinds))
	for _, k := range supported.Kinds {
		kinds = append(kinds, x402.SupportedKind{
			Scheme:  k.Scheme,
			Network: k.Network,
		})
	}

	return &EVMVerifier{
		facilitator: client,
		kinds:       kinds,
	}, nil
}

// Verify checks if a payment is valid without settling it.
func (v *EVMVerifier) Verify(ctx context.Context, payload *x402.PaymentPayload, requirements *x402.PaymentRequirements) (*x402.VerificationResult, error) {
	evmPayload, err := parseEVMPayload(payload.Payload)
	if err != nil {
		return &x402.VerificationResult{
			Valid:  false,
			Reason: fmt.Sprintf("invalid payload: %v", err),
		}, nil
	}

	verifyReq := &FacilitatorVerifyRequest{
		Payload:      payload,
		Requirements: requirements,
	}

	verifyResp, err := v.facilitator.Verify(ctx, verifyReq)
	if err != nil {
		return nil, fmt.Errorf("facilitator verification failed: %w", err)
	}

	return &x402.VerificationResult{
		Valid:        verifyResp.IsValid,
		Reason:       verifyResp.InvalidReason,
		PayerAddress: evmPayload.Authorization.From,
		Amount:       evmPayload.Authorization.Value,
	}, nil
}

// Settle executes the payment on-chain and returns settlement details.
func (v *EVMVerifier) Settle(ctx context.Context, payload *x402.PaymentPayload, requirements *x402.PaymentRequirements) (*x402.SettlementResult, error) {
	evmPayload, err := parseEVMPayload(payload.Payload)
	if err != nil {
		return nil, fmt.Errorf("invalid payload: %w", err)
	}

	settleReq := &FacilitatorSettleRequest{
		Payload:      payload,
		Requirements: requirements,
	}

	settleResp, err := v.facilitator.Settle(ctx, settleReq)
	if err != nil {
		return nil, fmt.Errorf("facilitator settlement failed: %w", err)
	}

	if !settleResp.Success {
		return nil, fmt.Errorf("settlement failed: %s", settleResp.ErrorReason)
	}

	return &x402.SettlementResult{
		TransactionHash:  settleResp.Transaction,
		Status:           "success",
		SettledAt:        time.Now(),
		Amount:           evmPayload.Authorization.Value,
		PayerAddress:     evmPayload.Authorization.From,
		RecipientAddress: evmPayload.Authorization.To,
		Network:          settleResp.Network,
	}, nil
}

// SupportedKinds returns the supported scheme+network pairs.
func (v *EVMVerifier) SupportedKinds() []x402.SupportedKind {
	return v.kinds
}

func parseEVMPayload(payload interface{}) (*EVMPayload, error) {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	var evmPayload EVMPayload
	if err := json.Unmarshal(payloadBytes, &evmPayload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal EVM payload: %w", err)
	}

	if evmPayload.Signature == "" {
		return nil, fmt.Errorf("signature is required")
	}

	if evmPayload.Authorization == nil {
		return nil, fmt.Errorf("authorization is required")
	}

	auth := evmPayload.Authorization
	if auth.From == "" || auth.To == "" || auth.Value == "" || auth.Nonce == "" {
		return nil, fmt.Errorf("authorization missing required fields")
	}

	return &evmPayload, nil
}
