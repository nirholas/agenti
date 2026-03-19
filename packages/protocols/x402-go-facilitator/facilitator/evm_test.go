package facilitator

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/gosuda/x402-facilitator/scheme/evm"
	"github.com/gosuda/x402-facilitator/types"
	"github.com/stretchr/testify/require"
)

const (
	PrivateKey = ""
	Network    = "base-sepolia"
	Token      = "USDC"
)

func TestEVMVerify(t *testing.T) {
	facilitator, err := NewEVMFacilitator(Network, "", PrivateKey)
	require.NoError(t, err)

	privKey, err := hex.DecodeString("")
	require.NoError(t, err)
	evmPayload, err := evm.NewEVMPayload(Network, Token,
		"", "", "10000", evm.NewRawPrivateSigner(privKey))
	require.NoError(t, err)

	evmPayloadJson, err := json.Marshal(evmPayload)
	require.NoError(t, err)

	payload := &types.PaymentPayload{
		X402Version: int(types.X402VersionV1),
		Scheme:      string(types.EVM),
		Network:     Network,
		Payload:     evmPayloadJson,
	}
	req := &types.PaymentRequirements{
		Scheme:  string(types.EVM),
		Network: Network,
		Asset:   Token,
	}

	res, err := facilitator.Verify(t.Context(), payload, req)
	require.NoError(t, err)
	jsonRes, err := json.MarshalIndent(res, "", "\t")
	require.NoError(t, err)
	fmt.Println(string(jsonRes))
}

func TestEVMSettle(t *testing.T) {
	facilitator, err := NewEVMFacilitator(Network, "", PrivateKey)
	require.NoError(t, err)

	privKey, err := hex.DecodeString("")
	require.NoError(t, err)
	evmPayload, err := evm.NewEVMPayload(Network, Token,
		"", "", "10000", evm.NewRawPrivateSigner(privKey))
	require.NoError(t, err)
	evmPayloadJson, err := json.Marshal(evmPayload)
	require.NoError(t, err)

	payload := &types.PaymentPayload{
		X402Version: int(types.X402VersionV1),
		Scheme:      string(types.EVM),
		Network:     Network,
		Payload:     evmPayloadJson,
	}

	req := &types.PaymentRequirements{
		Scheme:  string(types.EVM),
		Network: Network,
		Asset:   Token,
	}

	res, err := facilitator.Settle(t.Context(), payload, req)
	require.NoError(t, err)

	jsonRes, err := json.MarshalIndent(res, "", "\t")
	require.NoError(t, err)
	fmt.Println(string(jsonRes))
}
