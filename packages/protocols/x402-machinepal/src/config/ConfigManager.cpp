#include "ConfigManager.h"

#include "ConfigLoader.h"
#include "MachinePalCommon.h"
#include "MachinePalConfig.h"
#include "config/MachinePalConfigSchema.h"
#include "init/Init.h"
#include <openssl/evp.h>
#include <yaml-cpp/yaml.h>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <nlohmann/json-schema.hpp>
#include <nlohmann/json.hpp>
#include <optional>
#include <sstream>
#include <string>
#include <unordered_set>

#include "filesystem/FileManager.h"


using nlohmann::json;
using nlohmann::json_schema::json_validator;
;
using namespace nlohmann::literals; // Enables the _json_pointer literal


std::string ConfigManager::computeBlakeHash(const filesystem::path &filePath) {
    std::ifstream file(filePath, std::ios::binary);
    if (!file)
        throw std::runtime_error("Failed to open file for hashing: " + filePath.string());
    EVP_MD_CTX *ctx = EVP_MD_CTX_new();
    if (!ctx)
        throw std::runtime_error("Failed to create EVP_MD_CTX");
    const EVP_MD *md = EVP_blake2b512();
    if (!md) {
        EVP_MD_CTX_free(ctx);
        throw std::runtime_error("Failed to get BLAKE2b-512 digest method");
    }
    if (EVP_DigestInit_ex(ctx, md, nullptr) != 1) {
        EVP_MD_CTX_free(ctx);
        throw std::runtime_error("EVP_DigestInit_ex failed");
    }
    char buf[4096];
    while (file.good()) {
        file.read(buf, sizeof(buf));
        if (file.bad()) {
            EVP_MD_CTX_free(ctx);
            throw std::runtime_error("Error reading file during hashing: " + filePath.string());
        }
        if (file.gcount() > 0) {
            if (EVP_DigestUpdate(ctx, buf, (size_t) file.gcount()) != 1) {
                EVP_MD_CTX_free(ctx);
                throw std::runtime_error("EVP_DigestUpdate failed");
            }
        }
    }
    unsigned char hash[EVP_MAX_MD_SIZE];
    unsigned int hash_len = 0;
    if (EVP_DigestFinal_ex(ctx, hash, &hash_len) != 1) {
        EVP_MD_CTX_free(ctx);
        throw std::runtime_error("EVP_DigestFinal_ex failed");
    }
    EVP_MD_CTX_free(ctx);
    std::ostringstream oss;
    for (unsigned int i = 0; i < hash_len; ++i)
        oss << std::hex << std::setw(2) << std::setfill('0') << (int) hash[i];
    return oss.str();
}

void ConfigManager::checkFileExistsAndReadable(const std::string &configFile) {
    // Check that configFile exists
    if (!std::filesystem::exists(configFile)) {
        throw std::runtime_error(
            "Config file '" + configFile +
            "' does not exist.");
    }
    // Check that configFile is not a directory
    if (std::filesystem::is_directory(configFile)) {
        throw std::runtime_error(
            "Config file '" + configFile +
            "' is a directory, not a file");
    }
    // Check that configFile is readable
    std::ifstream configTest(configFile);
    if (!configTest.good()) {
        throw std::runtime_error(
            "Config file '" + configFile +
            "' is not readable.");
    }
    configTest.close();
}


ptr<ConfigManager> ConfigManager::initManager(
    const std::map<std::string, std::string> &configValuesFromCliAndEnv) {
    try {
        auto instance = createInstance(configValuesFromCliAndEnv);
        instance->reloadConfig();
        return instance;
    } catch (const std::exception &ex) {
        RETHROW_NESTED;
    }
}

ptr<ConfigManager> ConfigManager::createInstance(
    const std::map<std::string, std::string> &configValuesFromCliAndEnv) {
    try {
        ptr<ConfigManager> mgr(new ConfigManager(configValuesFromCliAndEnv));
        mgr->initConfigFilePathUsingConfigValuesFromCliAndEnv(configValuesFromCliAndEnv);
        return mgr;
    } catch (const std::exception &ex) {
        RETHROW_NESTED;
    }
}

void ConfigManager::initConfigFilePathUsingConfigValuesFromCliAndEnv(
    const std::map<std::string, std::string> &values) {
    try {
        configValuesFromCliAndEnv_ = values;
        CHECK_STATE(values.contains( "CONFIG" ));
        auto userProvidedConfigPath_ = values.at("CONFIG");
        CHECK_STATE(!userProvidedConfigPath_.empty())
        CHECK_STATE(!fileManager_)
        fileManager_ = std::make_shared<FileManager>(userProvidedConfigPath_);
    } catch (const std::exception &ex) {
        RETHROW_NESTED;
    }
}

void ConfigManager::reloadConfig() {
    std::unique_lock<std::shared_mutex> lock(latestConfigMutex_);

    try {
        CHECK_STATE(fileManager_);

        auto configPath = fileManager_->canonicalConfigPath();

        LOG_CORE_INFO("Loading machinepal config from: {}", configPath.c_str());
        LOG_CORE_INFO(
            "All relative paths in the config are resolved relative to the config base "
            "directory: {}",
            fileManager_->canonicalConfigDirPath().c_str());


        auto hash = computeBlakeHash(configPath);

        if (hash == latestConfigHash_) {
            CHECK_STATE(latestConfig_);
            return;
        }
        latestConfigHash_ = hash;

        ConfigLoader loader(ConfigManager::configValuesFromCliAndEnv_);

        latestConfig_ = loader.loadFromYamlFile(configPath, fileManager_);

        // Record last modified time
        auto ftime = std::filesystem::last_write_time(configPath);
        latestConfigModificationTime_ = std::chrono::system_clock::time_point(
            std::chrono::duration_cast<std::chrono::system_clock::duration>(
                ftime.time_since_epoch()));
    } catch (const std::exception &ex) {
        RETHROW_NESTED;
    }

    CHECK_STATE(latestConfig_);
}


std::shared_ptr<MachinePalConfig> ConfigManager::latestConfig() {
    std::shared_lock<std::shared_mutex> lock(latestConfigMutex_);
    CHECK_STATE(latestConfig_);
    return latestConfig_;
}

std::chrono::system_clock::time_point ConfigManager::latestConfigModificationTime() {
    std::shared_lock<std::shared_mutex> lock(latestConfigMutex_);
    return latestConfigModificationTime_;
}

const std::string &ConfigManager::latestConfigSha256() {
    std::shared_lock<std::shared_mutex> lock(latestConfigMutex_);
    return latestConfigHash_;
}

ConfigManager::ConfigManager(
    const std::map<std::string, std::string> &configValuesFromCliAndEnv ) : configValuesFromCliAndEnv_(
    configValuesFromCliAndEnv) {
}


[[nodiscard]] ptr< FileManager >ConfigManager::fileManager() const {
    CHECK_STATE( fileManager_ );
    return fileManager_;
}