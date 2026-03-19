package x402

import (
	"context"
	"math/big"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClientPaymentOptions(t *testing.T) {
	t.Run("RequiresAtLeastOneOption", func(t *testing.T) {
		_, err := NewPrivateKeySigner("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "at least one payment option")
	})

	t.Run("HelperFunctionsIncludeChainID", func(t *testing.T) {
		baseOption := AcceptUSDCBase()
		assert.Equal(t, big.NewInt(8453), baseOption.ChainID, "Base mainnet should have chain ID 8453")
		assert.Equal(t, "USD Coin", baseOption.Extra["name"])
		assert.Equal(t, "2", baseOption.Extra["version"])

		sepoliaOption := AcceptUSDCBaseSepolia()
		assert.Equal(t, big.NewInt(84532), sepoliaOption.ChainID, "Base Sepolia should have chain ID 84532")
		assert.Equal(t, "USDC", sepoliaOption.Extra["name"])
		assert.Equal(t, "2", sepoliaOption.Extra["version"])

		// Test new chains
		polygonOption := AcceptUSDCPolygon()
		assert.Equal(t, big.NewInt(137), polygonOption.ChainID, "Polygon mainnet should have chain ID 137")
		assert.Equal(t, USDCAddressPolygon, polygonOption.Asset)
		assert.Equal(t, "polygon", polygonOption.Network)
		assert.Equal(t, "USD Coin", polygonOption.Extra["name"])
		assert.Equal(t, "2", polygonOption.Extra["version"])

		polygonAmoyOption := AcceptUSDCPolygonAmoy()
		assert.Equal(t, big.NewInt(80002), polygonAmoyOption.ChainID, "Polygon Amoy should have chain ID 80002")
		assert.Equal(t, USDCAddressPolygonAmoy, polygonAmoyOption.Asset)
		assert.Equal(t, "polygon-amoy", polygonAmoyOption.Network)
		assert.Equal(t, "USDC", polygonAmoyOption.Extra["name"])
		assert.Equal(t, "2", polygonAmoyOption.Extra["version"])

		avalancheOption := AcceptUSDCAvalanche()
		assert.Equal(t, big.NewInt(43114), avalancheOption.ChainID, "Avalanche mainnet should have chain ID 43114")
		assert.Equal(t, USDCAddressAvalanche, avalancheOption.Asset)
		assert.Equal(t, "avalanche", avalancheOption.Network)
		assert.Equal(t, "USD Coin", avalancheOption.Extra["name"])
		assert.Equal(t, "2", avalancheOption.Extra["version"])

		avalancheFujiOption := AcceptUSDCAvalancheFuji()
		assert.Equal(t, big.NewInt(43113), avalancheFujiOption.ChainID, "Avalanche Fuji should have chain ID 43113")
		assert.Equal(t, USDCAddressAvalancheFuji, avalancheFujiOption.Asset)
		assert.Equal(t, "avalanche-fuji", avalancheFujiOption.Network)
		assert.Equal(t, "USDC", avalancheFujiOption.Extra["name"])
		assert.Equal(t, "2", avalancheFujiOption.Extra["version"])
	})

	t.Run("AcceptsMultipleOptions", func(t *testing.T) {
		signer, err := NewPrivateKeySigner(
			"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			AcceptUSDCBase(),
			AcceptUSDCBaseSepolia(),
		)
		require.NoError(t, err)

		// Check Base support
		assert.True(t, signer.SupportsNetwork("base"))
		assert.True(t, signer.HasAsset(USDCAddressBase, "base"))

		// Check Base Sepolia support
		assert.True(t, signer.SupportsNetwork("base-sepolia"))
		assert.True(t, signer.HasAsset(USDCAddressBaseSepolia, "base-sepolia"))

		// Test case-insensitive matching with mixed case
		assert.True(t, signer.HasAsset("0x833589FCD6EDB6E08F4C7C32D4F71B54BDA02913", "base"))

		// Check unsupported network
		assert.False(t, signer.SupportsNetwork("ethereum"))
		assert.False(t, signer.HasAsset("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "ethereum"))
	})

	t.Run("AcceptsMultipleChainsIncludingNewOnes", func(t *testing.T) {
		signer, err := NewPrivateKeySigner(
			"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			AcceptUSDCBase().WithPriority(1),
			AcceptUSDCPolygon().WithPriority(2),
			AcceptUSDCAvalanche().WithPriority(3),
			AcceptUSDCPolygonAmoy().WithPriority(4),
			AcceptUSDCAvalancheFuji().WithPriority(5),
		)
		require.NoError(t, err)

		// Check all mainnet chains
		assert.True(t, signer.SupportsNetwork("base"))
		assert.True(t, signer.SupportsNetwork("polygon"))
		assert.True(t, signer.SupportsNetwork("avalanche"))

		// Check all testnet chains
		assert.True(t, signer.SupportsNetwork("polygon-amoy"))
		assert.True(t, signer.SupportsNetwork("avalanche-fuji"))

		// Check correct assets
		assert.True(t, signer.HasAsset(USDCAddressPolygon, "polygon"))
		assert.True(t, signer.HasAsset(USDCAddressAvalanche, "avalanche"))
		assert.True(t, signer.HasAsset(USDCAddressPolygonAmoy, "polygon-amoy"))
		assert.True(t, signer.HasAsset(USDCAddressAvalancheFuji, "avalanche-fuji"))

		// Test case-insensitive address matching (mixed case should also work)
		assert.True(t, signer.HasAsset("0x3C499C542CEF5E3811E1192CE70D8CC03D5C3359", "polygon"))
		assert.True(t, signer.HasAsset("0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E", "avalanche"))
	})

	t.Run("FluentAPI", func(t *testing.T) {
		option := AcceptUSDCBase().
			WithPriority(2).
			WithMaxAmount("100000").
			WithMinBalance("50000")

		assert.Equal(t, 2, option.Priority)
		assert.Equal(t, "100000", option.MaxAmount)
		assert.Equal(t, "50000", option.MinBalance)
		assert.Equal(t, "base", option.Network)
		assert.Equal(t, big.NewInt(8453), option.ChainID, "Chain ID should be preserved through fluent API")
	})

	t.Run("GetPaymentOption", func(t *testing.T) {
		signer, err := NewPrivateKeySigner(
			"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			AcceptUSDCBase().WithPriority(1),
			AcceptUSDCBaseSepolia().WithPriority(2),
		)
		require.NoError(t, err)

		// Get Base option
		baseOpt := signer.GetPaymentOption("base", USDCAddressBase)
		require.NotNil(t, baseOpt)
		assert.Equal(t, 1, baseOpt.Priority)
		assert.Equal(t, "base", baseOpt.Network)
		assert.Equal(t, big.NewInt(8453), baseOpt.ChainID)

		// Get Base Sepolia option
		sepoliaOpt := signer.GetPaymentOption("base-sepolia", USDCAddressBaseSepolia)
		require.NotNil(t, sepoliaOpt)
		assert.Equal(t, 2, sepoliaOpt.Priority)
		assert.Equal(t, "base-sepolia", sepoliaOpt.Network)
		assert.Equal(t, big.NewInt(84532), sepoliaOpt.ChainID)

		// Try non-existent option
		nilOpt := signer.GetPaymentOption("ethereum", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
		assert.Nil(t, nilOpt)
	})

	t.Run("CustomPaymentOptionWithChainID", func(t *testing.T) {
		// Create a custom payment option for Ethereum mainnet
		customOption := ClientPaymentOption{
			PaymentRequirement: PaymentRequirement{
				Scheme:  "exact",
				Network: "ethereum",
				Asset:   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
				Extra: map[string]string{
					"name":    "USD Coin",
					"version": "2",
				},
			},
			Priority: 1,
			ChainID:  big.NewInt(1), // Ethereum mainnet
		}

		signer, err := NewPrivateKeySigner(
			"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			customOption,
		)
		require.NoError(t, err)

		// Verify the option is stored correctly
		option := signer.GetPaymentOption("ethereum", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
		require.NotNil(t, option)
		assert.Equal(t, big.NewInt(1), option.ChainID)
	})
}

func TestPaymentSelection(t *testing.T) {
	t.Run("SelectsByPriority", func(t *testing.T) {
		signer, err := NewPrivateKeySigner(
			"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			AcceptUSDCBaseSepolia().WithPriority(2), // Lower priority
			AcceptUSDCBase().WithPriority(1),        // Higher priority
		)
		require.NoError(t, err)

		handler, err := NewPaymentHandler(signer, &HandlerConfig{})
		require.NoError(t, err)

		// Server accepts both options
		accepts := []PaymentRequirement{
			{
				Scheme:            "exact",
				Network:           "base",
				Asset:             USDCAddressBase,
				MaxAmountRequired: "5000",
			},
			{
				Scheme:            "exact",
				Network:           "base-sepolia",
				Asset:             USDCAddressBaseSepolia,
				MaxAmountRequired: "5000",
			},
		}

		selected, err := handler.selectPaymentMethod(accepts)
		require.NoError(t, err)
		assert.Equal(t, "base", selected.Network) // Should select base (priority 1)
	})

	t.Run("SelectsCheaperWithSamePriority", func(t *testing.T) {
		signer, err := NewPrivateKeySigner(
			"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			AcceptUSDCBase().WithPriority(1),
			AcceptUSDCBaseSepolia().WithPriority(1), // Same priority
		)
		require.NoError(t, err)

		handler, err := NewPaymentHandler(signer, &HandlerConfig{})
		require.NoError(t, err)

		// Server accepts both with different prices
		accepts := []PaymentRequirement{
			{
				Scheme:            "exact",
				Network:           "base",
				Asset:             USDCAddressBase,
				MaxAmountRequired: "10000", // More expensive
			},
			{
				Scheme:            "exact",
				Network:           "base-sepolia",
				Asset:             USDCAddressBaseSepolia,
				MaxAmountRequired: "5000", // Cheaper
			},
		}

		selected, err := handler.selectPaymentMethod(accepts)
		require.NoError(t, err)
		assert.Equal(t, "base-sepolia", selected.Network) // Should select cheaper option
	})

	t.Run("RespectsMaxAmount", func(t *testing.T) {
		signer, err := NewPrivateKeySigner(
			"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			AcceptUSDCBase().WithMaxAmount("1000"), // Low max on Base
			AcceptUSDCBaseSepolia(),                // No limit on Sepolia
		)
		require.NoError(t, err)

		handler, err := NewPaymentHandler(signer, &HandlerConfig{})
		require.NoError(t, err)

		// Server requires more than Base max
		accepts := []PaymentRequirement{
			{
				Scheme:            "exact",
				Network:           "base",
				Asset:             USDCAddressBase,
				MaxAmountRequired: "5000", // Exceeds client's Base max
			},
			{
				Scheme:            "exact",
				Network:           "base-sepolia",
				Asset:             USDCAddressBaseSepolia,
				MaxAmountRequired: "5000",
			},
		}

		selected, err := handler.selectPaymentMethod(accepts)
		require.NoError(t, err)
		assert.Equal(t, "base-sepolia", selected.Network) // Should skip Base due to max limit
	})
}

func TestMockSigner(t *testing.T) {
	t.Run("DefaultsToBaseSepolia", func(t *testing.T) {
		signer := NewMockSigner("0xTestWallet")
		assert.True(t, signer.SupportsNetwork("base-sepolia"))
		assert.True(t, signer.HasAsset(USDCAddressBaseSepolia, "base-sepolia"))
	})

	t.Run("AcceptsCustomOptions", func(t *testing.T) {
		signer := NewMockSigner("0xTestWallet", AcceptUSDCBase())
		assert.True(t, signer.SupportsNetwork("base"))
		assert.False(t, signer.SupportsNetwork("base-sepolia"))
	})

	t.Run("SignsWithCorrectScheme", func(t *testing.T) {
		signer := NewMockSigner("0xTestWallet", AcceptUSDCBase())

		payment, err := signer.SignPayment(context.Background(), PaymentRequirement{
			Scheme:            "exact",
			Network:           "base",
			Asset:             USDCAddressBase,
			PayTo:             "0xRecipient",
			MaxAmountRequired: "1000",
			MaxTimeoutSeconds: 60,
		})

		require.NoError(t, err)
		assert.Equal(t, "exact", payment.Scheme)
		assert.Equal(t, "base", payment.Network)
	})
}
