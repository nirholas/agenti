#include "ServerConfig.h"
#include <regex>
#include <stdexcept>

#include "config/ConfigLoader.h"
#include "config/JsonUtils.h"
#include "exceptions/JsonValidationException.h"

static const std::regex ipv4_regex(
    R"(^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$)" );
static const std::regex ipv6_regex( R"(^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$)" );

ServerConfig::ServerConfig( const std::string& hostName, const std::string& bindIp,
                            ptr< HTTPConfig > http, ptr< HTTPSConfig > https )
    : hostName_( hostName ), bindIp_( bindIp ), http_( http ), https_( https )
{
    // --- 1. Hostname Validation ---
    if ( hostName_.empty() ) {
        throw std::invalid_argument( "hostName cannot be empty." );
    }

    // Regex is acceptable for Hostnames (logic is simpler than IP)
    static const std::regex hostname_regex(
        R"(^([a-zA-Z0-9][-a-zA-Z0-9]{0,62})(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})*$)" );

    if ( !std::regex_match( hostName_, hostname_regex ) ) {
        throw std::invalid_argument("hostname is not a valid local or internet hostname: '" + hostName_ + "'");
    }

    // --- 2. IP Address Validation (Optimized) ---
    if ( bindIp_.empty() ) {
        throw std::invalid_argument( "bindIp cannot be empty." );
    }

    // We use a buffer large enough for IPv6 (16 bytes).
    // inet_pton returns 1 on success.
    unsigned char buf[sizeof(struct in6_addr)];
    bool isValidIp = (inet_pton(AF_INET, bindIp_.c_str(), buf) == 1) ||
                     (inet_pton(AF_INET6, bindIp_.c_str(), buf) == 1);

    if ( !isValidIp ) {
        throw std::invalid_argument( "bindIp is not a valid IPv4 or IPv6 address." );
    }

    // --- 3. Protocol Validation ---
    if ( !http_ && !https_ ) {
        throw std::invalid_argument(
            "At least one protocol (HTTP or HTTPS) must be enabled in the server configuration." );
    }
}


ptr< ServerConfig > ServerConfig::createFromJson(
    const nlohmann::json& j, ptr< FileManager > fileManager ) {
    try {
        CHECK_STATE( fileManager );
        CHECK_STATE( j.is_object() );


        ptr< HTTPConfig > httpConfig = nullptr;

        if ( j.contains( "http" )) {
            CHECK_STATE_JSON( j.at( "http" ).is_object(), "http must be object", j );
            const auto& jt = j.at( "http" );
            httpConfig = HTTPConfig::createFromJson( jt, fileManager );
        }
        ptr< HTTPSConfig > httpsConfig = nullptr;
        if ( j.contains( "https" )) {
            CHECK_STATE_JSON( j.at( "https" ).is_object(), "https must be object", j );
            const auto& jt = j.at( "https" );
            httpsConfig = HTTPSConfig::createFromJson( jt, fileManager );
        }
        if ( !httpConfig && !httpsConfig ) {
            throw JsonValidationException(
                "At least one of HTTP or HTTPS must be configured in server config", j );
        }

        CHECK_STATE_JSON( j.contains( "hostname" ), "Missing required hostname in server config", j );
        CHECK_STATE_JSON( j.at( "hostname" ).is_string(), "hostname must be string", j );
        auto hostname = j.at( "hostname" ).get< std::string >();
        return ptr< ServerConfig >( new ServerConfig(hostname,
            JsonUtils::getStringWithDefault( j, "bind_ip", "0.0.0.0" ), httpConfig, httpsConfig ) );
    } catch ( exception& ex ) {
        RETHROW_NESTED;
    }
}

const std::string& ServerConfig::bindIp() const {
    return bindIp_;
}
const ptr< HTTPConfig > ServerConfig::http() const {
    return http_;
}
const ptr< HTTPSConfig > ServerConfig::https() const {
    return https_;
}