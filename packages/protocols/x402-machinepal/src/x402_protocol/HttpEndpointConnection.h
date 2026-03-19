#pragma once

#include <string>

class IBackendError;

namespace proxygen {
    class HTTPHeaders;
    class HTTPHeaders;
    enum class HTTPMethod;
}

class X402Processor;
class IResponseSender;

class HttpEndpointConnection {
    string url_;
    bool acceptAllCerts_;

public:
    HttpEndpointConnection(const string &url, bool acceptAllCerts)
        : url_(url),
          acceptAllCerts_(acceptAllCerts) {
    }

private:
    static curl_slist *createCurlHeadersFromProxygenHeaders(
        const proxygen::HTTPHeaders &requestHeaders);

    static std::string trimWhiteSpaceFromHeader(const std::string &str);

    static size_t headerCallback(char *buffer, size_t size, size_t nitems, void *userdata);

public:
    ptr<IBackendError> doGetRequest(
        const proxygen::HTTPHeaders &reqHeaders,
        uint64_t &httpStatusCode,
        proxygen::HTTPHeaders &responseHeaders,
        std::string &responseBody);

    ptr<IBackendError> doPostRequest(
        const proxygen::HTTPHeaders &requestHeaders,
        const std::string &requestBody,
        uint64_t &httpStatusCode,
        proxygen::HTTPHeaders &responseHeaders,
        std::string &responseBody);

    ptr<IBackendError> doHeadRequest(
        const proxygen::HTTPHeaders &reqHeaders,
        uint64_t &httpStatusCode,
        proxygen::HTTPHeaders &responseHeaders);

    ptr<IBackendError> doOptions(
        const proxygen::HTTPHeaders &reqHeaders,
        uint64_t &httpStatusCode,
        proxygen::HTTPHeaders &responseHeaders,
        std::string &responseBody);

    ptr<IBackendError> doPutRequest(
        const proxygen::HTTPHeaders &reqHeaders,
        const std::string &requestBody,
        uint64_t &httpStatusCode,
        proxygen::HTTPHeaders &responseHeaders,
        std::string &responseBody);

    ptr<IBackendError> doDeleteRequest(
        const proxygen::HTTPHeaders &requestHeaders,
        uint64_t &httpStatusCode,
        proxygen::HTTPHeaders &responseHeaders,
        std::string &responseBody);

    ptr<IBackendError> doRequest(proxygen::HTTPMethod method_,
                                 const proxygen::HTTPHeaders &reqHeaders,
                                 const std::string &requestBody,
                                 uint64_t &httpStatusCode,
                                 proxygen::HTTPHeaders &responseHeaders,
                                 std::string &responseBody);

    ptr<IBackendError> executeCurlRequest(
        const proxygen::HTTPHeaders &requestHeaders,
        uint64_t &httpStatusCode,
        proxygen::HTTPHeaders &responseHeaders,
        std::string &responseBody,
        const std::function<void(CURL *)> &configureMethod);

    static int debugCallback(CURL *, curl_infotype type, char *data, size_t size, void *);
};
