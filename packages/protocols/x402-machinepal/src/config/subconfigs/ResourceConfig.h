#pragma once
#include <boost/multiprecision/cpp_int.hpp>
#include <memory>

#include "MachinePalCommon.h"
#include "filesystem/FileManager.h"

class OrganizationConfig;

enum class ResourceType { LocalFile, ApiJsonRpc, ApiRest };


class ResourceConfig {
public:
    [[nodiscard]] std::string machinePalPath() const { return machinePalPath_; }

private:
    std::string name_;
    std::string location_;
    std::string machinePalPath_;
    ResourceType type_;
    boost::multiprecision::uint256_t price_;
    std::string token_;
    std::string mimeType_;
    std::string description_;
    std::string paymentScheme_;

    ResourceConfig( const std::string& name, const std::string& location, ResourceType type,
        boost::multiprecision::uint256_t price, const std::string& token );

public:
    std::string getLocation() const;


    const std::string& name() const { return name_; }
    const std::string& location() const { return location_; }
    ResourceType type() const { return type_; }
    const boost::multiprecision::uint256_t price() const { return price_; }
    const std::string& token() const { return token_; }

    const std::string priceStr() const { return price_.str(); }

    [[nodiscard]] std::string paymentScheme() const { return paymentScheme_; }

    [[nodiscard]] std::string mimeType() const { return mimeType_; }

    [[nodiscard]] std::string description() const { return description_; }

    static ResourceType mustContainType( const nlohmann::json& j );

    static ptr< ResourceConfig > createFromJson(
        const nlohmann::json& j, ptr< FileManager > fileManager );
    static ptr< vector< ptr< ResourceConfig > > > createVectorFromJsonArray(
        const nlohmann::json& j, ptr< FileManager > fileManager );
};