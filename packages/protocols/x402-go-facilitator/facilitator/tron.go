package facilitator

import (
	"context"

	"github.com/gosuda/x402-facilitator/types"
)

type TronFacilitator struct {
}

func NewTronFacilitator(network string, url string, privateKeyHex string) (*TronFacilitator, error) {
	return &TronFacilitator{}, nil
}

func (t *TronFacilitator) Verify(ctx context.Context, payload *types.PaymentPayload, req *types.PaymentRequirements) (*types.PaymentVerifyResponse, error) {
	return nil, nil
}

func (t *TronFacilitator) Settle(ctx context.Context, payload *types.PaymentPayload, req *types.PaymentRequirements) (*types.PaymentSettleResponse, error) {
	return nil, nil
}

func (t *TronFacilitator) Supported() []*types.SupportedKind {
	return []*types.SupportedKind{
		{
			Scheme:  string(types.Tron),
			Network: string(types.Tron),
		},
	}
}
