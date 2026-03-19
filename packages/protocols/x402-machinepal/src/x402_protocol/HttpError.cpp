#include "HttpError.h"

HttpError::HttpError( ErrorType type, const std::string& message )
    : type_( type ), message_( message ) {}

HttpError::HttpError( const HttpError& other ) : type_( other.type_ ), message_( other.message_ ) {}

HttpError::HttpError( HttpError&& other ) noexcept
    : type_( other.type_ ), message_( std::move( other.message_ ) ) {}

HttpError& HttpError::operator=( const HttpError& other ) {
    if ( this != &other ) {
        type_ = other.type_;
        message_ = other.message_;
    }
    return *this;
}

HttpError& HttpError::operator=( HttpError&& other ) noexcept {
    if ( this != &other ) {
        type_ = other.type_;
        message_ = std::move( other.message_ );
    }
    return *this;
}

HttpError::~HttpError() = default;

ErrorType HttpError::type() const {
    return type_;
}

std::string HttpError::message() const {
    return message_;
}