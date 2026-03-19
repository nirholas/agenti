using x402.Core.Models.Facilitator;
using x402.Core.Models.v2;

namespace x402.Facilitator
{
    public interface IPaymentService
    {
        Task<SettlementResponse> SettlePayment(PaymentPayloadHeader payload, PaymentRequirements requirements);
        Task<VerificationResponse> VerifyPayment(PaymentPayloadHeader payload, PaymentRequirements requirements);
    }
}