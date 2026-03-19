#pragma once
#include "FacilitatorClient.h"
#include <nlohmann/json.hpp>
#include <string>
#include <vector>
/// Minimal client for Coinbase x402 facilitator (REST JSON API).
/// Depends on: libcurl, nlohmann::json
///
///
//        std::string cdp_url = "https://api.cdp.coinbase.com/platform/v2/x402",
//        std::string cdpAuth = "Bearer XYZ", // Replace with real token if needed
///
class CBFacilitatorClient : public FacilitatorClient {
public:
    explicit CBFacilitatorClient( std::string _base_url = "https://x402.org/facilitator/",
        std::string _auth = "", long _connect_timeout_ms = 5000, long _total_timeout_ms = 15000 );


    ~CBFacilitatorClient() override = default;


    // POST /verify — validates the payment payload (no chain call)
    nlohmann::json verify( const nlohmann::json& _settlementRequest) const;


    // POST /settle — performs the on-chain transfer (gas sponsored by facilitator)
    nlohmann::json settle( const nlohmann::json& settleRequest ) const ;


private:



    nlohmann::json postJson( const std::string& _path, const nlohmann::json& _body ) const;

};
