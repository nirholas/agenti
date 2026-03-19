#pragma once

#include "BackendException.h"
#include <string>

class NotFoundException : public BackendException {
public:
    explicit NotFoundException( const std::string& message )
        : BackendException( "NotFoundException", message ) {}
};