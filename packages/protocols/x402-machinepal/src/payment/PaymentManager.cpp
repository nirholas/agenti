#include "PaymentManager.h"

#include "../facilitator_clients/FacilitatorClientManager.h"
#include "MachinePalApp.h"
#include "MachinePalCommon.h"
#include "config/subconfigs/FacilitatorConfig.h"
#include "config/subconfigs/NetworkConfig.h"
#include "config/subconfigs/ResourceConfig.h"
#include "crypto/Keccak.h"
#include "datastructures/PaymentPayload.h"
#include "datastructures/PaymentRequirements.h"
#include "datastructures/SettlementRequest.h"
#include "datastructures/SettlementResponse.h"
#include "db/EasyNetDb.h"  // added include for EasyNetDb
#include "db/MachinePalDb.h"
#include "db/PaymentRecord.h"
#include "facilitators/FacilitatorErrors.h"
#include "url/URLUtils.h"

PaymentManager::PaymentManager(MachinePalApp &app) : app_(app) {
}

variant<ptr<PaymentPayload>, HttpError> PaymentManager::decodeAndParsePayment(
    const std::unique_ptr<proxygen::HTTPMessage> &req) {
    try {
        const auto &headerTable = req->getHeaders();
        std::string payment = headerTable.getSingleOrEmpty("X-PAYMENT");
        // the payment header should not be empty at this point - otherwise we would have replied
        // 402 already
        CHECK_STATE(!payment.empty());

        std::string decoded;
        try {
            decoded = Encoding::base64Decode(payment);
        } catch (const std::exception &e) {
            LOG_CORE_ERROR("Exception during base64 decode of X-PAYMENT header: {}", e.what());
            return HttpError(ERR_BAD_REQUEST, "X-PAYMENT header is not valid base64");
        }

        nlohmann::json j;
        try {
            j = nlohmann::json::parse(decoded);
        } catch (const std::exception &e) {
            LOG_CORE_ERROR(
                "Failed to parse decoded X-PAYMENT header as JSON: {} {}", decoded, e.what());
            return HttpError(
                ERR_BAD_REQUEST, "X-PAYMENT header is not valid JSON after base64 decoding");
        }

        auto paymentPayloadP = PaymentPayload::fromJson(j);
        CHECK_STATE(paymentPayloadP);
        return paymentPayloadP;
    } catch (std::exception &e) {
        return HttpError(ERR_INTERNAL_SERVER_ERROR,
                         std::string("Error parsing X-PAYMENT header: ") + e.what());
    }
}

void PaymentManager::recordSuccessfulSettlement(const PaymentPayload &payload,
                                                const EIP712Domain &domain, const ResourceConfig &resource,
                                                const OrganizationConfig &organization, const Hash &transactionHash,
                                                const string &ipAddress) {
    auto db = app_.machinePalDB();
    db->saveSettledPayment(payload, domain, resource, organization, transactionHash, ipAddress);
}


std::optional<HttpError> PaymentManager::checkAgainstAlreadySettledPayments(
    const ptr<PaymentPayload> &paymentPayload, const ptr<EIP712Domain> &domain) {
    auto db = app_.machinePalDB();

    if (db->settledPaymentExists(paymentPayload, domain)) {
        const auto &from = paymentPayload->payload()->authorization()->from();
        const auto &nonce = paymentPayload->payload()->authorization()->nonce();
        const auto &asset = domain->assetAddress();
        const auto &chainId = domain->chainId();

        LOG_CORE_INFO(
            "CHECK_PAYMENT Payment has already been spent: from={} nonce={} token={} tokenAddress={} "
            "chainId={}",
            from.toHex(PREFIX_0x), nonce.toHex(PREFIX_0x), domain->name(),
            asset.toHex(PREFIX_0x), chainId.str());
        return HttpError(ERR_BAD_REQUEST,
                         std::string("This payment has already been spent: ") +
                         "from=" + from.toHex(PREFIX_0x) + " nonce=" + nonce.toHex(PREFIX_0x) +
                         " token=" + domain->name() + " tokenAddress=" + asset.toHex(PREFIX_0x) +
                         " chainId=" + chainId.str());
    }

    return std::nullopt;
}


bool PaymentManager::lockPaymentAsBeingSettled(
    ptr<Authorization> authorization, ptr<EIP712Domain> domain) {
    auto uniquePaymentKey =
            domain->uniquePaymentKey(authorization->from(), authorization->nonce());
    lock_guard<std::mutex> lock(currentlySettlingPaymentsMutex_);
    auto result = currentlySettlingPayments_.insert(uniquePaymentKey);
    auto lockedPayment = result.second;
    return lockedPayment;
}

