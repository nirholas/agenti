#pragma once

#include "MachinePalCommon.h"

class FileManager;

class HTTPConfig {
public:
    uint16_t port() const;
    static ptr< HTTPConfig > createFromJson(
        const nlohmann::json& j, ptr< FileManager > fileManager );

protected:
    HTTPConfig( uint16_t port );
    uint16_t port_;
};