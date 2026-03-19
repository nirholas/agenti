#include "MachinePalCommon.h"
#include "PaymentPayload.h"

#include "config/JsonUtils.h"
#include "config/subconfigs/NetworkConfig.h"
#include "facilitators/FacilitatorErrors.h"
#include "url/URLUtils.h"

// PaymentPayload implementations
PaymentPayload::PaymentPayload() : x402Version_( 1 ) {}

PaymentPayload::PaymentPayload( int x402Version, const std::string& scheme,
    const std::string& network, std::shared_ptr< Payload > payload )
    : x402Version_( x402Version ), scheme_( scheme ), network_( network ), payload_( payload ) {}

int PaymentPayload::x402Version() const {
    return x402Version_;
}

const std::string& PaymentPayload::scheme() const {
    return scheme_;
}

const std::string& PaymentPayload::network() const {
    return network_;
}

std::shared_ptr< Payload > PaymentPayload::payload() const {
    CHECK_STATE( payload_ );
    return payload_;
}

bool PaymentPayload::operator==( const PaymentPayload& other ) const {
    CHECK_STATE( payload_ );
    CHECK_STATE( other.payload_ );
    return x402Version_ == other.x402Version_ && scheme_ == other.scheme_ &&
           network_ == other.network_ &&
           ( ( payload_ && other.payload_ && *payload_ == *other.payload_ ) ||
               ( !payload_ && !other.payload_ ) );
}


std::shared_ptr< PaymentPayload > PaymentPayload::fromJson( const json& j ) {
    try {
        CHECK_STATE_JSON( j.contains( "x402Version" ),
            "Missing required field 'x402Version' in PaymentPayload JSON", j );
        CHECK_STATE_JSON(
            j.contains( "scheme" ), "Missing required field 'scheme' in PaymentPayload JSON", j );
        CHECK_STATE_JSON(
            j.contains( "network" ), "Missing required field 'network' in PaymentPayload JSON", j );
        CHECK_STATE_JSON(
            j.contains( "payload" ), "Missing required field 'payload' in PaymentPayload JSON", j );

        CHECK_STATE_JSON( j.at( "x402Version" ).is_number_integer(),
            "'x402Version' must be an integer in PaymentPayload JSON", j );
        CHECK_STATE_JSON(
            j.at( "scheme" ).is_string(), "'scheme' must be a string in PaymentPayload JSON", j );
        CHECK_STATE_JSON(
            j.at( "network" ).is_string(), "'network' must be a string in PaymentPayload JSON", j );
        CHECK_STATE_JSON( j.at( "payload" ).is_object(),
            "'payload' must be an object in PaymentPayload JSON", j );

        CHECK_STATE_JSON( j.at( "x402Version" ).get< int >() == 1,
            "x402Version must be 1 in PaymentPayload JSON", j );
        return std::make_shared< PaymentPayload >( j.at( "x402Version" ).get< int >(),
            j.at( "scheme" ).get< std::string >(), j.at( "network" ).get< std::string >(),
            Payload::fromJson( j.at( "payload" ) ) );
    } catch ( std::exception& e ) {
        RETHROW_NESTED;
    }
}

json PaymentPayload::toJson() const {
    json j;
    j["x402Version"] = x402Version_;
    j["scheme"] = scheme_;
    j["network"] = network_;
    if ( payload_ ) {
        j["payload"] = payload_->toJson();
    }
    return j;
}

std::optional< FacilitatorError > PaymentPayload::validateAndVerifySignature(
    const MachinePalConfig& config, const TokenAmount& price, EthAddress& destinationAddress,
   const string& paymentScheme ) const {
    try {
        if ( x402Version_ != 1 ) {
            LOG_CORE_ERROR( "Unsupported x402Version in payment payload: {}", x402Version_ );
            return FacilitatorError::invalid_x402_version;
        }
        if ( !config.isSchemeSupported( scheme_ ) ) {
            LOG_CORE_ERROR( "Payment scheme is not supported: {}", scheme_ );
            return FacilitatorError::invalid_scheme;
        }
        if ( scheme_ != paymentScheme ) {
            LOG_CORE_ERROR(" Payment scheme does not match resource's required scheme: {} != {}",
                scheme_, paymentScheme);
            return FacilitatorError::invalid_scheme;
        }
        if ( network_ != config.network()->name() ) {
            LOG_CORE_ERROR(" Payment network does not match configured network: {} != {}",
                network_, config.network()->name());
            return FacilitatorError::invalid_network;
        }

        auto error = payload()->validate( price, destinationAddress );

        if ( error ) {
            return error;
        }
        return verifyEIP3009Signature( config.network()->eip712Domain() );
    } catch ( const std::exception& e ) {
        LOG_CORE_ERROR( "Exception validating payment payload: {}", e.what() );
        return FacilitatorError::unexpected_verify_error;
    }
}

std::optional< FacilitatorError > PaymentPayload::verifyEIP3009Signature(
    ptr<EIP712Domain> eipDomain) const {

    try {
        CHECK_STATE( eipDomain );
        return payload()->verifyEIP3009Signature( eipDomain );
    } catch ( const std::exception& e ) {
        LOG_CORE_ERROR( "Exception : {}", e.what() );
        return FacilitatorError::unexpected_verify_error;
    }
}

ptr< PaymentPayload > PaymentPayload::createDefaultPaymentPayload( EthPrivateKey& privKey,
    EthAddress& to, TokenAmount& value, EIP3009Nonce& nonce, std::string networkName ) {
    EthPublicKey pubKey = privKey.computePublicKey();
    EthAddress from = pubKey.getAddress();

    std::time_t now = std::chrono::system_clock::to_time_t( std::chrono::system_clock::now() );

    EIP3009ValidityTime validAfter( now );
    EIP3009ValidityTime validBefore( now + 3600 );

    auto auth =
        std::make_shared< Authorization >( from, to, value, validAfter, validBefore, nonce );

    // Sign authorization
    EIP712Signature signature = EIP3009Authorization::signAuthorization(
        *EIP712Domain::machinePalEasyNet(), from, to, value, validAfter, validBefore, nonce, privKey );


    auto payload = std::make_shared< Payload >( signature, auth );
    return std::make_shared< PaymentPayload >( 1, "exact", networkName, payload );
}


pair<string, string> PaymentPayload::createHttpHeaderValue() {
    auto paymentJson = toJson();
    return {"X-PAYMENT", Encoding::base64Encode( paymentJson.dump())};
}