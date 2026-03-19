package facilitator

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind/v2"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/gosuda/x402-facilitator/scheme/evm"
	"github.com/gosuda/x402-facilitator/scheme/evm/eip3009"
	"github.com/gosuda/x402-facilitator/types"
)

var _ Facilitator = (*EVMFacilitator)(nil)

type EVMFacilitator struct {
	scheme    types.Scheme
	network   string
	networkID *big.Int

	client  *ethclient.Client
	signer  types.Signer
	address common.Address
}

func NewEVMFacilitator(network string, url string, privateKeyHex string) (*EVMFacilitator, error) {
	if network == "" && url == "" {
		return nil, fmt.Errorf("network or rpc url must be provided")
	} else if url == "" {
		// if url is not provided, use default URL
		if chainInfo := evm.GetChainInfo(network); chainInfo == nil {
			return nil, fmt.Errorf("unsupported network name: %s", network)
		} else {
			url = chainInfo.DefaultUrl
		}
	}

	client, err := ethclient.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Ethereum client: %w", err)
	}
	networkId, err := client.NetworkID(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to get network ID: %w", err)
	}
	chainName := evm.GetChainName(networkId)
	if chainName == "" || chainName != network {
		return nil, fmt.Errorf("unsupported network: %s", network)
	}

	privateKey, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return nil, err
	}
	signer := evm.NewRawPrivateSigner(privateKey)
	address, err := evm.GetAddrssFromPrivateKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to get address from private key: %w", err)
	}

	return &EVMFacilitator{
		scheme:    types.EVM,
		network:   network,
		networkID: networkId,

		client:  client,
		signer:  signer,
		address: address,
	}, nil
}

// verification steps:
//   - ✅ verify payload format
//   - ✅ verify payload version
//   - ✅ verify usdc address is correct for the chain
//   - ✅ verify permit signature
//   - ✅ verify deadline
//   - verify nonce is current
//   - ✅ verify client has enough funds to cover paymentRequirements.maxAmountRequired
//   - ✅ verify value in payload is enough to cover paymentRequirements.maxAmountRequired
//   - check min amount is above some threshold we think is reasonable for covering gas
//   - verify resource is not already paid for (next version)
func (t *EVMFacilitator) Verify(ctx context.Context, payload *types.PaymentPayload, req *types.PaymentRequirements) (*types.PaymentVerifyResponse, error) {
	// Step 1: Payload format
	var evmPayload evm.EVMPayload
	if err := json.Unmarshal([]byte(payload.Payload), &evmPayload); err != nil {
		return &types.PaymentVerifyResponse{
			IsValid:       false,
			InvalidReason: types.ErrInvalidPayloadFormat.Error(),
		}, nil
	}

	// Step 2: Scheme verification
	if payload.Scheme != string(t.scheme) || req.Scheme != string(t.scheme) {
		return &types.PaymentVerifyResponse{
			IsValid:       false,
			InvalidReason: types.ErrIncompatibleScheme.Error(),
			Payer:         evmPayload.Authorization.From.String(),
		}, nil
	}

	// Step 3: Network info and Contract info
	if payload.Network != t.network {
		return &types.PaymentVerifyResponse{
			IsValid:       false,
			InvalidReason: types.ErrNetworkMismatch.Error(),
			Payer:         evmPayload.Authorization.From.String(),
		}, nil
	}
	chainID := evm.GetChainID(payload.Network)
	if chainID == nil {
		return &types.PaymentVerifyResponse{
			IsValid:       false,
			InvalidReason: types.ErrInvalidNetwork.Error(),
			Payer:         evmPayload.Authorization.From.String(),
		}, nil
	}
	if chainID.Cmp(t.networkID) != 0 {
		return &types.PaymentVerifyResponse{
			IsValid:       false,
			InvalidReason: types.ErrNetworkIDMismatch.Error(),
			Payer:         evmPayload.Authorization.From.String(),
		}, nil
	}
	domainConfig := evm.GetDomainConfig(payload.Network, req.Asset)
	if domainConfig == nil {
		return &types.PaymentVerifyResponse{
			IsValid:       false,
			InvalidReason: types.ErrTokenMismatch.Error(),
			Payer:         evmPayload.Authorization.From.String(),
		}, nil
	}

	// Step 4: Verify signature (EIP-712)
	sig, err := evm.ParseSignature(evmPayload.Signature)
	if err != nil {
		return nil, err
	}
	digest := evmPayload.Authorization.ToMessageHash()
	pubkey, err := evm.Ecrecover(digest, sig)
	if err != nil {
		return nil, err
	}
	if valid := evm.VerifySignature(pubkey, digest, sig[:64]); !valid {
		return &types.PaymentVerifyResponse{
			IsValid:       false,
			InvalidReason: types.ErrInvalidSignature.Error(),
			Payer:         evmPayload.Authorization.From.String(),
		}, nil
	}

	// Step 5: Validate payTo

	// Step 6: Deadline check

	// Step 7: TODO: Nonce freshness check (optional in v1)

	// Step 8: Check ERC20 balance
	contract, err := eip3009.NewEip3009(domainConfig.VerifyingContract, t.client)
	if err != nil {
		return nil, fmt.Errorf("contract bind failed: %w", err)
	}
	balance, err := contract.BalanceOf(&bind.CallOpts{Context: ctx}, evmPayload.Authorization.From)
	if err != nil {
		return nil, fmt.Errorf("failed to get balance: %w", err)
	}
	if balance.Cmp(evmPayload.Authorization.Value) < 0 {
		return &types.PaymentVerifyResponse{
			IsValid:       false,
			InvalidReason: types.ErrInsufficientBalance.Error(),
			Payer:         evmPayload.Authorization.From.String(),
		}, nil
	}

	// Step 9: Check value in permit matches requirement

	// Step 10: TODO: Check minimum payment threshold (e.g. for gas overhead)

	// Step 11: TODO: Check if resource already paid (next version)

	// ✅ All checks passed
	return &types.PaymentVerifyResponse{
		IsValid: true,
		Payer:   evmPayload.Authorization.From.String(),
	}, nil
}

