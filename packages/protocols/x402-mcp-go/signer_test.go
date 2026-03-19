package x402

import (
	"context"
	"math/big"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSignerChainID(t *testing.T) {
	t.Run("SigningUsesChainIDFromOption", func(t *testing.T) {
		// Create signer with Base option
		signer, err := NewPrivateKeySigner(
			"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			AcceptUSDCBase(),
		)
		require.NoError(t, err)

		// Sign a payment for Base network
		payment, err := signer.SignPayment(context.Background(), PaymentRequirement{
			Scheme:            "exact",
			Network:           "base",
			Asset:             USDCAddressBase,
			PayTo:             "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb6",
			MaxAmountRequired: "1000",
			MaxTimeoutSeconds: 60,
			Extra: map[string]string{
				"name":    "USD Coin",
				"version": "2",
			},
		})

		require.NoError(t, err)
		assert.NotNil(t, payment)
		assert.Equal(t, "base", payment.Network)
		// The signature was created with chain ID 8453 from the payment option
	})

	t.Run("SigningFailsWithoutMatchingOption", func(t *testing.T) {
		// Create signer with only Base option
		signer, err := NewPrivateKeySigner(
			"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			AcceptUSDCBase(),
		)
		require.NoError(t, err)

		// Try to sign for a different network/asset combination
		_, err = signer.SignPayment(context.Background(), PaymentRequirement{
			Scheme:            "exact",
			Network:           "ethereum",
			Asset:             "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			PayTo:             "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb6",
			MaxAmountRequired: "1000",
			MaxTimeoutSeconds: 60,
		})

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "no payment option configured")
	})

	t.Run("RequiresChainIDInPaymentOption", func(t *testing.T) {
		// Create a payment option without chain ID
		optionWithoutChainID := ClientPaymentOption{
			PaymentRequirement: PaymentRequirement{
				Scheme:  "exact",
				Network: "sepolia",
				Asset:   "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC on Sepolia
				Extra: map[string]string{
					"name":    "USD Coin",
					"version": "2",
				},
			},
			Priority: 1,
			// ChainID is nil - this should cause signing to fail
		}

		signer, err := NewPrivateKeySigner(
			"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			optionWithoutChainID,
		)
		require.NoError(t, err)

		// Should fail to sign without chain ID
		_, err = signer.SignPayment(context.Background(), PaymentRequirement{
			Scheme:            "exact",
			Network:           "sepolia",
			Asset:             "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
			PayTo:             "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb6",
			MaxAmountRequired: "1000",
			MaxTimeoutSeconds: 60,
			Extra: map[string]string{
				"name":    "USD Coin",
				"version": "2",
			},
		})

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "chain ID not configured")
	})

	t.Run("MultipleOptionsWithDifferentChainIDs", func(t *testing.T) {
		// Create custom options with explicit chain IDs
		ethereumOption := ClientPaymentOption{
			PaymentRequirement: PaymentRequirement{
				Scheme:  "exact",
				Network: "ethereum",
				Asset:   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
				Extra: map[string]string{
					"name":    "USD Coin",
					"version": "2",
				},
			},
			Priority: 2,
			ChainID:  big.NewInt(1), // Ethereum mainnet
		}

		polygonOption := ClientPaymentOption{
			PaymentRequirement: PaymentRequirement{
				Scheme:  "exact",
				Network: "polygon",
				Asset:   "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
				Extra: map[string]string{
					"name":    "USD Coin",
					"version": "2",
				},
			},
			Priority: 3,
			ChainID:  big.NewInt(137), // Polygon mainnet
		}

		signer, err := NewPrivateKeySigner(
			"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			AcceptUSDCBase(), // Chain ID 8453
			ethereumOption,   // Chain ID 1
			polygonOption,    // Chain ID 137
		)
		require.NoError(t, err)

		// Verify each option retains its chain ID
		baseOpt := signer.GetPaymentOption("base", USDCAddressBase)
		require.NotNil(t, baseOpt)
		assert.Equal(t, big.NewInt(8453), baseOpt.ChainID)

		ethOpt := signer.GetPaymentOption("ethereum", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
		require.NotNil(t, ethOpt)
		assert.Equal(t, big.NewInt(1), ethOpt.ChainID)

		polyOpt := signer.GetPaymentOption("polygon", "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174")
		require.NotNil(t, polyOpt)
		assert.Equal(t, big.NewInt(137), polyOpt.ChainID)
	})
}

func TestMnemonicSignerChainID(t *testing.T) {
	t.Run("MnemonicSignerUsesChainID", func(t *testing.T) {
		// Test mnemonic (not a real wallet - for testing only)
		testMnemonic := "test test test test test test test test test test test junk"

		signer, err := NewMnemonicSigner(
			testMnemonic,
			"m/44'/60'/0'/0/0",
			AcceptUSDCBase(),
			AcceptUSDCBaseSepolia(),
		)
		require.NoError(t, err)

		// Verify options have chain IDs
		baseOpt := signer.GetPaymentOption("base", USDCAddressBase)
		require.NotNil(t, baseOpt)
		assert.Equal(t, big.NewInt(8453), baseOpt.ChainID)

		sepoliaOpt := signer.GetPaymentOption("base-sepolia", USDCAddressBaseSepolia)
		require.NotNil(t, sepoliaOpt)
		assert.Equal(t, big.NewInt(84532), sepoliaOpt.ChainID)
	})
}

func TestKeystoreSignerChainID(t *testing.T) {
	// Note: We can't easily test KeystoreSigner without a valid keystore file
	// This is more of a placeholder to ensure the pattern is consistent
	t.Run("KeystoreSignerStructure", func(t *testing.T) {
		// Just verify that the AcceptUSDCBase helper works correctly
		option := AcceptUSDCBase()
		assert.Equal(t, big.NewInt(8453), option.ChainID)
	})
}
