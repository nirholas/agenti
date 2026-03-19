namespace x402.Coinbase.Models
{
    public class CoinbaseOptions
    {
        public string BaseUrl { get; set; } = "https://api.cdp.coinbase.com/platform/v2/x402/";
        public required string ApiKeyId { get; set; }
        public required string ApiKeySecret { get; set; }
    }
}
