#include "ResourceConfig.h"

#include "OrganizationConfig.h"
#include "config/JsonUtils.h"
#include "exceptions/JsonValidationException.h"
#include "url/URLUtils.h"


class FileManager;


ResourceType ResourceConfig::mustContainType( const nlohmann::json& j ) {
    auto typeString = JsonUtils::mustContainString( j, "type" );
    if ( typeString == "local_file" ) {
        return ResourceType::LocalFile;
    }
    if ( typeString == "api-jsonrpc" ) {
        return ResourceType::ApiJsonRpc;
    }

    if ( typeString == "api-rest" ) {
        return ResourceType::ApiRest;
    }

    throw JsonValidationException( "Invalid resource type: " + typeString, j );
}

ptr< ResourceConfig > ResourceConfig::createFromJson(
    const nlohmann::json& j, ptr< FileManager > fileManager ) {
    try {
        CHECK_STATE( fileManager );
        auto name = JsonUtils::mustContainString( j, "name" );
        auto type = mustContainType( j );
        auto location = JsonUtils::mustContainString( j, "location" );
        auto price = JsonUtils::mustContainPrice( j, "price" );
        auto token = JsonUtils::mustContainString( j, "token" );


        if (type != ResourceType::LocalFile) {
            // For non-local files, validate URL format
            CHECK_STATE_JSON(URLUtils::isValidUrl(location),
                             "Invalid URL format for resource location: " + location, j);
        } else {
            // For local files, ensure the file exists and is readable
            fileManager->checkFileExistsAndReadableAndResolve(location);
        }

        return ptr< ResourceConfig >( new ResourceConfig( name, location, type, price, token ) );
    } catch ( const std::exception& ex ) {
        RETHROW_NESTED;
    }
}

ptr< vector< ptr< ResourceConfig > > > ResourceConfig::createVectorFromJsonArray(
    const nlohmann::json& j, ptr< FileManager > fileManager ) {
    try {
        CHECK_STATE( fileManager );
        auto result = std::make_shared< std::vector< ptr< ResourceConfig > > >();
        if ( !j.contains( "resources" ) )
            return result;
        auto resources = j.at( "resources" );
        CHECK_STATE_JSON( resources.is_array(), "resources must be an array", j );
        for ( const auto& item : resources ) {
            auto res = createFromJson( item, fileManager );
            CHECK_STATE ( res );
            result->push_back( res );
        }
        return result;
    } catch ( const std::exception& ex ) {
        RETHROW_NESTED;
    }
}

ResourceConfig::ResourceConfig( const std::string& name, const std::string& location,
    ResourceType type, boost::multiprecision::uint256_t price, const std::string& token )
    : name_( name ), location_( location ), type_( type ), price_( price ), token_( token ) {
    paymentScheme_ = "exact";
    if ( type_ == ResourceType::LocalFile ) {
        machinePalPath_ = location_;
        mimeType_ = "application/octet-stream";
    } else {
        machinePalPath_ = URLUtils::getLocationFromUrl( location_ );
        mimeType_ = "application/json";
    }
}

std::string ResourceConfig::getLocation() const {
    return location();
}