#include "EasyNetFacilitatorClient.h"

#include "MachinePalApp.h"
#include "MachinePalCommon.h"
#include "crypto/EIP712Signature.h"  // added for computeSignatureHash
#include "crypto/Encoding.h"
#include "facilitators/EasyNetFacilitator.h"
#include "payment/datastructures/PaymentRequirements.h"
#include "payment/datastructures/SettlementRequest.h"
#include "payment/datastructures/SettlementResponse.h"
#include "payment/datastructures/VerifyResponse.h"

#include <limits>        // for numeric_limits<u256>::max()
#include <shared_mutex>  // added for std::shared_mutex, std::shared_lock, std::unique_lock

EasyNetFacilitatorClient::EasyNetFacilitatorClient(string baseUrl)
    : FacilitatorClient(baseUrl) {}

