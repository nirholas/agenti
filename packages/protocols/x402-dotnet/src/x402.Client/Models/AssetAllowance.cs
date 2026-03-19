namespace x402.Client.Models
{
    public record AssetAllowance
    {
        public required long TotalAllowance { get; set; }
        public required long MaxPerRequestAllowance { get; set; }

        public required string Asset { get; set; }
    }
}
