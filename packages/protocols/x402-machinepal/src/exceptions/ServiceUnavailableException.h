#pragma once

#include "BackendException.h"
#include <string>

class ServiceUnavailableException : public BackendException {
public:
    explicit ServiceUnavailableException( const std::string& message )
        : BackendException( "ServiceUnavailableException", message ) {}
};