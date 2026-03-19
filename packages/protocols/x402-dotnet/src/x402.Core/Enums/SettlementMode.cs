using System.Text.Json.Serialization;
using x402.Core.JsonConverters;

namespace x402.Core.Enums
{
    [JsonConverter(typeof(LowercaseEnumConverter<SettlementMode>))]
    public enum SettlementMode
    {
        /// <summary>
        /// Pessimistic settlement mode: request is handled only after settlement is confirmed.
        /// </summary>
        Pessimistic,

        /// <summary>
        /// Optimistic settlement mode: request is handled immediately after verify succeeded, without waiting for settlement confirmation.
        /// </summary>
        Optimistic,

        /// <summary>
        /// Use this mode to skip settlement entirely (for testing or scenarios where settlement is handled externally).
        /// </summary>
        DoNotSettle
    }
}


