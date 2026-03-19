#pragma once
#include "MachinePalCommon.h"


enum class LogLevel { trace, debug, info, warn, error, fatal };

enum class LogType { text, json };

LogLevel parseLogLevel( const std::string& level );
LogType parseLogType( const std::string& type );

class FileManager;

class LogConfig {
    LogLevel level_;
    LogType type_;


    LogConfig( const std::string& level, const std::string& type );
    LogConfig( LogLevel level, LogType type );

public:
    LogLevel level() const;
    LogType type() const;
    static ptr< LogConfig > createDefault();
    static ptr< LogConfig > createFromJson(
        const nlohmann::json& j, ptr< FileManager > fileManager );
};