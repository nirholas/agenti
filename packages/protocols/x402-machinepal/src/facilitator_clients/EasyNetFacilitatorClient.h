#pragma once

#include "FacilitatorClient.h"
#include "crypto/TokenAmount.h"
#include "crypto/EthAddress.h"
#include "db/EasyNetDb.h"

class PaymentRequirements;
// A local in-process facilitator implementation that uses EasyNetDb instead of
// making remote HTTP calls. Intended for development, testing, or offline mode.
//
// verify(): checks that the sender wallet has sufficient balance for the requested amount.
// settle(): performs the balance transfer via EasyNetDb::transferValue.
class EasyNetFacilitatorClient : public FacilitatorClient {
public:
    explicit EasyNetFacilitatorClient( const string baseUrl);

    bool verifyTLSCerts()  const override {
        return false;
    }


};
