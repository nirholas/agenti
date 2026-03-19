#include "ServerFactory.h"
#include "MachinePalCommon.h"
#include "X402HandlerFactory.h"
#include "crypto/CertManager.h"

#include <proxygen/httpserver/HTTPServer.h>
#include <proxygen/httpserver/HTTPServerOptions.h>

#include "config/subconfigs/ServerConfig.h"


using namespace proxygen;

bool ServerFactory::isRedHat() {
    return std::filesystem::exists("/etc/redhat-release");
}

bool ServerFactory::isAlpine() {
    std::ifstream f("/etc/os-release");
    std::string line;
    while (std::getline(f, line)) {
        if (line.find("ID=alpine") != std::string::npos) {
            return true;
        }
    }
    return std::filesystem::exists("/etc/alpine-release");
}

void ServerFactory::addHttpServerToIPConfigs(
    const ServerConfig &serverConfig, std::vector<HTTPServer::IPConfig> &ipConfigs) {
    auto http = serverConfig.http();
    CHECK_STATE(http);
    ipConfigs.emplace_back(folly::SocketAddress(serverConfig.bindIp(), http->port(), true),
                           HTTPServer::Protocol::HTTP);
}

void ServerFactory::addHTTPSServerToIpConfigs(
    const ServerConfig &serverConfig, std::vector<HTTPServer::IPConfig> &ipConfigs) {
    auto https = serverConfig.https();
    CHECK_STATE(https);
    auto sslCfg = CertManager::createAndValidateWangleSSLContext(https);

    HTTPServer::IPConfig config(folly::SocketAddress(serverConfig.bindIp(), https->port(), true),
                                HTTPServer::Protocol::HTTP2); // we use HTTP2 for HTTPS, since this is default for
    // industry now
    config.sslConfigs.push_back(sslCfg);
    ipConfigs.emplace_back(config);
}

std::shared_ptr<HTTPServer> ServerFactory::createServerInstance(
    const ServerConfig &serverConfig) {
    try {
        HTTPServerOptions options;

        auto factory = std::make_unique<X402HandlerFactory>(app_);

        options.idleTimeout = std::chrono::milliseconds(60000);
        options.handlerFactories = RequestHandlerChain().addThen(std::move(factory)).build();


        std::vector<HTTPServer::IPConfig> ipConfigs;

        if (serverConfig.http()) {
            addHttpServerToIPConfigs(serverConfig, ipConfigs);
        }

        if (serverConfig.https()) {
            addHTTPSServerToIpConfigs(serverConfig, ipConfigs);
        }

        if (ipConfigs.empty()) {
            throw std::runtime_error(
                "At least one of HTTP or HTTPS must"
                " be enabled in the server configuration.");
        }


        auto server = std::make_shared<HTTPServer>(std::move(options));

        for (const auto &config: ipConfigs) {
            auto protocol = config.sslConfigs.empty() ? "HTTP" : "HTTPS";
            LOG_NETWORK_INFO("Starting {} server on  {}:{}",
                         protocol, config.address.getAddressStr(),
                         config.address.getPort());
        }

        server->bind(ipConfigs);
        return server;
    } catch (const std::exception &ex) {
        RETHROW_NESTED;
    }
}
