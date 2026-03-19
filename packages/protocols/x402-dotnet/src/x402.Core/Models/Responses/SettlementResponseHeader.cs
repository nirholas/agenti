namespace x402.Core.Models.Responses
{

    /// <summary>
    /// Header for settlement response.
    /// </summary>
    public class SettlementResponseHeader
    {
        /// <summary>
        /// Success indicator.
        /// </summary>
        public bool Success { get; }

        /// <summary>
        /// Transaction hash.
        /// </summary>
        public string Transaction { get; }

        /// <summary>
        /// Network ID.
        /// </summary>
        public string Network { get; }

        /// <summary>
        /// Payer address.
        /// </summary>
        public string? Payer { get; }

        public SettlementResponseHeader(bool success, string transaction, string network, string? payer)
        {
            Success = success;
            Transaction = transaction;
            Network = network;
            Payer = payer;
        }
    }
}
