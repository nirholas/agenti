using x402.Core.Models.Facilitator;

namespace x402.Core.Models.v2;

/// <summary>
/// Contains the complete result of X402 payment processing, including all information needed to generate HTTP responses.
/// </summary>
public record X402ProcessingResult
{
    /// <summary>
    /// The X402 version.
    /// </summary>
    public required int X402Version { get; set; } = 2;

    /// <summary>
    /// Whether the request can continue (payment was successful).
    /// </summary>
    public bool CanContinueRequest { get; init; }

    public required ResourceInfo ResourceInfo { get; set; }

    /// <summary>
    /// The payment requirements used for processing.
    /// </summary>
    public List<PaymentRequirements> PaymentRequirements { get; init; } = new();

    public PaymentRequirements? SelectedPaymentRequirement { get; init; }

    /// <summary>
    /// Error message if processing failed.
    /// </summary>
    public string? Error { get; init; }

    /// <summary>
    /// The verification response from the facilitator.
    /// </summary>
    public VerificationResponse? VerificationResponse { get; init; }

    /// <summary>
    /// The settlement response from the facilitator.
    /// </summary>
    public SettlementResponse? SettlementResponse { get; init; }

    /// <summary>
    /// The HTTP status code to return.
    /// </summary>
    public int StatusCode { get; init; }

    /// <summary>
    /// The payment payload header that was processed.
    /// </summary>
    public PaymentPayloadHeader? PaymentPayload { get; init; }

    /// <summary>
    /// The full URL that was processed.
    /// </summary>
    public string FullUrl { get; init; } = string.Empty;

    /// <summary>
    /// Whether settlement was performed pessimistically (before response).
    /// </summary>
    public bool PessimisticSettlement { get; init; }

    /// <summary>
    /// Exception that occurred during settlement, if any.
    /// </summary>
    public Exception? SettlementException { get; init; }


    /// <summary>
    /// Creates a successful result.
    /// </summary>
    public static X402ProcessingResult Success(
        List<PaymentRequirements> paymentRequirements,
        ResourceInfo resourceInfo,
        PaymentRequirements selectedPaymentRequirement,
        VerificationResponse verificationResponse,
        SettlementResponse? settlementResponse = null,
        PaymentPayloadHeader? paymentPayload = null,
        string fullUrl = "",
        bool pessimisticSettlement = false)
    {
        return new X402ProcessingResult
        {
            X402Version = 2,
            CanContinueRequest = true,
            PaymentRequirements = paymentRequirements,
            ResourceInfo = resourceInfo,
            SelectedPaymentRequirement = selectedPaymentRequirement,
            VerificationResponse = verificationResponse,
            SettlementResponse = settlementResponse,
            PaymentPayload = paymentPayload,
            FullUrl = fullUrl,
            StatusCode = 200, // Will be overridden by actual response
            PessimisticSettlement = pessimisticSettlement
        };
    }

    /// <summary>
    /// Creates an error result.
    /// </summary>
    public static X402ProcessingResult CreateError(
        List<PaymentRequirements> paymentRequirements,
        ResourceInfo resourceInfo,
        string error,
        int statusCode,
        VerificationResponse? verificationResponse = null,
        SettlementResponse? settlementResponse = null,
        PaymentPayloadHeader? paymentPayload = null,
        string fullUrl = "",
        Exception? settlementException = null)
    {
        return new X402ProcessingResult
        {
            X402Version = 2,
            CanContinueRequest = false,
            PaymentRequirements = paymentRequirements,
            ResourceInfo = resourceInfo,
            Error = error,
            StatusCode = statusCode,
            VerificationResponse = verificationResponse,
            SettlementResponse = settlementResponse,
            PaymentPayload = paymentPayload,
            FullUrl = fullUrl,
            SettlementException = settlementException
        };
    }
}
