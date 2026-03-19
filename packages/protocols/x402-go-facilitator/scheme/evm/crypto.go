package evm

import (
	"crypto/ecdsa"
	"errors"
	"fmt"

	"github.com/decred/dcrd/dcrec/secp256k1/v4"
	decred_ecdsa "github.com/decred/dcrd/dcrec/secp256k1/v4/ecdsa"
)

// SignatureLength indicates the byte length required to carry a signature with recovery id.
const SignatureLength = 64 + 1 // 64 bytes ECDSA signature + 1 byte recovery id

// RecoveryIDOffset points to the byte offset within the signature that contains the recovery id.
const RecoveryIDOffset = 64

// DigestLength sets the signature digest exact length
const DigestLength = 32

// Ecrecover returns the uncompressed public key that created the given signature.
func Ecrecover(hash, sig []byte) ([]byte, error) {
	pub, err := sigToPub(hash, sig)
	if err != nil {
		return nil, err
	}
	bytes := pub.SerializeUncompressed()
	return bytes, err
}

func sigToPub(hash, sig []byte) (*secp256k1.PublicKey, error) {
	if len(sig) != SignatureLength {
		return nil, errors.New("invalid signature")
	}
	// Convert to secp256k1 input format with 'recovery id' v at the beginning.
	btcsig := make([]byte, SignatureLength)
	btcsig[0] = sig[RecoveryIDOffset]
	if btcsig[0] < 27 {
		btcsig[0] += 27
	}
	copy(btcsig[1:], sig)

	pub, _, err := decred_ecdsa.RecoverCompact(btcsig, hash)
	return pub, err
}

// Sign calculates an ECDSA signature.
//
// This function is susceptible to chosen plaintext attacks that can leak
// information about the private key that is used for signing. Callers must
// be aware that the given hash cannot be chosen by an adversary. Common
// solution is to hash any input before calculating the signature.
//
// The produced signature is in the [R || S || V] format where V is 0 or 1.
func Sign(hash []byte, prv *ecdsa.PrivateKey) ([]byte, error) {
	if len(hash) != 32 {
		return nil, fmt.Errorf("hash is required to be exactly 32 bytes (%d)", len(hash))
	}

	// ecdsa.PrivateKey -> secp256k1.PrivateKey
	var priv secp256k1.PrivateKey
	if overflow := priv.Key.SetByteSlice(prv.D.Bytes()); overflow || priv.Key.IsZero() {
		return nil, errors.New("invalid private key")
	}
	defer priv.Zero()
	sig := decred_ecdsa.SignCompact(&priv, hash, false) // ref uncompressed pubkey
	// Convert to Ethereum signature format with 'recovery id' v at the end.
	v := sig[0] - 27
	copy(sig, sig[1:])
	sig[RecoveryIDOffset] = v
	return sig, nil
}

// VerifySignature checks that the given public key created signature over hash.
// The public key should be in compressed (33 bytes) or uncompressed (65 bytes) format.
// The signature should have the 64 byte [R || S] format.
func VerifySignature(pubkey, hash, signature []byte) bool {
	if len(signature) != 64 {
		return false
	}
	var r, s secp256k1.ModNScalar
	if r.SetByteSlice(signature[:32]) {
		return false // overflow
	}
	if s.SetByteSlice(signature[32:]) {
		return false
	}
	sig := decred_ecdsa.NewSignature(&r, &s)
	key, err := secp256k1.ParsePubKey(pubkey)
	if err != nil {
		return false
	}
	// Reject malleable signatures. libsecp256k1 does this check but decred doesn't.
	if s.IsOverHalfOrder() {
		return false
	}
	return sig.Verify(hash, key)
}
