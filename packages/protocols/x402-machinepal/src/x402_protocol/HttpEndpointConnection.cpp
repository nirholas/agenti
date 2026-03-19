//
// Created by stan on 11/10/25.
//
#include "HttpEndpointConnection.h"

#include <proxygen/lib/http/HTTPMessage.h>
#include "MachinePalCommon.h"
#include "X402Processor.h"
#include "curl/curl.h"
#include <spdlog/spdlog.h>
#include <folly/String.h> // Required for folly::toLowerAscii and folly::trimWhitespace

#include "BackendCurlError.h"
#include "IBackendError.h"
#include "BackendHttpError.h"

// "https://jsonplaceholder.typicode.com/posts"


ptr<IBackendError> HttpEndpointConnection::doRequest(
    proxygen::HTTPMethod method_,
    const proxygen::HTTPHeaders &requestHeaders,
    const std::string &requestBody,
    uint64_t &httpStatusCode,
    proxygen::HTTPHeaders &responseHeaders,
    std::string &responseBody) {
    switch (method_) {
        case proxygen::HTTPMethod::GET:
            return doGetRequest(requestHeaders, httpStatusCode, responseHeaders, responseBody);
        case proxygen::HTTPMethod::POST:
            return doPostRequest(requestHeaders, requestBody, httpStatusCode, responseHeaders, responseBody);
        case proxygen::HTTPMethod::HEAD:
            return doHeadRequest(requestHeaders, httpStatusCode, responseHeaders);
        case proxygen::HTTPMethod::OPTIONS:
            return doOptions(requestHeaders, httpStatusCode, responseHeaders, responseBody);
        case proxygen::HTTPMethod::PUT:
            return doPutRequest(requestHeaders, requestBody, httpStatusCode, responseHeaders, responseBody
            );
        case proxygen::HTTPMethod::DELETE:
            return doDeleteRequest(requestHeaders, httpStatusCode, responseHeaders, responseBody);
        default:
            return make_shared<BackendHttpError>(501);
    }
}


// Helper to check if string starts with a prefix (case insensitive handling recommended in production)
bool startsWith(const std::string &fullString, const std::string &prefix) {
    return fullString.rfind(prefix, 0) == 0;
}

std::string getDetailedError(CURL *curl, CURLcode result) {
    // 1. Start with the standard libcurl description
    std::string errorMessage = std::string(curl_easy_strerror(result));

    // 2. Gather Context: URL and Port
    char *urlPtr = nullptr;
    long port = 0;
    curl_easy_getinfo(curl, CURLINFO_EFFECTIVE_URL, &urlPtr);
    curl_easy_getinfo(curl, CURLINFO_PRIMARY_PORT, &port);

    std::string url = urlPtr ? std::string(urlPtr) : "unknown url";
    bool isHttpScheme = startsWith(url, "http://");
    bool isHttpsScheme = startsWith(url, "https://");

    // 3. Append context-aware troubleshooting advice
    if (result == CURLE_PEER_FAILED_VERIFICATION) {
        errorMessage += " (SSL Certificate Problem). \n"
                "Possible causes:\n"
                "1. The server is using a self-signed certificate.\n"
                "2. The system's CA bundle is outdated or missing.\n"
                "3. System clock is incorrect (certificate appears expired).";
    } else if (result == CURLE_SSL_CONNECT_ERROR) {
        errorMessage += " (SSL Handshake Failed). \n"
                "The client and server could not agree on a protocol or cipher. ";

        // --- DETECT HTTPS -> HTTP PORT MISMATCH ---
        if (isHttpsScheme && port == 80) {
            errorMessage += "\n**POTENTIAL CONFIG ERROR:** You are connecting via HTTPS to port 80. "
                    "Standard HTTP ports do not support SSL handshakes. "
                    "Change the URL to 'http://' or the port to 443.";
        } else {
            errorMessage += "\nEnsure your client supports the TLS version required by the server.";
        }
    } else if (result == CURLE_OPERATION_TIMEDOUT) {
        errorMessage += " (Connection Timeout). \n"
                "The server took too long to respond. ";
    } else if (result == CURLE_COULDNT_CONNECT) {
        errorMessage += " (Connection Refused). \n"
                "Target port is not listening or is blocked by a firewall.";
    } else if (result == CURLE_GOT_NOTHING) {
        // --- DETECT HTTP -> HTTPS PORT MISMATCH ---
        if (isHttpScheme && port == 443) {
            errorMessage += " (Empty Response). \n"
                    "**POTENTIAL CONFIG ERROR:** You are connected via plain HTTP to port 443. "
                    "The server likely expects an SSL connection. Try changing URL to 'https://'.";
        } else {
            errorMessage += " The server closed the connection without sending any data.";
        }
    }

    // 4. General warning for plain HTTP errors
    if (isHttpScheme && result != CURLE_OK) {
        errorMessage += "\n[Note]: Request was made over unencrypted HTTP.";
    }

    return errorMessage;
}

