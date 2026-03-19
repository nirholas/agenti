namespace x402.Core.Models
{
    public record AssetInfo
    {
        public ulong ChainId { get; init; }
        public required string Network { get; init; }
        public required string ContractAddress { get; init; } = string.Empty;

        public string Name { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
        public NetworkType NetworkType { get; set; }
    }

    public enum NetworkType
    {
        Other,
        /// <summary> Ethereum Virtual Machine </summary>
        EVM,
        /// <summary> Solana Virtual Machine </summary>
        SVM
    }
}
