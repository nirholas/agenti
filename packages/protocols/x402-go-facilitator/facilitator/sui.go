package facilitator

import (
	"context"

	"github.com/gosuda/x402-facilitator/types"
)

type SuiFacilitator struct {
}

func NewSuiFacilitator(network string, url string, privateKeyHex string) (*SuiFacilitator, error) {
	return &SuiFacilitator{}, nil
}

func (t *SuiFacilitator) Verify(ctx context.Context, payload *types.PaymentPayload, req *types.PaymentRequirements) (*types.PaymentVerifyResponse, error) {
	return nil, nil
}

func (t *SuiFacilitator) Settle(ctx context.Context, payload *types.PaymentPayload, req *types.PaymentRequirements) (*types.PaymentSettleResponse, error) {
	return nil, nil
}

func (t *SuiFacilitator) Supported() []*types.SupportedKind {
	return []*types.SupportedKind{
		{
			Scheme:  string(types.Sui),
			Network: string(types.Sui),
		},
	}
}
