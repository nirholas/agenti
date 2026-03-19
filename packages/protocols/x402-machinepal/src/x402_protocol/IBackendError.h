#pragma once

class IBackendError {
public:
    IBackendError() = default;
    virtual ~IBackendError() = default;

    virtual uint64_t getError() const = 0;

    virtual const string& getMessage() const = 0;
};

