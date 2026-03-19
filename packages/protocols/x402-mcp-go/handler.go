package x402

import (
	"context"
	"fmt"
	"math/big"
	"sort"
	"time"
)

// PaymentHandler handles x402 payment operations
type PaymentHandler struct {
	signers []PaymentSigner
	config  *HandlerConfig
}

// HandlerConfig configures the payment handler
type HandlerConfig struct {
	PaymentCallback func(amount *big.Int, resource string) bool
	OnSignerAttempt func(PaymentEvent)
}

// NewPaymentHandler creates a new payment handler (backward compatibility)
func NewPaymentHandler(signer PaymentSigner, config *HandlerConfig) (*PaymentHandler, error) {
	if signer == nil {
		return nil, fmt.Errorf("signer cannot be nil")
	}

	if config == nil {
		config = &HandlerConfig{}
	}

	return &PaymentHandler{
		signers: []PaymentSigner{signer},
		config:  config,
	}, nil
}

// NewPaymentHandlerMulti creates a new payment handler with multiple signers
func NewPaymentHandlerMulti(signers []PaymentSigner, config *HandlerConfig) (*PaymentHandler, error) {
	if len(signers) == 0 {
		return nil, ErrNoSignerConfigured
	}

	if config == nil {
		config = &HandlerConfig{}
	}

	return &PaymentHandler{
		signers: signers,
		config:  config,
	}, nil
}

// ShouldPay determines if a payment should be made
func (h *PaymentHandler) ShouldPay(req PaymentRequirement) (bool, error) {
	amount := new(big.Int)
	if _, ok := amount.SetString(req.MaxAmountRequired, 10); !ok {
		return false, fmt.Errorf("invalid payment amount: %s", req.MaxAmountRequired)
	}

	// Validate amount is positive
	if amount.Sign() <= 0 {
		return false, fmt.Errorf("payment amount must be positive: %s", req.MaxAmountRequired)
	}

	// Use callback if provided
	if h.config.PaymentCallback != nil {
		return h.config.PaymentCallback(amount, req.Resource), nil
	}

	// Default: approve payment
	return true, nil
}

// CreatePayment creates a signed payment for the given requirements
func (h *PaymentHandler) CreatePayment(ctx context.Context, reqs PaymentRequirementsResponse) (*PaymentPayload, error) {
	// For backward compatibility, check if we have single or multiple signers
	if len(h.signers) == 1 {
		// Single signer - use existing logic for backward compatibility
		selected, err := h.selectPaymentMethodForSigner(h.signers[0], reqs.Accepts)
		if err != nil {
			return nil, err
		}

		shouldPay, err := h.ShouldPay(*selected)
		if err != nil {
			return nil, err
		}

		if !shouldPay {
			return nil, fmt.Errorf("payment declined by policy")
		}

		payload, err := h.signers[0].SignPayment(ctx, *selected)
		if err != nil {
			return nil, fmt.Errorf("signing payment: %w", err)
		}

		return payload, nil
	}

	// Multiple signers - use fallback logic
	return h.selectPaymentWithFallback(ctx, reqs.Accepts)
}

// selectPaymentMethod selects the best payment method from available options (legacy)
func (h *PaymentHandler) selectPaymentMethod(accepts []PaymentRequirement) (*PaymentRequirement, error) {
	if len(h.signers) == 0 {
		return nil, ErrNoAcceptablePayment
	}
	return h.selectPaymentMethodForSigner(h.signers[0], accepts)
}

// selectPaymentMethodForSigner selects payment method for a specific signer
func (h *PaymentHandler) selectPaymentMethodForSigner(signer PaymentSigner, accepts []PaymentRequirement) (*PaymentRequirement, error) {
	if len(accepts) == 0 {
		return nil, ErrNoAcceptablePayment
	}

	type candidate struct {
		req      PaymentRequirement
		priority int
		amount   *big.Int
	}

	var candidates []candidate

	for _, req := range accepts {
		// Check if we support this network and asset
		option := signer.GetPaymentOption(req.Network, req.Asset)
		if option == nil {
			continue
		}

		// Check scheme matches
		if option.Scheme != req.Scheme {
			continue
		}

		amount := new(big.Int)
		if _, ok := amount.SetString(req.MaxAmountRequired, 10); !ok {
			// Skip invalid amounts
			continue
		}

		// Skip zero or negative amounts
		if amount.Sign() <= 0 {
			continue
		}

		// Check if within client's max amount for this option
		if option.MaxAmount != "" {
			maxAmount := new(big.Int)
			if _, ok := maxAmount.SetString(option.MaxAmount, 10); ok {
				if amount.Cmp(maxAmount) > 0 {
					// Required amount exceeds client's max for this option
					continue
				}
			}
		}

		candidates = append(candidates, candidate{
			req:      req,
			priority: option.Priority,
			amount:   amount,
		})
	}

	if len(candidates) == 0 {
		return nil, fmt.Errorf("no payment option for network=%s asset=%s",
			accepts[0].Network, accepts[0].Asset)
	}

	// Sort by priority first, then by amount
	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].priority != candidates[j].priority {
			return candidates[i].priority < candidates[j].priority
		}
		return candidates[i].amount.Cmp(candidates[j].amount) < 0
	})

	return &candidates[0].req, nil
}

