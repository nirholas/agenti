#include "X402Client.h"

#include "payment/datastructures/PaymentPayload.h"
#include <functional>
#include "x402_protocol/HttpEndpointConnection.h"
#include <proxygen/lib/http/HTTPMessage.h>
#include <proxygen/lib/http/HTTPMethod.h>

#include "payment/datastructures/PaymentRequiredResponse.h"
#include "x402_protocol/IBackendError.h"

X402Client::X402Client() {
}

X402Client::~X402Client() {
}


HttpResponse X402Client::doGetRequest(
    std::string url, const std::vector<pair<string, string> > &_requestHeaders) {
    auto requestHeaders = proxygen::HTTPHeaders();

    for (const auto &header: _requestHeaders) {
        requestHeaders.add(header.first, header.second);
    }


    HttpResponse resp;


    HttpEndpointConnection httpEndpointConnection(url, true);

    auto err = httpEndpointConnection.doGetRequest(requestHeaders,
                                                   resp.status, resp.headers, resp.body);


    return {resp};
}


HttpResponse X402Client::doPostRequest(
    const std::string &url,
    const std::vector<std::pair<std::string, std::string> > &_requestHeaders,
    const std::string &requestBody) {
    auto requestHeaders = proxygen::HTTPHeaders();

    for (const auto &header: _requestHeaders) {
        requestHeaders.add(header.first, header.second);
    }

    HttpResponse resp;

    HttpEndpointConnection httpEndpointConnection(url, true);

    auto err = httpEndpointConnection.doPostRequest(requestHeaders, requestBody,
                                                    resp.status, resp.headers, resp.body);

    return resp;
}


HttpResponse X402Client::doX402Request(proxygen::HTTPMethod method, const std::string &url,
    const ptr<PaymentPayload> payload,
                                       const ptr<std::string> &requestBody) {
    std::vector<pair<string, string> > header;

    if (method == proxygen::HTTPMethod::POST) {
        header.emplace_back("Content-Type", "application/json");
    }
    if (payload) {
        header.push_back(payload->createHttpHeaderValue());
    }
    if (method == proxygen::HTTPMethod::GET) {
        return doGetRequest(url, header);
    } else {
        CHECK_STATE(requestBody)
        return doPostRequest(url, {header}, *requestBody);
    }
}

HttpResponse X402Client::buyAndRetrieveX402Resource(proxygen::HTTPMethod method, const std::string &url,
    EthPrivateKey& fundingKey, ptr<string> requestBody) {
    auto resp = doX402Request(method, url, nullptr, make_shared<string>(""));

    CHECK_STATE(resp.status == 402);
    CHECK_STATE(resp.headers.getSingleOrEmpty("Content-Type") == "application/json");

    PaymentRequiredResponse response;

    try {
        response = PaymentRequiredResponse::fromJson(nlohmann::json::parse(resp.body));
    } catch (const std::exception &ex) {
        RETHROW_NESTED;
    }

    auto accepts = response.accepts();
    CHECK_STATE(accepts.size() == 1);
    auto req = accepts.front();


    EthAddress to = EthAddress::parseFlexible(req.payTo());
    auto  value = TokenAmount::fromHexOrDecimal(req.maxAmountRequired());
    EIP3009Nonce nonce = EIP3009Nonce::generateRandomNonce();

    auto paymentPayload =
            PaymentPayload().createDefaultPaymentPayload(fundingKey, to,
                                                         value, nonce, req.network());

    resp = doX402Request(method, url, paymentPayload, requestBody);


    CHECK_STATE(resp.status == 200);
    CHECK_STATE(resp.headers.exists( "X-PAYMENT-RESPONSE" ));
    //auto paymentResponse = resp.headers.getSingleOrEmpty("X-PAYMENT-RESPONSE");

    return resp;
}


