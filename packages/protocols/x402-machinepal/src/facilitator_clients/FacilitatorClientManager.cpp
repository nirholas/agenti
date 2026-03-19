#include "FacilitatorClientManager.h"
#include "MachinePalApp.h"
#include "db/MachinePalDb.h"
#include "spdlog/spdlog.h"

FacilitatorClientManager::FacilitatorClientManager(MachinePalApp& app) : app_(app) {}

variant< SettlementResponse, HttpError > FacilitatorClientManager::routeToFacilitatorAndSettle(
    const MachinePalConfig& machinePalConfig, SettlementRequest& settlementRequest ) {
    auto networkConfig = machinePalConfig.network();
    CHECK_STATE( networkConfig );

    auto facilitatorClient = machinePalConfig.facilitatorClient();
    CHECK_STATE( facilitatorClient );

    auto result = facilitatorClient->settle( settlementRequest.toJson());

    return SettlementResponse::fromJsonString( result.dump(  ) );
}

