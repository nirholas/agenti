#include "MachinePalCommon.h"
#include "ClientCli.h"
#include <CLI/CLI.hpp>
#include <boost/url.hpp> // Requires Boost 1.81+

#include "payment/datastructures/PaymentPayload.h"
#include "x402_client/X402Client.h"
#include <proxygen/lib/http/HTTPMethod.h>


void ClientCli::addClientSubcommand(CLI::App& app, ClientConfig& config) {
    auto* client = app.add_subcommand("client", "Client commands");

    auto boostUrlValidator = [](const std::string& val) -> std::string {
        // 1. Attempt to parse the URI
        boost::system::result<boost::urls::url_view> result = boost::urls::parse_uri(val);

        if (result.has_error()) {
            return "Invalid URL format: " + result.error().message();
        }

        if (result->scheme_id() != boost::urls::scheme::http &&
            result->scheme_id() != boost::urls::scheme::https) {
            return "URL must use http or https scheme";
            }

        if (!result->has_authority()) {
            return "URL must contain a valid host";
        }

        return ""; // Empty string means validation passed
    };

    client->add_option("-u,--url", config.url, "URL for the endpoint")
          ->type_name("URL")
          ->check(boostUrlValidator) // Apply the Boost validator here
          ->required();

    // Map method strings to proxygen::HTTPMethod enum values and transform input accordingly
    auto methodTransformer = CLI::CheckedTransformer(
            std::map<std::string, proxygen::HTTPMethod>{
                    {"GET", proxygen::HTTPMethod::GET},
                    {"POST", proxygen::HTTPMethod::POST},
            }, CLI::ignore_case);

    client->add_option("-m,--method", config.method, "HTTP method")
          ->type_name("METHOD")
          ->transform(methodTransformer)
          ->default_str("GET");

    client->add_option("-p,--payload-file", config.payload, "JSON payload file")
          ->type_name("JSON_STRING");
}

int ClientCli::runClientCommand(const ClientConfig &config) {
    ptr<PaymentPayload> payload = nullptr;
    std::string payloadContent;

    try {
        X402Client client;

        if (!config.payload.empty()) {
            std::ifstream payloadFile(config.payload);
            if (!payloadFile) {
                LOG_CLIENT_ERROR("Failed to open payload file: {}", config.payload);
                return 1;
            }
            std::stringstream buffer;
            buffer << payloadFile.rdbuf();
            payloadContent = buffer.str();
            payload = PaymentPayload::fromJson(json::parse(payloadContent));
        }

        client.doX402Request(config.method, config.url, payload, nullptr);
    } catch (const std::exception &ex) {
        LOG_CLIENT_ERROR("Exception running client command: {}", ex.what());
        return 1;
    }

    return 0;

}
