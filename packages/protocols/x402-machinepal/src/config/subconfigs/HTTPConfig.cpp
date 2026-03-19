#include "HTTPConfig.h"
#include <nlohmann/json.hpp>
#include <stdexcept>

#include "config/JsonUtils.h"
#include "filesystem/FileManager.h"

HTTPConfig::HTTPConfig( uint16_t port ) : port_( port ) {
    CHECK_STATE( port_ > 0 );
}

uint16_t HTTPConfig::port() const {
    return port_;
}

ptr< HTTPConfig > HTTPConfig::createFromJson(
    const nlohmann::json& j, ptr< FileManager > fileManager ) {
    try {
        CHECK_STATE( fileManager );
        CHECK_STATE( j.is_object() );
        bool enabled = JsonUtils::getBoolWithDefault( j, "enabled", true );
        if (!enabled) {
            return nullptr;
        }
        uint16_t port = JsonUtils::getUint16WithDefault( j, "port", 8080 );
        return ptr< HTTPConfig >( new HTTPConfig( port ) );
    } catch ( const std::exception& ex ) {
        RETHROW_NESTED;
    }
}