#include "FacilitatorClient.h"
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


FacilitatorClient::~FacilitatorClient() = default;


FacilitatorClient::FacilitatorClient( std::string baseUrl, std::string auth,
    long _connectTimeoutMs, long totalTimeoutMs )
    : baseUrl_( baseUrl ),
      authHeaderValue_( auth ),
      connectTimeoutMs_( _connectTimeoutMs ),
      totalTimeoutMs_( totalTimeoutMs ) {
    CHECK_STATE( connectTimeoutMs_ > 0 );
    CHECK_STATE( totalTimeoutMs > 0 );
    CHECK_STATE( totalTimeoutMs_ >= connectTimeoutMs_ );
}


std::string FacilitatorClient::extractCBInvalidReason(
    std::string& _responseData ) const {
    try {
        auto errJson = nlohmann::json::parse( _responseData );
        if ( errJson.contains( "reason" ) && errJson["reason"].is_string() ) {
            return errJson["reason"].get< std::string >();
        }
    } catch ( ... ) {
        // Ignore JSON parse errors here
    }
    return {};
}

void FacilitatorClient::checkForGenericHttpError( const std::string url,
    std::string payload, std::string responseData, long httpCode ) const {
    if ( httpCode < 200 || httpCode >= 300 ) {
        std::string errorExplanationForUser;
        switch ( httpCode ) {
        case 400: {
            errorExplanationForUser = "Bad Request";
            std::string invalidReason = extractCBInvalidReason( responseData );
            errorExplanationForUser += ":" + invalidReason;
            break;
        }
        case 401:
            errorExplanationForUser = "Unauthorized";
            break;
        case 403:
            errorExplanationForUser = "Forbidden";
            break;
        case 404:
            errorExplanationForUser = "Not Found";
            break;
        case 429:
            errorExplanationForUser = "Too Many Requests";
            break;
        case 500:
            errorExplanationForUser = "Internal Server Error";
            break;
        case 502:
            errorExplanationForUser = "Bad Gateway";
            break;
        case 503:
            errorExplanationForUser = "Service Unavailable";
            break;
        case 504:
            errorExplanationForUser = "Gateway Timeout";
            break;
        default:
            errorExplanationForUser = "Unknown Error";
            break;
        }

        std::string errorString =
            ( "HTTP " + std::to_string( httpCode ) + " (" + errorExplanationForUser +
                ") error at " + url + ": " + responseData + "\n | Payload: " + payload );

        LOG( ERROR ) << errorString;

        switch ( httpCode ) {
        case 401:
            throw UnauthorizedException( errorExplanationForUser );
        case 403:
            throw ForbiddenException( errorExplanationForUser );
        case 404:
            throw NotFoundException( errorExplanationForUser );
        case 429:
            throw TooManyRequestsException( errorExplanationForUser );
        case 500:
            throw UnknownServerErrorException( errorExplanationForUser );
        case 502:
            throw BadGatewayException( errorExplanationForUser );
        case 503:
            throw ServiceUnavailableException( errorExplanationForUser );
        case 504:
            throw GatewayTimeoutException( errorExplanationForUser );
        default:
            throw UnknownServerErrorException( errorExplanationForUser );
        }
    }
}

size_t FacilitatorClient::writeCallback(
    char* _ptr, size_t _size, size_t _nmemb, void* _userdata ) {
    const size_t real_size = _size * _nmemb;
    auto* buf = static_cast< std::string* >( _userdata );
    buf->append( _ptr, real_size );
    return real_size;
}

std::string FacilitatorClient::joinUrl(
    const std::string& _base, const std::string& _path ) {
    if ( _base.empty() )
        return _path;
    if ( _path.empty() )
        return _base;
    const bool b = _base.back() == '/';
    const bool p = _path.front() == '/';
    if ( b && p )
        return _base + _path.substr( 1 );
    if ( !b && !p )
        return _base + "/" + _path;
    return _base + _path;
}


