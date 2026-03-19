#pragma once

#include <exception>
#include <nlohmann/json.hpp>
#include <string>

class JsonValidationException : public std::exception {
public:
    JsonValidationException( const std::string& message, const nlohmann::json& j )
        : message_( message ), json_( j ) {}

    const char* what() const noexcept override { return message_.c_str(); }

    const nlohmann::json& getJson() const { return json_; }

private:
    std::string message_;
    nlohmann::json json_;
};