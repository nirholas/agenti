#pragma once

#include <folly/json.h>
#include <proxygen/httpserver/RequestHandler.h>
#include <proxygen/httpserver/ResponseBuilder.h>
#include <string>

#include "MachinePalApp.h"
#include "config/MachinePalConfig.h"

class MachinePalApp;


constexpr const char* EASYNET_FACILITATOR_PREFIX = "/machinepal-facilitator-easynet";

class X402Handler : public proxygen::RequestHandler {
public:
    void onRequest( std::unique_ptr< proxygen::HTTPMessage > _headers ) noexcept override;
    void onBody( std::unique_ptr< folly::IOBuf > _body ) noexcept override;
    void sendInternalError();
    void onEOM() noexcept override;

    void requestComplete() noexcept override;

    ~X402Handler() override {}

    void onError( proxygen::ProxygenError _err ) noexcept override;

    void onUpgrade( proxygen::UpgradeProtocol /*_prot*/ ) noexcept override;

    explicit X402Handler( MachinePalApp& app );

private:
    MachinePalApp& app_;
    ptr< MachinePalConfig > config_;
    std::unique_ptr< proxygen::HTTPMessage > reqHeaders_;
    std::string bodyBuffer_;
    ptr< IProcessor > processor_;
    [[nodiscard]] ptr< IProcessor > processor() const {
        CHECK_STATE( processor_ );
        return processor_;
    }
    [[nodiscard]] std::shared_ptr< IResponseSender > responseSender()  {
        CHECK_STATE( responseSender_ )
        return responseSender_;
    }

    std::shared_ptr< IResponseSender > responseSender_;

    ptr< X402Handler > self_{ nullptr };
    bool internalErrorSent_{ false };

    friend class X402HandlerFactory;
};