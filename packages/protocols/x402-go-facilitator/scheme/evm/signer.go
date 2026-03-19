package evm

import (
	"encoding/hex"
	"fmt"
	"math/big"

	"github.com/decred/dcrd/dcrec/secp256k1/v4"
	"github.com/ethereum/go-ethereum/accounts/abi/bind/v2"
	"github.com/ethereum/go-ethereum/common"
	ethTypes "github.com/ethereum/go-ethereum/core/types"

	"github.com/gosuda/x402-facilitator/types"
)

func NewRawPrivateSigner(privateKey []byte) types.Signer {
	return func(digest []byte) ([]byte, error) {
		privKey := secp256k1.PrivKeyFromBytes(privateKey)

		sig, err := Sign(digest, privKey.ToECDSA())
		if err != nil {
			return nil, err
		}
		return sig, nil
	}
}

func ToGethSigner(signer types.Signer, chainID *big.Int) bind.SignerFn {
	return func(_ common.Address, tx *ethTypes.Transaction) (*ethTypes.Transaction, error) {
		signerObj := ethTypes.LatestSignerForChainID(chainID)
		digest := signerObj.Hash(tx).Bytes()

		sig, err := signer(digest)
		if err != nil {
			return nil, err
		} else if len(sig) != 65 {
			return nil, fmt.Errorf("invalid signature length: %d", len(sig))
		}

		return tx.WithSignature(signerObj, sig)
	}
}

func SignEip3009(auth *Authorization, domain *DomainConfig, signer types.Signer) (string, error) {
	sig, err := signer(HashEip3009(auth, domain))
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(sig), nil
}

func HashEip3009(auth *Authorization, domain *DomainConfig) []byte {
	domainSeparator := domain.ToMessageHash()
	messageHash := auth.ToMessageHash()

	// Final EIP-712 hash
	var prefix = []byte{0x19, 0x01}
	return Keccak256(
		append(prefix, append(domainSeparator, messageHash...)...),
	)
}
