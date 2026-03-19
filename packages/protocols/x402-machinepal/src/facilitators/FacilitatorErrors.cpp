#include "MachinePalCommon.h"
#include "FacilitatorErrors.h"

#define ERROR_STRING_MAP_ENTRY(e) {#e, FacilitatorError::e}

static const std::unordered_map<std::string_view, FacilitatorError> kErrorStringToEnum = {
    ERROR_STRING_MAP_ENTRY(insufficient_funds),
    ERROR_STRING_MAP_ENTRY(invalid_exact_evm_payload_authorization_valid_after),
    ERROR_STRING_MAP_ENTRY(invalid_exact_evm_payload_authorization_valid_before),
    ERROR_STRING_MAP_ENTRY(invalid_exact_evm_payload_authorization_value),
    ERROR_STRING_MAP_ENTRY(invalid_exact_evm_payload_signature),
    ERROR_STRING_MAP_ENTRY(invalid_exact_evm_payload_recipient_mismatch),
    ERROR_STRING_MAP_ENTRY(invalid_network),
    ERROR_STRING_MAP_ENTRY(invalid_payload),
    ERROR_STRING_MAP_ENTRY(invalid_payment_requirements),
    ERROR_STRING_MAP_ENTRY(invalid_scheme),
    ERROR_STRING_MAP_ENTRY(unsupported_scheme),
    ERROR_STRING_MAP_ENTRY(invalid_x402_version),
    ERROR_STRING_MAP_ENTRY(invalid_transaction_state),
    ERROR_STRING_MAP_ENTRY(unexpected_verify_error),
    ERROR_STRING_MAP_ENTRY(unexpected_settle_error)
};


static const std::unordered_map<FacilitatorError, std::string_view>
kErrorDescriptions = {
    {
        FacilitatorError::insufficient_funds,
        "Insufficient funds"
    },
    {
        FacilitatorError::invalid_exact_evm_payload_authorization_valid_after,
        "Payment authorization is not yet valid (before validAfter timestamp)"
    },
    {
        FacilitatorError::invalid_exact_evm_payload_authorization_valid_before,
        "Payment authorization has expired (after validBefore timestamp)"
    },
    {
        FacilitatorError::invalid_exact_evm_payload_authorization_value,
        "Payment amount is insufficient for the required payment"
    },
    {
        FacilitatorError::invalid_exact_evm_payload_signature,
        "Payment authorization signature is invalid or improperly signed"
    },
    {
        FacilitatorError::invalid_exact_evm_payload_recipient_mismatch,
        "Recipient address does not match payment requirements"
    },
    {
        FacilitatorError::invalid_network,
        "Specified blockchain network is not supported"
    },
    {
        FacilitatorError::invalid_payload,
        "Payment payload is malformed or contains invalid data"
    },
    {
        FacilitatorError::invalid_payment_requirements,
        "Payment requirements object is invalid or malformed"
    },
    {
        FacilitatorError::invalid_scheme,
        "Specified payment scheme is not supported"
    },
    {
        FacilitatorError::unsupported_scheme,
        "Payment scheme is not supported by the facilitator"
    },
    {
        FacilitatorError::invalid_x402_version,
        "Protocol version is not supported"
    },
    {
        FacilitatorError::invalid_transaction_state,
        "Blockchain transaction failed or was rejected"
    },
    {
        FacilitatorError::unexpected_verify_error,
        "Unexpected error occurred during payment verification"
    },
    {
        FacilitatorError::unexpected_settle_error,
        "Unexpected error occurred during payment settlement"
    },
};


#define ERROR_STRING_CASE(e) case FacilitatorError::e: return #e;

std::string_view FacilitatorErrors::getErrorString(FacilitatorError error) {
    switch (error) {
        ERROR_STRING_CASE(insufficient_funds)
        ERROR_STRING_CASE(invalid_exact_evm_payload_authorization_valid_after)
        ERROR_STRING_CASE(invalid_exact_evm_payload_authorization_valid_before)
        ERROR_STRING_CASE(invalid_exact_evm_payload_authorization_value)
        ERROR_STRING_CASE(invalid_exact_evm_payload_signature)
        ERROR_STRING_CASE(invalid_exact_evm_payload_recipient_mismatch)
        ERROR_STRING_CASE(invalid_network)
        ERROR_STRING_CASE(invalid_payload)
        ERROR_STRING_CASE(invalid_payment_requirements)
        ERROR_STRING_CASE(invalid_scheme)
        ERROR_STRING_CASE(unsupported_scheme)
        ERROR_STRING_CASE(invalid_x402_version)
        ERROR_STRING_CASE(invalid_transaction_state)
        ERROR_STRING_CASE(unexpected_verify_error)
        ERROR_STRING_CASE(unexpected_settle_error)
        default:
            return "unknown_error";
    }
}


std::string_view FacilitatorErrors::getErrorDescription(FacilitatorError error) {
    auto it = kErrorDescriptions.find(error);
    if (it != kErrorDescriptions.end()) {
        return it->second;
    }
    return "Unknown error";
}

std::optional<FacilitatorError> FacilitatorErrors::getErrorFromString(std::string_view str) {
    for (const auto &[key, value]: kErrorStringToEnum) {
        if (str.find(key) != std::string_view::npos) {
            return value;
        }
    }
    return std::nullopt;
}

