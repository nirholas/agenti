#pragma once
#include <optional>
#include <variant>

#include "MachinePalCommon.h"
#include "filesystem/CanonicalPath.h"
#include "payment/datastructures/PaymentPayload.h"
#include "x402_protocol/HttpError.h"

class SettlementResponse;
class FileManager;
class CanonicalPath;

enum class FacilitatorType {
    cdp,
    base,
};


class FacilitatorConfig {
    FacilitatorType type_;
    std::string baseUrl_;
    std::optional< CanonicalPath > apiKeyFile_;

    FacilitatorConfig( FacilitatorType type, std::string baseUrl,
        std::optional< CanonicalPath > apiKeyFile = std::nullopt );

public:
    [[nodiscard]] FacilitatorType type() const;
    [[nodiscard]] const std::string& baseUrl() const;
    [[nodiscard]] const std::optional< CanonicalPath >& apiKeyFile() const;

    static ptr< FacilitatorConfig > createFomJson(
        const nlohmann::json& j, ptr< FileManager > fileManager );


    static FacilitatorType mustContainType( const nlohmann::json& j );
};

inline std::string toString( FacilitatorType type ) {
    switch ( type ) {
    case FacilitatorType::cdp:
        return "cdp";
    case FacilitatorType::base:
        return "base";
    }
    throw std::invalid_argument( "Unknown FacilitatorType" );
}