ptr<IBackendError> HttpEndpointConnection::executeCurlRequest(
    const proxygen::HTTPHeaders &
    requestHeaders,
    uint64_t &httpStatusCode,
    proxygen::HTTPHeaders &responseHeaders,
    std::string &responseBody,
    const std::function<void(CURL *)> &configureMethod) {
    static thread_local std::unique_ptr<CURL, decltype(&curl_easy_cleanup)> curlThreadLocal(
        nullptr, &curl_easy_cleanup);

    if (!curlThreadLocal) {
        auto curlObject = curl_easy_init();
        if (!curlObject) {
            LOG_NETWORK_ERROR("Could not initialize CURL object");
            throw runtime_error("Could not initialize CURL object");
        }
        curlThreadLocal.reset(curlObject);
    }

    CHECK_STATE(curlThreadLocal);
    auto *curl = curlThreadLocal.get();
    curl_easy_reset(curl);

    struct curl_slist *headers = createCurlHeadersFromProxygenHeaders(requestHeaders);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
    CHECK_STATE(!url_.empty());
    curl_easy_setopt(curl, CURLOPT_URL, url_.c_str());

    // --- Setup Response Header Parsing ---
    curl_easy_setopt(curl, CURLOPT_HEADERFUNCTION, headerCallback);
    curl_easy_setopt(curl, CURLOPT_HEADERDATA, &responseHeaders);

    // --- Setup Response Body Parsing ---
    curl_easy_setopt(
        curl, CURLOPT_WRITEFUNCTION,
        +[](char *_ptr, size_t _size, size_t _nmemb, void *_userdata) -> size_t {
        auto *str = static_cast<std::string *>(_userdata);
        str->append(_ptr, _size * _nmemb);
        return _size * _nmemb;
        });
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseBody);


    if (spdlog::get_level() == spdlog::level::trace) {
        curl_easy_setopt(curl, CURLOPT_DEBUGFUNCTION, HttpEndpointConnection::debugCallback);
        curl_easy_setopt(curl, CURLOPT_VERBOSE, 1L);
    }


    //if (acceptAllCerts_) {
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 0L);
    //  } else {
    // Enable SSL certificate verification for security
    //     curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 1L);
    //     curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 2L);
    // }

    // Apply method-specific configurations
    if (configureMethod) {
        configureMethod(curl);
    }

    auto result = curl_easy_perform(curl);

    if (headers) {
        curl_slist_free_all(headers);
    }

    if (result != CURLE_OK) {
        std::string errorMessage = curl_easy_strerror(result);
        if (result == CURLE_PEER_FAILED_VERIFICATION) {
            errorMessage += " (SSL Certificate Problem). \n"
                    "Possible causes:\n"
                    "1. The server is using a self-signed certificate.\n"
                    "2. The system's CA bundle is outdated or missing.\n"
                    "3. System clock is incorrect (certificate appears expired or not yet valid).";
        } else if (result == CURLE_SSL_CONNECT_ERROR) {
            errorMessage += " (SSL Handshake Failed). \n"
                    "You may be trying to connect to non-HTTPS endoint. Or there may be a mismatch in supported"
                    "TLS ciphers \n";
        } else if (result == CURLE_OPERATION_TIMEDOUT) {
            errorMessage += " (Connection Timeout). \n"
                    "The server took too long to respond. Check your firewall settings or the server's load.";
        } else if (result == CURLE_COULDNT_RESOLVE_HOST) {
            errorMessage += " (DNS Resolution Failed). \n"
                    "Could not translate the hostname to an IP address. Check your DNS configuration or internet connection.";
        } else if (result == CURLE_COULDNT_CONNECT) {
            errorMessage += " (Connection Refused). \n"
                    "Target port is not listening or is blocked by a firewall.";
        }
        LOG_NETWORK_ERROR("CURL error: {}", errorMessage);
        return make_shared<BackendCurlError>(result, errorMessage);
    }

    uint64_t statusCode = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &statusCode);
    httpStatusCode = statusCode;
    if (httpStatusCode >= 400 && httpStatusCode != 402) {
        LOG_NETWORK_ERROR("Upstream service returned HTTP error: {}", httpStatusCode);
        return make_shared<BackendHttpError>(httpStatusCode);
    }

    return nullptr;
}

ptr<IBackendError> HttpEndpointConnection::doGetRequest(
    const proxygen::HTTPHeaders &requestHeaders,
    uint64_t &httpStatusCode,
    proxygen::HTTPHeaders &responseHeaders,
    std::string &responseBody) {
    return executeCurlRequest(requestHeaders, httpStatusCode, responseHeaders, responseBody, nullptr);
}

ptr<IBackendError> HttpEndpointConnection::doPostRequest(
    const proxygen::HTTPHeaders &requestHeaders,
    const std::string &requestBody,
    uint64_t &httpStatusCode,
    proxygen::HTTPHeaders &responseHeaders,
    std::string &responseBody) {
    return executeCurlRequest(requestHeaders, httpStatusCode, responseHeaders, responseBody,
                              [&](CURL *curl) {
                                  curl_easy_setopt(curl, CURLOPT_POST, 1L);
                                  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, requestBody.c_str());
                                  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, static_cast<long>(requestBody.size()));
                              });
}

