using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using x402.Core.Enums;
using x402.Core.Interfaces;

namespace x402.Attributes
{
    /// <summary>
    /// Attribute to specify payment requirements on controller actions or endpoints.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class PaymentRequiredAttribute : ActionFilterAttribute
    {
        /// <summary>
        /// The payment scheme (e.g., "exact").
        /// </summary>
        public PaymentScheme Scheme { get; set; }

        /// <summary>
        /// The maximum amount required in atomic units.
        /// </summary>
        public string MaxAmountRequired { get; set; }

        /// <summary>
        /// The asset symbol (e.g., "USDC").
        /// </summary>
        public string Asset { get; set; }

        /// <summary>
        /// The pay-to wallet address.
        /// </summary>
        public string PayTo { get; set; }

        public int Version { get; set; }


        public string Description { get; set; } = string.Empty;
        public string MimeType { get; set; } = string.Empty;

        public SettlementMode SettlementMode { get; set; } = SettlementMode.Pessimistic;

        /// <summary>
        /// List endpoint with facilitator discovery service when set to true.
        /// </summary>
        public bool Discoverable { get; set; }

        /// <summary>
        /// Creates a payment required attribute with the specified price.
        /// </summary>
        /// <param name="maxAmountRequired"></param>
        /// <param name="asset"></param>
        /// <param name="payTo"></param>
        /// <param name="version"></param>
        /// <param name="scheme"></param>
        public PaymentRequiredAttribute(string maxAmountRequired,
            string asset,
            string payTo,
            int version = 2,
            PaymentScheme scheme = PaymentScheme.Exact)
        {
            MaxAmountRequired = maxAmountRequired;
            Asset = asset;
            PayTo = payTo;
            Version = version;
            Scheme = scheme;
        }

        public override async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<PaymentRequiredAttribute>>();
            var assetInfoProvider = context.HttpContext.RequestServices.GetRequiredService<IAssetInfoProvider>();

            var request = context.HttpContext.Request;
            var fullUrl = $"{request.Scheme}://{request.Host}{request.Path}{request.QueryString}";

            logger.LogDebug("PaymentRequiredAttribute invoked for path {Path}", fullUrl);

            var assetInfo = assetInfoProvider.GetAssetInfo(this.Asset);
            if (assetInfo == null)
            {
                logger.LogWarning("No asset info found for asset {Asset};", this.Asset);
            }



            if (Version == 2)
            {
                var paymentRequirements = new List<x402.Core.Models.v2.PaymentRequirements>
                {
                    new ()
                    {
                        Asset = this.Asset,
                        Amount = this.MaxAmountRequired.ToString(),
                        Network = assetInfo?.Network ?? string.Empty,
                        PayTo = this.PayTo,
                        Scheme = this.Scheme,
                        MaxTimeoutSeconds = 60,
                        Extra = new x402.Core.Models.v2.PaymentRequirementsExtra
                        {
                            Name = assetInfo?.Name ?? string.Empty,
                            Version = assetInfo?.Version ?? string.Empty
                        }
                    }
                };

                var resourceInfo = new x402.Core.Models.v2.ResourceInfo
                {
                    Url = fullUrl,
                    Description = this.Description,
                    MimeType = this.MimeType,
                };

                logger.LogInformation("Built payment requirements for path {Path}", fullUrl);

                var x402Handler = context.HttpContext.RequestServices.GetRequiredService<X402HandlerV2>();
                var x402Result = await x402Handler.HandleX402Async(resourceInfo, paymentRequirements, Discoverable, settlementMode: SettlementMode).ConfigureAwait(false);
                if (!x402Result.CanContinueRequest)
                {
                    logger.LogWarning("Payment not satisfied for path {Path}; stopping execution", fullUrl);
                    return;
                }
            }
            else
            {
                throw new Exception($"Unsupported X402 version: {Version}");
            }

            logger.LogDebug("Payment verified for path {Path}; executing next action", fullUrl);
            await next();
        }


    }
}
