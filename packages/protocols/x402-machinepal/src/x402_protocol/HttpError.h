#pragma once


enum ErrorType { ERR_BAD_REQUEST = 400, ERR_INTERNAL_SERVER_ERROR = 500, ERR_BAD_GATEWAY = 502 };

class HttpError {
    ErrorType type_;
    std::string message_;

public:
    HttpError( ErrorType type, const std::string& message );
    HttpError( const HttpError& other );
    HttpError( HttpError&& other ) noexcept;
    HttpError& operator=( const HttpError& other );
    HttpError& operator=( HttpError&& other ) noexcept;
    ~HttpError();

    [[nodiscard]] ErrorType type() const;
    [[nodiscard]] std::string message() const;
};