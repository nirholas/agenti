namespace x402.Core.Models.Facilitator
{
    public class FacilitatorErrorCodes
    {
        /// <summary>Client does not have enough tokens to complete the payment.</summary>
        public static readonly string InsufficientFunds = "insufficient_funds";

        /// <summary>Payment authorization is not yet valid (before validAfter timestamp).</summary>
        public static readonly string InvalidExactEvmPayloadAuthorizationValidAfter = "invalid_exact_evm_payload_authorization_valid_after";

        /// <summary>Payment authorization has expired (after validBefore timestamp).</summary>
        public static readonly string InvalidExactEvmPayloadAuthorizationValidBefore = "invalid_exact_evm_payload_authorization_valid_before";

        /// <summary>Payment amount is insufficient for the required payment.</summary>
        public static readonly string InvalidExactEvmPayloadAuthorizationValue = "invalid_exact_evm_payload_authorization_value";

        /// <summary>Payment authorization signature is invalid or improperly signed.</summary>
        public static readonly string InvalidExactEvmPayloadSignature = "invalid_exact_evm_payload_signature";

        /// <summary>Recipient address does not match payment requirements.</summary>
        public static readonly string InvalidExactEvmPayloadRecipientMismatch = "invalid_exact_evm_payload_recipient_mismatch";

        /// <summary>Specified blockchain network is not supported.</summary>
        public static readonly string InvalidNetwork = "invalid_network";

        /// <summary>Payment payload is malformed or contains invalid data.</summary>
        public static readonly string InvalidPayload = "invalid_payload";

        /// <summary>Payment requirements object is invalid or malformed.</summary>
        public static readonly string InvalidPaymentRequirements = "invalid_payment_requirements";

        /// <summary>Specified payment scheme is not supported.</summary>
        public static readonly string InvalidScheme = "invalid_scheme";

        /// <summary>Payment scheme is not supported by the facilitator.</summary>
        public static readonly string UnsupportedScheme = "unsupported_scheme";

        /// <summary>Protocol version is not supported.</summary>
        public static readonly string InvalidX402Version = "invalid_x402_version";

        /// <summary>Blockchain transaction failed or was rejected.</summary>
        public static readonly string InvalidTransactionState = "invalid_transaction_state";

        /// <summary>Unexpected error occurred during payment verification.</summary>
        public static readonly string UnexpectedVerifyError = "unexpected_verify_error";

        /// <summary>Unexpected error occurred during payment settlement.</summary>
        public static readonly string UnexpectedSettleError = "unexpected_settle_error";

        /// <summary>Transaction simulation failed.</summary>
        public static readonly string SimulationFailed = "simulation_failed";

        /// <summary>Unexpected error occurred during processing.</summary>
        public static readonly string UnexpectedError = "unexpected_error";
    }
}