nlohmann::json FacilitatorClient::doRequestResponse(
    const std::string& _path, const nlohmann::json& _body ) const {
    const std::string url = joinUrl( baseUrl_, _path );
    std::string payload = _body.dump();

    CURL* curl = curl_easy_init();
    if ( !curl )
        throw std::runtime_error( "Failed to init CURL easy handle" );

    std::string responseData;
    long httpCode = 0;

    // Build headers
    struct curl_slist* headers = nullptr;
    headers = curl_slist_append( headers, "Content-Type: application/json" );
    if ( !authHeaderValue_.empty() ) {
        std::string auth = "Authorization: " + authHeaderValue_;
        headers = curl_slist_append( headers, auth.c_str() );
    }
    for ( const auto& h : extraHeaders_ ) {
        headers = curl_slist_append( headers, h.c_str() );
    }

    // Set options
    curl_easy_setopt( curl, CURLOPT_URL, url.c_str() );
    curl_easy_setopt( curl, CURLOPT_HTTPHEADER, headers );
    curl_easy_setopt( curl, CURLOPT_POST, 1L );
    curl_easy_setopt( curl, CURLOPT_POSTFIELDS, payload.c_str() );
    curl_easy_setopt( curl, CURLOPT_POSTFIELDSIZE, payload.size() );
    curl_easy_setopt( curl, CURLOPT_USERAGENT, "MachinePal/1.0" );
    curl_easy_setopt( curl, CURLOPT_WRITEFUNCTION, &FacilitatorClient::writeCallback );
    curl_easy_setopt( curl, CURLOPT_WRITEDATA, &responseData );
    curl_easy_setopt( curl, CURLOPT_CONNECTTIMEOUT_MS, connectTimeoutMs_ );
    curl_easy_setopt( curl, CURLOPT_TIMEOUT_MS, totalTimeoutMs_ );
    curl_easy_setopt( curl, CURLOPT_FOLLOWLOCATION, 1L );

    if ( !proxyUrl_.empty() ) {
        curl_easy_setopt( curl, CURLOPT_PROXY, proxyUrl_.c_str() );
    }

    if (!verifyTLSCerts()) {
        // Disables certificate verification
        curl_easy_setopt( curl, CURLOPT_SSL_VERIFYPEER, 0L );
        // Disables hostname verification
        curl_easy_setopt( curl, CURLOPT_SSL_VERIFYHOST, 0L );
    }


    // Perform
    CURLcode res = curl_easy_perform( curl );

    // Collect HTTP code before cleanup
    curl_easy_getinfo( curl, CURLINFO_RESPONSE_CODE, &httpCode );

    // Cleanup
    if ( headers )
        curl_slist_free_all( headers );
    curl_easy_cleanup( curl );


    if ( res != CURLE_OK ) {
        throw std::runtime_error(
            std::string( "CURL error: " ) + curl_easy_strerror( res ) );
    }

    if ( httpCode == 400 ) {
        std::string errorExplanationForUser = "Bad Request";
        std::string invalidReason = extractCBInvalidReason( responseData );
        errorExplanationForUser += ":" + invalidReason;
        throw VerificationError( errorExplanationForUser );
    }

    checkForGenericHttpError( url, payload, responseData, httpCode );

    if ( responseData.empty() ) {
        throw std::runtime_error( "HTTP server at " + url +
                                  " returned empty response (HTTP " +
                                  std::to_string( httpCode ) + ")" );
    }

    // Parse response
    nlohmann::json j;
    try {
        j = nlohmann::json::parse( responseData );
    } catch ( const std::exception& e ) {
        throw std::runtime_error( "Failed to parse JSON (HTTP " +
                                  std::to_string( httpCode ) + ") from " + url + ": " +
                                  std::string( e.what() ) + " | Raw: " + responseData );
    }


    return j;
}

nlohmann::json FacilitatorClient::verify( const nlohmann::json& request ) const {
    return doRequestResponse( "/verify", request );
}

nlohmann::json FacilitatorClient::settle( const nlohmann::json& request ) const {
    return doRequestResponse( "/settle", request );
}

void FacilitatorClient::selfTest() const {
    auto testUrl = baseUrl_ + "/settle";
    LOG_HEALTH_INFO("Testing connection to facilitator endpoint:"
        + testUrl);

    // Create a buffer to hold detailed error messages
    char errbuf[CURL_ERROR_SIZE];

    CURL* curl = curl_easy_init();

    if ( !curl ) {
        throw std::runtime_error( "selfTest: Failed to init CURL easy handle" );
    }

    curl_easy_setopt( curl, CURLOPT_ERRORBUFFER, errbuf );

    // Set options for a connection-only test
    curl_easy_setopt( curl, CURLOPT_URL, testUrl.c_str() );

    // This option tells curl to only perform the TCP connection (and SSL handshake)
    // and not send any application-level (HTTP) request.
    curl_easy_setopt( curl, CURLOPT_CONNECT_ONLY, 1L );

    // Use the same connection and total timeouts as regular requests
    curl_easy_setopt( curl, CURLOPT_CONNECTTIMEOUT_MS, connectTimeoutMs_ );
    curl_easy_setopt( curl, CURLOPT_TIMEOUT_MS, totalTimeoutMs_ );

    if (!verifyTLSCerts()) {
        // Disables certificate verification
        curl_easy_setopt( curl, CURLOPT_SSL_VERIFYPEER, 0L );
        // Disables hostname verification
        curl_easy_setopt( curl, CURLOPT_SSL_VERIFYHOST, 0L );
    }

    // Perform the connection attempt
    CURLcode res = curl_easy_perform( curl );

    // Cleanup
    curl_easy_cleanup( curl );

    // Check for CURL-level errors (DNS, TCP, SSL, timeout)
    if ( res != CURLE_OK ) {
        LOG_HEALTH_CRITICAL(
                "Facilitator Connection Test FAILED"
                "  URL: {}"
                "  CURL Error [{}]: {}"
                "  **Details: {}**", // Log the new, detailed messag
                testUrl, static_cast<int>(res), curl_easy_strerror(res),
                errbuf);
    } else {
        LOG_HEALTH_INFO("Facilitator Connection Test successful.");
    }
}