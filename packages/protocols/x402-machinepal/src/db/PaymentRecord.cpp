#include "PaymentRecord.h"
#include "MachinePalCommon.h"
#include "crypto/EIP3009Nonce.h"
#include "crypto/TokenAmount.h"
#include "crypto/Encoding.h"
#include "crypto/EthAddress.h"
#include "crypto/Keccak.h"  // for computing resource hash
#include <soci/row.h>

#include "payment/datastructures/Authorization.h"
#include "payment/datastructures/Payload.h"
#include "payment/datastructures/PaymentPayload.h"
#include <chrono>

#include "config/subconfigs/OrganizationConfig.h"

ptr< PaymentRecord > PaymentRecord::deserializeFromDbRow( const soci::row& ) {
    // Not implemented yet
    throw std::runtime_error( "PaymentRecord::deserializeFromDbRow not implemented" );
}


std::string PaymentRecord::organizationName() const {
    return organizationName_;
}

u256 PaymentRecord::chainId() const {
    return chainId_;
}

EthAddress PaymentRecord::fromAddress() const {
    return fromAddress_;
}

EthAddress PaymentRecord::toAddress() const {
    return toAddress_;
}

EthAddress PaymentRecord::assetAddress() const {
    return assetAddress_;
}

TokenAmount PaymentRecord::value() const {
    return value_;
}

EIP3009Nonce PaymentRecord::nonce() const {
    return nonce_;
}

string PaymentRecord::resourceLocation() const {
    // renamed to match header
    return resourceLocation_;
}

uint64_t PaymentRecord::settlementTime() const {
    return settlementTime_;
}

Hash PaymentRecord::authorizationSignatureHash() const {
    return authorizationSignatureHash_;
}

Hash PaymentRecord::transactionHash() const {
    return transactionHash_;
}

std::string PaymentRecord::fromIpAddress() const {
    return fromIpAddress_;
}

std::string PaymentRecord::jsonInfo() const {
    return jsonInfo_;
}

PaymentRecord::PaymentRecord( const std::string& organizationName, const u256 chainId,
    const EthAddress& fromAddress, const EthAddress& toAddress, const EthAddress& assetAddress,
    const TokenAmount& value, const EIP3009Nonce& nonce, const string& resourceIdentifier,
    uint64_t settlementTime, const Hash& authorizationSignatureHash, const Hash& transactionHash,
    const std::string& fromIpAddress, const std::string& jsonInfo )
    : organizationName_( organizationName ),
      chainId_( chainId ),
      fromAddress_( fromAddress ),
      toAddress_( toAddress ),
      assetAddress_( assetAddress ),
      value_( value ),
      nonce_( nonce ),
      resourceLocation_( resourceIdentifier ),
      settlementTime_( settlementTime ),
      authorizationSignatureHash_( authorizationSignatureHash ),
      transactionHash_( transactionHash ),
      fromIpAddress_( fromIpAddress ),
      jsonInfo_( jsonInfo ) {}

ptr< PaymentRecord > PaymentRecord::createPaymentRecord( const PaymentPayload& paymentPayload,
    const EIP712Domain& domain, const ResourceConfig& resource,
    const OrganizationConfig& organization, const Hash& transactionHash,
    const string& fromIpAddress ) {
    auto payload = paymentPayload.payload();
    CHECK_STATE( payload );
    auto auth = payload->authorization();
    CHECK_STATE( auth );

    const EthAddress from = auth->from();
    const EthAddress to = auth->to();
    const TokenAmount value = auth->value();
    const EIP3009Nonce nonce = auth->nonce();

    auto organizationName = organization.organizationName();
    const u256 chainId = domain.chainId();
    const EthAddress assetAddress = domain.assetAddress();

    // Compute resource hash from identifier string
    const std::string resourceLocation = resource.getLocation();
    Hash authorizationSignatureHash = payload->signature().computeSignatureHash();

    uint64_t settlementTime =
        static_cast< uint64_t >( std::chrono::duration_cast< std::chrono::seconds >(
            std::chrono::system_clock::now().time_since_epoch() )
                                     .count() );

    const std::string jsonInfo = paymentPayload.toJson().dump();

    return std::make_shared< PaymentRecord >( organizationName, chainId, from, to, assetAddress,
        value, nonce, resourceLocation, settlementTime, authorizationSignatureHash, transactionHash,
        fromIpAddress, jsonInfo );
}