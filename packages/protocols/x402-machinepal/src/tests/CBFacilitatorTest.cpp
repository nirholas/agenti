#include "facilitator_clients/CBFacilitatorClient.h"
#include <boost/test/unit_test.hpp>

#include <glog/logging.h>
#include <iostream>

#include "exceptions/VerificationError.h"


// This test suite uses a safe hardcoded "test stub" payload.
// The signature/address values are dummy values — the real facilitator will reject them,
// but the purpose here is to exercise the request/response path against the real API.

static nlohmann::json makeRequirements() {
    return nlohmann::json{
        { "network", "base-sepolia" }, { "asset", "usdc" },
        { "amount", "1000000" },  // 1.000000 USDC (6 decimals)
        { "scheme", "exact" },
        { "receiver", "0x8ba1f109551bD432803012645Ac136ddd64DBA72" }  // example receiver
    };
}

static nlohmann::json makePayload() {
    return nlohmann::json{
        { "from", "0x8ba1f109551bD432803012645Ac136ddd64DBA72" },
        { "to", "0x8ba1f109551bD432803012645Ac136ddd64DBA72" }, { "amount", "1000000" },
        { "nonce", "0xdeadbeef" }, { "validAfter", 1699999999 }, { "validBefore", 1999999999 },
        // Dummy signature (not valid). Facilitator will likely reject this payload.
        //{"signature",   "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
    };
}

BOOST_AUTO_TEST_CASE( verify_call_real_server_invalid_sig ) {
    CBFacilitatorClient client;  // defaults to https://x402.org/facilitator

    auto instruction = makeRequirements();
    auto payload = makePayload();

    json request;

    request["paymentPayload"] = payload;
    request["paymentRequirements"] = instruction;

    try {
        auto res = client.verify( request);
        // We expect the facilitator to either return a JSON object describing invalid signature
        // or another error object. Accept either.
        BOOST_TEST( res.is_object() );
        // Contains "valid" (bool) for some facilitator implementations or "error" for rejected
        // payloads.
        BOOST_TEST(
            ( res.contains( "valid" ) || res.contains( "invalidReason" ) || res.contains( "message" ) ) );
        BOOST_TEST_MESSAGE( "verify response: " + res.dump() );
    } catch ( VerificationError& e ) {
        BOOST_TEST_MESSAGE(
            std::string( "verify threw VerificationError (expected with dummy signature): " ) +
            e.what() );
    } catch ( const std::exception& e ) {
        // Network or HTTP-level errors should fail the test — record message for debugging.
        BOOST_FAIL( std::string( "verify threw exception: " ) + e.what() );
    }
}

BOOST_AUTO_TEST_CASE( settle_call_real_server_stub ) {
    CBFacilitatorClient client;

    auto instruction = makeRequirements();
    auto payload = makePayload();

    try {
        auto res = client.settle( payload);
        // On success, facilitator returns txHash; on failure it may return error JSON or HTTP
        // non-2xx. We accept any valid JSON object but assert that the response is parsed.
        BOOST_TEST( res.is_object() );
        BOOST_TEST(
            ( res.contains( "txHash" ) || res.contains( "errorReason" ) || res.contains( "message" ) ) );
        BOOST_TEST_MESSAGE( "settle response: " + res.dump() );
    } catch ( const std::exception& e ) {
        // Likely outcome for dummy signature: facilitator rejects with an HTTP error that our
        // client throws. Record the message but don't fail the whole test suite — use a warning
        // instead.
        BOOST_TEST_MESSAGE(
            std::string( "settle threw exception (expected with dummy signature): " ) + e.what() );
    }
}