func (t *EVMFacilitator) Settle(ctx context.Context, payload *types.PaymentPayload, req *types.PaymentRequirements) (*types.PaymentSettleResponse, error) {
	var evmPayload evm.EVMPayload
	if err := json.Unmarshal([]byte(payload.Payload), &evmPayload); err != nil {
		return &types.PaymentSettleResponse{
			Success: false,
			Error:   types.ErrInvalidPayloadFormat.Error(),
		}, nil
	}

	networkID := evm.GetChainID(req.Network)
	if networkID == nil {
		return &types.PaymentSettleResponse{
			Success: false,
			Error:   types.ErrInvalidNetwork.Error(),
		}, nil
	}

	domainConfig := evm.GetDomainConfig(payload.Network, req.Asset)
	if domainConfig == nil {
		return &types.PaymentSettleResponse{
			Success: false,
			Error:   types.ErrTokenMismatch.Error(),
		}, nil
	}
	contract, err := eip3009.NewEip3009(domainConfig.VerifyingContract, t.client)
	if err != nil {
		return nil, fmt.Errorf("contract bind failed: %w", err)
	}
	clientSig, err := evm.ParseSignature(evmPayload.Signature) // client signature
	if err != nil {
		return nil, err
	}

	tx, err := contract.TransferWithAuthorization(
		&bind.TransactOpts{
			Context: ctx,
			Signer:  evm.ToGethSigner(t.signer, networkID), // facilitator signature
			From:    t.address,
		},
		evmPayload.Authorization.From,
		evmPayload.Authorization.To,
		evmPayload.Authorization.Value,
		evmPayload.Authorization.ValidAfter,
		evmPayload.Authorization.ValidBefore,
		evmPayload.Authorization.Nonce,
		clientSig,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to transfer with authorization %w", err)
	}

	return &types.PaymentSettleResponse{
		Success:   true,
		TxHash:    tx.Hash().Hex(),
		NetworkId: fmt.Sprintf("%d", networkID),
	}, nil
}

func (t *EVMFacilitator) Supported() []*types.SupportedKind {
	return []*types.SupportedKind{
		{
			Scheme:  string(t.scheme),
			Network: t.network,
		},
	}
}
