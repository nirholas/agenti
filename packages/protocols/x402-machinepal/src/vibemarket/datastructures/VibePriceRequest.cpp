//
// Created by kladko on 2/9/26.
//

#include "MachinePalCommon.h"
#include "config/JsonUtils.h"
#include "VibePriceRequest.h"

VibePriceRequest VibePriceRequest::fromJson(const nlohmann::json& j)
{
    CHECK_STATE_JSON(j.is_object(), "VibePriceRequest::fromJson: expected JSON object", j);

    auto itToken = j.find("token");
    CHECK_STATE_JSON(itToken != j.end() && !itToken->is_null(),
        "VibePriceRequest::fromJson: missing field: token",
        j);
    CHECK_STATE_JSON(itToken->is_string(),
        "VibePriceRequest::fromJson: field must be string: token",
        j);

    VibePriceRequest out{};
    out.token_ = itToken->get<std::string>();
    return out;
}

nlohmann::json VibePriceRequest::toJson() const
{
    nlohmann::json j = nlohmann::json::object();
    j["token"] = token_;
    return j;
}
