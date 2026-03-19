using x402.Core.Interfaces;
using x402.Core.Models;

namespace x402.Core
{
    public class AssetInfoProvider : IAssetInfoProvider
    {
        protected Dictionary<string, string> Aliases { get; } = new();
        protected List<AssetInfo> AssetInfos { get; } = new()
        {
            new AssetInfo
            {
                ChainId = 84532,
                Network = "eip155:84532", //base-sepolia
                ContractAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC
                Name = "USDC",
                Version = "2",
                NetworkType = NetworkType.EVM
            },
            new AssetInfo
            {
                ChainId = 8453,
                Network = "eip155:8453", //base
                ContractAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USD Coin
                Name = "USD Coin",
                Version = "2",
                NetworkType = NetworkType.EVM
            },
            new AssetInfo
            {
                ChainId = 43113,
                Network = "eip155:43113", //avalanche-fuji
                ContractAddress = "0x5425890298aed601595a70AB815c96711a31Bc65", // USD Coin
                Name = "USD Coin",
                Version = "2",
                NetworkType = NetworkType.EVM
            },
            new AssetInfo
            {
                ChainId = 43114,
                Network = "eip155:avalanche",
                ContractAddress = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // USDC
                Name = "USDC",
                Version = "2",
                NetworkType = NetworkType.EVM
            },
            new AssetInfo
            {
                Network = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", //solana devnet
                ContractAddress = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // USDC
                Name = "USDC",
                Version = "1",
                NetworkType = NetworkType.SVM
            },
            new AssetInfo
            {
                Network = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", //solana mainnet
                ContractAddress = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
                Name = "USDC",
                Version = "1",
               NetworkType = NetworkType.SVM
            },
            //new AssetInfo
            //{
            //    Network = "solana-mainnet-beta",
            //    ContractAddress = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
            //    Name = "USDC",
            //    Version = "1",
            //    NetworkType = NetworkType.SVM
            //},
            new AssetInfo
            {
                ChainId = 137,
                Network = "eip155:137", //polygon
                ContractAddress = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // USD Coin
                Name = "USD Coin",
                Version = "2",
                NetworkType = NetworkType.EVM
            },
            new AssetInfo
            {
                ChainId = 80002,
                Network = "eip155:80002", //polygon-amoy
                ContractAddress = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", // USDC
                Name = "USDC",
                Version = "2",
                NetworkType = NetworkType.EVM
            },
            new AssetInfo
            {
                ChainId = 4689,
                Network = "eip155:4689", //iotex
                ContractAddress = "0x3b2bf2b523f54c4e454f08aa286d03115aff326c", // USDC.e (bridged) - Native USDC deployment pending; use bridged version
                Name = "USD Coin",
                Version = "1",
                NetworkType = NetworkType.EVM
            },
            new AssetInfo
            {
                ChainId = 3338,
                Network = "eip155:3338", //peaq
                ContractAddress = "0xbbA60da06c2c5424f03f7434542280FCAd453d10", // USDC (bridged standard)
                Name = "USDC",
                Version = "2"
            },
            new AssetInfo
            {
                ChainId = 1329,
                Network = "eip155:1329", //sei
                ContractAddress = "0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392", // Native USDC
                Name = "USDC",
                Version = "2",
                NetworkType = NetworkType.EVM
            },
            new AssetInfo
            {
                ChainId = 1328,
                Network = "eip155:1328", //sei-testnet
                ContractAddress = "0x4fCF1784B31630811181f670Aea7A7bEF803eaED", // Native USDC
                Name = "USDC",
                Version = "2",
                NetworkType = NetworkType.EVM
            },
            //new AssetInfo
            //{
            //    ChainId = 2741,
            //    Network = "eip155:2741", //abstract
            //    ContractAddress = "0x84a71ccd554cc1b02749b35d22f684cc8ec987e1", // USDC (bridged; native pending)
            //    Name = "USDC",
            //    Version = "1",
            //    NetworkType = NetworkType.EVM
            //},
            new AssetInfo
            {
                ChainId = 324705682,
                Network = "eip155:324705682",
                ContractAddress = "0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4", // USDC.e (bridged)
                Name = "USDC",
                Version = "1",
                NetworkType = NetworkType.EVM
            }
        };

        public void AddAlias(string alias, string contractAddress)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(alias);
            ArgumentException.ThrowIfNullOrWhiteSpace(contractAddress);

            if (GetAssetInfo(contractAddress) is null)
            {
                throw new ArgumentException(
                    $"Cannot create alias '{alias}' for unknown contract address '{contractAddress}'.",
                    nameof(contractAddress)
                );
            }

            Aliases[alias] = contractAddress;
        }

        public void AddAssetInfo(AssetInfo assetInfo)
        {
            var existing = GetAssetInfo(assetInfo.ContractAddress);
            if (existing != null)
            {
                AssetInfos.Remove(existing);
            }
            AssetInfos.Add(assetInfo);
        }

        public virtual AssetInfo? GetAssetInfo(string contractAddress)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(contractAddress);

            // Resolve alias first, if it exists
            if (Aliases.TryGetValue(contractAddress, out var aliasedContract))
            {
                contractAddress = aliasedContract;
            }

            return AssetInfos.FirstOrDefault(info =>
                string.Equals(info.ContractAddress, contractAddress, StringComparison.OrdinalIgnoreCase));
        }

        public virtual List<AssetInfo> GetAssetInfoByNetwork(string network)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(network);

            return AssetInfos.Where(info =>
                string.Equals(info.Network, network, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        public virtual List<AssetInfo> GetAll()
        {
            return AssetInfos;
        }
    }
}
