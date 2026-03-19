#pragma once

#include "config/subconfigs/NetworkConfig.h"
#include "datastructures/PaymentPayload.h"
#include "datastructures/SettlementRequest.h"
#include "datastructures/SettlementResponse.h"
#include "x402_protocol/HttpError.h"

class SettlementResponse;
class HttpError;

namespace proxygen {
class HTTPMessage;
}

class MachinePalApp;     // forward declaration
class MachinePalConfig;  // forward declaration
class ResourceConfig;    // forward declaration

class PaymentManager {
public:
    explicit PaymentManager( MachinePalApp& app );

    variant< ptr< PaymentPayload >, HttpError > decodeAndParsePayment(
        const std::unique_ptr< proxygen::HTTPMessage >& req );

    std::optional< HttpError > validatePaymentPayload( const MachinePalConfig& config,
        const ResourceConfig& resource, shared_ptr< PaymentPayload > paymentPayload );


    [[nodiscard]] MachinePalApp& app() const { return app_; }

    void recordSuccessfulSettlement( const PaymentPayload& payload, const EIP712Domain& domain,
        const ResourceConfig& resource, const OrganizationConfig& organization,
        const Hash& transactionHash, const string& ipAddress );

    std::optional< HttpError > checkAgainstAlreadySettledPayments(
        const ptr< PaymentPayload >& paymentPayload, const ptr< EIP712Domain >& domain );

    bool lockPaymentAsBeingSettled(
        ptr< Authorization > authorization, ptr< EIP712Domain > domain );

    void unlockPaymentAsBeingSettled(
        ptr< Authorization > _authorization, ptr< EIP712Domain > _domain );


    variant< SettlementResponse, HttpError > checkPaymentIsNewAndSettleItUnsafe(
        const MachinePalConfig& machinePalConfig, const ResourceConfig& resource,
        const OrganizationConfig& organization, shared_ptr< PaymentPayload > paymentPayload,
        const string& ipAddress );

    variant< SettlementResponse, HttpError > checkPaymentIsNewAndSettleIt(
        const MachinePalConfig& machinePalConfig, const ResourceConfig& resource,
        const OrganizationConfig& organization, shared_ptr< PaymentPayload > paymentPayload,
        const string& ipAddress );


    variant< SettlementResponse, HttpError > decodePreValidateAndSettleWithFacilitator(
        const std::unique_ptr< proxygen::HTTPMessage >& req, const MachinePalConfig& config,
        const ResourceConfig& resource, const OrganizationConfig& organization,
        ptr< Authorization >& outAuthorization );

private:
    MachinePalApp& app_;

    std::set< std::string > currentlySettlingPayments_;
    std::mutex currentlySettlingPaymentsMutex_;
};