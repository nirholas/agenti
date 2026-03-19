#include "crypto/EIP3009Authorization.h"
#include "crypto/EIP712Domain.h"
#include "crypto/EIP712Signature.h"
#include "crypto/EthAddress.h"
#include "crypto/EthPrivateKey.h"
#include "crypto/EthPublicKey.h"
#include <MachinePalCommon.h>
#include <boost/multiprecision/cpp_int.hpp>
#include <boost/test/unit_test.hpp>

#include "crypto/EIP3009ValidityTime.h"
#include "crypto/TokenAmount.h"
#include "x402_protocol/HttpError.h"

using u256 = boost::multiprecision::uint256_t;

BOOST_AUTO_TEST_CASE( EIP3009_SignAndVerify_ReferenceValues ) {
    try {
        // Reference values (example test vectors)
        EthAddress to( "0xffcf8fdee72ac11b5c542428b35eef5769c409f0" );
        TokenAmount value( 1000000000000000000ULL );
        EIP3009ValidityTime validAfter( 1633046400 );
        EIP3009ValidityTime validBefore( 1733046400 );
        EIP3009Nonce nonce = EIP3009Nonce::fromHex(
            "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" );

        // Example private key (DO NOT USE IN PRODUCTION)
        std::string privKeyHex = "4c0883a69102937d6231471b5dbb6204fe5129617082796e8a7a7e7a7a7a7a7a";
        EthPrivateKey privKey( privKeyHex );
        EthPublicKey pubKey = privKey.computePublicKey();
        EthAddress from = pubKey.getAddress();

        // Sign authorization
        EIP712Signature signature =
            EIP3009Authorization::signAuthorization( *EIP712Domain::machinePalEasyNet(), from,
                to, value, validAfter, validBefore, nonce, privKey );
        BOOST_TEST( !signature.toHex().empty() );

        // Verify authorization
        auto error = EIP3009Authorization::verifyAuthorizationSignature(
            *EIP712Domain::machinePalEasyNet(), from, to, value, validAfter, validBefore, nonce,
            signature );
        BOOST_TEST( !error );
    } catch ( exception& ex ) {
        printNestedException( ex );
        BOOST_FAIL( std::string( "Exception during EIP3009 sign/verify test: " ) + ex.what() );
    }
}