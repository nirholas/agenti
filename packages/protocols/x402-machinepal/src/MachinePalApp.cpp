#include "MachinePalApp.h"
#include "db/MachinePalDb.h"
#include "facilitator_clients/FacilitatorClientManager.h"
#include "facilitators/EasyNetFacilitator.h"

MachinePalApp::MachinePalApp(const std::map<std::string, std::string>& configValuesFromCliAndEnv)
{
    try
    {
        configManager_ = ConfigManager::initManager(configValuesFromCliAndEnv);
        configPath_ = configManager_->fileManager()->canonicalConfigDirPath();
        Init::configureLogging(configManager());
        paymentManager_ = std::make_shared<PaymentManager>(*this);
        facilitatorClientManager_ = std::make_shared<FacilitatorClientManager>(*this);
        easyNetFacilitator_ = std::make_shared<EasyNetFacilitator>(*this);
        //machinePalDB_ = std::make_shared<MachinePalDb>(*this, DbType::SQLite);
        machinePalDB_ = std::make_shared<EasyNetDb>(*this, DbType::SQLite);
    }
    catch (...)
    {
        RETHROW_NESTED2("Failed to initialize MachinePalApp");
    }
}
ptr< FacilitatorClientManager > MachinePalApp::facilitatorClientManager() const {
    CHECK_STATE( facilitatorClientManager_ );
    return facilitatorClientManager_;
}
ptr< EasyNetFacilitator > MachinePalApp::easyNetFacilitator() const {
    CHECK_STATE( easyNetFacilitator_);
    return easyNetFacilitator_;
}


static std::atomic<int> sigReceived{0};


static void machinepalTerminateSignalHandler(int sig)
{
    sigReceived = sig;
}

uint32_t MachinePalApp::runUntilExit()
{
    std::signal(SIGTERM, machinepalTerminateSignalHandler);
    std::signal(SIGINT, machinepalTerminateSignalHandler);


    try
    {
        LOG_CORE_INFO("Starting machinepal");
        serverFactory_ = std::make_shared<ServerFactory>(*this);
        auto serverConfig = configManager_->latestConfig()->server();

        proxygenServer_ = serverFactory_->createServerInstance(*serverConfig);

        auto ioExecutor = std::make_shared<folly::IOThreadPoolExecutor>(
            256,
            std::make_shared<folly::NamedThreadFactory>("x402Processor"));

        auto onSuccess = [this]()
        {
            LOG_CORE_INFO("Machinepal started successfully.");
            this->isStarted_ = true;
        };
        auto onError = [this](std::exception_ptr eptr)
        {
            try
            {
                if (eptr) std::rethrow_exception(eptr);
            }
            catch (const std::exception& ex)
            {
                LOG_CORE_ERROR("Machinepal failed to start: {}", ex.what());
                this->setExited(1, ex.what());
                return;
            }
            catch (...)
            {
            }
            LOG_CORE_ERROR("Machinepal failed to start: unknown error");
            this->setExited(1, "Machinepal failed to start: unknown error");
        };

        std::thread serverThread([this, ioExecutor, onSuccess, onError]()
        {
            try
            {
                proxygenServer_->start(onSuccess, onError, nullptr, ioExecutor);
                setExited();
            }
            catch (...)
            {
                LOG_CORE_ERROR("Machinepal failed to start: unknown error");
                setExited(1, "Unknown error starting machinepal");
            }
        });

        uint64_t counter = 0;

        while (!isExited() && !sigReceived)
        {
            counter++;
            if (counter == 10) {
                // do a self test of the facilitator one second after start
                try {
                    this->configManager()->latestConfig()->facilitatorClient()->selfTest();
                } catch (const std::exception& ex) {
                    LOG_CORE_ERROR("Facilitator self test failed: {}", ex.what());
                } catch (...) {
                    LOG_CORE_ERROR("Facilitator self test failed: unknown error");
                }
            }
            usleep(100 * 1000);
        }
        if (sigReceived)
        {
            if (sigReceived == SIGINT)
                LOG_CORE_INFO("SIGINT (Ctrl-C) received, stopping server.");
            else if (sigReceived == SIGTERM)
                LOG_CORE_INFO("SIGTERM received, stopping server.");
            else
            {
                CHECK_STATE2(false, std::string("Unexpected signal {}") + to_string(sigReceived.load()));
            }
            stopServer();
        }
        // Wait for server to exit after stopServer is called
        while (!isExited())
        {
            usleep(100 * 1000);
        }


        serverThread.join();
        if (exitCode_ != 0)
        {
            LOG_CORE_ERROR("Error running machinepal server: {}. Server exited.", exitErrorMessage_);
            return exitCode_;
        }
        LOG_CORE_INFO("Machinepal server exited normally.");
        return 0;
    }
    catch (const std::exception& ex)
    {
        LOG_CORE_CRITICAL("Fatal error running machinepal server: {}. Server exited", ex.what());
        printNestedException(ex);
        return 1;
    }
}

void MachinePalApp::stopServer()
{
    if (serverStopCalled_.exchange(true))
        return;

    proxygenServer_->stop();
}

std::weak_ptr<MachinePalApp> MachinePalApp::sLatestInstance;