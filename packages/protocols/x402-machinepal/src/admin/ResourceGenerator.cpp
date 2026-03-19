#include "MachinePalCommon.h"
#include "ResourceGenerator.h"
#include <filesystem>
#include <fstream>



void ResourceGenerator::generateDefaultResources(const filesystem::path& path) {
    try {
        std::filesystem::path base = path / "resources";
        std::error_code ec;
        CHECK_STATE(std::filesystem::exists(base));
        CHECK_STATE(std::filesystem::is_directory(base));

        const auto filePath = base / "hello_world.txt";
        std::ofstream file(filePath);
        CHECK_STATE2(file.is_open(), "Failed to open resource file for writing: " + filePath.string());
        file << "hello world";
        file.close();
    } catch (const std::exception& e) {
        LOG_CORE_ERROR(e.what());
        RETHROW_NESTED;
    }
}