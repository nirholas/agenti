#include "MachinePalCommon.h"

#include "EIP712Domain.h"

#include "EthPrivateKey.h"
#include "Keccak.h"
#include <boost/algorithm/hex.hpp>
#include <boost/algorithm/string.hpp>
#include <iostream>
#include <vector>


EIP712Domain::EIP712Domain( const std::string& name, const std::string& version,
    const u256& chainId, const EthAddress& verifyingContract,
    const std::optional< std::string > domainSeparator )
    : name_( name ), version_( version ), chainId_( chainId ), assetAddress_( verifyingContract ) {
    auto computedDomainSeparator = hashDomain();
    domainSeparator_ = Encoding::toHex( computedDomainSeparator, true );
    if ( domainSeparator ) {
        CHECK_STATE( domainSeparator_ == domainSeparator.value() );
    }
}


// https://github.com/0xsequence/ethers-eip712/blob/master/tests/typed-data.test.ts
std::array< uint8_t, 32 > EIP712Domain::getDomainTypeHash() {
    // EIP-712 Domain Type Hash
    //  public constant EIP712_DOMAIN_TYPEHASH =
    //  0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f;
    static std::array< uint8_t, 32 > EIP712_DOMAIN_TYPEHASH = KeccakHash::keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)" );

    std::string hex;
    boost::algorithm::hex(
        EIP712_DOMAIN_TYPEHASH.begin(), EIP712_DOMAIN_TYPEHASH.end(), std::back_inserter( hex ) );
    boost::algorithm::to_lower( hex );

    CHECK_STATE( hex == "8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f" );

    return EIP712_DOMAIN_TYPEHASH;
}


// https://github.com/0xsequence/ethers-eip712/blob/master/tests/typed-data.test.ts
std::array< uint8_t, 32 > EIP712Domain::hashDomain() const {
    std::vector< uint8_t > encodedData;

    auto domainTypeHash = getDomainTypeHash();

    // EIP-712 field: typeHash
    encodedData.insert( encodedData.end(), domainTypeHash.begin(), domainTypeHash.end() );

    // EIP-712 field: name (string)
    auto hashed_name = KeccakHash::keccak256( name_ );
    encodedData.insert( encodedData.end(), hashed_name.begin(), hashed_name.end() );

    // EIP-712 field: version (string)
    auto hashed_version = KeccakHash::keccak256( version_ );

    encodedData.insert( encodedData.end(), hashed_version.begin(), hashed_version.end() );

    // EIP-712 field: chainId (uint256) - left-padded to 32 bytes
    std::vector< uint8_t > chainIdBytes;
    boost::multiprecision::export_bits( chainId_, std::back_inserter( chainIdBytes ), 8 );
    std::vector< uint8_t > paddedChainId( 32 - chainIdBytes.size(), 0 );
    paddedChainId.insert( paddedChainId.end(), chainIdBytes.begin(), chainIdBytes.end() );
    CHECK_STATE( paddedChainId.size() == 32 );

    encodedData.insert( encodedData.end(), paddedChainId.begin(), paddedChainId.end() );

    // EIP-712 field: verifyingContract (address) - left-padded to 32 bytes
    auto contractBytes = assetAddress_.bytes();  // Should be 20 bytes

    std::vector< uint8_t > paddedContract( 32 - contractBytes.size(), 0 );
    paddedContract.insert( paddedContract.end(), contractBytes.begin(), contractBytes.end() );
    CHECK_STATE( paddedContract.size() == 32 );

    encodedData.insert( encodedData.end(), paddedContract.begin(), paddedContract.end() );

    CHECK_STATE( encodedData.size() == 160 );

    return KeccakHash::keccak256( encodedData );
}

std::array< uint8_t, 32 > EIP712Domain::hashWithDomain(
    const std::array< uint8_t, 32 >& structHash ) const {
    std::vector< uint8_t > dataToHash;
    dataToHash.push_back( 0x19 );
    dataToHash.push_back( 0x01 );
    auto domainSeparator = hashDomain();
    dataToHash.insert( dataToHash.end(), domainSeparator.begin(), domainSeparator.end() );
    dataToHash.insert( dataToHash.end(), structHash.begin(), structHash.end() );
    return KeccakHash::keccak256( dataToHash );
}


EIP712Signature EIP712Domain::signWithDomain(
    const std::array< uint8_t, 32 >& structHash, const EthPrivateKey& privateKey ) const {
    std::vector< uint8_t > dataToHash;
    auto hash = hashWithDomain( structHash );
    return EthPrivateKey::signAuthRaw( hash.data(), privateKey.bytes().data() );
}


std::optional< FacilitatorError > EIP712Domain::verifyWithDomain(
    const std::array< uint8_t, 32 >& structHash, const EIP712Signature& signature,
    const EthAddress& expectedAddress ) const {
    auto hash = hashWithDomain( structHash );
    return EthPrivateKey::eip712VerifyRaw( hash.data(), signature.bytes().data(), expectedAddress );
}