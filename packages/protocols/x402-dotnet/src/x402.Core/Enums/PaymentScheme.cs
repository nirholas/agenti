using System.Text.Json.Serialization;
using x402.Core.JsonConverters;

namespace x402.Core.Enums
{
    [JsonConverter(typeof(LowercaseEnumConverter<PaymentScheme>))]
    public enum PaymentScheme
    {
        Exact
    }
}
