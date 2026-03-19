// X402HandlerFactory.h
#pragma once
#include <proxygen/httpserver/RequestHandler.h>
#include <proxygen/httpserver/RequestHandlerFactory.h>

#include "MachinePalApp.h"
#include "X402Handler.h"
#include "config/ConfigManager.h"

class MachinePalApp;

class X402HandlerFactory : public proxygen::RequestHandlerFactory {
public:
    explicit X402HandlerFactory( MachinePalApp& app ) : app_( app ) {}

    void onServerStart( folly::EventBase* /*_evb*/ ) noexcept override {}

    void onServerStop() noexcept override {}

    proxygen::RequestHandler* onRequest( proxygen::RequestHandler* /*_handler*/,
        proxygen::HTTPMessage* /*_msg*/ ) noexcept override {
        auto handler = std::shared_ptr< X402Handler >( new X402Handler( app_ ) );
        handler->self_ = handler;  // self-owning ref, ensures lifetime
        return handler.get();
    }

private:
    MachinePalApp& app_;
};