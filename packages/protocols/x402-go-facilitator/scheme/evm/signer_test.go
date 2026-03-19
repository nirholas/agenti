package evm

import (
	"encoding/hex"
	"testing"

	"github.com/decred/dcrd/dcrec/secp256k1/v4"
	"github.com/stretchr/testify/require"
)

func TestMessageSignVerify(t *testing.T) {
	// Generate a random private key
	privKey, err := secp256k1.GeneratePrivateKey()
	require.NoError(t, err)

	// Create a signer using the private key
	signer := NewRawPrivateSigner(privKey.Serialize())

	// Create a message to sign
	message := Keccak256([]byte("Hello, World!"))

	// Sign the message
	signature, err := signer(message)
	require.NoError(t, err)

	pubkey, err := Ecrecover(message, signature)
	require.NoError(t, err)

	// Verify the signature
	valid := VerifySignature(pubkey, message, signature[:64])
	require.True(t, valid, "signature verification failed")
}

func TestPayloadSignVerify(t *testing.T) {
	// Generate a random private key
	privKey, err := secp256k1.GeneratePrivateKey()
	require.NoError(t, err)

	// Create a signer using the private key
	signer := NewRawPrivateSigner(privKey.Serialize())

	// Create a message to sign
	chain := "base-sepolia"
	token := "USDC"

	payload, err := NewEVMPayload(chain, token,
		"0x1234567890abcdef1234567890abcdef12345678", "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef", "100", signer)
	require.NoError(t, err)
	message := HashEip3009(payload.Authorization, GetDomainConfig(chain, token))
	signature, err := hex.DecodeString(payload.Signature)
	require.NoError(t, err)
	pubkey, err := Ecrecover(message, signature)
	require.NoError(t, err)

	// Verify the signature
	valid := VerifySignature(pubkey, message, signature[:64])
	require.True(t, valid, "signature verification failed")
}
