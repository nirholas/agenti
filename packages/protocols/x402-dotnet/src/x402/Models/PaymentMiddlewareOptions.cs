using x402.Core.Enums;

namespace x402.Models
{
    public class PaymentMiddlewareOptions
    {
        /// <summary>
        /// Key is the resource path (e.g., "/api/data"), value is the payment requirements for that resource.
        /// </summary>
        public Dictionary<string, PaymentRequirementsConfig> PaymentRequirements { get; set; } = new();

        public SettlementMode SettlementMode { get; set; } = SettlementMode.Pessimistic;
    }
}
