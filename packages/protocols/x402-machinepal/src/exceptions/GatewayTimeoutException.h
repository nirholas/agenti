#pragma once

#include <exception>
#include <string>

#include "BackendException.h"

class GatewayTimeoutException : public BackendException {
public:
    explicit GatewayTimeoutException( const std::string& _message )
        : BackendException( "GatewayTimeoutException", _message ) {}

    const char* what() const noexcept override { return message.c_str(); }

private:
    std::string message;
};