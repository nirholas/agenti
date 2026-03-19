#include "MachinePalCommon.h"

#include "VibeBuyResponse.h"

#include "config/JsonUtils.h"

VibeBuyResponse VibeBuyResponse::fromJson(const nlohmann::json& j)
{
    // Parse using base implementation and return as derived.
    const McpResponse base = McpResponse::fromJson(j);

    VibeBuyResponse out{};
    out.setIsError(base.isError());
    out.setTextContent(base.textContent());
    out.setJsonContent(base.jsonContent());
    return out;
}
