//
// Created by kladko on 2/9/26.
//

#include "MachinePalCommon.h"

#include "McpResponse.h"

#include "config/JsonUtils.h"

McpResponse McpResponse::fromJson(const nlohmann::json& j)
{
    CHECK_STATE_JSON(j.is_object(), "McpResponse::fromJson: expected JSON object", j);

    auto itResult = j.find("result");
    CHECK_STATE_JSON(itResult != j.end() && !itResult->is_null(),
        "McpResponse::fromJson: missing field: result",
        j);
    CHECK_STATE_JSON(itResult->is_object(),
        "McpResponse::fromJson: field must be object: result",
        j);
    const nlohmann::json& result = *itResult;

    McpResponse out{};
    out.isError_ = false;
    out.textContent_.clear();
    out.jsonContent_ = nlohmann::json::array();

    if (auto itErr = result.find("isError"); itErr != result.end() && !itErr->is_null())
    {
        CHECK_STATE_JSON(itErr->is_boolean(),
            "McpResponse::fromJson: field must be boolean: result.isError",
            result);
        out.isError_ = itErr->get<bool>();
    }

    auto itContent = result.find("content");
    CHECK_STATE_JSON(itContent != result.end() && !itContent->is_null(),
        "McpResponse::fromJson: missing field: result.content",
        result);
    CHECK_STATE_JSON(itContent->is_array(),
        "McpResponse::fromJson: field must be array: result.content",
        result);

    bool sawText = false;

    for (const auto& item : *itContent)
    {
        CHECK_STATE_JSON(item.is_object(),
            "McpResponse::fromJson: content item must be object",
            item);

        auto itType = item.find("type");
        CHECK_STATE_JSON(itType != item.end() && !itType->is_null(),
            "McpResponse::fromJson: content item missing field: type",
            item);
        CHECK_STATE_JSON(itType->is_string(),
            "McpResponse::fromJson: content item field must be string: type",
            item);
        const std::string type = itType->get<std::string>();

        if (type == "text")
        {
            auto itText = item.find("text");
            CHECK_STATE_JSON(itText != item.end() && !itText->is_null(),
                "McpResponse::fromJson: content item missing field: text",
                item);
            CHECK_STATE_JSON(itText->is_string(),
                "McpResponse::fromJson: content item field must be string: text",
                item);

            sawText = true;
            if (!out.textContent_.empty())
                out.textContent_.append("\n");
            out.textContent_.append(itText->get<std::string>());
        }
        else if (type == "json")
        {
            auto itJson = item.find("json");
            CHECK_STATE_JSON(itJson != item.end() && !itJson->is_null(),
                "McpResponse::fromJson: content item missing field: json",
                item);
            CHECK_STATE_JSON(itJson->is_object(),
                "McpResponse::fromJson: content item field must be object: json",
                item);
            out.jsonContent_.push_back(*itJson);
        }
        else
        {
            CHECK_STATE_JSON(false,
                "McpResponse::fromJson: unsupported content item type",
                item);
        }
    }

    if (out.isError_)
    {
        CHECK_STATE_JSON(!itContent->empty(),
            "McpResponse::fromJson: result.content must be non-empty when result.isError is true",
            result);
        CHECK_STATE_JSON(sawText && !out.textContent_.empty(),
            "McpResponse::fromJson: expected at least one text message in result.content when result.isError is true",
            result);
    }

    return out;
}

nlohmann::json McpResponse::toJson() const
{
    nlohmann::json result = nlohmann::json::object();
    result["isError"] = isError_;

    nlohmann::json content = nlohmann::json::array();

    if (!textContent_.empty())
    {
        // Represent the accumulated text as a single MCP text item.
        content.push_back(nlohmann::json{
            {"type", "text"},
            {"text", textContent_}
        });
    }

    if (jsonContent_.is_array())
    {
        for (const auto& obj : jsonContent_)
        {
            CHECK_STATE_JSON(obj.is_object(), "McpResponse::toJson: jsonContent_ elements must be objects", obj);
            content.push_back(nlohmann::json{
                {"type", "json"},
                {"json", obj}
            });
        }
    }
    else if (!jsonContent_.is_null())
    {
        // Defensive: if someone set it to a single object, still serialize coherently.
        CHECK_STATE_JSON(jsonContent_.is_object(), "McpResponse::toJson: jsonContent_ must be array (or object)", jsonContent_);
        content.push_back(nlohmann::json{
            {"type", "json"},
            {"json", jsonContent_}
        });
    }

    result["content"] = std::move(content);

    // Mirror the shape consumed by fromJson(): { "result": { ... } }
    return nlohmann::json{{"result", std::move(result)}};
}
