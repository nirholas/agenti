#pragma once
#include <nlohmann/json.hpp>
#include <string>

class PaymentRequirements;
class PaymentPayload;

class SettlementRequest {
public:
    [[nodiscard]] ptr<PaymentPayload> paymentPayload() const;

    [[nodiscard]] ptr<PaymentRequirements> paymentRequirements() const;

    SettlementRequest() = default;
    SettlementRequest(const ptr<PaymentPayload>& payload,
                      const ptr<PaymentRequirements>& paymentRequirements);

    // Serialize to JSON
    [[nodiscard]] nlohmann::json toJson() const;
    // Deserialize from JSON
    static SettlementRequest fromJson(const nlohmann::json& j);

private:
    ptr<PaymentPayload> paymentPayload_;
    ptr<PaymentRequirements> paymentRequirements_;
};
