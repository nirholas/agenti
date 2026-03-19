#include "PaymentRequiredResponse.h"
#include "MachinePalCommon.h"

#include "config/JsonUtils.h"
#include "config/MachinePalConfig.h"
#include "config/subconfigs/NetworkConfig.h"
#include "config/subconfigs/OrganizationConfig.h"
#include "config/subconfigs/ResourceConfig.h"

using json = nlohmann::json;

PaymentRequiredResponse PaymentRequiredResponse::fromJson( const json& j ) {
    try {
        CHECK_STATE_JSON( j.contains( "x402Version" ) && j["x402Version"].is_number_integer(),
            "PaymentRequiredResponse must contain integer x402Version", j );


        CHECK_STATE_JSON( j.at( "x402Version" ).get< int >() == 1, "x402Version must be 1", j );

        CHECK_STATE_JSON( j.contains( "accepts" ) && j["accepts"].is_array(),
            "PaymentRequiredResponse must contain array accepts", j );


        string error;

        CHECK_STATE_JSON(
            j.contains( "error" ), "PaymentRequiredResponse must contain error field", j );

        CHECK_STATE_JSON(
            j["error"].is_string(), "PaymentRequiredResponse error must be string", j );

        error = j.at( "error" ).get< std::string >();

        std::vector< PaymentRequirements > paymentRequirementsList;
        for ( const auto& elem : j["accepts"] ) {
            // PaymentRequirements::fromJson returns shared_ptr
            auto pr = PaymentRequirements::fromJson( elem );
            if ( pr )
                paymentRequirementsList.push_back( *pr );
        }


        CHECK_STATE_JSON( !paymentRequirementsList.empty(), "Accepts array must not be empty", j );

        return PaymentRequiredResponse( paymentRequirementsList, error );
    } catch ( const std::exception& e ) {
        RETHROW_NESTED;
    }
}

json PaymentRequiredResponse::toJson() const {
    json j;
    j["x402Version"] = x402Version_;
    j["accepts"] = json::array();
    for ( const auto& p : accepts_ ) {
        j["accepts"].push_back( p.toJson() );
    }

    j["error"] = error_;

    return j;
}


std::string PaymentRequiredResponse::getPaymentRequiredResponseAsString(
    ptr< OrganizationConfig > organization, ptr< ResourceConfig > resource,
    ptr< MachinePalConfig > config, const std::optional< string >& errorMessage ) {
    auto req = PaymentRequirements::makePaymentRequirements( *organization,
        *resource,
        *config->network() );

    std::vector< PaymentRequirements > reqs( { *req } );

    auto response = PaymentRequiredResponse( reqs, errorMessage );
    return response.toJson().dump();
}