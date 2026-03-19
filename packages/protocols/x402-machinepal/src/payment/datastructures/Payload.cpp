#include "Payload.h"
#include <stdexcept>

#include "config/JsonUtils.h"
#include "crypto/EIP3009Authorization.h"
#include "crypto/EIP712Domain.h"
#include "facilitators/FacilitatorErrors.h"
#include "x402_protocol/HttpError.h"

class HttpError;

// Payload implementations
Payload::Payload() = default;

Payload::Payload( const std::string& signature, std::shared_ptr< Authorization > authorization )
    : signature_( signature ), authorization_( authorization ) {
    CHECK_STATE( authorization )
}

const EIP712Signature Payload::signature() const {
    return signature_;
}

std::shared_ptr< Authorization > Payload::authorization() const {
    CHECK_STATE( authorization_ );
    return authorization_;
}


bool Payload::operator==( const Payload& other ) const {
    CHECK_STATE( authorization() );
    CHECK_STATE( other.authorization() );
    return signature_ == other.signature_ && ( ( authorization_ && other.authorization_ &&
                                                   *authorization_ == *other.authorization_ ) ||
                                                 ( !authorization_ && !other.authorization_ ) );
}

std::shared_ptr< Payload > Payload::fromJson( const json& j ) {
    try {
        CHECK_STATE_JSON(
            j.contains( "signature" ), "Missing required field 'signature' in Payload JSON", j );
        CHECK_STATE_JSON( j.contains( "authorization" ),
            "Missing required field 'authorization' in Payload JSON", j );

        CHECK_STATE_JSON(
            j.at( "signature" ).is_string(), "'signature' must be a string in Payload JSON", j );
        CHECK_STATE_JSON( j.at( "authorization" ).is_object(),
            "'authorization' must be an object in Payload JSON", j );

        auto authPtr = Authorization::fromJson( j.at( "authorization" ) );
        return std::make_shared< Payload >( j.at( "signature" ).get< std::string >(), authPtr );
    } catch ( std::exception& ) {
        RETHROW_NESTED;
    }
}

[[nodiscard]] json Payload::toJson() const {
    json j;
    j["signature"] = signature_.toHex( true );
    CHECK_STATE( authorization() );
    j["authorization"] = authorization_->toJson();
    return j;
}

std::optional< FacilitatorError > Payload::validate(
    const TokenAmount& price, EthAddress& destinationAddress ) {
    return authorization()->validate( price, destinationAddress );
}

std::optional< FacilitatorError > Payload::verifyEIP3009Signature(
    std::shared_ptr< EIP712Domain > domain ) const {
    try {
        return EIP3009Authorization::verifyAuthorizationSignature( *domain, authorization()->from(),
            authorization()->to(), authorization()->value(), authorization()->validAfter(),
            authorization()->validBefore(), authorization()->nonce(), signature() );
    } catch ( const std::exception& e ) {
        printNestedException( e );
        return FacilitatorError::unexpected_verify_error;
    }
    return std::nullopt;
};