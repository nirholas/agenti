package facilitator

import (
	"context"
	"fmt"

	"github.com/gosuda/x402-facilitator/types"
)

type Facilitator interface {
	Verify(ctx context.Context, payment *types.PaymentPayload, req *types.PaymentRequirements) (*types.PaymentVerifyResponse, error)
	Settle(ctx context.Context, payment *types.PaymentPayload, req *types.PaymentRequirements) (*types.PaymentSettleResponse, error)
	Supported() []*types.SupportedKind
}

func NewFacilitator(scheme types.Scheme, network, rpcUrl string, privateKeyHex string) (Facilitator, error) {
	switch scheme {
	case types.EVM:
		return NewEVMFacilitator(network, rpcUrl, privateKeyHex)
	case types.Solana:
		return NewSolanaFacilitator(network, rpcUrl, privateKeyHex)
	case types.Sui:
		return NewSuiFacilitator(network, rpcUrl, privateKeyHex)
	case types.Tron:
		return NewTronFacilitator(network, rpcUrl, privateKeyHex)
	default:
		return nil, fmt.Errorf("unsupporsed scheme: %s", scheme)
	}
}
