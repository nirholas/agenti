namespace x402.Core.Models.v2
{
    /// <summary>
    /// Response for 402 Payment Required.
    /// </summary>
    public class PaymentRequiredResponse
    {
        /// <summary>
        /// The X402 version.
        /// </summary>
        public int X402Version { get; set; }

        public required ResourceInfo Resource { get; set; }

        /// <summary>
        /// List of accepted payment requirements.
        /// </summary>
        public List<PaymentRequirements> Accepts { get; set; } = new List<PaymentRequirements>();

        /// <summary>
        /// Error message, if any.
        /// </summary>
        public string? Error { get; set; }

        public Dictionary<string, ExtensionData>? Extensions { get; set; }
    }

    public class ResourceInfo
    {
        /// <summary>
        /// The resource path.
        /// </summary>
        public string Url { get; set; } = string.Empty;

        /// <summary>
        /// Human-readable description of the resource
        /// </summary>
        public string Description { get; set; } = string.Empty;

        /// <summary>
        /// Gets or sets the website URL associated with the entity.
        /// </summary>
        public string Website { get; set; } = string.Empty;

        /// <summary>
        /// The MIME type of the resource.
        /// </summary>
        public string MimeType { get; set; } = string.Empty;
    }

    public class ExtensionData
    {
        public object? Info { get; set; }
        public object? Schema { get; set; }
    }
}
