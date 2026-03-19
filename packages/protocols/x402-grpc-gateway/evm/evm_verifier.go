package evm

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/becomeliminal/grpc-gateway-x402"
)

// EVMVerifier implements ChainVerifier for EVM-compatible chains
type EVMVerifier struct {
	facilitator *FacilitatorClient
	networks    []x402.NetworkInfo
}

// NewEVMVerifier creates a new EVM verifier using a Coinbase facilitator
func NewEVMVerifier(facilitatorURL string) (*EVMVerifier, error) {
	client := NewFacilitatorClient(facilitatorURL)

	// Fetch supported networks from facilitator
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	supported, err := client.GetSupported(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch supported networks: %w", err)
	}

	// Convert facilitator network info to our format
	networks := make([]x402.NetworkInfo, 0, len(supported.Networks))
	for _, n := range supported.Networks {
		networks = append(networks, x402.NetworkInfo{
			Network:       n.Network,
			ChainID:       n.ChainID,
			ChainType:     n.ChainType,
			NativeCurrency: n.NativeCurrency,
		})
	}

	return &EVMVerifier{
		facilitator: client,
		networks:    networks,
	}, nil
}

// Verify checks if a payment is valid without settling it
func (v *EVMVerifier) Verify(ctx context.Context, payment *x402.Payment) (*x402.VerificationResult, error) {
	// Validate payment structure
	if payment.X402Version != 1 {
		return &x402.VerificationResult{
			Valid:  false,
			Reason: fmt.Sprintf("unsupported x402 version: %d", payment.X402Version),
		}, nil
	}

	if payment.Scheme != "exact" {
		return &x402.VerificationResult{
			Valid:  false,
			Reason: fmt.Sprintf("unsupported scheme: %s", payment.Scheme),
		}, nil
	}

	// Parse EVM payload
	evmPayload, err := parseEVMPayload(payment.Payload)
	if err != nil {
		return &x402.VerificationResult{
			Valid:  false,
			Reason: fmt.Sprintf("invalid payload: %v", err),
		}, nil
	}

	// Call facilitator to verify
	verifyReq := &FacilitatorVerifyRequest{
		X402Version: payment.X402Version,
		Scheme:      payment.Scheme,
		Network:     payment.Network,
		Payload:     payment.Payload,
	}

	verifyResp, err := v.facilitator.Verify(ctx, verifyReq)
	if err != nil {
		return nil, fmt.Errorf("facilitator verification failed: %w", err)
	}

	result := &x402.VerificationResult{
		Valid:        verifyResp.Valid,
		Reason:       verifyResp.Reason,
		PayerAddress: evmPayload.Authorization.From,
		Amount:       evmPayload.Authorization.Value,
	}

	return result, nil
}

// Settle executes the payment on-chain and returns settlement details
func (v *EVMVerifier) Settle(ctx context.Context, payment *x402.Payment) (*x402.SettlementResult, error) {
	// First verify the payment
	verifyResult, err := v.Verify(ctx, payment)
	if err != nil {
		return nil, fmt.Errorf("verification failed: %w", err)
	}

	if !verifyResult.Valid {
		return nil, fmt.Errorf("payment is not valid: %s", verifyResult.Reason)
	}

	// Parse EVM payload for settlement info
	evmPayload, err := parseEVMPayload(payment.Payload)
	if err != nil {
		return nil, fmt.Errorf("invalid payload: %w", err)
	}

	// Call facilitator to settle
	settleReq := &FacilitatorSettleRequest{
		X402Version: payment.X402Version,
		Scheme:      payment.Scheme,
		Network:     payment.Network,
		Payload:     payment.Payload,
	}

	settleResp, err := v.facilitator.Settle(ctx, settleReq)
	if err != nil {
		return nil, fmt.Errorf("facilitator settlement failed: %w", err)
	}

	result := &x402.SettlementResult{
		TransactionHash:  settleResp.TransactionHash,
		Status:          settleResp.Status,
		SettledAt:       time.Now(),
		Amount:          evmPayload.Authorization.Value,
		PayerAddress:    evmPayload.Authorization.From,
		RecipientAddress: evmPayload.Authorization.To,
	}

	return result, nil
}

// SupportedNetworks returns the list of EVM networks this verifier supports
func (v *EVMVerifier) SupportedNetworks() []x402.NetworkInfo {
	return v.networks
}

// parseEVMPayload converts a generic payload interface to EVMPayload
func parseEVMPayload(payload interface{}) (*EVMPayload, error) {
	// Marshal and unmarshal to convert map to struct
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	var evmPayload EVMPayload
	if err := json.Unmarshal(payloadBytes, &evmPayload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal EVM payload: %w", err)
	}

	// Validate required fields
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
