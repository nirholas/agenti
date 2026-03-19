using x402.Core.Models;

namespace x402.Models
{
    /// <summary>
    /// Represents the requirements for a payment.
    /// </summary>
    public class PaymentRequirementsConfig
    {
        /// <summary>
        /// The payment scheme (e.g., "exact").
        /// </summary>
        public required PaymentRequiredInfo PaymentRequirements { get; set; }


        /// <summary>
        /// Set to true to enable matching routes based on query string parameters.
        /// </summary>
        public bool EnableQueryStringMatching { get; set; }

        /// <summary>
        /// x402 version
        /// </summary>
        public int Version { get; set; } = 2;

    }
}
