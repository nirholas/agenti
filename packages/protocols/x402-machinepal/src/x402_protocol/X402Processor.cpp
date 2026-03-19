#include "X402Processor.h"
#include "HttpEndpointConnection.h"
#include "BackendCurlError.h"
#include "BackendHttpError.h"
#include "IResponseSender.h"
#include "MachinePalApp.h"
#include "MachinePalCommon.h"
#include "config/subconfigs/OrganizationConfig.h"
#include "config/subconfigs/PassThroughConfig.h"
#include "config/subconfigs/ServerConfig.h"
#include "payment/datastructures/PaymentPayload.h"
#include "payment/datastructures/PaymentRequiredResponse.h"
#include "payment/datastructures/PaymentRequirements.h"
#include "url/URLUtils.h"


X402Processor::X402Processor(MachinePalApp &app, weak_ptr<IResponseSender> &responseSender)
    : app_(app), responseSender_(responseSender) {
    config_ = app_.configManager()->latestConfig();
}

bool X402Processor::isReplySent() const {
    return state_ == X402ProcessorState::ERROR_SENT ||
           state_ == X402ProcessorState::REPLY_SENT;
}


/**
| x402 Error       | HTTP Status | Description                                     |
| ---------------- | ----------- | ----------------------------------------------- |
| Payment Required | 402         | Payment needed to access resource               |
| Invalid Payment  | 400         | Malformed payment payload or requirements       |
| Payment Failed   | 402         | Payment verification or settlement failed       |
| Server Error     | 500         | Internal server error during payment processing |
| Success          | 200         | Payment verified and settled successfully       |
*/


bool X402Processor::reply402IfNoPaymentHeader(
    const proxygen::HTTPHeaders &requestHeaders) {
    try {
        if (requestHeaders.exists("X-PAYMENT"))
            return false;

        reply402PaymentRequired(std::nullopt);
    } catch (std::exception &e) {
        LOG_NETWORK_ERROR("[hasPaymentHeader] Exception while checking X-PAYMENT header: {}",
                      e.what());
    }

    return true;
}


void X402Processor::reply502BadGateway(const std::string &message) {
    string body = getJsonErrorBody(message);

    sendResponse({502, "Bad Gateway"}, getApplicationJsonHeaders(), body);
    state_ = X402ProcessorState::ERROR_SENT;
}


void X402Processor::replyGenericHttpError(IBackendError &error, proxygen::HTTPHeaders &responseHeaders) {
    string body = getJsonErrorBody(error.getMessage());
    sendResponse({
                     static_cast<uint16_t>(error.getError()),
                     proxygen::HTTPMessage::getDefaultReason(static_cast<uint16_t>(error.getError()))
                 },
                 responseHeaders, body);
    state_ = X402ProcessorState::ERROR_SENT;
}

void X402Processor::replyPassThroughError(IBackendError &error, proxygen::HTTPHeaders &responseHeaders) {
    if (dynamic_cast<BackendCurlError *>(&error)) {
        reply502BadGateway(error.getMessage());
    } else {
        replyGenericHttpError(error, responseHeaders);
    }
}

void X402Processor::replyX402ResourceSuccess(uint64_t statusCode,
                                             const std::string &settlementInfo,
                                             const proxygen::HTTPHeaders &&headers,
                                             std::string &responseBody) {
    CHECK_STATE(statusCode >= 200 && statusCode < 300);
    auto headersFinal = std::move(headers);
    headersFinal.add("X-PAYMENT-RESPONSE", settlementInfo);
    sendResponse({
                     statusCode,
                     proxygen::HTTPMessage::getDefaultReason(statusCode)
                 }, headersFinal, responseBody);
    state_ = X402ProcessorState::REPLY_SENT;
}


