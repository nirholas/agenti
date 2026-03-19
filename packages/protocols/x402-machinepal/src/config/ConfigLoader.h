#pragma once


#include "MachinePalConfig.h"
#include "nlohmann/json.hpp"
#include <mutex>

class MachinePalConfig;

// Source-of-truth loader:
// 1) Load YAML from file.
// 2) Convert to JSON.
// 3) Overlay environment variables (selected keys).
// 4) Resolve secret *files* (read contents).
// 5) Validate against JSON Schema.
// 6) Materialize AppConfig.
class ConfigLoader {
public:
    explicit ConfigLoader( const std::map< std::string, std::string >& overrides )
        : overridesFromCliAndEnv_( overrides ) {}


    std::shared_ptr< MachinePalConfig > loadFromYamlFile(
        const filesystem::path& yamlPath, ptr< FileManager > fileManager );

private:
    // Helper: convert YAML (yaml-cpp node) to nlohmann::json
    static nlohmann::json yamlToJson( const std::string& yaml_path );


    void applyEnvOverrides( nlohmann::json& j );
    static void resolveSecrets( nlohmann::json& j );
    static void validateJson( const nlohmann::json& j );

    // Utility helpers
    std::optional< std::string > getenvOpt( const char* key );

    void applyStringEnv(
        nlohmann::json& j, const nlohmann::json_pointer< std::string >& path, const char* envVar );

    void applyBoolEnv(
        nlohmann::json& j, const nlohmann::json_pointer< std::string >& path, const char* envVar );

    void applyIntEnv(
        nlohmann::json& j, const nlohmann::json_pointer< std::string >& path, const char* envVar );

    static std::string readSecretFileFirstLine(
        const std::string& path, const std::string& fallback = "" );


    std::map< std::string, std::string > overridesFromCliAndEnv_;
};