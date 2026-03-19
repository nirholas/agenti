#include "SettlementRequest.h"
#include "MachinePalCommon.h"
#include "PaymentPayload.h"
#include "PaymentRequirements.h"


ptr< PaymentPayload > SettlementRequest::paymentPayload() const {
    CHECK_STATE( paymentPayload_ );
    return paymentPayload_;
}

ptr< PaymentRequirements > SettlementRequest::paymentRequirements() const {
    CHECK_STATE( paymentRequirements_ );
    return paymentRequirements_;
}

SettlementRequest::SettlementRequest( const ptr< PaymentPayload >& paymentPayload,
    const ptr< PaymentRequirements >& paymentRequirements )
    : paymentPayload_( paymentPayload ), paymentRequirements_( paymentRequirements ) {
    CHECK_STATE( paymentPayload_ );
    CHECK_STATE( paymentRequirements_ );
}

nlohmann::json SettlementRequest::toJson() const {
    nlohmann::json j;
    j["paymentPayload"] = paymentPayload()->toJson();
    j["paymentRequirements"] = paymentRequirements()->toJson();
    return j;
}

SettlementRequest SettlementRequest::fromJson( const nlohmann::json& j ) {
    ptr< PaymentPayload > payload;
    ptr< PaymentRequirements > requirements;
    CHECK_STATE_JSON( j.contains( "paymentPayload" ) && !j["paymentPayload"].is_null(), "", j );

    payload = PaymentPayload::fromJson( j["paymentPayload"] );

    CHECK_STATE_JSON(
        j.contains( "paymentRequirements" ) && !j["paymentRequirements"].is_null(), "", j );
    requirements = PaymentRequirements::fromJson( j["paymentRequirements"] );
    CHECK_STATE( payload );
    CHECK_STATE( requirements );
    return SettlementRequest( payload, requirements );
}
