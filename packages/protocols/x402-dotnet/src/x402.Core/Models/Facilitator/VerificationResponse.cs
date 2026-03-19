namespace x402.Core.Models.Facilitator
{
    /// <summary>
    /// Response from verification operation.
    /// </summary>
    public class VerificationResponse
    {
        /// <summary>
        /// Whether the payment is valid.
        /// </summary>
        public bool IsValid { get; set; }

        /// <summary>
        /// Reason if invalid.
        /// </summary>
        public string? InvalidReason { get; set; }

        public string? Payer { get; set; }

    }
}
