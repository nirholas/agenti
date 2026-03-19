package evm

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
	"github.com/mark3labs/x402-go"
)

// EIP3009Authorization represents the parameters for EIP-3009 transferWithAuthorization.
type EIP3009Authorization struct {
	From        common.Address
	To          common.Address
	Value       *big.Int
	ValidAfter  *big.Int
	ValidBefore *big.Int
	Nonce       common.Hash
}

// CreateEIP3009Authorization creates a new EIP-3009 authorization with appropriate timing and nonce.
func CreateEIP3009Authorization(from, to common.Address, value *big.Int, timeoutSeconds int) (*EIP3009Authorization, error) {
	// Generate a cryptographically secure random nonce
	nonce, err := generateNonce()
	if err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Set validity window
	// Subtract 10 seconds from validAfter to account for clock drift between client and server
	// This prevents the authorization from being rejected if the client's clock is slightly ahead
	now := time.Now().Unix()
	validAfter := big.NewInt(now - 10)
	validBefore := big.NewInt(now + int64(timeoutSeconds))

	return &EIP3009Authorization{
		From:        from,
		To:          to,
		Value:       value,
		ValidAfter:  validAfter,
		ValidBefore: validBefore,
		Nonce:       nonce,
	}, nil
}

// SignTransferAuthorization signs an EIP-3009 transferWithAuthorization using EIP-712.
// The name and version parameters should be provided from the payment requirements.
func SignTransferAuthorization(privateKey *ecdsa.PrivateKey, tokenAddress common.Address, chainID *big.Int, auth *EIP3009Authorization, name, version string) (string, error) {
	// Build EIP-712 typed data
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
			"nonce":       auth.Nonce.Hex(),
		},
	}

	// Compute the EIP-712 hash
	domainSeparator, err := typedData.HashStruct("EIP712Domain", typedData.Domain.Map())
	if err != nil {
		return "", fmt.Errorf("failed to hash domain: %w", err)
	}

	messageHash, err := typedData.HashStruct("TransferWithAuthorization", typedData.Message)
	if err != nil {
		return "", fmt.Errorf("failed to hash message: %w", err)
	}

	// Build the final hash: keccak256("\x19\x01" || domainSeparator || messageHash)
	rawData := append([]byte{0x19, 0x01}, append(domainSeparator, messageHash...)...)
	digest := crypto.Keccak256(rawData)

	// Sign the digest
	signature, err := crypto.Sign(digest, privateKey)
	if err != nil {
		return "", x402.NewPaymentError(x402.ErrCodeSigningFailed, "failed to sign authorization", err)
	}

	// Adjust v value for Ethereum (27 or 28)
	signature[64] += 27

	return "0x" + hex.EncodeToString(signature), nil
}

// generateNonce generates a cryptographically secure 32-byte random nonce.
func generateNonce() (common.Hash, error) {
	var nonce [32]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return common.Hash{}, err
	}
	return common.BytesToHash(nonce[:]), nil
}
