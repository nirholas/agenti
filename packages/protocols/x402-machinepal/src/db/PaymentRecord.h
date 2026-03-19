#pragma once
#include "MachinePalCommon.h"  // added for Hash and u256
#include "crypto/EIP3009Nonce.h"
#include "crypto/TokenAmount.h"
#include "crypto/Encoding.h"
#include "crypto/EthAddress.h"
#include <soci/row.h>

class OrganizationConfig;
class EIP712Domain;
class ResourceConfig;
class PaymentPayload;
class EIP3009Nonce;
class TokenAmount;
class EthAddress;
/**
 * @brief Represents a payment record.
 */
class PaymentRecord {
    std::string organizationName_;
    u256 chainId_;
    EthAddress fromAddress_;
    EthAddress toAddress_;
    EthAddress assetAddress_;
    TokenAmount value_;
    EIP3009Nonce nonce_;
    string resourceLocation_;
    uint64_t settlementTime_;
    Hash authorizationSignatureHash_;
    Hash transactionHash_;
    std::string fromIpAddress_;
    std::string jsonInfo_;

public:
    [[nodiscard]] std::string organizationName() const;

    [[nodiscard]] u256 chainId() const;

    [[nodiscard]] EthAddress fromAddress() const;

    [[nodiscard]] EthAddress toAddress() const;

    [[nodiscard]] EthAddress assetAddress() const;

    [[nodiscard]] TokenAmount value() const;

    [[nodiscard]] EIP3009Nonce nonce() const;

    [[nodiscard]] string resourceLocation() const;  // returns resource hash

    [[nodiscard]] uint64_t settlementTime() const;

    [[nodiscard]] Hash authorizationSignatureHash() const;

    [[nodiscard]] Hash transactionHash() const;

    [[nodiscard]] std::string fromIpAddress() const;  // add nodiscard

    [[nodiscard]] std::string jsonInfo() const;

    static ptr< PaymentRecord > createPaymentRecord( const PaymentPayload& payload,
        const EIP712Domain& domain, const ResourceConfig& resource,
        const OrganizationConfig& organization, const Hash& transactionHash,
        const string& ipAddress );


    PaymentRecord( const std::string& organizationName, const u256 chainId,
        const EthAddress& fromAddress, const EthAddress& toAddress, const EthAddress& assetAddress,
        const TokenAmount& value, const EIP3009Nonce& nonce, const string& resourceIdentifier,
        uint64_t settlementTime, const Hash& authorizationSignatureHash,
        const Hash& transactionHash, const std::string& fromIpAddress,
        const std::string& jsonInfo );

    static ptr< PaymentRecord > deserializeFromDbRow( const soci::row& row );
};