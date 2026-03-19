using Microsoft.AspNetCore.Builder;
using x402.Models;

namespace x402
{
    public static class PaymentMiddlewareExtensions
    {
        /// <summary>
        /// Creates a payment middleware that enforces x402 payments on configured paths or endpoints.
        /// </summary>
        /// <param name="builder"></param>
        /// <param name="paymentMiddlewareOptions"></param>
        /// <returns></returns>
        public static IApplicationBuilder UsePaymentMiddleware(
            this IApplicationBuilder builder,
            PaymentMiddlewareOptions paymentMiddlewareOptions)
        {
            return builder.UseMiddleware<PaymentMiddleware>(paymentMiddlewareOptions);
        }
    }
}
