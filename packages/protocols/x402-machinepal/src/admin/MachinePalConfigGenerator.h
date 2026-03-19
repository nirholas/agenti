#pragma once
#include <filesystem>


class EthPrivateKey;

class MachinePalConfigGenerator {
public:
    // Creates machinepal.yml inside dirPath (does not overwrite existing file).
    void generateDefaultConfig(const std::filesystem::path &dirPath, EthPrivateKey& machinePalKey);
};

