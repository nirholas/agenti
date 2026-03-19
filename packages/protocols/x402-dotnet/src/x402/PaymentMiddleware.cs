using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using x402.Models;

namespace x402
{
    /// <summary>
    /// Middleware that enforces x402 payments on selected paths or endpoints with attributes.
    /// </summary>
    public class PaymentMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<PaymentMiddleware> logger;
        private readonly PaymentMiddlewareOptions paymentMiddlewareOptions;
        private readonly X402HandlerV2 x402HandlerV2;

        /// <summary>
        /// Creates a payment middleware that enforces x402 payments on configured paths or endpoints.
        /// </summary>
        /// <param name="next"></param>
        /// <param name="paymentMiddlewareOptions">Configuration options</param>
        /// <exception cref="ArgumentNullException"></exception>
        public PaymentMiddleware(RequestDelegate next,
            ILogger<PaymentMiddleware> logger,
            X402HandlerV2 x402HandlerV2,
            PaymentMiddlewareOptions paymentMiddlewareOptions)
        {
            _next = next ?? throw new ArgumentNullException(nameof(next));
            this.logger = logger;
            this.paymentMiddlewareOptions = paymentMiddlewareOptions;
            this.x402HandlerV2 = x402HandlerV2;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            string protectedPath = (context.Request.Path.Value ?? string.Empty).ToLowerInvariant();
            string protectedPathAndQuery = (context.Request.Path.Value + context.Request.QueryString.Value).ToLowerInvariant();
            var resourceFullUrl = $"{context.Request.Scheme}://{context.Request.Host}{context.Request.Path}{context.Request.QueryString}";
            logger.LogDebug("PaymentMiddleware invoked for path {Path}", resourceFullUrl);

            var paymentConfig = paymentMiddlewareOptions.PaymentRequirements
                .Where(x => x.Key == protectedPath && !x.Value.EnableQueryStringMatching
                            || x.Key == protectedPathAndQuery && x.Value.EnableQueryStringMatching)
                    .Select(x => x.Value)
                .FirstOrDefault();

            if (paymentConfig == null)
            {
                logger.LogDebug("No payment required for path {Path}; continuing pipeline", resourceFullUrl);
                await _next(context);
                return;
            }

            logger.LogInformation("Enforcing x402 payment for path {Path}", resourceFullUrl);

            if (paymentConfig.Version == 2)
            {
                var x402Result = await x402HandlerV2.HandleX402Async(paymentConfig.PaymentRequirements, settlementMode: paymentMiddlewareOptions.SettlementMode);
                if (!x402Result.CanContinueRequest)
                {
                    logger.LogWarning("Payment not satisfied for path {Path}; responding with 402/500 already handled", resourceFullUrl);
                    return;
                }
            }
            else
            {
                throw new Exception($"Unsupported x402 version {paymentConfig.Version} for path {resourceFullUrl}");
            }

            //Payment verified, continue to next middleware
            logger.LogDebug("Payment verified for path {Path}; continuing to next middleware", resourceFullUrl);
            await _next(context);
        }
    }
}
