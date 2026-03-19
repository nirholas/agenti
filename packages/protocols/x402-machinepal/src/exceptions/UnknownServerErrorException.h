#pragma once

#include "BackendException.h"
#include <string>

class UnknownServerErrorException : public BackendException {
public:
    explicit UnknownServerErrorException( const std::string& message )
        : BackendException( "UnknownServerErrorException", message ) {}
};