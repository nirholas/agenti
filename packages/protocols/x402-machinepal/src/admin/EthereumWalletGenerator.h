#pragma once

#include <string>
#include <filesystem>



class EthPrivateKey; // forward declaration

class EthereumWalletGenerator {
public:
    static void generateWalletFileFromKey(const std::filesystem::path &privKeyPath, const EthPrivateKey &key);
};
