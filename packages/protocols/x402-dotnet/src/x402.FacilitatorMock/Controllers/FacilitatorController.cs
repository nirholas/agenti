using Microsoft.AspNetCore.Mvc;
using x402.Core.Models.Facilitator;
using x402.Core.Models.v2.Facilitator;

namespace x402.FacilitatorMock.Controllers;

[ApiController]
[Route("/")]
public class FacilitatorController : ControllerBase
{
    private readonly ILogger<FacilitatorController> _logger;

    public FacilitatorController(ILogger<FacilitatorController> logger)
    {
        _logger = logger;
    }

    [HttpPost]
    [Route("verify")]
    public VerificationResponse Verify([FromBody] FacilitatorRequest req)
    {
        if (req.X402Version != 2)
            return VerificationError(FacilitatorErrorCodes.InvalidX402Version);

        var payer = req.PaymentPayload.ExtractPayerFromPayload();

        return new()
        {
            IsValid = true,
            Payer = payer
        };
    }

    private VerificationResponse VerificationError(string invalidX402Version)
    {
        return new()
        {
            InvalidReason = invalidX402Version,
            IsValid = false
        };
    }

    [HttpPost]
    [Route("settle")]
    public SettlementResponse Settle([FromBody] FacilitatorRequest req)
    {
        var payer = req.PaymentPayload.ExtractPayerFromPayload();

        return new()
        {
            Success = true,
            Payer = payer,
            Network = req.PaymentRequirements.Network,
            Transaction = "0xFacilitatorMockServer"
        };
    }

    [HttpGet]
    [Route("supported")]
    public List<FacilitatorKind> Supported()
    {
        return new()
        {
             new FacilitatorKind("USDC", "mainnet", 1)
        };
    }


    [HttpGet]
    [Route("supported-v2")]
    public SupportedResponse SupportedV2()
    {
        return new SupportedResponse
        {
            Kinds = new List<FacilitatorKind>
            {
                 { new FacilitatorKind("USDC", "mainnet", 1) },
                 { new FacilitatorKind("USDC", "mainnet", 2) }
            },
            Extensions = new List<string> { "ext1", "ext2" },
            Signers = new Dictionary<string, List<string>>
            {
                { "eip155:*", new() { "0x209693Bc6afc0C5329bA36FaF03C514EF312287C" } },
                { "solana:*", new() { "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5" } }
            }
        };
    }

}
