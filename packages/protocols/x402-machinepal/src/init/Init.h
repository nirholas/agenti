#pragma once
#include <curl/curl.h>
#include <folly/init/Init.h>
#include <glog/logging.h>
#include <atomic>
#include <map>
#include <mutex>
#include <string>

class ConfigManager;

class Init {
public:
    static void initAllLibs( int _argc, char* _argv[] );

    static void setupLogging(bool useJson, spdlog::level::level_enum level);

    static void setupBootStrapLogging();


    static bool isInited();
    static std::map< std::string, std::string > getMachinePalEnvironmentOverloads();
    static void checkOperatingSystemConfiguration();

    static void configureLogging( ptr< ConfigManager > manager );
    static void checkSystemTime();

    static bool getUseJsonLogging() {
        return useJsonLogging_;
    }


private:

    static std::atomic< bool > inited_;

    static std::atomic<bool> useJsonLogging_;


    static std::shared_ptr<spdlog::logger> createLogger(const std::string &name, const std::vector<spdlog::sink_ptr> &sinks,
                                                 const std::string &pattern, bool useJson);

    static std::shared_ptr<spdlog::logger> createAccessLogger(const std::vector<spdlog::sink_ptr> &sinks, bool useJson);


    static bool fetchInternetTime( const char* url, std::string& utc_datetime,
                                   std::string& responseOut, std::string& errorOut );
};

void ThrowOnFailure();