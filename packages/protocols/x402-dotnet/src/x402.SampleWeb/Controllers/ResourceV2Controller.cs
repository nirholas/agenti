using Microsoft.AspNetCore.Mvc;
using x402.Attributes;
using x402.Core.Enums;
using x402.Core.Models;
using x402.Core.Models.v2;
using x402.SampleWeb.Models;

namespace x402.SampleWeb.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class ResourceV2Controller : ControllerBase
    {
        private readonly X402HandlerV2 x402Handler;

        public ResourceV2Controller(X402HandlerV2 x402Handler)
        {
            this.x402Handler = x402Handler;
        }

        /// <summary>
        /// Protected by Middleware
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        [Route("middleware")]
        public SampleResult Middleware()
        {
            return new SampleResult { Title = "Success! Protected by middleware" };
        }

        [HttpGet]
        [Route("free")]
        public SampleResult Free()
        {
            return new SampleResult { Title = "Free Resource" };
        }

        [HttpGet]
        [Route("protected")]
        [PaymentRequired("1000", "0x036CbD53842c5426634e7929541eC2318f3dCF7e", "0x7D95514aEd9f13Aa89C8e5Ed9c29D08E8E9BfA37", Discoverable = true, Version = 2, SettlementMode = SettlementMode.Pessimistic)]
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
        [PaymentRequired("1000", "0x036CbD53842c5426634e7929541eC2318f3dCF7e", "0x7D95514aEd9f13Aa89C8e5Ed9c29D08E8E9BfA37", Discoverable = true, Version = 2)]
        public SampleResult ProtectedPost([FromBody] SampleRequest req)
        {
            return new SampleResult { Title = "Success! Protected by PaymentRequired Attribute" };
        }

        [HttpGet]
        [Route("dynamic")]
        public async Task<SampleResult?> Dynamic(string amount)
        {
            var x402Result = await x402Handler.HandleX402Async(
                new PaymentRequiredInfo
                {
                    Resource = new ResourceInfoBasic
                    {
                        Description = "Dynamic payment",

                        // Overwrite so that it does not contain the query string
                        Resource = $"{HttpContext.Request.Scheme}://{HttpContext.Request.Host}{HttpContext.Request.Path}".ToLowerInvariant()
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
                    Discoverable = true
                },
                SettlementMode.Pessimistic,
                onSettlement: (context, response, ex) =>
                {
                    Console.WriteLine("Settlement completed: " + response?.Success + ex?.Message);
                    return Task.CompletedTask;
                },
                onSetOutputSchema: (context, reqs, schema) =>
                {
                    schema.Input ??= new();

                    //Manually set the input schema
                    schema.Input.BodyFields = new Dictionary<string, object>
                    {
                        {
                            nameof(amount),
                            new FieldDefenition
                            {
                                Required = true,
                                Description = "Amount to send",
                                Type = "string"
                            }
                        }
                    };

                    return schema;
                });

            if (!x402Result.CanContinueRequest)
            {
                return null;
            }

            return new SampleResult { Title = $"Success! Dynamic protected for {amount}, paid by: {x402Result.VerificationResponse?.Payer}. Tx: {x402Result.SettlementResponse?.Transaction}" };
        }

        [HttpPost]
        [Route("send-msg")]
        public async Task<SampleResult?> SendMsg([FromBody] SampleRequest req)
        {
            var x402Result = await x402Handler.HandleX402Async(
                new PaymentRequiredInfo
                {
                    Resource = new ResourceInfoBasic
                    {
                        Description = "Send a message",

                    },
                    Accepts = new List<PaymentRequirementsBasic>
                    {
                        new PaymentRequirementsBasic
                        {
                            Asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                            Amount = "1000",
                            PayTo = "0x7D95514aEd9f13Aa89C8e5Ed9c29D08E8E9BfA37",
                        }
                    },
                    Discoverable = true
                },
                SettlementMode.Pessimistic,
                onSetOutputSchema: (context, reqs, schema) =>
                {
                    schema.Input ??= new();

                    //Manually set the input schema
                    schema.Input.BodyFields = new Dictionary<string, object>
                    {
                        {
                            nameof(req.Value),
                            new FieldDefenition
                            {
                                Required = true,
                                Description = "Message to send",
                                Type = "string"
                            }
                        }
                    };

                    return schema;
                });

            if (!x402Result.CanContinueRequest)
            {
                return null;
            }

            return new SampleResult { Title = $"Success! Msg: {req.Value}, paid by: {x402Result.VerificationResponse?.Payer}" };
        }

    }
}
