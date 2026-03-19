#include "MachinePalCommon.h"

#include "VibeBuyRequest.h"

#include "config/JsonUtils.h"


VibeBuyRequest VibeBuyRequest::fromJson(const nlohmann::json& j)
{
    CHECK_STATE_JSON(j.is_object(), "VibeBuyRequest::fromJson: expected JSON object", j);

    auto requireString = [&](const char* key) -> std::string {
        CHECK_STATE_JSON(j.contains(key),
            std::string("VibeBuyRequest::fromJson: missing field: ") + key,
            j);
        CHECK_STATE_JSON(j.at(key).is_string(),
            std::string("VibeBuyRequest::fromJson: field must be string: ") + key,
            j);
        return j.at(key).get<std::string>();
    };

    VibeBuyRequest req;
    req.token       = requireString("token");
    req.amount      = TokenAmount::fromHexOrDecimal(requireString("amount"));
    return req;
}

nlohmann::json VibeBuyRequest::toJson() const
{
    nlohmann::json j = nlohmann::json::object();
    j["token"] = token;

    // Prefer the canonical string used by fromJson (hex-or-decimal).
    // Adjust this line to match your TokenAmount string/JSON API (e.g., toString(), toDecimalString(), toHexString()).
    j["amount"] = amount.toDecimal();

    return j;
}
