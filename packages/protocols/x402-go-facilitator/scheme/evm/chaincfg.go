package evm

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
)

func GetChainName(chainID *big.Int) string {
	if chainID == nil {
		return ""
	}
	return chainName[int(chainID.Int64())]
}

var chainName = map[int]string{
	1:        "ethereum",
	11155111: "sepolia",
	8453:     "base",
	84532:    "base-sepolia",
	10:       "optimism",
	11155420: "optimism-sepolia",
	42161:    "arbitrum",
	421614:   "arbitrum-sepolia",
}

type ChainInfo struct {
	ChainID        *big.Int
	DefaultUrl     string
	TokenContracts map[string]DomainConfig
}

func GetChainInfo(chain string) *ChainInfo {
	chainInfo, ok := chainInfo[chain]
	if !ok {
		return nil
	}
	return &chainInfo
}

func GetChainID(chain string) *big.Int {
	chainInfo, ok := chainInfo[chain]
	if !ok {
		return nil
	}
	return chainInfo.ChainID
}

func GetDomainConfig(chain, token string) *DomainConfig {
	chainInfo, ok := chainInfo[chain]
	if !ok {
		return nil
	}
	domainConfig, ok := chainInfo.TokenContracts[token]
	if !ok {
		return nil
	}
	return &domainConfig
}

var chainInfo = map[string]ChainInfo{
	"ethereum": {
		ChainID: big.NewInt(1),
		TokenContracts: map[string]DomainConfig{
			"USDC": {
				Name:              "USD Coin",
				Version:           "2",
				ChainID:           big.NewInt(1),
				VerifyingContract: common.HexToAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
			},
		},
	},
	"base": {
		ChainID:    big.NewInt(8453),
		DefaultUrl: "https://mainnet.base.org",
		TokenContracts: map[string]DomainConfig{
			"USDC": {
				Name:              "USD Coin",
				Version:           "2",
				ChainID:           big.NewInt(8453),
				VerifyingContract: common.HexToAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
			},
		},
	},
	"base-sepolia": {
		ChainID:    big.NewInt(84532),
		DefaultUrl: "https://sepolia.base.org",
		TokenContracts: map[string]DomainConfig{
			"USDC": {
				Name:              "USDC",
				Version:           "2",
				ChainID:           big.NewInt(84532),
				VerifyingContract: common.HexToAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e"),
			},
		},
	},
	"arbitrum": {
		ChainID:    big.NewInt(42161),
		DefaultUrl: "https://arb1.arbitrum.io/rpc",
		TokenContracts: map[string]DomainConfig{
			"USDC": {
				Name:              "USD Coin",
				Version:           "2",
				ChainID:           big.NewInt(42161),
				VerifyingContract: common.HexToAddress("0xaf88d065e77c8cC2239327C5EDb3A432268e5831"),
			},
		},
	},
	"arbitrum-sepolia": {
		ChainID:    big.NewInt(421614),
		DefaultUrl: "https://sepolia-rollup.arbitrum.io/rpc",
		TokenContracts: map[string]DomainConfig{
			"USDC": {
				Name:              "USDC",
				Version:           "2",
				ChainID:           big.NewInt(421614),
				VerifyingContract: common.HexToAddress("0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"),
			},
		},
	},
}
