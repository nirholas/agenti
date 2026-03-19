#include "crypto/EIP712Domain.h"
#include <MachinePalCommon.h>
#include <crypto/Encoding.h>
#include <boost/algorithm/hex.hpp>
#include <boost/algorithm/string.hpp>
#include <boost/test/unit_test.hpp>

BOOST_AUTO_TEST_CASE( EIP712Domain_Hash_Test ) {
    auto hash = EIP712Domain::baseMainnet()->hashDomain();
    BOOST_TEST( Encoding::toHex( hash, true ) == EIP712Domain::baseMainnet()->domainSeparator() );
    auto hash2 = EIP712Domain::baseSepolia()->hashDomain();
    BOOST_TEST( Encoding::toHex( hash2, true ) == EIP712Domain::baseSepolia()->domainSeparator() );
}