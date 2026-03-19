#pragma once
#include "../x402_protocol/IResponseSender.h"
#include <folly/io/async/EventBaseManager.h>
#include <proxygen/httpserver/ResponseBuilder.h>
#include <chrono>
#include "MachinePalCommon.h"

class ProxygenResponseSender : public IResponseSender {
public:
    void sendResponse(const std::pair<uint16_t, std::string> &statusAndMessage,
                      const proxygen::HTTPHeaders &headers,
                      const std::string &body) override;

    static ptr<ProxygenResponseSender> makeShared(proxygen::ResponseHandler *downstream,
                                                  folly::EventBase *eventBase, proxygen::HTTPMessage &requestHeaders,
                                                  const string &clientAddress);

    void setSanitizedUserAgent();

private:
    proxygen::ResponseHandler *downstream_;
    folly::EventBase *eventBase_;
    weak_ptr<ProxygenResponseSender> weakSelf_;
    std::chrono::steady_clock::time_point creationTime_;
    proxygen::HTTPMessage requestHeaders_;
    string requestId_;
    string method_;
        string userAgent_;
        uint64_t bytesSent_ = 0;
    string clientAddress_;
    string path_;

    explicit ProxygenResponseSender(proxygen::ResponseHandler *downstream,
                                    folly::EventBase *eventBase, proxygen::HTTPMessage &requestHeaders,
                                    const string& clientAddress);

    void setWeakSelf(const weak_ptr<ProxygenResponseSender> &weakSelf);

    void logAccess(const std::string& service, int status);

    void logAccessAsJson(const std::string &service, int status);

    void logAccessAsCLF( const std::string& service, int status);

    std::string generateRequestId();

    std::string getOrCreateRequestId(proxygen::HTTPMessage &msg);
};
