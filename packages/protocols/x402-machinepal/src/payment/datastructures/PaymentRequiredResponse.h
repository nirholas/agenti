#pragma once

#include "PaymentRequirements.h"


/**
 * HTTP 402 response body returned by an x402-enabled server.
 * Example shape:
 * {
 *   "x402Version": 1,
 *   "accepts": [ { ... PaymentRequirements ... } ],
 *   "error": "Optional error message"
 * }
 */
class PaymentRequiredResponse {
public:
    using json = nlohmann::json;

    PaymentRequiredResponse() = default;

    PaymentRequiredResponse(
        std::vector< PaymentRequirements >& accepts, const std::optional< string >& error )
        : accepts_( accepts ) {
        CHECK_STATE2( !accepts.empty(), "Accepts array must not be empty" );
        if ( !error ) {
            error_ = "X-PAYMENT header is required";
        } else {
            error_ = error.value();
        }
    }

    // Getters
    int x402Version() const { return x402Version_; }
    const std::vector< PaymentRequirements >& accepts() const { return accepts_; }
    const string& error() const { return error_; }

    // Equality and stream output for convenience/testing
    bool operator==( const PaymentRequiredResponse& other ) const {
        return x402Version_ == other.x402Version_ && accepts_ == other.accepts_ &&
               error_ == other.error_;
    }


    // JSON serialization/deserialization
    static PaymentRequiredResponse fromJson( const json& j );
    json toJson() const;

    static std::string getPaymentRequiredResponseAsString( ptr< OrganizationConfig > organization,
        ptr< ResourceConfig > resource, ptr< MachinePalConfig > config,
        const std::optional< string >& errorMessage = std::nullopt );


private:
    uint32_t x402Version_{ 1 };
    std::vector< PaymentRequirements > accepts_;
    string error_;
};