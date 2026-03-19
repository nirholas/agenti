using Microsoft.AspNetCore.Mvc;
using x402.Attributes;
using x402.Core.Enums;
using x402.Core.Models;
using x402.SampleWeb.Models;

namespace x402.SampleWeb.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class SolanaResourceController : ControllerBase
    {
        private readonly X402HandlerV2 x402Handler;

        public SolanaResourceController(X402HandlerV2 x402Handler)
        {
            this.x402Handler = x402Handler;
        }



        [HttpGet]
        [Route("protected")]
        [PaymentRequired("1000", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "FvaJmaAob2woFwxmvHroKXr8WRqUwEY5cWMCKoES2Bbu", Discoverable = true, SettlementMode = SettlementMode.Pessimistic)]
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

        [HttpPost]
        [Route("protected")]
        [PaymentRequired("1000", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "FvaJmaAob2woFwxmvHroKXr8WRqUwEY5cWMCKoES2Bbu", Discoverable = true)]
        public SampleResult ProtectedPost([FromBody] SampleRequest req)
        {
            return new SampleResult { Title = "Success! Protected by PaymentRequired Attribute. Please pay with Solana." };
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
                        Description = "This Solana resource is protected dynamically",
                    },
                    Accepts = new List<PaymentRequirementsBasic>
                    {
                        new PaymentRequirementsBasic
                        {
                            Asset = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                            Amount = amount,
                            PayTo = "FvaJmaAob2woFwxmvHroKXr8WRqUwEY5cWMCKoES2Bbu",
                        }
                    },
                    Discoverable = true
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
