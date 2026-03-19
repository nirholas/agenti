
#include "FacilitatorProcessor.h"
#include  "x402_server/X402Handler.h"
#include "IResponseSender.h"
#include "MachinePalApp.h"
#include "MachinePalCommon.h"
#include "config/subconfigs/OrganizationConfig.h"
#include "config/subconfigs/ServerConfig.h"
#include "facilitators/EasyNetFacilitator.h"


auto SETTLE_PATH = EASYNET_FACILITATOR_PREFIX + string("/settle");
auto VERIFY_PATH = EASYNET_FACILITATOR_PREFIX + string("/verify");


FacilitatorProcessor::FacilitatorProcessor( MachinePalApp& app, weak_ptr< IResponseSender >& responseSender )
    : app_( app ), responseSender_( responseSender ) {
    config_ = app_.configManager()->latestConfig();
}


void FacilitatorProcessor::reply400BadRequest( const std::string& message ) {
    string body = getJsonErrorBody( message );
    sendResponse( { 400, "Bad request" }, X402Processor::getApplicationJsonHeaders(), body );
    state_ = FacilitatorProcessorState::ERROR_SENT;
}

void FacilitatorProcessor::reply500InternalError( const std::string& message ) {
    string body = getJsonErrorBody( message );
    sendResponse( { 500, "Server Error" },  X402Processor::getApplicationJsonHeaders(), body );
    state_ = FacilitatorProcessorState::ERROR_SENT;
}

void FacilitatorProcessor::reply405MethodNotAllowed( const std::string& message ) {
    string body = getJsonErrorBody( message );
    auto headers =  X402Processor::getApplicationJsonHeaders();
    headers.add("Allow", "POST");
    sendResponse( { 405, "Method Not Allowed" }, headers, body );
    state_ = FacilitatorProcessorState::ERROR_SENT;
}

void FacilitatorProcessor::reply413PayloadTooLarge( const std::string& message ) {
    string body = getJsonErrorBody( message );
    sendResponse( { 413, "Payload Too Large" },  X402Processor::getApplicationJsonHeaders(), body );
    state_ = FacilitatorProcessorState::ERROR_SENT;
}

void FacilitatorProcessor::reply415UnsupportedMediaType( const std::string& message ) {
    string body = getJsonErrorBody( message );
    auto headers =  X402Processor::getApplicationJsonHeaders();
    headers.add("Accept-Post", "application/json");
    sendResponse( { 415, "Unsupported Media Type" }, headers, body );
    state_ = FacilitatorProcessorState::ERROR_SENT;
}


std::string FacilitatorProcessor::getJsonErrorBody( const std::string& message ) {
        nlohmann::json j;
        j["error"] = message;
        return j.dump();
}



void FacilitatorProcessor::sendResponse( const std::pair< uint16_t, std::string >& statusAndMessage,
    const proxygen::HTTPHeaders& headers, const std::string& body ) {
    if ( state_ == FacilitatorProcessorState::ERROR_SENT) {
        LOG_NETWORK_ERROR( "Attempted to send response after error response already sent." );
        return;
    }

    if ( state_ == FacilitatorProcessorState::REPLY_SENT ) {
        LOG_NETWORK_ERROR( "Attempted to send response after resource already sent." );
        return;
    }

    auto responseSender = responseSender_.lock();
    if ( !responseSender ) {
        LOG_NETWORK_ERROR( "Connection closed before sending reply" );
        return;
    }
    try {
        responseSender->sendResponse( statusAndMessage, headers, body );
    } catch ( std::exception& e ) {
        LOG_NETWORK_ERROR( "Exception while sending response: {}", e.what() );
        // nothing can be done so we consider response as sent
    }
}



void FacilitatorProcessor::onRequestStart(
    const std::unique_ptr< proxygen::HTTPMessage >& reqHeaders ) noexcept {
    try {
        CHECK_STATE( reqHeaders );
        if (reqHeaders->getMethod() != proxygen::HTTPMethod::POST) {
            reply405MethodNotAllowed("Only POST method is allowed.");
            return;
        }

        auto contentType = reqHeaders->getHeaders().getSingleOrEmpty("Content-Type");

        // Trim leading whitespace to be more robust
        contentType.erase(0, contentType.find_first_not_of(" \t"));
        if (!contentType.starts_with("application/json")) {
            reply415UnsupportedMediaType("Content-Type must be application/json.");
            return;
        }

        auto path = reqHeaders->getPath();

        if (path != SETTLE_PATH && path != VERIFY_PATH) {
            reply400BadRequest("Invalid endpoint. Use settle or verify.");
            return;
        }

        path_ = path;


    } catch ( std::exception& e ) {
        LOG_NETWORK_CRITICAL( "onRequestStart exception" );
        printNestedException( e );
        reply500InternalError( "Could not process x402 request start." );
    } catch (...) {
        LOG_NETWORK_CRITICAL( "onRequestStart unknown exception" );
        reply500InternalError( "Could not process x402 request start." );
    };
}




bool FacilitatorProcessor::isReplySent() const {
    return state_ == FacilitatorProcessorState::ERROR_SENT ||
           state_ == FacilitatorProcessorState::REPLY_SENT;
}

void FacilitatorProcessor::onRequestFullyReceived(
    const std::unique_ptr< proxygen::HTTPMessage >& , const string& body ) noexcept {
    try {
        if (isReplySent())
            return;

        nlohmann::json jsonBody;

        try {
            jsonBody = nlohmann::json::parse( body );
        } catch ( nlohmann::json::parse_error& e ) {
            reply400BadRequest( "Invalid JSON in request body." );
            return;
        }


        nlohmann::json result;

        if (path_ == SETTLE_PATH)
            result = app_.easyNetFacilitator()->processSettleRequest( jsonBody );
        else  {
            CHECK_STATE( path_ == VERIFY_PATH );
            result = app_.easyNetFacilitator()->processVerifyRequest( jsonBody );
        }


        std::string responseBody = result.dump(); // assuming result is nlohmann::json

        sendResponse({200, "OK"}, X402Processor::getApplicationJsonHeaders(), responseBody);
        state_ = FacilitatorProcessorState::REPLY_SENT;

    } catch ( std::exception& e ) {
        LOG_NETWORK_CRITICAL( "onRequestFullyReceived exception" );
        printNestedException( e );
        reply500InternalError( "Could not process settlement request." );
    } catch (...) {
        LOG_NETWORK_CRITICAL( "onRequestFullyReceived unknown exception" );
        reply500InternalError( "Could not process settlement request." );
    }
}

void FacilitatorProcessor::onBodySizeIncrease( size_t newSize ) {
    if (isReplySent())
        return;
    constexpr size_t MAX_BODY_SIZE = 1024 * 1024;
    if ( newSize > MAX_BODY_SIZE ) {
        reply413PayloadTooLarge(
            "Request body too large. Maximum allowed is 1MByte. You can increase this limit in "
            "machinepal config if needed." );
    }
}
