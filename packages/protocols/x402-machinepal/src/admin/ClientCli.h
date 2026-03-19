

#pragma once

#include <string>
#include <proxygen/lib/http/HTTPMethod.h>

#include "CLI/CLI.hpp"


namespace proxygen {
    enum class HTTPMethod;
}

class ClientConfig {
public:
    std::string url;
    proxygen::HTTPMethod method = proxygen::HTTPMethod::GET;
    std::string payload;
};

namespace ClientCli {

    void addClientSubcommand(CLI::App& app, ClientConfig& config);
    int runClientCommand(const ClientConfig& config);

}
