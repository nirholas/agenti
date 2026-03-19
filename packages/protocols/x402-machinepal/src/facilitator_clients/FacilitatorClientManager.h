#pragma once
#include "../payment/datastructures/SettlementRequest.h"
#include "../payment/datastructures/SettlementResponse.h"
#include "MachinePalApp.h"
#include "config/subconfigs/FacilitatorConfig.h"
#include "config/subconfigs/NetworkConfig.h"
#include "db/MachinePalDb.h"
#include <memory>
#include <variant>

using std::variant;
using std::shared_ptr;

class FacilitatorClientManager {
public:
    explicit FacilitatorClientManager(MachinePalApp& app);
    variant< SettlementResponse, HttpError > routeToFacilitatorAndSettle(
        const MachinePalConfig& networkConfig, SettlementRequest& settlementRequest );



private:
    MachinePalApp& app_;
};