// selectPaymentWithFallback tries each signer in priority order until one succeeds
func (h *PaymentHandler) selectPaymentWithFallback(ctx context.Context, requirements []PaymentRequirement) (*PaymentPayload, error) {
	if len(requirements) == 0 {
		return nil, ErrNoAcceptablePayment
	}

	var failures []SignerFailure
	attemptNumber := 0

	for idx, signer := range h.signers {
		attemptNumber++

		// Emit signer attempt event
		if h.config.OnSignerAttempt != nil {
			event := PaymentEvent{
				Type:           PaymentEventSignerAttempt,
				SignerIndex:    idx,
				SignerPriority: signer.GetPriority(),
				SignerAddress:  signer.GetAddress(),
				AttemptNumber:  attemptNumber,
				Timestamp:      time.Now().Unix(),
			}
			h.config.OnSignerAttempt(event)
		}

		// Try to select payment method for this signer
		selected, err := h.selectPaymentMethodForSigner(signer, requirements)
		if err != nil {
			// Record failure and continue to next signer
			failures = append(failures, SignerFailure{
				SignerIndex:    idx,
				SignerPriority: signer.GetPriority(),
				SignerAddress:  signer.GetAddress(),
				Reason:         err.Error(),
				WrappedError:   err,
			})

			// Emit failure event
			if h.config.OnSignerAttempt != nil {
				event := PaymentEvent{
					Type:           PaymentEventSignerFailure,
					SignerIndex:    idx,
					SignerPriority: signer.GetPriority(),
					SignerAddress:  signer.GetAddress(),
					AttemptNumber:  attemptNumber,
					Error:          err,
					Timestamp:      time.Now().Unix(),
				}
				h.config.OnSignerAttempt(event)
			}
			continue
		}

		// Check payment callback
		shouldPay, err := h.ShouldPay(*selected)
		if err != nil || !shouldPay {
			if err == nil {
				err = fmt.Errorf("payment declined by policy")
			}
			failures = append(failures, SignerFailure{
				SignerIndex:    idx,
				SignerPriority: signer.GetPriority(),
				SignerAddress:  signer.GetAddress(),
				Reason:         err.Error(),
				WrappedError:   err,
			})
			continue
		}

		// Try to sign the payment
		payload, err := signer.SignPayment(ctx, *selected)
		if err != nil {
			failures = append(failures, SignerFailure{
				SignerIndex:    idx,
				SignerPriority: signer.GetPriority(),
				SignerAddress:  signer.GetAddress(),
				Reason:         fmt.Sprintf("signing failed: %v", err),
				WrappedError:   err,
			})
			continue
		}

		// Success - emit event and return
		if h.config.OnSignerAttempt != nil {
			amount := new(big.Int)
			amount.SetString(selected.MaxAmountRequired, 10)
			event := PaymentEvent{
				Type:           PaymentEventSignerSuccess,
				SignerIndex:    idx,
				SignerPriority: signer.GetPriority(),
				SignerAddress:  signer.GetAddress(),
				AttemptNumber:  attemptNumber,
				Amount:         amount,
				Network:        selected.Network,
				Asset:          selected.Asset,
				Recipient:      selected.PayTo,
				Timestamp:      time.Now().Unix(),
			}
			h.config.OnSignerAttempt(event)
		}

		return payload, nil
	}

	// All signers failed - return aggregated error
	return nil, &MultiSignerError{
		Message:        "no viable payment option found",
		SignerFailures: failures,
	}
}
