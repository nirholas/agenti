#pragma once
#include <proxygen/lib/http/HTTPMessage.h>

#include "IBackendError.h"

class BackendHttpError : public IBackendError {
public:
    uint64_t getError() const {
        return error_;
    }

    const std::string &getMessage() const {
        return message_;
    }

    virtual ~BackendHttpError() = default;

    BackendHttpError(uint64_t error)
        : error_(error), message_(proxygen::HTTPMessage::getDefaultReason(static_cast<int>(error))) {
    }

private:
    uint64_t error_;
    std::string message_;
};