void PaymentManager::unlockPaymentAsBeingSettled(
    ptr<Authorization> authorization, ptr<EIP712Domain> domain) {
    auto uniquePaymentKey =
            domain->uniquePaymentKey(authorization->from(), authorization->nonce());
    lock_guard<std::mutex> lock(currentlySettlingPaymentsMutex_);
    CHECK_STATE(currentlySettlingPayments_.erase( uniquePaymentKey ) == 1);
}


// this function assumes the payment has been locked for settlement already
variant<SettlementResponse, HttpError> PaymentManager::checkPaymentIsNewAndSettleItUnsafe(
    const MachinePalConfig &machinePalConfig, const ResourceConfig &resource,
    const OrganizationConfig &organization, shared_ptr<PaymentPayload> paymentPayload,
    const string &ipAddress) {
    std::optional<HttpError> error = std::nullopt;

    auto networkConfig = machinePalConfig.network();

    error = checkAgainstAlreadySettledPayments(paymentPayload, networkConfig->eip712Domain());
    auto paymentRequirements =
            PaymentRequirements::makePaymentRequirements(organization, resource, *networkConfig);

    auto settlementRequest = SettlementRequest(paymentPayload, paymentRequirements);


    if (error) {
        return error.value();
    }


    auto result =
            app_.facilitatorClientManager()->routeToFacilitatorAndSettle(machinePalConfig, settlementRequest);
    if (holds_alternative<HttpError>(result)) {
        return result;
    }

    const auto &transactionHashHex = std::get<SettlementResponse>(result).transaction();
    auto transactionHash = Encoding::fromHexToHash(transactionHashHex);

    recordSuccessfulSettlement(*paymentPayload, *networkConfig->eip712Domain(), resource,
                               organization, transactionHash, ipAddress);

    return result;;
}

variant<SettlementResponse, HttpError> PaymentManager::checkPaymentIsNewAndSettleIt(
    const MachinePalConfig &machinePalConfig, const ResourceConfig &resource,
    const OrganizationConfig &organization, shared_ptr<PaymentPayload> paymentPayload,
    const string &ipAddress) {
    CHECK_STATE(paymentPayload);
    auto authorization = paymentPayload->payload()->authorization();
    auto networkConfig = machinePalConfig.network();
    auto domain = networkConfig->eip712Domain();

    // we need to make sure that the user can not submit the same payment multiple times in parallel
    // submitting the same payment twice should result in one successful settlement and one error
    // response otherwise the user could use the same payment to pay for multiple requests we do it
    // by marking the payment as locked while being settled

    if (!lockPaymentAsBeingSettled(authorization, domain)) {
        // Failed to acquire lock, return immediately.
        return HttpError(ERR_BAD_REQUEST,
                         "Your payment is currently being processed. "
                         "Looks like you submitted the same payment twice.");
    }

    // Lock acquired. Immediately create the RAII guard.
    // folly::makeGuard creates a guard that will unlock the payment once we exit this function,.
    auto guard =
            folly::makeGuard([&]() { unlockPaymentAsBeingSettled(authorization, domain); });

    try {
        // Now that we hold the lock, proceed with the actual settlement.
        return checkPaymentIsNewAndSettleItUnsafe(
            machinePalConfig, resource, organization, paymentPayload, ipAddress);
    } catch (const std::exception &e) {
        LOG_CORE_ERROR("Error during payment settlement request to"
                      " facilitator: {}", e.what());
        return HttpError(ERR_INTERNAL_SERVER_ERROR,
                         std::string("Error during payment settlement request to facilitator: "));
    }
}


variant<SettlementResponse, HttpError> PaymentManager::decodePreValidateAndSettleWithFacilitator(
    const std::unique_ptr<proxygen::HTTPMessage> &req, const MachinePalConfig &config,
    const ResourceConfig &resource, const OrganizationConfig &organization,
    ptr<Authorization> &authorization) {
    std::optional<HttpError> error = std::nullopt;

    try {
        auto result = decodeAndParsePayment(req);
        if (holds_alternative<HttpError>(result)) {
            return std::get<HttpError>(result);
        }

        auto paymentPayload = std::get<ptr<PaymentPayload> >(result);

        authorization = paymentPayload->payload()->authorization();

        TokenAmount price(resource.price());

        auto walletAddress = config.network()->walletAddress();

        auto verificationError = paymentPayload->validateAndVerifySignature(config, price, walletAddress,
                                                                            resource.paymentScheme());

        if (verificationError) {
            return HttpError(ERR_BAD_REQUEST,
                             std::string(FacilitatorErrors::getErrorString(verificationError.value())));
        }

        auto ipAddress = req->getClientAddress().getAddressStr();

        return checkPaymentIsNewAndSettleIt(
            config, resource, organization, paymentPayload, ipAddress);
    } catch (std::exception &e) {
        LOG_CORE_ERROR("decodeValidateAndSettlePayment had exception  {}", e.what());
        return HttpError(ERR_INTERNAL_SERVER_ERROR,
                         std::string("decodeValidateAndSettlePayment had exception") + e.what());
    }
}
