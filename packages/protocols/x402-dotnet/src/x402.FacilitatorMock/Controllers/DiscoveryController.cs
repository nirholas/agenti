using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using x402.Core.Models.v2.Facilitator;

namespace x402.FacilitatorMock.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class DiscoveryController : ControllerBase
    {
        [HttpGet]
        [Route("resources")]
        [SwaggerIgnore]
        public DiscoveryResponse Discovery([FromQuery] string? type = null, [FromQuery] int limit = 20, [FromQuery] int offset = 0)
        {
            return new()
            {
                Pagination = new()
                {
                    Limit = limit,
                    Offset = offset,
                    Total = 1
                },
                Items = new()
            {
                new DiscoveryItem
                {
                    LastUpdated = DateTimeOffset.UtcNow,
                    Resource = "/resource/middleware",
                    Type = "http",
                    Accepts = new List<DiscoveryPaymentRequirements>
                    {
                        new DiscoveryPaymentRequirements
                        {
                            Asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                            Amount = "1000",
                            Network = "eip155:84532",
                            PayTo = "0x7D95514aEd9f13Aa89C8e5Ed9c29D08E8E9BfA37"
                        }
                    }
                }
            }
            };
        }
    }
}
