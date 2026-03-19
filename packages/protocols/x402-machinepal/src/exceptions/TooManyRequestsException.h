#pragma once

#include "BackendException.h"
#include <exception>
#include <string>

class TooManyRequestsException : public BackendException {
public:
    explicit TooManyRequestsException( const std::string& _message )
        : BackendException( "TooManyRequestsException", _message ) {}

    const char* what() const noexcept override { return message.c_str(); }

private:
    std::string message;
};