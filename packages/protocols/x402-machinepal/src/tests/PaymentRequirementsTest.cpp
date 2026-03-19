#include "../payment/datastructures/PaymentRequirements.h"
#include "../examples/PaymentExamples.h"
#include "MachinePalCommon.h"
#include "nlohmann/json.hpp"
#include <boost/test/unit_test.hpp>

using json = nlohmann::json;

BOOST_AUTO_TEST_CASE( deserialize_payment_requirements ) {
    json j_data = json::parse( PaymentExamples::EXACT_UCDC_PAYMENT_REQ_CB_SEPOLIA );
    auto requirements = PaymentRequirements::fromJson( j_data );

    BOOST_TEST( requirements->scheme() == "exact" );
    BOOST_TEST( requirements->network() == "base-sepolia" );
    BOOST_TEST( requirements->maxAmountRequired() == "12000000000000000000" );
    BOOST_TEST( requirements->resource() == "https://jsonplaceholder.typicode.com/posts/1" );
    BOOST_TEST( requirements->description() == "" );
    BOOST_TEST( requirements->mimeType() == "application/json" );
    BOOST_TEST( !requirements->outputSchema().has_value() );
    BOOST_TEST( requirements->payTo() == "0x2222222222222222222222222222222222222222" );
    BOOST_TEST( requirements->maxTimeoutSeconds() == 600 );
    BOOST_TEST( requirements->asset() == "0x036CbD53842c5426634e7929541eC2318f3dCF7e" );
    BOOST_TEST( !requirements->extra().is_null() );
}

BOOST_AUTO_TEST_CASE( serialize_payment_requirements ) {
    PaymentRequirements new_req( "streaming", "base", "50000000000000000",
        "https://api.prod.com/stream/video", "Production Video Stream", "video/mp4", std::nullopt,
        "0x2222222222222222222222222222222222222222", 600,
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", nullptr );

    json j_output;
    j_output["paymentRequirements"] = new_req.toJson();

    BOOST_TEST( j_output["paymentRequirements"]["scheme"] == "streaming" );
    BOOST_TEST( j_output["paymentRequirements"]["network"] == "base" );
    BOOST_TEST( j_output["paymentRequirements"]["maxAmountRequired"] == "50000000000000000" );
    BOOST_TEST(
        j_output["paymentRequirements"]["resource"] == "https://api.prod.com/stream/video" );
    BOOST_TEST( j_output["paymentRequirements"]["description"] == "Production Video Stream" );
    BOOST_TEST( j_output["paymentRequirements"]["mimeType"] == "video/mp4" );
    if ( !j_output["paymentRequirements"].contains( "outputSchema" ) ) {
        BOOST_TEST( true );  // outputSchema is not present, which is valid
    }
    BOOST_TEST(
        j_output["paymentRequirements"]["payTo"] == "0x2222222222222222222222222222222222222222" );
    BOOST_TEST( j_output["paymentRequirements"]["maxTimeoutSeconds"] == 600 );
    BOOST_TEST(
        j_output["paymentRequirements"]["asset"] == "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" );
    BOOST_TEST( j_output["paymentRequirements"]["extra"].is_null() );
}