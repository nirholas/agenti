namespace x402.Core.Models.Facilitator
{
    /// <summary>
    /// Response from settlement operation.
    /// </summary>
    public class SettlementResponse
    {
        /// <summary>
        /// Whether the settlement was successful.
        /// </summary>
        public bool Success { get; set; }

        /// <summary>
        /// The transaction hash, if successful.
        /// </summary>
        public string? Transaction { get; set; }

        /// <summary>
        /// Address of the payer's wallet
        /// </summary>
        public string? Payer { get; set; }

        /// <summary>
        /// The network ID, if successful.
        /// </summary>
        public string? Network { get; set; }

        /// <summary>
        /// Error message, if not successful.
        /// </summary>
        public string? ErrorReason { get; set; }
    }
}
