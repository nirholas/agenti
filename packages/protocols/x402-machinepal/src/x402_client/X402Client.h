#pragma once

#include "MachinePalCommon.h"
#include "x402_server/ServerFactory.h"
#include <folly/SocketAddress.h>
#include <folly/init/Init.h>
#include <proxygen/httpserver/HTTPServer.h>

class EthPrivateKey;
class PaymentPayload;

struct HttpResponse {
    uint64_t status = 0;
    std::string body;
    proxygen::HTTPHeaders headers;
};

struct X402Client {
private:


    HttpResponse
    doGetRequest(std::string _location,
                              const std::vector<pair<string, string> > &_requestHeaders);

    HttpResponse doPostRequest(const std::string &_location,
                                               const std::vector<std::pair<std::string, std::string>> &_requestHeaders,
                                               const std::string &requestBody);


public:
    X402Client();

    ~X402Client();

    std::string baseUrl();



    HttpResponse doX402Request(proxygen::HTTPMethod method, const std::string &_location, const ptr<PaymentPayload> payload,
                                                          const ptr<std::string> &requestBody);

    HttpResponse buyAndRetrieveX402Resource(proxygen::HTTPMethod method, const std::string &url,
        EthPrivateKey& fundingKey, ptr<string> requestBody);;


};
