#pragma once

#include <string>

#include "McpRequest.h"
#include "crypto/TokenAmount.h"
#include <nlohmann/json.hpp>


class VibeBuyRequest : public McpRequest{
    std::string token;
    TokenAmount amount;


public:
    static VibeBuyRequest fromJson(const nlohmann::json& j);
    nlohmann::json toJson() const;

    const std::string& getToken() const { return token; }
    const TokenAmount& getAmount() const { return amount; }
};
