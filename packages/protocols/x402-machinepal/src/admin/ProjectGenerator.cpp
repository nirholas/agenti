#include "MachinePalCommon.h"
#include "ProjectGenerator.h"
#include "FolderGenerator.h"
#include "EthereumWalletGenerator.h"
#include "TLSCertGenerator.h"
#include "MachinePalConfigGenerator.h"
#include "ResourceGenerator.h"
#include "crypto/EthPrivateKey.h"
#include <stdexcept>
#include <filesystem>


int ProjectGenerator::generateProjectInCurrentWorkingDir() {
    LOG_CORE_INFO("Creating new project structure in the current directory…");
    auto cwd = std::filesystem::current_path();
    generateProject(cwd);
    LOG_CORE_INFO("Project initialized successfully.");
    return 0;
}

void ProjectGenerator::generateProject(const std::filesystem::path &baseDir) {
    validateBaseDirEmpty(baseDir);

    // Each step is now a clear, self-documenting function call
    generateDirectoryStructure(baseDir);

    // 1. Generate wallet (returns key for use in config)
    auto machinePalKey = generateWallet(baseDir);

    // 2. Generate TLS certificate
    generateTLSCertificate(baseDir);

    // 3. Generate default resources
    generateResources(baseDir);

    // 4. Generate configuration
    generateConfiguration(baseDir, machinePalKey);
}


void ProjectGenerator::generateDirectoryStructure(const std::filesystem::path &baseDir) {
    FolderGenerator fg(baseDir);
    fg.generateFolderStructure();
}

EthPrivateKey ProjectGenerator::generateWallet(const std::filesystem::path &baseDir) {
    auto machinePalKey = EthPrivateKey::generate();

    // Use constants for paths
    const auto walletPath = baseDir / kSecretsDir / kWalletFile;

    EthereumWalletGenerator walletGen;
    walletGen.generateWalletFileFromKey(walletPath, machinePalKey);

    return machinePalKey;
}


void ProjectGenerator::generateTLSCertificate(const std::filesystem::path &baseDir) {
    // Use constants for paths
    const auto certPath = baseDir / kCertsDir / kCertFile;
    const auto certKeyPath = baseDir / kSecretsDir / kCertKeyFile;

    TLSCertGenerator tlsGen;
    tlsGen.generateDefaultCertFiles(certPath, certKeyPath);
}

void ProjectGenerator::generateResources(const std::filesystem::path &baseDir) {
     ResourceGenerator resourceGen;
     resourceGen.generateDefaultResources(baseDir);
}


void ProjectGenerator::generateConfiguration(const std::filesystem::path &baseDir,
                                             EthPrivateKey &machinePalKey) {
    MachinePalConfigGenerator cfgGen;
    cfgGen.generateDefaultConfig(baseDir, machinePalKey);
}


void ProjectGenerator::validateBaseDirEmpty(const std::filesystem::path &baseDir) {
    std::error_code ec;
    if (!std::filesystem::exists(baseDir, ec) || ec) {
        throw std::runtime_error("Project base directory does not exist: " + baseDir.string());
    }
    if (!std::filesystem::is_directory(baseDir, ec) || ec) {
        throw std::runtime_error("Project base path is not a directory: " + baseDir.string());
    }
    // Check emptiness
    auto it = std::filesystem::directory_iterator(baseDir, ec);
    if (ec) {
        throw std::runtime_error("Failed to read project base directory: " + baseDir.string());
    }
    if (it != std::filesystem::end(it)) {
        throw std::runtime_error(string("Directory is not empty. Please run project init in an empty directory."));
    }
}
