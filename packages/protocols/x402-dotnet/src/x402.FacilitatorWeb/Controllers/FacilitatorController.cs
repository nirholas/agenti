using Microsoft.AspNetCore.Mvc;
using x402.Core.Models.Facilitator;
using x402.Core.Models.v2.Facilitator;
using x402.Facilitator;

namespace x402.FacilitatorWeb.Controllers;

[ApiController]
[Route("/")]
public class FacilitatorController : ControllerBase
{
    private readonly PaymentServiceFactory _paymentServiceFactory;

    public FacilitatorController(PaymentServiceFactory paymentServiceFactory)
    {
        _paymentServiceFactory = paymentServiceFactory;
    }

    private VerificationResponse VerificationError(string invalidReason)
    {
        return new VerificationResponse
        {
            InvalidReason = invalidReason,
            IsValid = false
        };
    }

    [HttpPost]
    [Route("verify")]
    public async Task<VerificationResponse> Verify([FromBody] FacilitatorRequest req)
    {
        if (req.X402Version != 2)
            return VerificationError(FacilitatorErrorCodes.InvalidX402Version);

        try
        {
            var paymentService = _paymentServiceFactory.GetPaymentServiceByNetwork(req.PaymentPayload.Accepted.Network);

            if (paymentService == null)
            {
                return VerificationError($"Unsupported network: {req.PaymentPayload.Accepted.Network}");
            }

            var response = await paymentService.VerifyPayment(
                req.PaymentPayload,
                req.PaymentRequirements
            );

            return response;
        }
        catch (Exception ex)
        {
            return VerificationError($"Error: {ex.Message}");
        }
    }

    [HttpPost]
    [Route("settle")]
    public async Task<SettlementResponse> Settle([FromBody] FacilitatorRequest req)
    {
        try
        {
            var paymentService = _paymentServiceFactory.GetPaymentServiceByNetwork(req.PaymentPayload.Accepted.Network);

            if (paymentService == null)
            {
                return new SettlementResponse
                {
                    Success = false,
                    ErrorReason = $"Unsupported network: {req.PaymentPayload.Accepted.Network}",
                    Network = req.PaymentPayload.Accepted.Network,
                    Transaction = ""
                };
            }

            var response = await paymentService.SettlePayment(
                req.PaymentPayload,
                req.PaymentRequirements
            );

            return response;
        }
        catch (Exception ex)
        {
            return new SettlementResponse
            {
                Success = false,
                ErrorReason = $"Error: {ex.Message}",
                Network = req.PaymentPayload.Accepted.Network,
                Transaction = ""
            };
        }
    }

    [HttpGet]
    [Route("supported")]
    public List<FacilitatorKind> Supported()
    {
        return _paymentServiceFactory.GetAllKinds();
    }
}
