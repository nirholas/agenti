using Microsoft.AspNetCore.Mvc;
using x402.Attributes;
using x402.BlazorSample.Server.Models;
using x402.Core.Enums;
using x402.Core.Models;

namespace x402.BlazorSample.Server.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class ResourceController : ControllerBase
    {
        private readonly X402HandlerV2 x402Handler;

        public ResourceController(X402HandlerV2 x402Handler)
        {
            this.x402Handler = x402Handler;
        }

        [HttpGet]
        [Route("free")]
        public SampleResult Free()
        {
            return new SampleResult { Title = "Free Resource" };
        }

        [HttpGet]
        [Route("protected")]
        [PaymentRequired("1000", "0x036CbD53842c5426634e7929541eC2318f3dCF7e", "0x7D95514aEd9f13Aa89C8e5Ed9c29D08E8E9BfA37", Discoverable = true, SettlementMode = SettlementMode.Pessimistic)]
        public ActionResult<SampleResult> Protected()
        {
            // Optional: Retrieve the X402 result from HttpContext
            var x402Result = HttpContext.GetX402ResultV2();
            if (x402Result == null)
            {
                // Handle unexpected case (should not happen since we just called HandleX402Async)
                return StatusCode(500, new { error = "X402 result not found" });
            }

            if (!x402Result.CanContinueRequest)
            {
                // Response is already set to 402 or 500 by X402Handler, so just return
                return new EmptyResult();
            }

            return new SampleResult { Title = $"Success! Protected by PaymentRequired Attribute. Tx: {x402Result.SettlementResponse?.Transaction}" };
        }

        [HttpGet]
        [Route("dynamic")]
        public async Task<SampleResult?> Dynamic(string amount)
        {
            var x402Result = await x402Handler.HandleX402Async(
                new PaymentRequiredInfo()
                {
                    Resource = new ResourceInfoBasic
                    {
                        Description = "This resource is protected dynamically",

                        // Overwrite so that it does not contain the query string
                        Resource = $"{HttpContext.Request.Scheme}://{HttpContext.Request.Host}{HttpContext.Request.Path}/test".ToLowerInvariant()
                    },
                    Accepts = new List<PaymentRequirementsBasic>
                    {
                        new PaymentRequirementsBasic
                        {
                            Asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                            Amount = amount,
                            PayTo = "0x7D95514aEd9f13Aa89C8e5Ed9c29D08E8E9BfA37",
                        }
                    },
                    Discoverable = true,
                },
                SettlementMode.Pessimistic,
                onSettlement: (context, response, ex) =>
                {
                    Console.WriteLine("Settlement completed: " + response?.Success + ex?.Message);
                    return Task.CompletedTask;
                });

            if (!x402Result.CanContinueRequest)
            {
                return null;
            }

            return new SampleResult { Title = $"Success! Dynamic protected for {amount}, paid by: {x402Result.VerificationResponse?.Payer}. Tx: {x402Result.SettlementResponse?.Transaction}" };
        }

    }
}
