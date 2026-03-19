#include "PassThroughConfig.h"

#include "config/JsonUtils.h"

std::shared_ptr<PassThroughConfig> PassThroughConfig::createFromJson(
    const nlohmann::json& j, ptr<FileManager> /*fileManager*/)
{

    if (j.contains("enable")) {
        CHECK_STATE_JSON(j["enable"].is_boolean(), "enable must be boolean", j);
        if (!j["enable"].get<bool>()) {
            return nullptr;
        }
    }


    CHECK_STATE_JSON(j.contains("target_url"), "Passthrough config must contain target_url", j);


    CHECK_STATE_JSON(j["target_url"].is_string(), "target_url must be string", j);

    auto targetUrl = j["target_url"].get<std::string>();
    return std::shared_ptr<PassThroughConfig>(new PassThroughConfig(targetUrl));
}
