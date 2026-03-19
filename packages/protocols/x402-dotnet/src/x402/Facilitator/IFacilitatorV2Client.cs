using x402.Core.Models.Facilitator;
using x402.Core.Models.v2;
using x402.Core.Models.v2.Facilitator;

namespace x402.Facilitator
{
    /// <summary>
    /// Client for interacting with the x402 Facilitator service.
    /// Handles payment verification and settlement.
    /// </summary>
    public interface IFacilitatorV2Client
    {

        /// <summary>
        /// Verifies a payment header against the requirements.
        /// </summary>
        /// <param name="paymentPayload">The PAYMENT-SIGNATURE header value transformed into a payload.</param>
        /// <param name="requirements">The payment requirements.</param>
        /// <param name="cancellationToken">Optional cancellation token to cancel the operation.</param>
        /// <returns>Verification response.</returns>
        Task<VerificationResponse> VerifyAsync(PaymentPayloadHeader paymentPayload, PaymentRequirements requirements, CancellationToken cancellationToken = default);

        /// <summary>
        /// Settles a verified payment.
        /// </summary>
        /// <param name="paymentPayload">The PAYMENT-SIGNATURE header value transformed into a payload.</param>
        /// <param name="requirements">The payment requirements.</param>
        /// <param name="cancellationToken">Optional cancellation token to cancel the operation.</param>
        /// <returns>Settlement response.</returns>
        Task<SettlementResponse> SettleAsync(PaymentPayloadHeader paymentPayload, PaymentRequirements requirements, CancellationToken cancellationToken = default);

        /// <summary>
        /// Retrieves the set of payment kinds supported by this facilitator.
        /// </summary>
        /// <param name="cancellationToken">Optional cancellation token to cancel the operation.</param>
        /// <returns></returns>
        Task<SupportedResponse> SupportedAsync(CancellationToken cancellationToken = default);


        Task<DiscoveryResponse> DiscoveryAsync(string? type = null, int? limit = null, int? offset = null, CancellationToken cancellationToken = default);


    }
}
