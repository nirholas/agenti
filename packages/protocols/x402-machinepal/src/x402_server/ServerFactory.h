#pragma once


#include "config/MachinePalConfig.h"
#include <proxygen/httpserver/HTTPServer.h>


namespace proxygen {
class HTTPServer;
}

class MachinePalApp;

class ServerFactory {
    MachinePalApp& app_;

public:
    explicit ServerFactory( MachinePalApp& app ) : app_( app ) {}

    std::shared_ptr< proxygen::HTTPServer > createServerInstance(
        const ServerConfig& serverConfig );

private:
    static bool isRedHat();
    static bool isAlpine();
    static void addHttpServerToIPConfigs( const ServerConfig& serverConfig,
        std::vector< proxygen::HTTPServer::IPConfig >& ipConfigs );

    static void addHTTPSServerToIpConfigs( const ServerConfig& serverConfig,
        std::vector< proxygen::HTTPServer::IPConfig >& ipConfigs );
};