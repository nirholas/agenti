#pragma once

#include "x402_protocol/HttpError.h"

using json = nlohmann::json;

class VerifyResponse {
public:
    // Explicitly default copy constructor and assignment
    VerifyResponse( const VerifyResponse& ) = default;
    VerifyResponse& operator=( const VerifyResponse& ) = default;
    // Getters
    bool success() const;
    const std::optional< std::string >& invalidReason() const;
    const std::string& transaction() const;
    const std::string& network() const;
    const std::string& payer() const;
    // Equality operator
    bool operator==( const VerifyResponse& other ) const;
    // JSON serialization
    json toJson() const;
    // JSON deserialization
    static VerifyResponse fromJsonString( const std::string& jsonString );
    // Return base64 encoding of original JSON string captured at construction
    std::string originalJsonToBase64() const;


    VerifyResponse( bool success, std::optional< std::string > errorReason,
        const std::string& payer,
        const optional< std::string >& originalJson );

private:
    bool success_;
    std::optional< std::string > invalidReason_;
    std::string payer_;
    std::string originalJson_;
};