ptr<IBackendError> HttpEndpointConnection::doHeadRequest(
    const proxygen::HTTPHeaders &requestHeaders,
    uint64_t &httpStatusCode,
    proxygen::HTTPHeaders &responseHeaders) {
    std::string responseBody; // Ignored for HEAD
    return executeCurlRequest(requestHeaders, httpStatusCode, responseHeaders, responseBody,
                              [](CURL *curl) {
                                  curl_easy_setopt(curl, CURLOPT_NOBODY, 1L);
                              });
}

ptr<IBackendError> HttpEndpointConnection::doOptions(
    const proxygen::HTTPHeaders &
    requestHeaders,
    uint64_t &httpStatusCode,
    proxygen::HTTPHeaders &responseHeaders,
    std::string &responseBody) {
    return executeCurlRequest(requestHeaders, httpStatusCode, responseHeaders, responseBody,
                              [](CURL *curl) {
                                  curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "OPTIONS");
                              });
}

ptr<IBackendError> HttpEndpointConnection::doPutRequest(
    const proxygen::HTTPHeaders &requestHeaders,
    const std::string &requestBody,
    uint64_t &httpStatusCode,
    proxygen::HTTPHeaders &responseHeaders,
    std::string &responseBody) {
    return executeCurlRequest(requestHeaders, httpStatusCode, responseHeaders, responseBody,
                              [&](CURL *curl) {
                                  curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "PUT");
                                  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, requestBody.c_str());
                                  curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, static_cast<long>(requestBody.size()));
                              });
}

ptr<IBackendError> HttpEndpointConnection::doDeleteRequest(
    const proxygen::HTTPHeaders &requestHeaders,
    uint64_t &httpStatusCode,
    proxygen::HTTPHeaders &responseHeaders,
    std::string &responseBody) {
    return executeCurlRequest(requestHeaders, httpStatusCode, responseHeaders, responseBody,
                              [](CURL *curl) {
                                  curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "DELETE");
                              });
}


curl_slist *HttpEndpointConnection::createCurlHeadersFromProxygenHeaders(
    const proxygen::HTTPHeaders &requestHeaders) {
    curl_slist *chunk = nullptr;

    // Block list (must be all lowercase)
    static const std::unordered_set<std::string> blockedHeaders = {
        "host",
        "content-length",
        "transfer-encoding",
        "connection",
        "expect",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "upgrade"
    };

    requestHeaders.forEach(
        [&chunk](const std::string &name, const std::string &value) {
            std::string lowerName = name;
            folly::toLowerAscii(lowerName);

            if (blockedHeaders.find(lowerName) == blockedHeaders.end()) {
                std::string headerStr = name + ": " + value;
                chunk = curl_slist_append(chunk, headerStr.c_str());
                CHECK_STATE(chunk);
            }
        });


    return chunk;
}


std::string HttpEndpointConnection::trimWhiteSpaceFromHeader(const std::string &str) {
    return folly::trimWhitespace(str).str();
}


size_t HttpEndpointConnection::headerCallback(char *buffer, size_t size, size_t nitems, void *userdata) {
    size_t totalSize = size * nitems;
    std::string raw(buffer, totalSize);

    auto *headers = static_cast<proxygen::HTTPHeaders *>(userdata);

    CHECK_STATE(headers);

    // Ignore blank lines (e.g., the one separating headers from body)
    if (folly::trimWhitespace(raw).empty()) {
        return totalSize;
    }

    // Ignore the HTTP status line (e.g., "HTTP/1.1 200 OK")
    if (raw.rfind("HTTP/", 0) == 0) {
        return totalSize;
    }

    // HTTP headers come in the format "Key: Value"
    size_t colonPos = raw.find(':');
    if (colonPos != std::string::npos) {
        std::string key = trimWhiteSpaceFromHeader(raw.substr(0, colonPos));
        std::string value = trimWhiteSpaceFromHeader(raw.substr(colonPos + 1));

        if (!key.empty()) {
            headers->add(key, value);
        }
    }


    return totalSize;
}


int HttpEndpointConnection::debugCallback(CURL *, curl_infotype type, char *data, size_t size, void *) {
    switch (type) {
        case CURLINFO_HEADER_OUT:
            LOG_NETWORK_INFO("CURL_SEND_HEADER:{}", std::string(data, size));
            break;
        case CURLINFO_DATA_OUT:
            LOG_NETWORK_INFO("CURL_SEND_DATA:{}", std::string(data, size));
            break;
        case CURLINFO_HEADER_IN:
            LOG_NETWORK_INFO("CURL_RECV_HEADER:{}", std::string(data, size));
            break;
        case CURLINFO_DATA_IN:
            LOG_NETWORK_INFO("CURL_RECV_DATA:{}", std::string(data, size));
            break;
        default:
            break;
    }
    return 0;
}