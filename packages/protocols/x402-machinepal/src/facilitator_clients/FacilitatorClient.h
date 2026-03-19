#pragma once


// Abstract interface for facilitator clients capable of verifying and settling payments.
// This allows different concrete facilitator backends (e.g., Coinbase, mock, etc.).
class FacilitatorClient {
public:
    virtual ~FacilitatorClient();
    FacilitatorClient( std::string baseUrl,
        std::string auth = "", long _connectTimeoutMs = 5000, long totalTimeoutMs = 15000
    );
    std::string extractCBInvalidReason( std::string& _responseData ) const;
    void checkForGenericHttpError( std::string url, std::string payload,
        std::string responseData, long httpCode ) const;

    /*
    // POST /verify — validates the payment payload (no chain call)
    virtual nlohmann::json verify(
        const nlohmann::json& verifyRequestJson) const = 0;

    // POST /settle — performs the on-chain transfer (gas sponsored by facilitator)
    virtual nlohmann::json settle(
        const nlohmann::json& settlementRequestJson) const = 0;
        */


    virtual nlohmann::json verify( const nlohmann::json& request ) const ;
    virtual nlohmann::json settle( const nlohmann::json& ) const;
    void selfTest() const;

    virtual bool verifyTLSCerts() const {
        return true;
    }

protected:

    std::string baseUrl_;
    std::string authHeaderValue_;
    long connectTimeoutMs_;
    long totalTimeoutMs_;
    std::string proxyUrl_;
    std::vector< std::string > extraHeaders_;



    static size_t writeCallback( char* _ptr, size_t _size, size_t _nmemb, void* _userdata );
    static std::string joinUrl( const std::string& _base, const std::string& _path );
    nlohmann::json doRequestResponse(
        const std::string& _path, const nlohmann::json& _body ) const;
};
