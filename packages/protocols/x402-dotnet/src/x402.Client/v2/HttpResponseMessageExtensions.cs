using System.Text;
using System.Text.Json;
using x402.Core.Models.Responses;

namespace x402.Client.v2
{
    public static class HttpResponseMessageExtensions
    {
        public static readonly string PaymentResponseHeaderV2 = "PAYMENT-RESPONSE";

        public static SettlementResponseHeader? ReadSettlementResponseHeader(this HttpResponseMessage response, JsonSerializerOptions? jsonOptions = null)
        {
            IEnumerable<string>? values = null;

            if (response.Headers.TryGetValues(PaymentResponseHeaderV2, out var v2Value))
            {
                values = v2Value;
            }

            if (values == null)
                return null;

            var base64 = values.FirstOrDefault();
            if (string.IsNullOrEmpty(base64))
                return null;

            try
            {
                jsonOptions ??= JsonSerializerOptions.Web;

                string json = Encoding.UTF8.GetString(Convert.FromBase64String(base64));
                return JsonSerializer.Deserialize<SettlementResponseHeader>(json, jsonOptions);
            }
            catch
            {
                return null;
            }
        }
    }
}
