#pragma once

#include "BackendException.h"
#include <string>

class BadGatewayException : public BackendException {
public:
    explicit BadGatewayException( const std::string& message )
        : BackendException( "BadGatewayException", message ) {}
};