void X402Processor::reply402PaymentRequired(
    std::optional<SettlementResponse> errorResponse) {
    try {
        CHECK_STATE(resource_);

        std::optional<string> errorString = std::nullopt;

        auto headers = getApplicationJsonHeaders();

        if (errorResponse) {
            errorString = errorResponse->errorReason().value_or(
                "Payment required to access resource");
            auto settlementInfo = errorResponse->originalJsonToBase64();
            headers.add(
                "X-PAYMENT-RESPONSE", settlementInfo);
        }

        auto paymentRequirements =
                PaymentRequiredResponse::getPaymentRequiredResponseAsString(
                    organization(), resource(), config(), errorString);

        sendResponse({402, "Payment Required"}, headers, paymentRequirements);
        state_ = X402ProcessorState::REPLY_SENT;
    } catch
    (std::exception &e) {
        RETHROW_NESTED;
    }
}


void X402Processor::reply400BadRequest(const std::string &message) {
    sendResponse({400, "Bad Request"}, getApplicationJsonHeaders(),
                 getJsonErrorBody(message));
    state_ = X402ProcessorState::ERROR_SENT;
}

void X402Processor::reply404ResourceNotFound(const std::string &message) {
    sendResponse({404, "Not Found"}, getApplicationJsonHeaders(),
                 getJsonErrorBody(message));
    state_ = X402ProcessorState::ERROR_SENT;
}


void X402Processor::reply500InternalError(const std::string &message) {
    sendResponse({500, "Server Error"}, getApplicationJsonHeaders(),
                 getJsonErrorBody(message));
    state_ = X402ProcessorState::ERROR_SENT;
}


std::string X402Processor::getJsonErrorBody(const std::string &message) {
    if (organization_ && resource_ && config_) {
        return PaymentRequiredResponse::getPaymentRequiredResponseAsString(
            organization(), resource(), config(), message);
    } else {
        nlohmann::json j;
        j["error"] = message;
        return j.dump();
    }
}


void X402Processor::sendResponse(
    const std::pair<uint16_t, std::string> &statusAndMessage,
    const proxygen::HTTPHeaders &headers,
    const std::string &body) {
    if (state_ == X402ProcessorState::ERROR_SENT) {
        LOG_NETWORK_INFO("Attempted to send response after error response already sent.");
        return;
    }

    if (state_ == X402ProcessorState::REPLY_SENT) {
        LOG_NETWORK_INFO("Attempted to send response after resource already sent.");
        return;
    }


    auto responseSender = responseSender_.lock();
    if (!responseSender) {
        LOG_NETWORK_ERROR("Connection closed before response could be sent.");
        return;
    }
    try {
        responseSender->sendResponse(statusAndMessage, headers, body);
    } catch (std::exception &e) {
        LOG_NETWORK_ERROR("Exception while sending response: {}", e.what());
        // nothing can be done so we consider response as sent
    }
}


bool X402Processor::validateAndExtractSubDomainName(
    const std::unique_ptr<proxygen::HTTPMessage> &request) {
    auto domainName = request->getHeaders().getSingleOrEmpty("host");
    // Remove port if present (e.g., example.com:8080 -> example.com)

    if (domainName.empty()) {
        reply400BadRequest("Missing Host header");
        return false;
    }

    if (URLUtils::isIpAddress(domainName)) {
        reply400BadRequest(
            "Unknown host: " + domainName +
            ". You need to access MachinePal using a hostname, not an IP address. "
            "Please use a valid hostname to access this service.");
        return false;
    }

    auto colonPos = domainName.rfind(':');
    if (colonPos != std::string::npos) {
        domainName = domainName.substr(0, colonPos);
    }

    // check for IP address again

    if (URLUtils::isIpAddress(domainName)) {
        reply400BadRequest(
            "Unknown host: " + domainName +
            ". You need to access MachinePal using a hostname, not an IP address. "
            "Please use a valid hostname specified in machinepal config "
            "(like localhost or xyz.com) to access this service.");
        return false;
    }

    if (!URLUtils::isDomainName(domainName)) {
        reply400BadRequest(
            "Invalid host name: " + domainName +
            "."
            "Please use a valid hostname specified in machinepal config "
            "(like localhost or xyz.com) to access this service.");
        return false;
    }

    auto hostName = config_->server()->hostName();

    if (domainName == hostName) {
        subDomainName_ = "";
    } else if (domainName.ends_with("." + hostName)) {
        subDomainName_ = domainName.substr(0, domainName.size() - hostName.size() - 1);
    } else {
        reply400BadRequest(
            "Unknown host: " + domainName +
            " "
            "Please use a valid hostname specified in machinepal config "
            "(like localhost or xyz.com) to access this service.");
        return false;
    }

    return true;
}

