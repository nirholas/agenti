#pragma once
#include "config/subconfigs/NetworkConfig.h"


/**
 * @brief Represents the payment requirements object for an x402 transaction.
 *
 * All string fields use std::string, and the timeout is an integer.
 * Note: maxAmountRequired is stored as a string as it represents a
 * large, unit-less integer (smallest token denomination) which could
 * exceed standard 64-bit integer limits.
 */

/**
 * @brief Represents the full x402 Payment Requirements object,
 * including optional fields like 'outputSchema' and 'extra'.
 */

class OrganizationConfig;
class ResourceConfig;
class MachinePalConfig;

using json = nlohmann::json;

class PaymentRequirements {
public:
    PaymentRequirements(
        std::string scheme,
        std::string network,
        std::string maxAmountRequired,
        std::string resource,
        std::string description,
        std::string mimeType,
        std::optional< json > outputSchema,
        std::string payTo,
        uint64_t maxTimeoutSeconds,
        std::string asset,
        json extra
        )
        : scheme_( std::move( scheme ) ),
          network_( std::move( network ) ),
          maxAmountRequired_( std::move( maxAmountRequired ) ),
          resource_( std::move( resource ) ),
          description_( std::move( description ) ),
          mimeType_( std::move( mimeType ) ),
          outputSchema_( std::move( outputSchema ) ),
          payTo_( std::move( payTo ) ),
          maxTimeoutSeconds_( maxTimeoutSeconds ),
          asset_( std::move( asset ) ),
          extra_( std::move( extra ) ) {
    };

    bool operator==( const PaymentRequirements& other ) const {
        return scheme_ == other.scheme_ &&
               network_ == other.network_ &&
               maxAmountRequired_ == other.maxAmountRequired_ &&
               resource_ == other.resource_ &&
               description_ == other.description_ &&
               mimeType_ == other.mimeType_ &&
               outputSchema_ == other.outputSchema_ &&
               payTo_ == other.payTo_ &&
               maxTimeoutSeconds_ == other.maxTimeoutSeconds_ &&
               asset_ == other.asset_ &&
               extra_ == other.extra_;
    }

    friend std::ostream& operator<<( std::ostream& os, const PaymentRequirements& p ) {
        os << "{scheme: " << p.scheme_
            << ", network: " << p.network_
            << ", maxAmountRequired: " << p.maxAmountRequired_
            << ", resource: " << p.resource_
            << ", description: " << p.description_
            << ", mimeType: " << p.mimeType_
            << ", outputSchema: " << ( p.outputSchema_ ? p.outputSchema_->dump() : "null" )
            << ", payTo: " << p.payTo_
            << ", maxTimeoutSeconds: " << p.maxTimeoutSeconds_
            << ", asset: " << p.asset_
            << ", extra: " << p.extra_.dump()
            << "}";
        return os;
    }


    // Getters
    const std::string& scheme() const { return scheme_; }
    const std::string& network() const { return network_; }
    const std::string& maxAmountRequired() const { return maxAmountRequired_; }
    const std::string& resource() const { return resource_; }
    const std::string& description() const { return description_; }
    const std::string& mimeType() const { return mimeType_; }
    const std::optional< json >& outputSchema() const { return outputSchema_; }
    const std::string& payTo() const { return payTo_; }
    uint64_t maxTimeoutSeconds() const { return maxTimeoutSeconds_; }
    const std::string& asset() const { return asset_; }
    const json& extra() const { return extra_; }


    static std::shared_ptr< PaymentRequirements > fromJson( const json& j );

    json toJson() const;
    static ptr<PaymentRequirements> makePaymentRequirements( const OrganizationConfig& organization,
        const  ResourceConfig& resource,
        const NetworkConfig& networkConfig );

private:
    static std::shared_ptr< std::string > toString( const PaymentRequirements& p );


    std::string scheme_;
    std::string network_;
    std::string maxAmountRequired_;
    std::string resource_;
    std::string description_;
    std::string mimeType_;
    std::optional< json > outputSchema_;
    std::string payTo_;
    uint64_t maxTimeoutSeconds_;
    std::string asset_;
    json extra_; // New: object | null
};

// Add these declarations for ADL:
void toJson( json& j, const PaymentRequirements& p );
void fromJson( const json& j, PaymentRequirements& p );
