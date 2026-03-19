using System.Text.Json;
using System.Text.Json.Serialization;
using x402.Core.Enums;

namespace x402.Core.Models.v2
{
    /// <summary>
    /// Represents the requirements for a payment.
    /// </summary>
    public class PaymentRequirements
    {
        /// <summary>
        /// The payment scheme (e.g., "exact").
        /// </summary>
        public PaymentScheme Scheme { get; set; }

        /// <summary>
        /// The network identifier (e.g., "eip155:84532").
        /// </summary>
        public required string Network { get; set; }

        /// <summary>
        /// The maximum amount required in atomic units.
        /// </summary>
        public required string Amount { get; set; }

        /// <summary>
        /// The asset contract address
        /// </summary>
        public required string Asset { get; set; }

        /// <summary>
        /// The pay-to wallet address.
        /// </summary>
        public required string PayTo { get; set; }

        /// <summary>
        /// The maximum timeout in seconds.
        /// </summary>
        public int MaxTimeoutSeconds { get; set; } = 60;

        /// <summary>
        /// Scheme-specific additional information
        /// </summary>
        public PaymentRequirementsExtra? Extra { get; set; }

    }

    public class PaymentRequirementsExtra
    {
        public string? Name { get; set; }
        public string? Version { get; set; }
    }

    public class OutputSchema
    {
        public Input? Input { get; set; } = new();
        public object? Output { get; set; }

        [JsonExtensionData]
        public Dictionary<string, JsonElement> ExtensionData { get; set; } = new();
    }

    public class Input
    {
        public bool Discoverable { get; set; } = true;
        public string Type { get; set; } = "http";
        public string? Method { get; set; }
        public string? BodyType { get; set; }
        public Dictionary<string, object>? QueryParams { get; set; }
        public Dictionary<string, object>? BodyFields { get; set; }
        public Dictionary<string, object>? HeaderFields { get; set; }

        [JsonExtensionData]
        public Dictionary<string, JsonElement> ExtensionData { get; set; } = new();

    }

    public class FieldDefenition
    {
        public string? Type { get; set; }
        public bool Required { get; set; }
        public string? Description { get; set; }
        public List<string>? Enum { get; set; }

        public Dictionary<string, FieldDefenition>? Properties { get; set; }
    }
}