bool X402Processor::validateAndDecodePath(const std::unique_ptr<proxygen::HTTPMessage> &request) {
    auto path = request->getPath();
    std::string errorMessage;
    if (!URLUtils::decodePath(path, decodedPath_, errorMessage)) {
        reply400BadRequest(errorMessage);
        return false;
    }
    return true;
}

bool X402Processor::matchOrganization() {
    organization_ = config()->getOrganizationBySubdomainName(subDomainName_);

    if (!organization_) {
        reply400BadRequest(
            "Unknown subdomain  " + subDomainName_ + "." + config_->server()->hostName() +
            " Please use a valid subdomain specified in machinepal config "
            "(like localhost or xyz.com) to access this service.");
        return false;
    }
    return true;
}

bool X402Processor::validateMethod(const std::unique_ptr<proxygen::HTTPMessage> &request) {
    if (!request->getMethod().has_value()) {
        reply400BadRequest("Missing HTTP method");
        return false;
    }

    method_ = request->getMethod().value();

    if (method_ != proxygen::HTTPMethod::GET && method_ != proxygen::HTTPMethod::POST
        && method_ != proxygen::HTTPMethod::HEAD && method_ != proxygen::HTTPMethod::OPTIONS &&
        method_ != proxygen::HTTPMethod::PUT && method_ != proxygen::HTTPMethod::DELETE) {
        reply400BadRequest(
            "Unsupported HTTP method." +
            request->getMethodString());
        return false;
    }
    return true;
}

void X402Processor::onRequestStart(const std::unique_ptr<proxygen::HTTPMessage> &request) noexcept {
    try {
        CHECK_STATE(request);

        if (!validateAndExtractSubDomainName(request))
            return;

        if (!matchOrganization())
            return;

        if (!validateAndDecodePath(request))
            return;
    } catch (std::exception &e) {
        LOG_NETWORK_CRITICAL("onRequestStart exception");
        printNestedException(e);
        reply500InternalError("Could not process x402 request start.");
    } catch (...) {
        LOG_NETWORK_CRITICAL("onRequestStart unknown exception");
        reply500InternalError("Could not process x402 request start.");
    };
}


void X402Processor::sendSettlementErrorResponse(
    ptr<Authorization> authorization, add_pointer_t<HttpError> const error) {
    if (error->type() == ErrorType::ERR_INTERNAL_SERVER_ERROR) {
        reply500InternalError(error->message());
    } else {
        string payer;
        if (authorization) {
            // extract payer address from authorization
            // if we do not have authorization, we put empty payer
            payer = authorization->from().toHex(PREFIX_0x);
        }
        auto errorSettlementResponse = SettlementResponse::getErrorSettlementResponse(
            *error, config()->network()->name(), payer);
        CHECK_STATE(errorSettlementResponse);
        reply402PaymentRequired(*errorSettlementResponse);
    }
}

