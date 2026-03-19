using Microsoft.AspNetCore.Http;
using x402.Core.Models.v2;

namespace x402
{
    public static class HttpContextExtensions
    {
        public static X402ProcessingResult? GetX402ResultV2(this HttpContext context)
        {
            if (context == null)
            {
                throw new ArgumentNullException(nameof(context));
            }

            if (context.Items.TryGetValue(X402HandlerV2.X402ResultKey, out var result) && result is X402ProcessingResult x402Result)
            {
                return x402Result;
            }

            return null;
        }
    }
}
