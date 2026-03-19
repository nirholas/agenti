#pragma once

#include <exception>
#include <string>

class BackendException : public std::exception {
public:
    BackendException( const std::string& prefix, const std::string& message )
        : message( prefix + ": " + message ) {}

    const char* what() const noexcept override { return message.c_str(); }

private:
    explicit BackendException( const std::string& message ) : message( message ) {}

    std::string message;
};