void X402Processor::doPassThrough(const std::unique_ptr<proxygen::HTTPMessage> &request,
                                  const string &requestBody) {
    try {
        // Validate request method (only GET/POST supported for now)
        if (!validateMethod(request)) {
            return;
        }

        // Proxy the request to the backend without any payment checks
        std::string responseBody;

        proxygen::HTTPHeaders responseHeaders;

        auto url = organization_->passThroughConfig()->targetUrl() + request->getPath();


        uint64_t httpStatusCode = 0;


        HttpEndpointConnection httpEndpointConnection(url, true);

        auto error = httpEndpointConnection.doRequest(method_, request->getHeaders(),
                                                      requestBody, httpStatusCode, responseHeaders, responseBody);

        if (error) {
            replyPassThroughError(*error, responseHeaders);
            return; // proxyResponseToBackEnd already sent an error response
        }

        // For pass-through, just return 200 OK with standard headers and the proxied body

        sendResponse({
                         httpStatusCode,
                         proxygen::HTTPMessage::getDefaultReason(httpStatusCode)
                     }, responseHeaders, responseBody);
        state_ = X402ProcessorState::REPLY_SENT;
    } catch (std::exception &e) {
        LOG_NETWORK_CRITICAL("doPassThrough exception");
        printNestedException(e);
        reply500InternalError("Could not process pass-through request.");
    } catch (...) {
        LOG_NETWORK_CRITICAL("doPassThrough unknown exception");
        reply500InternalError("Could not process pass-through request.");
    }
}

void X402Processor::handlePassThrowOrErrorOnNoResourceMatch(
    const std::unique_ptr<proxygen::HTTPMessage> &request,
    const std::string &body) {
    // resource not found. If is pass through organization, do pass through
    // else reply 400
    if (organization()->passThroughConfig()) {
        doPassThrough(request, body);
    } else {
        reply404ResourceNotFound(
            "Requested resource not found: " + decodedPath_);
    }
}

void X402Processor::onRequestFullyReceived(
    const std::unique_ptr<proxygen::HTTPMessage> &request, const string &body) noexcept {
    try {
        if (state_ == X402ProcessorState::ERROR_SENT)
            return;

        CHECK_STATE(organization_);
        resource_ = organization_->getResourceByPath(decodedPath_, method_, body);

        if (!resource_) {
            handlePassThrowOrErrorOnNoResourceMatch(request, body);
            return;
        }


        if (!validateMethod(request))
            return;

        if (reply402IfNoPaymentHeader(request->getHeaders())) {
            return;
        }


        ptr<Authorization> authorization;

        auto result = app_.paymentManager()->decodePreValidateAndSettleWithFacilitator(
            request, *config(), *resource(), *organization(), authorization);

        if (holds_alternative<HttpError>(result)) {
            auto const error = std::get_if<HttpError>(&result);
            sendSettlementErrorResponse(authorization, error);
            return;
        }

        string responseBody;

        uint64_t httpStatusCode = 0;

        proxygen::HTTPHeaders responseHeaders;

        auto url = resource_->getLocation();

        HttpEndpointConnection httpEndpointConnection(url, true);

        auto error = httpEndpointConnection.doRequest(
            method_, request->getHeaders(), body,
            httpStatusCode, responseHeaders, responseBody);

        if (error) {
            replyPassThroughError(*error, responseHeaders);
            return;
        }

        auto settlementResponse = std::get<SettlementResponse>(result);

        replyX402ResourceSuccess(httpStatusCode, settlementResponse.originalJsonToBase64(), std::move(responseHeaders),
                                 responseBody);
    } catch (std::exception &e) {
        LOG_NETWORK_CRITICAL("onRequestCompletion exception");
        printNestedException(e);
        reply500InternalError("Could not process x402 request.");
    } catch (...) {
        LOG_NETWORK_CRITICAL("onRequestCompletion unknown exception");
        reply500InternalError("Could not process x402 request.");
    };
}


void X402Processor::onBodySizeIncrease(size_t newSize) {
    if (state_ == X402ProcessorState::ERROR_SENT)
        return;
    constexpr size_t MAX_BODY_SIZE = 1024 * 1024;
    if (newSize > MAX_BODY_SIZE) {
        reply400BadRequest(
            "Request body too large. Maximum allowed is 1MByte. You can increase this "
            "limit in "
            "machinepal config if needed.");
    }
}

const proxygen::HTTPHeaders &X402Processor::getApplicationJsonHeaders() {
    static proxygen::HTTPHeaders headers = [] {
        proxygen::HTTPHeaders h;
        h.add("Content-Type", "application/json");
        return h;
    }();
    return headers;
}
