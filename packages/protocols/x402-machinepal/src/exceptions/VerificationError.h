#pragma once

#include "BackendException.h"
#include <string>


class VerificationError : public BackendException {
public:
    explicit VerificationError( const std::string& message )
        : BackendException( "VerificationError", message ) {}
};