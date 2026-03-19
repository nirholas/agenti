package eip3009

import (
	"crypto/ecdsa"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/math"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
)

type Authorization struct {
	From        common.Address
	To          common.Address
	Value       *big.Int
	ValidAfter  *big.Int
	ValidBefore *big.Int
	Nonce       [32]byte
}

func CreateAuthorization(from, to common.Address, value *big.Int, timeoutSeconds int) (*Authorization, error) {
	nonce, err := GenerateNonce()
	if err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	now := time.Now().Unix()
	validAfter := big.NewInt(now - 10)
	validBefore := big.NewInt(now + int64(timeoutSeconds))

	return &Authorization{
		From:        from,
		To:          to,
		Value:       value,
		ValidAfter:  validAfter,
		ValidBefore: validBefore,
		Nonce:       nonce,
	}, nil
}

func GenerateNonce() ([32]byte, error) {
	var nonce [32]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return nonce, err
	}
	return nonce, nil
}

func SignAuthorization(privateKey *ecdsa.PrivateKey, tokenAddress common.Address, chainID *big.Int, auth *Authorization, name, version string) (string, error) {
	typedData := apitypes.TypedData{
		Types: apitypes.Types{
			"EIP712Domain": []apitypes.Type{
				{Name: "name", Type: "string"},
				{Name: "version", Type: "string"},
				{Name: "chainId", Type: "uint256"},
				{Name: "verifyingContract", Type: "address"},
			},
			"TransferWithAuthorization": []apitypes.Type{
				{Name: "from", Type: "address"},
				{Name: "to", Type: "address"},
				{Name: "value", Type: "uint256"},
				{Name: "validAfter", Type: "uint256"},
				{Name: "validBefore", Type: "uint256"},
				{Name: "nonce", Type: "bytes32"},
			},
		},
		PrimaryType: "TransferWithAuthorization",
		Domain: apitypes.TypedDataDomain{
			Name:              name,
			Version:           version,
			ChainId:           (*math.HexOrDecimal256)(chainID),
			VerifyingContract: tokenAddress.Hex(),
		},
		Message: apitypes.TypedDataMessage{
			"from":        auth.From.Hex(),
			"to":          auth.To.Hex(),
			"value":       (*math.HexOrDecimal256)(auth.Value),
			"validAfter":  (*math.HexOrDecimal256)(auth.ValidAfter),
			"validBefore": (*math.HexOrDecimal256)(auth.ValidBefore),
			"nonce":       common.BytesToHash(auth.Nonce[:]).Hex(),
		},
	}

	domainSeparator, err := typedData.HashStruct("EIP712Domain", typedData.Domain.Map())
	if err != nil {
		return "", fmt.Errorf("failed to hash domain: %w", err)
	}

	messageHash, err := typedData.HashStruct("TransferWithAuthorization", typedData.Message)
	if err != nil {
		return "", fmt.Errorf("failed to hash message: %w", err)
	}

	rawData := append([]byte{0x19, 0x01}, append(domainSeparator, messageHash...)...)
	digest := crypto.Keccak256(rawData)

	signature, err := crypto.Sign(digest, privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign authorization: %w", err)
	}

	signature[64] += 27

	return "0x" + hex.EncodeToString(signature), nil
}
