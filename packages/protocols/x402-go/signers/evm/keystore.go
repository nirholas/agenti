package evm

import (
	"crypto/ecdsa"
	"encoding/json"
	"fmt"
	"os"

	"github.com/ethereum/go-ethereum/accounts/keystore"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/mark3labs/x402-go"
	"github.com/tyler-smith/go-bip32"
	"github.com/tyler-smith/go-bip39"
)

// WithKeystore loads a private key from an encrypted keystore file.
func WithKeystore(keystorePath, password string) SignerOption {
	return func(s *Signer) error {
		// Read keystore file
		data, err := os.ReadFile(keystorePath)
		if err != nil {
			return fmt.Errorf("%w: %v", x402.ErrInvalidKeystore, err)
		}

		// Parse keystore JSON
		var keyJSON struct {
			Crypto keystore.CryptoJSON `json:"crypto"`
		}
		if err := json.Unmarshal(data, &keyJSON); err != nil {
			return fmt.Errorf("%w: invalid JSON format", x402.ErrInvalidKeystore)
		}

		// Decrypt the key
		privateKeyBytes, err := keystore.DecryptDataV3(keyJSON.Crypto, password)
		if err != nil {
			return fmt.Errorf("%w: decryption failed", x402.ErrInvalidKeystore)
		}

		// Convert to ECDSA private key
		privateKey, err := crypto.ToECDSA(privateKeyBytes)
		if err != nil {
			return fmt.Errorf("%w: invalid private key", x402.ErrInvalidKeystore)
		}

		s.privateKey = privateKey
		return nil
	}
}

// WithMnemonic derives a private key from a BIP39 mnemonic phrase.
// The accountIndex parameter selects which HD account to use (typically 0).
// Derivation path: m/44'/60'/0'/0/{accountIndex}
func WithMnemonic(mnemonic string, accountIndex uint32) SignerOption {
	return func(s *Signer) error {
		// Validate mnemonic
		if !bip39.IsMnemonicValid(mnemonic) {
			return x402.ErrInvalidMnemonic
		}

		// Generate seed from mnemonic
		seed := bip39.NewSeed(mnemonic, "")

		// Derive the key using BIP32/BIP44
		// Path: m/44'/60'/0'/0/{accountIndex}
		privateKey, err := deriveEthereumKey(seed, accountIndex)
		if err != nil {
			return fmt.Errorf("%w: %v", x402.ErrInvalidMnemonic, err)
		}

		s.privateKey = privateKey
		return nil
	}
}

// deriveEthereumKey derives an Ethereum private key from a BIP39 seed.
// Follows BIP44 path: m/44'/60'/0'/0/{index}
func deriveEthereumKey(seed []byte, index uint32) (*ecdsa.PrivateKey, error) {
	// Create master key
	masterKey, err := bip32.NewMasterKey(seed)
	if err != nil {
		return nil, err
	}

	// Derive path m/44'/60'/0'/0/{index}
	// 44' = BIP44 purpose
	key, err := masterKey.NewChildKey(bip32.FirstHardenedChild + 44)
	if err != nil {
		return nil, err
	}

	// 60' = Ethereum coin type
	key, err = key.NewChildKey(bip32.FirstHardenedChild + 60)
	if err != nil {
		return nil, err
	}

	// 0' = account 0
	key, err = key.NewChildKey(bip32.FirstHardenedChild + 0)
	if err != nil {
		return nil, err
	}

	// 0 = external chain
	key, err = key.NewChildKey(0)
	if err != nil {
		return nil, err
	}

	// {index} = address index
	key, err = key.NewChildKey(index)
	if err != nil {
		return nil, err
	}

	// Convert to ECDSA private key
	privateKey, err := crypto.ToECDSA(key.Key)
	if err != nil {
		return nil, err
	}

	return privateKey, nil
}
