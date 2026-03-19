namespace x402.Core.Models.v2.Facilitator
{
    /// <summary>
    /// Request to facilitator
    /// </summary>
    public class FacilitatorRequest
    {
        /// <summary>
        /// The X402 version.
        /// </summary>
        public int X402Version { get; set; }

        public required PaymentPayloadHeader PaymentPayload { get; set; }

        /// <summary>
        /// List of accepted payment requirements.
        /// </summary>
        public required PaymentRequirements PaymentRequirements { get; set; }


    }
}
