#pragma once

#include "BackendException.h"
#include <string>

class UnauthorizedException : public BackendException {
public:
    explicit UnauthorizedException( const std::string& message )
        : BackendException( "UnauthorizedException", message ) {}
};