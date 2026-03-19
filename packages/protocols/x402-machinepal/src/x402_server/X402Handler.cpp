#include "X402Handler.h"
#include "MachinePalCommon.h"

#include "ProxygenResponseSender.h"
#include "examples/PaymentExamples.h"
#include "x402_protocol/HttpEndpointConnection.h"
#include "x402_protocol/IProcessor.h"

using namespace proxygen;


X402Handler::X402Handler( MachinePalApp& app ) : app_( app ) {
    // we take the latest condig at the start
    config_ = app_.configManager()->latestConfig();
    CHECK_STATE( config_ );
}


void X402Handler::onRequest( std::unique_ptr< HTTPMessage > _headers ) noexcept {
    if ( internalErrorSent_ )
        return;

    try {
        CHECK_STATE( self_ );
        CHECK_STATE( _headers);

        const folly::SocketAddress& clientAddr =
            downstream_->getTransaction()->getTransport().getPeerAddress();

        std::string clientIp = clientAddr.getAddressStr();

        responseSender_ = ProxygenResponseSender::makeShared(downstream_ ,
            folly::EventBaseManager::get()->getEventBase(), *_headers , clientIp);
        reqHeaders_ = std::move( _headers );
        auto weakResponseSender = std::weak_ptr< IResponseSender >( responseSender_ );
        if ( reqHeaders_->getPath().starts_with( EASYNET_FACILITATOR_PREFIX ) ) {
            processor_ = app_.makeFacilitatorProcessor( weakResponseSender );
        } else {
            processor_ = app_.makeX402Processor( weakResponseSender );
        }

        processor()->onRequestStart( reqHeaders_ );
    } catch ( const std::exception& e ) {
        LOG_NETWORK_CRITICAL( "Error in onRequest: {}", e.what() );
        sendInternalError();
    } catch ( ... ) {
        LOG_NETWORK_CRITICAL( "Unknown error in onRequest" );
        sendInternalError();
    }
}
void X402Handler::onBody( std::unique_ptr< folly::IOBuf > _body ) noexcept {
    if ( internalErrorSent_ )
        return;

    try {
        CHECK_STATE( self_ );
        if ( !_body )
            return;
        if ( processor()->isReplySent() ) {
            return;
        }

        _body->coalesce();
        bodyBuffer_.append( reinterpret_cast< const char* >( _body->data() ), _body->length() );
        processor()->onBodySizeIncrease( bodyBuffer_.size() );
    } catch ( const std::exception& e ) {
        LOG_NETWORK_CRITICAL( "Error in onBody: {}", e.what() );
        sendInternalError();
    } catch ( ... ) {
        LOG_NETWORK_CRITICAL( "Unknown error in onBody" );
        sendInternalError();
    }
}


void X402Handler::sendInternalError() {
    internalErrorSent_ = true;
    if ( !responseSender_ ) {
        LOG_NETWORK_CRITICAL( "Response sender not available in sendInternalError" );
        return;
    }
    proxygen::HTTPHeaders headers;
    headers.add("Content-Type", "application/json");
    responseSender_->sendResponse(
        { 500, "Server Error" }, headers,
        "{\"error\":\"Internal server error.\"}" );
}

void X402Handler::onEOM() noexcept {
    if ( internalErrorSent_ )
        return;

    try {
        CHECK_STATE( self_ );
        if ( processor()->isReplySent() ) {
            return;
        }
        processor()->onRequestFullyReceived( reqHeaders_, bodyBuffer_ );
    } catch ( const std::exception& e ) {
        LOG_NETWORK_CRITICAL( "Error in onEOM: {}", e.what() );
        sendInternalError();
    } catch ( ... ) {
        LOG_NETWORK_CRITICAL( "Unknown errror in onEOM" );
        sendInternalError();
    }
}


void X402Handler::onError( proxygen::ProxygenError _err ) noexcept  {
    LOG_NETWORK_ERROR( "X402Handler::onError called: {}", proxygen::getErrorString( ( _err ) ) );
    responseSender().reset();
    // clean object if not used by different thread
    self_.reset();
}



void X402Handler::requestComplete() noexcept {
    // clean object if not used by different thread
    self_.reset();
}

void X402Handler::onUpgrade( proxygen::UpgradeProtocol /*_prot*/ ) noexcept {
    // No upgrade handling needed for now
}