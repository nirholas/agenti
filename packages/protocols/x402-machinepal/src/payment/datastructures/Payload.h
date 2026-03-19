#pragma once

#include "Authorization.h"


enum class FacilitatorError;
class HttpError;
class ResourceConfig;
class EIP712Domain;
;

class Payload {
public:
    Payload();
    Payload( const std::string& signature, std::shared_ptr< Authorization > authorization );

    Payload(
        const EIP712Signature& signature, const std::shared_ptr< Authorization >& authorization )
        : signature_( signature ), authorization_( authorization ) {}

    [[nodiscard]] const EIP712Signature signature() const;
    [[nodiscard]] std::shared_ptr< Authorization > authorization() const;

    bool operator==( const Payload& other ) const;
    static std::shared_ptr< Payload > fromJson( const json& j );
    [[nodiscard]] json toJson() const;

    std::optional< FacilitatorError > validate( const TokenAmount&  price, EthAddress& destinationAddress );
    std::optional< FacilitatorError > verifyEIP3009Signature(
        std::shared_ptr< EIP712Domain > domain ) const;

private:
    EIP712Signature signature_;
    std::shared_ptr< Authorization > authorization_;
};