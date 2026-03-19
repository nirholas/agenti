using x402.Core.Models.v2;

namespace x402.Client.v2
{
    public static class HttpRequestMessageExtensions
    {
        public const string PaymentHeaderV2 = "PAYMENT-SIGNATURE";
        public static void AddPaymentHeader(this HttpRequestMessage request, PaymentPayloadHeader header)
        {
            request.Headers.Add(PaymentHeaderV2, header.ToBase64Header());
        }
    }
}
