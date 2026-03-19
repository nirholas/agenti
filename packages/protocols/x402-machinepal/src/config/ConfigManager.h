#pragma once

#include "MachinePalCommon.h"
#include "MachinePalConfig.h"


class ConfigManager {
public:
    static ptr< ConfigManager > initManager(
        const std::map< std::string, std::string >& configValuesFromCliAndEnv );
    static ptr< ConfigManager > createInstance(
        const std::map< std::string, std::string >& configValuesFromCliAndEnv );

    void reloadConfig();
    std::shared_ptr< MachinePalConfig > latestConfig();
    std::chrono::system_clock::time_point latestConfigModificationTime();
    const std::string& latestConfigSha256();


    [[nodiscard]] ptr< FileManager > fileManager() const;


private:

    ConfigManager(const std::map<std::string, std::string> &configValuesFromCliAndEnv );

    ConfigManager( const ConfigManager& ) = delete;
    ConfigManager& operator=( const ConfigManager& ) = delete;


    void initConfigFilePathUsingConfigValuesFromCliAndEnv(
        const std::map< std::string, std::string >& values );

    ptr< FileManager > fileManager_;
    std::shared_ptr< MachinePalConfig > latestConfig_;
    std::shared_mutex latestConfigMutex_;
    std::chrono::system_clock::time_point latestConfigModificationTime_;
    std::string latestConfigHash_;
    std::map< std::string, std::string > configValuesFromCliAndEnv_;


    std::string computeBlakeHash( const filesystem::path& filePath );
    void checkFileExistsAndReadable( const std::string& configFile );
};