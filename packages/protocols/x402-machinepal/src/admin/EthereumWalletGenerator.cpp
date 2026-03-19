#include "MachinePalCommon.h"
#include "crypto/EthPrivateKey.h"
#include "EthereumWalletGenerator.h"
#include <fstream>



void EthereumWalletGenerator::generateWalletFileFromKey(const std::filesystem::path& privKeyPath, const EthPrivateKey& key) {
    try {
        if (std::filesystem::exists(privKeyPath)) {
            throw std::runtime_error("File already exists. Refusing to overwrite: " + privKeyPath.string());
        }
        if (privKeyPath.has_parent_path()) {
            std::filesystem::create_directories(privKeyPath.parent_path());
        }
        std::ofstream f(privKeyPath);
        if (!f) {
            throw std::runtime_error("Failed to open file for writing: " + privKeyPath.string());
        }
        f << key.toHex() << '\n';
        if (!f) {
            throw std::runtime_error("Failed to write data to file: " + privKeyPath.string());
        }
        f.close();
        std::error_code ec;
        std::filesystem::permissions(
            privKeyPath,
            std::filesystem::perms::owner_read | std::filesystem::perms::owner_write,
            std::filesystem::perm_options::replace,
            ec
        );
        if (ec) {
            throw std::filesystem::filesystem_error(
                "Failed to set permissions on new wallet file: " + privKeyPath.string(), ec);
        }
    } catch (...) {
        std::throw_with_nested(std::runtime_error(
            "Failed to generate Ethereum wallet file (from provided key) at: " + privKeyPath.string()
        ));
    }
}
