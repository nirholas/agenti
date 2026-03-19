#pragma once

#include <wangle/ssl/SSLContextConfig.h>

class HTTPSConfig;

class CertManager {
public:
    static wangle::SSLContextConfig createAndValidateWangleSSLContext( ptr< HTTPSConfig > https );
    static void doThoroughKeyCertFormatCheck(
        const std::filesystem::path& certPath, const std::filesystem::path& keyPath );

private:
    static void checkPEMFormat(
        const std::filesystem::path& certPath, const std::filesystem::path& keyPath );
    static void checkKeyMatchesCert(
        const std::filesystem::path& certPath, const std::filesystem::path& keyPath );

    static void validateSSLFiles( const std::filesystem::path& certFile,
        const std::filesystem::path& keyFile, const std::filesystem::path& caFile );
    static std::filesystem::path getCaFilePath( const std::shared_ptr< HTTPSConfig >& https );
};