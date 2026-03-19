#pragma once

#include <map>
#include <string_view>
#include <optional>

enum class FacilitatorError {
    insufficient_funds,
    invalid_exact_evm_payload_authorization_valid_after,
    invalid_exact_evm_payload_authorization_valid_before,
    invalid_exact_evm_payload_authorization_value,
    invalid_exact_evm_payload_signature,
    invalid_exact_evm_payload_recipient_mismatch,
    invalid_network,
    invalid_payload,
    invalid_payment_requirements,
    invalid_scheme,
    unsupported_scheme,
    invalid_x402_version,
    invalid_transaction_state,
    unexpected_verify_error,
    unexpected_settle_error
};


class FacilitatorErrors {
public:
    static std::string_view getErrorDescription(FacilitatorError error);
    static std::string_view getErrorString(FacilitatorError error);
    static std::optional<FacilitatorError> getErrorFromString(std::string_view str);
};
