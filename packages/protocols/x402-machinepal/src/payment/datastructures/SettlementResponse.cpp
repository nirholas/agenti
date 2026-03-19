#include "MachinePalCommon.h"

#include "SettlementResponse.h"

#include "crypto/Encoding.h"
#include "url/URLUtils.h"


SettlementResponse::SettlementResponse( bool success, std::optional< std::string > errorReason,
    const std::string& transaction, const std::string& network, const std::string& payer,
    const optional< std::string >& originalJson )
    : success_( success ),
      errorReason_( std::move( errorReason ) ),
      transaction_( transaction ),
      network_( network ),
      payer_( payer ) {
    if ( originalJson ) {
        originalJson_ = originalJson.value();
    } else {
        // construct originalJson_ from the fields
        json j = toJson();
        originalJson_ = j.dump();
    }
}

bool SettlementResponse::success() const {
    return success_;
}
const std::optional< std::string >& SettlementResponse::errorReason() const {
    return errorReason_;
}
const std::string& SettlementResponse::transaction() const {
    return transaction_;
}
const std::string& SettlementResponse::network() const {
    return network_;
}
const std::string& SettlementResponse::payer() const {
    return payer_;
}

bool SettlementResponse::operator==( const SettlementResponse& other ) const {
    return success_ == other.success_ && errorReason_ == other.errorReason_ &&
           transaction_ == other.transaction_ && network_ == other.network_ &&
           payer_ == other.payer_;
}

json SettlementResponse::toJson() const {
    json j;
    j["success"] = success_;
    j["transaction"] = transaction_;
    j["network"] = network_;
    j["payer"] = payer_;
    if ( errorReason_.has_value() ) {
        j["errorReason"] = errorReason_.value();
    }
    return j;
}


ptr< SettlementResponse > SettlementResponse::getErrorSettlementResponse(
    HttpError& error, const std::string& network, const std::string& payer ) {
    auto result = make_shared< SettlementResponse >(
        false, error.message(), "", network, payer, std::nullopt );
    return result;
}


SettlementResponse SettlementResponse::fromJsonString( std::string const& jsonString ) {
    auto j = json::parse( jsonString );
    bool success = j.at( "success" ).get< bool >();
    std::string transaction = j.at( "transaction" ).get< std::string >();
    std::string network = j.at( "network" ).get< std::string >();
    std::string payer = j.at( "payer" ).get< std::string >();
    std::optional< std::string > errorReason = std::nullopt;
    if ( j.contains( "errorReason" ) && j.at( "errorReason" ).is_string() ) {
        errorReason = j.at( "errorReason" ).get< std::string >();
    }
    return SettlementResponse( success, errorReason, transaction, network, payer, jsonString );
}

std::string SettlementResponse::originalJsonToBase64() const {
    return Encoding::base64Encode( originalJson_ );
}