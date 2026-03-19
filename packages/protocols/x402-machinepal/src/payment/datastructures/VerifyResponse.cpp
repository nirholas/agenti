#include "MachinePalCommon.h"

#include "VerifyResponse.h"

#include "crypto/Encoding.h"
#include "url/URLUtils.h"

#include <folly/json/json.h>


VerifyResponse::VerifyResponse( bool success, std::optional< std::string > errorReason,
    const std::string& payer,
    const optional< std::string >& originalJson )
    : success_( success ),
      invalidReason_( std::move( errorReason ) ),
      payer_( payer ) {
    if ( originalJson ) {
        originalJson_ = originalJson.value();
    } else {
        // construct originalJson_ from the fields
        json j = toJson();
        originalJson_ = j.dump();
    }
}

bool VerifyResponse::success() const {
    return success_;
}
const std::optional< std::string >& VerifyResponse::invalidReason() const {
    return invalidReason_;
}

const std::string& VerifyResponse::payer() const {
    return payer_;
}

bool VerifyResponse::operator==( const VerifyResponse& other ) const {
    return success_ == other.success_ && invalidReason_ == other.invalidReason_ &&
           payer_ == other.payer_;
}

json VerifyResponse::toJson() const {
    json j;
    j["isValid"] = success_;
    j["payer"] = payer_;
    if ( invalidReason_.has_value() ) {
        j["invalidReason"] = invalidReason_.value();
    }
    return j;
}




VerifyResponse VerifyResponse::fromJsonString( std::string const& jsonString ) {
    auto j = json::parse( jsonString );
    bool success = j.at( "isValid" ).get< bool >();
    std::string transaction = j.at( "transaction" ).get< std::string >();
    std::string network = j.at( "network" ).get< std::string >();
    std::string payer = j.at( "payer" ).get< std::string >();
    std::optional< std::string > errorReason = std::nullopt;
    if ( j.contains( "invalidReason" ) && j.at( "invalidReason" ).is_string() ) {
        errorReason = j.at( "invalidReason" ).get< std::string >();
    }
    return VerifyResponse( success, errorReason,  payer, jsonString );
}

std::string VerifyResponse::originalJsonToBase64() const {
    return Encoding::base64Encode( originalJson_ );
}