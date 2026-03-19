#pragma once
#include "MachinePalCommon.h"
#include <nlohmann/json.hpp>
#include <string>

class FileManager;

// Configuration for pass-through behavior at the app level
class PassThroughConfig {
private:
    std::string targetUrl_;

    explicit PassThroughConfig(std::string targetUrl)
        : targetUrl_(std::move(targetUrl)) {}

public:
    [[nodiscard]] const std::string& targetUrl() const { return targetUrl_; }

    static
        std::shared_ptr<PassThroughConfig> createFromJson(const nlohmann::json& j, ptr<FileManager> /*fileManager*/);
};
