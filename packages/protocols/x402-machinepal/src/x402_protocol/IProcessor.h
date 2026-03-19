#pragma once
#include <memory>
#include <string>

namespace proxygen {
class HTTPMessage;
}

class HttpError;

class IProcessor {
public:
    virtual ~IProcessor() = default;

    virtual void onRequestStart(const std::unique_ptr<proxygen::HTTPMessage>& headers) noexcept = 0;
    virtual void onRequestFullyReceived(const std::unique_ptr<proxygen::HTTPMessage>& reqHeaders, const std::string& body) noexcept = 0;
    virtual void onBodySizeIncrease(size_t newSize) = 0;
    virtual bool isReplySent() const = 0;
};

