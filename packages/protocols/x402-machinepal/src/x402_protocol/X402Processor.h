#pragma once
#include <proxygen/lib/http/HTTPMethod.h>
#include <optional>

#include "IBackendError.h"
#include "HttpError.h"
#include "IProcessor.h"
#include "IResponseSender.h"
#include "X402ProcessorState.h"
#include "payment/datastructures/Authorization.h"


class IBackendError;
class SettlementResponse;
class ResourceConfig;

namespace proxygen {
    class HTTPHeaders;
    enum class HTTPMethod;
class ResponseHandler;
class HTTPMessage;
}  // namespace proxygen

class MachinePalApp;  // Forward declaration
class MachinePalConfig;
class OrganizationConfig;

class X402Processor : public IProcessor {
public:

    explicit X402Processor( MachinePalApp& app, weak_ptr< IResponseSender >& responseSender );

    bool isReplySent() const override;

    bool reply402IfNoPaymentHeader( const proxygen::HTTPHeaders& requestHeaders );

    static const proxygen::HTTPHeaders &getApplicationJsonHeaders();

    void onRequestStart( const std::unique_ptr< proxygen::HTTPMessage >& request ) noexcept override;

    void sendSettlementErrorResponse(
        ptr< Authorization > authorization, add_pointer_t< HttpError > error );

    void doPassThrough(const std::unique_ptr< proxygen::HTTPMessage >& request,const string& requestBody);

    void handlePassThrowOrErrorOnNoResourceMatch(const std::unique_ptr<proxygen::HTTPMessage> &request,
                                                 const string &body);

    void onRequestFullyReceived(
        const std::unique_ptr< proxygen::HTTPMessage >& request, const string& body ) noexcept override;
    void onBodySizeIncrease( size_t newSize ) override;


private:

    void sendResponse( const std::pair< uint16_t, std::string >& statusAndMessage,
        const proxygen::HTTPHeaders& headers,
        const std::string& body );

    void reply400BadRequest( const std::string& message );

    void reply402PaymentRequired( std::optional< SettlementResponse > errorResponse );

    void reply404ResourceNotFound(const std::string& message);

    string getJsonErrorBody( const std::string& message );

    void reply500InternalError( const std::string& message );

    void reply502BadGateway( const std::string& message );

    void replyGenericHttpError(IBackendError &error, proxygen::HTTPHeaders & responseHeaders);

    void replyPassThroughError( IBackendError& error, proxygen::HTTPHeaders & responseHeaders );

    bool validateAndExtractSubDomainName(
        const std::unique_ptr< proxygen::HTTPMessage >& request );

    bool validateAndDecodePath( const std::unique_ptr< proxygen::HTTPMessage >& request );

    bool matchOrganization();

    bool validateMethod( const std::unique_ptr< proxygen::HTTPMessage >& request );

    void  replyX402ResourceSuccess( uint64_t statusCode, const std::string& settlementInfo,
        const proxygen::HTTPHeaders&& responseHeaders,
        std::string& responseBody );

    [[nodiscard]] ptr< MachinePalConfig > config() const {
        CHECK_STATE( config_ );
        return config_;
    }

    [[nodiscard]] ptr< ResourceConfig > resource() const {
        CHECK_STATE( resource_ );
        return resource_;
    }


    [[nodiscard]] ptr< OrganizationConfig > organization() const {
        CHECK_STATE( organization_ );
        return organization_;
    }


    MachinePalApp& app_;
    ptr< MachinePalConfig > config_;
    std::string decodedPath_;
    std::string subDomainName_;
    ptr< OrganizationConfig > organization_;
    ptr< ResourceConfig > resource_;
    weak_ptr< IResponseSender > responseSender_;
    X402ProcessorState state_ = X402ProcessorState::START;
    // initially set to non-supported value
    proxygen::HTTPMethod method_ = proxygen::HTTPMethod::TRACE;
};
