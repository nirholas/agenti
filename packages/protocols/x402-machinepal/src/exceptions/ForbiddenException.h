#pragma once

#include "BackendException.h"
#include <string>

class ForbiddenException : public BackendException {
public:
    explicit ForbiddenException( const std::string& message )
        : BackendException( "ForbiddenException", message ) {}
};