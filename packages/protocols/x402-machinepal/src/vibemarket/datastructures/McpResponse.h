#pragma once

#include <string>
#include <nlohmann/json.hpp>

class McpResponse {
    bool isError_ = false;
    std::string textContent_;
    nlohmann::json jsonContent_ = nlohmann::json::array();

protected:
    void setIsError(bool v) { isError_ = v; }
    void setTextContent(const std::string& v) { textContent_ = v; }
    void setJsonContent(const nlohmann::json& v) { jsonContent_ = v; }

public:
    virtual ~McpResponse() = default;

    bool isError() const { return isError_; }
    const std::string& textContent() const { return textContent_; }
    const nlohmann::json& jsonContent() const { return jsonContent_; }

    static McpResponse fromJson(const nlohmann::json& j);

    nlohmann::json toJson() const;
};
