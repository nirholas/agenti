#include "CBFacilitatorClient.h"
#include "MachinePalCommon.h"



#include "exceptions/BadGatewayException.h"
#include "exceptions/ForbiddenException.h"
#include "exceptions/GatewayTimeoutException.h"
#include "exceptions/NotFoundException.h"
#include "exceptions/ServiceUnavailableException.h"
#include "exceptions/TooManyRequestsException.h"
#include "exceptions/UnauthorizedException.h"
#include "exceptions/UnknownServerErrorException.h"
#include "exceptions/VerificationError.h"

CBFacilitatorClient::CBFacilitatorClient(
    std::string _base_url, std::string _auth, long _connect_timeout_ms, long _total_timeout_ms )
    : FacilitatorClient(_base_url,  _auth, _connect_timeout_ms , _total_timeout_ms ) {
}



const std::string VERIFY_PAYLOAD_EXAMPLE = R"JSON(
{
    "x402Version": 1,
    "paymentPayload": {
        "x402Version": 1,
        "scheme": "exact",
        "network": "base-sepolia",
        "payload": {
            "signature": "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef1b",
            "authorization": {
                "from": "0x1111111111111111111111111111111111111111",
                "to": "0x2222222222222222222222222222222222222222",
                "value": "1000",
                "validAfter": "1716150000",
                "validBefore": "1716153600",
                "nonce": "0x1234567890abcdef"
            }
        }
    },
    "paymentRequirements": {
        "scheme": "exact",
        "network": "base-sepolia",
        "maxAmountRequired": "1000",
        "resource": "https://api.example.com/premium/data",
        "description": "Test API data",
        "mimeType": "application/json",
        "payTo": "0x2222222222222222222222222222222222222222",
        "maxTimeoutSeconds": 10,
        "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
    }
}
)JSON";


nlohmann::json CBFacilitatorClient::verify(
    const nlohmann::json& ) const {
    auto example = json::parse( VERIFY_PAYLOAD_EXAMPLE );
    return doRequestResponse( "/verify", example );
}

nlohmann::json CBFacilitatorClient::settle(
        const nlohmann::json&
    ) const {


    auto example = json::parse( VERIFY_PAYLOAD_EXAMPLE );
    return doRequestResponse( "/settle", example );
}


nlohmann::json CBFacilitatorClient::postJson(
    const std::string& _path, const nlohmann::json& ) const {
    auto example = json::parse( VERIFY_PAYLOAD_EXAMPLE );
    return doRequestResponse( _path, example );
}
