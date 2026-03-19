#pragma once
#include "config/ConfigManager.h"
#include "init/Init.h"
#include "payment/PaymentManager.h"
#include "x402_protocol/FacilitatorProcessor.h"
#include "x402_protocol/X402Processor.h"
#include "x402_server/ServerFactory.h"


class EasyNetFacilitator;
class FacilitatorClientManager;
class MachinePalDb;

class MachinePalApp {
public:
    [[nodiscard]] ptr<ConfigManager> configManager() const
    {
        CHECK_STATE(configManager_);
        return configManager_;
    }

    [[nodiscard]] ptr<ServerFactory> serverFactory() const
    {
        CHECK_STATE(serverFactory_);
        return serverFactory_;
    }

    [[nodiscard]] ptr<PaymentManager> paymentManager() const
    {
        CHECK_STATE(paymentManager_);
        return paymentManager_;
    }


    [[nodiscard]] ptr< FacilitatorClientManager > facilitatorClientManager() const;

    [[nodiscard]] ptr< EasyNetFacilitator > easyNetFacilitator() const;


    [[nodiscard]] ptr<MachinePalDb> machinePalDB() const
    {
        CHECK_STATE(machinePalDB_);
        return machinePalDB_;
    }


    std::shared_ptr<IProcessor> makeFacilitatorProcessor(weak_ptr<IResponseSender>& _responseSender)
    {
        return std::make_shared<FacilitatorProcessor>(*this, _responseSender);;
    }


    std::shared_ptr<IProcessor> makeX402Processor(weak_ptr<IResponseSender>& _responseSender)
    {
        return std::make_shared<X402Processor>(*this, _responseSender);;
    }


    static std::weak_ptr<MachinePalApp> sLatestInstance;

    static ptr<MachinePalApp> makeInstance(std::map<std::string, std::string>& configValuesFromCliAndEnv)
    {
        auto shared = ptr<MachinePalApp>(new MachinePalApp(configValuesFromCliAndEnv));
        sLatestInstance = shared;
        CHECK_STATE(shared);
        return shared;
    }

    static void processCRTLC() noexcept
    {
        try
        {
            auto shared = sLatestInstance.lock();
            if (shared)
            {
                shared->stopServer();
            }
            else
            {
                LOG_CORE_WARN("No MachinePalApp instance to stop server on terminate signal.");
            }
        }
        catch (const std::exception& ex)
        {
            LOG_CORE_ERROR("Error stopping server by terminate signal: {}", ex.what());
        }
        catch (...)
        {
            LOG_CORE_ERROR("Unknown error stopping server by terminate signal.");
        }
    }

    void onSuccess();

    void onError(std::exception_ptr eptr);

    uint32_t runUntilExit();

    void stopServer();

    MachinePalApp() = delete;

    MachinePalApp(const MachinePalApp&) = delete;

    MachinePalApp(MachinePalApp&&) = delete;

    MachinePalApp& operator=(const MachinePalApp&) = delete;

    MachinePalApp& operator=(MachinePalApp&&) = default;


    [[nodiscard]] bool isStarted() const
    {
        return isStarted_.load();
    }


    [[nodiscard]] bool isExited()
    {
        std::lock_guard<std::mutex> lock(exitMutex);
        return isExited_;
    }

    void setExited(uint32_t exitCode = 0, const string& exitErrorMessage = "")
    {
        std::lock_guard<std::mutex> lock(exitMutex);
        isExited_ = true;
        exitCode_ = exitCode;
        exitErrorMessage_ = exitErrorMessage;
    }

    [[nodiscard]] uint32_t exitCode()
    {
        std::lock_guard<std::mutex> lock(exitMutex);
        return exitCode_;
    }

    [[nodiscard]] string exitErrorMessage()
    {
        std::lock_guard<std::mutex> lock(exitMutex);
        return exitErrorMessage_;
    }


    [[nodiscard]] std::filesystem::path configPath() const
    {
        return configPath_;
    }

private:
    explicit MachinePalApp(const std::map<std::string, std::string>& configValuesFromCliAndEnv);

    ptr<ConfigManager> configManager_;
    ptr<ServerFactory> serverFactory_;
    ptr<proxygen::HTTPServer> proxygenServer_;


private:
    ptr<PaymentManager> paymentManager_;
    ptr<FacilitatorClientManager> facilitatorClientManager_;
    ptr<EasyNetFacilitator> easyNetFacilitator_;
    std::atomic<bool> isStarted_{false};
    std::atomic<bool> serverStopCalled_{false};


    ptr<MachinePalDb> machinePalDB_;


    bool isExited_{false};
    uint32_t exitCode_{0};
    string exitErrorMessage_;


    std::mutex exitMutex;
    std::filesystem::path configPath_;
};