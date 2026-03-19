#pragma once
#include "MachinePalCommon.h"

#include "HTTPConfig.h"

#include "filesystem/CanonicalPath.h"

class HTTPSConfig : public HTTPConfig {
    CanonicalPath certFile_;
    CanonicalPath keyFile_;
    std::optional< CanonicalPath > keyPassFile_;
    std::optional< CanonicalPath > caFile_;
    HTTPSConfig( uint16_t port, const CanonicalPath& certFile,
        const CanonicalPath& keyFile, const std::optional< CanonicalPath > keyPassFile,
        const std::optional< CanonicalPath >& caFile );

public:
    const CanonicalPath& certFile() const;
    const CanonicalPath& keyFile() const;
    const std::optional< CanonicalPath >& keyPassFile() const;
    const std::optional< CanonicalPath >& caFile() const;
    static ptr< HTTPSConfig > createFromJson(
        const nlohmann::json& j, ptr< FileManager > fileManager );
};