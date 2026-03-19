#pragma once

#include "IBackendError.h"

class BackendCurlError : public IBackendError {

public:
    BackendCurlError(uint64_t error, const std::string &message)
        : error_(error),
          message_(message) {
    }

    uint64_t getError() const override {
        return error_;
    }

    const std::string& getMessage() const  override {
        return message_;
    }

    virtual ~BackendCurlError() = default;

private:
    uint64_t error_;
    std::string message_;
};