#pragma once

#include <filesystem>

class FolderGenerator {
public:
    FolderGenerator(const std::filesystem::path& baseDir);
    void generateFolderStructure();

private:
    void createAndSecure(const std::filesystem::path& p);
    std::filesystem::path base_;
};