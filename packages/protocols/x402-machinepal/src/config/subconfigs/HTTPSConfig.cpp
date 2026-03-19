#include "HTTPSConfig.h"
#include "crypto/CertManager.h"
#include <stdexcept>

#include "config/JsonUtils.h"
#include "filesystem/FileManager.h"

HTTPSConfig::HTTPSConfig(uint16_t port, const CanonicalPath &certFile,
                         const CanonicalPath &keyFile, const optional<CanonicalPath> keyPassFile,
                         const optional<CanonicalPath> &caFile)
    : HTTPConfig(port), certFile_(certFile),
      keyFile_(keyFile),
      keyPassFile_(keyPassFile),
      caFile_(caFile) {
    CHECK_STATE(port_ > 0);
    CertManager::doThoroughKeyCertFormatCheck(certFile_, keyFile_);
}

const CanonicalPath &HTTPSConfig::certFile() const {
    return certFile_;
}

const CanonicalPath &HTTPSConfig::keyFile() const {
    return keyFile_;
}

const optional<CanonicalPath> &HTTPSConfig::keyPassFile() const {
    return keyPassFile_;
}

const optional<CanonicalPath> &HTTPSConfig::caFile() const {
    return caFile_;
}

ptr<HTTPSConfig> HTTPSConfig::createFromJson(
    const nlohmann::json &j, ptr<FileManager> fileManager) {
    try {
        auto isEnabled = JsonUtils::getBoolWithDefault(j, "enabled", true);
        if (!isEnabled) {
            return nullptr;
        }

        optional<CanonicalPath> caFile = nullopt;
        if (j.contains("ca_file") && !j.at("ca_file").is_null()) {
            string file = j.at("ca_file").get<string>();
            auto resolved = fileManager->checkFileExistsAndReadableAndResolve(file);
            caFile = CanonicalPath(resolved);
        }
        optional<CanonicalPath> keyPassFile = nullopt;
        if (j.contains("key_pass_file") && !j.at("key_pass_file").is_null()) {
            string file = j.at("key_pass_file").get<string>();
            auto resolved = fileManager->checkFileExistsAndReadableAndResolve(file);
            keyPassFile = CanonicalPath(resolved);
        }
        auto certFile = CanonicalPath(fileManager->checkFileExistsAndReadableAndResolve(
            JsonUtils::getStringWithDefault(j, "cert_file", "")));
        auto keyFile = CanonicalPath(fileManager->checkFileExistsAndReadableAndResolve(
            JsonUtils::getStringWithDefault(j, "key_file", "")));
        return ptr<HTTPSConfig>(new HTTPSConfig(
            JsonUtils::getUint16WithDefault(j, "port", 8080), certFile, keyFile, keyPassFile,
            caFile));
    } catch (const std::exception &ex) {
        RETHROW_NESTED;
    }
}
