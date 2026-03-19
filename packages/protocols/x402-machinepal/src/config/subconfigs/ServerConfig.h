#pragma once

#include "HTTPConfig.h"
#include "HTTPSConfig.h"
#include "MachinePalCommon.h"

class FileManager;

class ServerConfig {
    std::string hostName_;
    std::string bindIp_;
    ptr< HTTPConfig > http_;

private:
    ptr< HTTPSConfig > https_;

    ServerConfig( const std::string& hostName, const std::string& bindIp, ptr< HTTPConfig > http,
        ptr< HTTPSConfig > https );

public:
    const std::string& bindIp() const;
    const ptr< HTTPConfig > http() const;
    const ptr< HTTPSConfig > https() const;
    static ptr< ServerConfig > createFromJson(
        const nlohmann::json& j, ptr< FileManager > fileManager );

    [[nodiscard]] std::string hostName() const { return hostName_; }
};