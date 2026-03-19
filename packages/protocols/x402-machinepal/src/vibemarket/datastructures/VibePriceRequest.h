#pragma once
#include <string>
#include <nlohmann/json.hpp>
#include "McpRequest.h"

class VibePriceRequest : public McpRequest {
    std::string token_;
public:
    static VibePriceRequest fromJson(const nlohmann::json& j);
    [[nodiscard]] nlohmann::json toJson() const;
    [[nodiscard]] const std::string& token() const { return token_; }
};
