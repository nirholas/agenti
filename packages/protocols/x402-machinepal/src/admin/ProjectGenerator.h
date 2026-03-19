#pragma once
#include "crypto/EthPrivateKey.h"
#include <filesystem>

class ProjectGenerator {


    // Private helper methods
    static void generateDirectoryStructure(const std::filesystem::path& baseDir);
    static EthPrivateKey generateWallet(const std::filesystem::path& baseDir);
    static void generateTLSCertificate(const std::filesystem::path& baseDir);
    static void generateResources(const std::filesystem::path& baseDir);
    static void generateConfiguration(const std::filesystem::path& baseDir,
                               EthPrivateKey& machinePalKey);
    static void validateBaseDirEmpty(const std::filesystem::path& baseDir);

public:


    // Constants for directory and file names
    static constexpr auto kSecretsDir = "secrets";
    static constexpr auto kCertsDir = "certs";
    static constexpr auto kResourcesDir = "resources";
    static constexpr auto kWalletFile = "machinepal_client_wallet.key";
    static constexpr auto kCertFile = "machinepal_tls_certificate.crt";
    static constexpr auto kCertKeyFile = "machinepal_tls_certificate.key";
    static constexpr auto kConfigFile = "machinepal.yml";


    static int generateProjectInCurrentWorkingDir();

    static void generateProject(const std::filesystem::path &baseDir);

};
