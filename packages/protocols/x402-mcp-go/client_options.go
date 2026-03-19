package x402

import "math/big"

// USDC contract addresses (lowercase for consistency)
const (
	// EVM Mainnet USDC addresses
	USDCAddressBase      = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" // Base mainnet
	USDCAddressPolygon   = "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359" // Polygon mainnet
	USDCAddressAvalanche = "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e" // Avalanche C-Chain

	// EVM Testnet USDC addresses
	USDCAddressBaseSepolia   = "0x036cbd53842c5426634e7929541ec2318f3dcf7e" // Base Sepolia
	USDCAddressPolygonAmoy   = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582" // Polygon Amoy
	USDCAddressAvalancheFuji = "0x5425890298aed601595a70ab815c96711a31bc65" // Avalanche Fuji

	// Solana USDC mint addresses
	USDCMintSolana       = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" // Solana mainnet
	USDCMintSolanaDevnet = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" // Solana devnet
)

// Helper functions for common client payment options

// AcceptUSDCBase creates a client payment option for USDC on Base mainnet
func AcceptUSDCBase() ClientPaymentOption {
	return ClientPaymentOption{
		PaymentRequirement: PaymentRequirement{
			Scheme:  "exact",
			Network: "base",
			Asset:   USDCAddressBase,
			Extra: map[string]string{
				"name":    "USD Coin",
				"version": "2",
			},
		},
		Priority: 1,                // Default high priority for Base (cheap & fast)
		ChainID:  big.NewInt(8453), // Base mainnet chain ID
	}
}

// AcceptUSDCBaseSepolia creates a client payment option for USDC on Base Sepolia testnet
func AcceptUSDCBaseSepolia() ClientPaymentOption {
	return ClientPaymentOption{
		PaymentRequirement: PaymentRequirement{
			Scheme:  "exact",
			Network: "base-sepolia",
			Asset:   USDCAddressBaseSepolia,
			Extra: map[string]string{
				"name":    "USDC",
				"version": "2",
			},
		},
		Priority: 1,
		ChainID:  big.NewInt(84532), // Base Sepolia chain ID
	}
}

// Fluent API for customization

// WithPriority sets the priority for this payment option
func (opt ClientPaymentOption) WithPriority(p int) ClientPaymentOption {
	opt.Priority = p
	return opt
}

// WithMaxAmount sets the maximum amount the client is willing to pay with this option
func (opt ClientPaymentOption) WithMaxAmount(amount string) ClientPaymentOption {
	opt.MaxAmount = amount
	return opt
}

// WithMinBalance sets the minimum balance to maintain (won't use if balance would fall below)
func (opt ClientPaymentOption) WithMinBalance(amount string) ClientPaymentOption {
	opt.MinBalance = amount
	return opt
}

// AcceptUSDCPolygon creates a client payment option for USDC on Polygon mainnet
func AcceptUSDCPolygon() ClientPaymentOption {
	return ClientPaymentOption{
		PaymentRequirement: PaymentRequirement{
			Scheme:  "exact",
			Network: "polygon",
			Asset:   USDCAddressPolygon,
			Extra: map[string]string{
				"name":    "USD Coin",
				"version": "2",
			},
		},
		Priority: 2,               // Medium priority
		ChainID:  big.NewInt(137), // Polygon mainnet chain ID
	}
}

// AcceptUSDCPolygonAmoy creates a client payment option for USDC on Polygon Amoy testnet
func AcceptUSDCPolygonAmoy() ClientPaymentOption {
	return ClientPaymentOption{
		PaymentRequirement: PaymentRequirement{
			Scheme:  "exact",
			Network: "polygon-amoy",
			Asset:   USDCAddressPolygonAmoy,
			Extra: map[string]string{
				"name":    "USDC",
				"version": "2",
			},
		},
		Priority: 2,
		ChainID:  big.NewInt(80002), // Polygon Amoy testnet chain ID
	}
}

// AcceptUSDCAvalanche creates a client payment option for USDC on Avalanche C-Chain mainnet
func AcceptUSDCAvalanche() ClientPaymentOption {
	return ClientPaymentOption{
		PaymentRequirement: PaymentRequirement{
			Scheme:  "exact",
			Network: "avalanche",
			Asset:   USDCAddressAvalanche,
			Extra: map[string]string{
				"name":    "USD Coin",
				"version": "2",
			},
		},
		Priority: 2,                 // Medium priority
		ChainID:  big.NewInt(43114), // Avalanche C-Chain mainnet chain ID
	}
}

// AcceptUSDCAvalancheFuji creates a client payment option for USDC on Avalanche Fuji testnet
func AcceptUSDCAvalancheFuji() ClientPaymentOption {
	return ClientPaymentOption{
		PaymentRequirement: PaymentRequirement{
			Scheme:  "exact",
			Network: "avalanche-fuji",
			Asset:   USDCAddressAvalancheFuji,
			Extra: map[string]string{
				"name":    "USDC",
				"version": "2",
			},
		},
		Priority: 2,
		ChainID:  big.NewInt(43113), // Avalanche Fuji testnet chain ID
	}
}

// AcceptUSDCSolana creates a client payment option for USDC on Solana mainnet
func AcceptUSDCSolana() ClientPaymentOption {
	return ClientPaymentOption{
		PaymentRequirement: PaymentRequirement{
			Scheme:  "exact",
			Network: "solana",
			Asset:   USDCMintSolana,
			Extra: map[string]string{
				"name":     "USD Coin",
				"decimals": "6",
			},
		},
		Priority:  2,
		NetworkID: "mainnet-beta",
	}
}

// AcceptUSDCSolanaDevnet creates a client payment option for USDC on Solana devnet
func AcceptUSDCSolanaDevnet() ClientPaymentOption {
	return ClientPaymentOption{
		PaymentRequirement: PaymentRequirement{
			Scheme:  "exact",
			Network: "solana-devnet",
			Asset:   USDCMintSolanaDevnet,
			Extra: map[string]string{
				"name":     "USDC (Devnet)",
				"decimals": "6",
			},
		},
		Priority:  2,
		NetworkID: "devnet",
	}
}
