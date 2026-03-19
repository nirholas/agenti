#include "PaymentRequirements.h"
#include "MachinePalCommon.h"
#include "config/JsonUtils.h"
#include "config/subconfigs/NetworkConfig.h"
#include "config/subconfigs/OrganizationConfig.h"
#include "config/subconfigs/ResourceConfig.h"

/**
 * @brief Serializes a PaymentRequirements struct into a JSON string.
 * Handles 'outputSchema' conditionally: the key is omitted if the optional is empty.
 */
std::shared_ptr< std::string > PaymentRequirements::toString( const PaymentRequirements& p ) {
    return std::make_shared< std::string >( p.toJson().dump() );
}

// --- Custom JSON Deserialization (fromJson) ---
/**
 * @brief Deserializes a nlohmann::json object into a PaymentRequirements struct.
 * Handles 'outputSchema' conditionally: sets the optional to nullopt if the key is missing.
 */
std::shared_ptr< PaymentRequirements > PaymentRequirements:: fromJson( const json& j ) {
    auto scheme = JsonUtils::mustContainString( j, "scheme" );
    auto network = JsonUtils::mustContainString( j, "network" );
    auto maxAmountRequired = JsonUtils::mustContainString( j, "maxAmountRequired" );
    auto resource = JsonUtils::mustContainString( j, "resource" );
    auto description = JsonUtils::mustContainString( j, "description" );
    auto mimeType = JsonUtils::mustContainString( j, "mimeType" );
    std::optional< json > outputSchema =
        ( j.contains( "outputSchema" ) && !j.at( "outputSchema" ).is_null() ) ?
            std::optional< json >( j.at( "outputSchema" ) ) :
            std::nullopt;
    auto payTo = JsonUtils::mustContainString( j, "payTo" );
    int maxTimeoutSeconds = j.at( "maxTimeoutSeconds" ).get< int >();
    std::string asset = JsonUtils::mustContainString( j, "asset" );
    json extra = j.at( "extra" );
    auto p = std::make_shared< PaymentRequirements >( scheme, network, maxAmountRequired, resource,
        description, mimeType, outputSchema, payTo, maxTimeoutSeconds, asset, extra );
    return p;
}

json PaymentRequirements::toJson() const {
    json j;
    j["scheme"] = scheme_;
    j["network"] = network_;
    j["maxAmountRequired"] = maxAmountRequired_;
    j["resource"] = resource_;
    j["description"] = description_;
    j["mimeType"] = mimeType_;
    j["payTo"] = payTo_;
    j["maxTimeoutSeconds"] = maxTimeoutSeconds_;
    j["asset"] = asset_;
    j["extra"] = extra_;
    if ( outputSchema_.has_value() ) {
        j["outputSchema"] = outputSchema_.value();
    }
    return j;
}


ptr< PaymentRequirements > PaymentRequirements::makePaymentRequirements(
    const OrganizationConfig& , const ResourceConfig& resource,
    const NetworkConfig& networkConfig ) {

    auto priceStr = resource.priceStr();
    auto scheme = resource.paymentScheme();
    auto mimeType = resource.mimeType();
    auto network = networkConfig.name();
    auto payTo = networkConfig.walletAddress().toHex(PREFIX_0x);
    auto maxTimeoutSeconds = 600;
    auto description = resource.description();
    auto tokenName = resource.token();
    auto asset = networkConfig.getTokenAddress( tokenName );
    auto extraVersion = networkConfig.getTokenVersion( tokenName );
    ;
    // auto path = resource_->machinePalPath();
    nlohmann::json extra;
    extra["name"] = tokenName;
    if ( !extraVersion.empty() ) {
        extra["version"] = extraVersion;
    }
    return make_shared< PaymentRequirements >( scheme, network, priceStr,
        resource.location(),
        description, mimeType,
        std::nullopt,  // outputSchema
        payTo, maxTimeoutSeconds, asset, extra );
}