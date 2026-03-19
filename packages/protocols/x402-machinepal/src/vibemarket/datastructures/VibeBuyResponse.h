#pragma once


#include "McpResponse.h"


class VibeBuyResponse : public McpResponse {
public:
    static VibeBuyResponse fromJson(const nlohmann::json& j);

    nlohmann::json toJson() const { return McpResponse::toJson(); }
};
