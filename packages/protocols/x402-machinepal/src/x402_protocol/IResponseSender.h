#pragma once

namespace proxygen {
    class HTTPHeaders;
}

class IResponseSender {
public:
    virtual ~IResponseSender() = default;
    virtual void sendResponse( const std::pair< uint16_t, std::string >& statusAndMessage,
        const proxygen::HTTPHeaders & headers,
        const std::string& body = "" ) = 0;
};
