#pragma once


class FileManager {
public:
    [[nodiscard]] std::filesystem::path canonicalConfigPath() const {
        CHECK_STATE( !canonicalConfigPath_.empty() );
        return canonicalConfigPath_;
    }

    [[nodiscard]] std::filesystem::path canonicalConfigDirPath() const {
        CHECK_STATE( !canonicalConfigDirPath_.empty() );
        return canonicalConfigDirPath_;
    }

    explicit FileManager( const filesystem::path& userProvidedConfigPath )
        : userProvidedConfigPath_( userProvidedConfigPath ) {
        try {
            checkFileExistsAndReadableCwd( userProvidedConfigPath );
            canonicalConfigPath_ =
                FileManager::resolveCanonicalPathAgainstCwd( userProvidedConfigPath_ );
            CHECK_STATE( !canonicalConfigPath_.empty() );
            canonicalConfigDirPath_ =
                std::filesystem::path( canonicalConfigPath_ ).parent_path().string();
        } catch ( const std::exception& ex ) {
            RETHROW_NESTED;
        }
    }

    filesystem::path checkFileExistsAndReadableAndResolve( const std::string& path );

    static void checkFileExistsAndReadableCwd( const std::string& path );

    static std::chrono::system_clock::time_point getLastFileModificationTime(
        const std::string& _path );

    static std::filesystem::path resolveCanonicalPathAgainstCwd( const std::string& _path );

    std::filesystem::path resolveCanonicalPath( const std::string& _path ) const;

private:
    std::string userProvidedConfigPath_;
    std::filesystem::path canonicalConfigPath_;
    std::filesystem::path canonicalConfigDirPath_;
};