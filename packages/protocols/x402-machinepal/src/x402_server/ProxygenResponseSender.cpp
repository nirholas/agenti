#include "MachinePalCommon.h"
#include "ProxygenResponseSender.h"

#include "init/Init.h"


using namespace proxygen;

void ProxygenResponseSender::sendResponse(const std::pair<uint16_t, std::string> &statusAndMessage,
                                          const proxygen::HTTPHeaders &headers,
                                          const std::string &body) {
    auto task = [weakSelf = weakSelf_, statusAndMessage, headers, body]() mutable {
        auto self = weakSelf.lock();
        if (!self) {
            LOG_NETWORK_ERROR("Connection closed before sending reply");
            return;
        }
        proxygen::ResponseBuilder builder(self->downstream_);
        builder.status(statusAndMessage.first, statusAndMessage.second);
        headers.forEach([&builder](const std::string &name, const std::string &value) {
            builder.header(name, value);
        });
        if (!body.empty()) builder.body(body);
        builder.sendWithEOM();
        self->bytesSent_ += body.size();
        self->logAccess("gateway", statusAndMessage.first);
    };

    if (folly::EventBaseManager::get()->getEventBase() == eventBase_) {
        task();
    } else {
        eventBase_->runInEventBaseThread(std::move(task));
    }
}

ptr<ProxygenResponseSender> ProxygenResponseSender::makeShared(proxygen::ResponseHandler *downstream,
                                                               folly::EventBase *eventBase,
                                                               proxygen::HTTPMessage &requestHeaders,
                                                               const string &clientAddress) {
    auto sender = ptr<ProxygenResponseSender>(
        new ProxygenResponseSender(downstream, eventBase, requestHeaders, clientAddress));
    sender->setWeakSelf(sender);
    return sender;
}

void ProxygenResponseSender::setSanitizedUserAgent() {
    std::string rawUserAgent = requestHeaders_.getHeaders().getSingleOrEmpty("User-Agent");
    if (!rawUserAgent.empty()) {
        json j = rawUserAgent;
        std::string dumped = j.dump();
        // Remove surrounding quotes added by dump()
        if (dumped.size() >= 2) {
            userAgent_ = dumped.substr(1, dumped.size() - 2);
        } else {
            userAgent_ = "";
        }
    } else {
        userAgent_ = "";
    }
}

ProxygenResponseSender::ProxygenResponseSender(proxygen::ResponseHandler *downstream,
                                               folly::EventBase *eventBase, proxygen::HTTPMessage &requestHeaders,
                                               const string &clientAddress)
    : downstream_(downstream), eventBase_(eventBase), creationTime_(std::chrono::steady_clock::now()),
      requestHeaders_(requestHeaders), clientAddress_(clientAddress) {
    CHECK_STATE(eventBase_);
    CHECK_STATE(downstream);
    requestId_ = getOrCreateRequestId(requestHeaders_);
    method_ = requestHeaders_.getMethodString();
    path_ = requestHeaders_.getPath();
    setSanitizedUserAgent();;


    LOG_NETWORK_INFO(
        "RECEIVED_REQUEST method={} path={} ip={} id={} ",method_, path_, clientAddress_,  requestId_);
}

void ProxygenResponseSender::setWeakSelf(const weak_ptr<ProxygenResponseSender> &weakSelf) {
    weakSelf_ = weakSelf;
}

void ProxygenResponseSender::logAccess(const std::string &service, int status) {
    if (Init::getUseJsonLogging()) {
        logAccessAsJson(service, status);
    } else {
        logAccessAsCLF(service, status);
    }
}

void ProxygenResponseSender::logAccessAsJson(
    const std::string &service,
    int status
) {
    auto now = std::chrono::steady_clock::now();
    auto durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(now - creationTime_).count();

    // Build UTC timestamp with milliseconds
    auto systemNow = std::chrono::system_clock::now();
    auto msPart = std::chrono::duration_cast<std::chrono::milliseconds>(systemNow.time_since_epoch()) % 1000;
    std::time_t systemNowTime = std::chrono::system_clock::to_time_t(systemNow);

    std::tm tm{};
    gmtime_r(&systemNowTime, &tm);

    char baseTs[32];
    std::strftime(baseTs, sizeof(baseTs), "%Y-%m-%d %H:%M:%S", &tm);

    char timestampMs[48];
    std::snprintf(timestampMs, sizeof(timestampMs), "%s.%03lld",
                  baseTs, static_cast<long long>(msPart.count()));

    LOG_ACCESS_INFO(
        "{{"
        " \"timestamp\": \"{}\","
        " \"logger\": \"access\","
        " \"level\": \"info\","
        " \"service\": \"{}\","
        " \"method\": \"{}\","
        " \"path\": \"{}\","
        " \"status\": {},"
        " \"bytesSent\": {},"
        " \"latencyMs\": {},"
        " \"clientIp\": \"{}\","
        " \"userAgent\": \"{}\","
        " \"requestId\": \"{}\""
        "}}",
        timestampMs,
        service,
        method_,
        path_,
        status,
        bytesSent_,
        durationMs,
        clientAddress_,
        userAgent_,
        requestId_
    );
}


void ProxygenResponseSender::logAccessAsCLF(const std::string &service, int status) {
    // 1. Prepare Timestamp [dd/MMM/yyyy:HH:mm:ss +0000]
    auto systemNow = std::chrono::system_clock::now();
    std::time_t systemNowTime = std::chrono::system_clock::to_time_t(systemNow);
    std::tm tm{};
    gmtime_r(&systemNowTime, &tm);

    char timestamp[64];
    std::strftime(timestamp, sizeof(timestamp), "%d/%b/%Y:%H:%M:%S +0000", &tm);

    // 2. Extract Headers
    const auto &headers = requestHeaders_.getHeaders();

    // Referer
    std::string referer = headers.getSingleOrEmpty(proxygen::HTTP_HEADER_REFERER);
    if (referer.empty()) referer = "-";

    // User Agent
    std::string userAgent = userAgent_;
    if (userAgent.empty()) userAgent = "-";

    // 3. Protocol
    std::string protocol = requestHeaders_.getVersionString();
    if (protocol.empty()) protocol = "HTTP/1.1";

    // 4. Log: Combined Format + Service + RequestID
    LOG_ACCESS_INFO(
        "{} - - [{}] \"{} {} {}\" {} {} \"{}\" \"{}\" \"{}\" \"{}\"", // <--- Added extra \"{}\" at the end
        clientAddress_, // %h
        timestamp,      // %t
        method_,        // %r
        path_,          // %r
        protocol,       // %r
        status,         // %>s
        bytesSent_,     // %b
        referer,        // Referer
        userAgent,      // User-Agent
        service,        // Service Name
        requestId_      // <--- Added Request ID
    );
}

const std::string kRequestIdHeader = "X-Request-ID";

std::string ProxygenResponseSender::generateRequestId() {
    // Standard UUID v4 generation
    static std::random_device rd;
    static std::mt19937_64 gen(rd());
    static std::uniform_int_distribution<uint64_t> dist;

    uint64_t part1 = dist(gen);
    uint64_t part2 = dist(gen);

    // Set version to 4 (0100)
    part1 = (part1 & 0xFFFFFFFFFFFF0FFFULL) | 0x0000000000004000ULL;
    // Set variant to 1 (10xx)
    part2 = (part2 & 0x3FFFFFFFFFFFFFFFULL) | 0x8000000000000000ULL;

    std::stringstream ss;
    ss << std::hex << std::setfill('0')
            << std::setw(8) << (part1 >> 32) << "-"
            << std::setw(4) << ((part1 >> 16) & 0xFFFF) << "-"
            << std::setw(4) << (part1 & 0xFFFF) << "-"
            << std::setw(4) << (part2 >> 48) << "-"
            << std::setw(12) << (part2 & 0xFFFFFFFFFFFFULL);

    return ss.str();
}

std::string ProxygenResponseSender::getOrCreateRequestId(proxygen::HTTPMessage &msg) {
    auto &headers = msg.getHeaders();

    // 1. Try to get the existing ID (Proxygen handles case-insensitivity)
    const std::string &existingId = headers.getSingleOrEmpty(kRequestIdHeader);

    if (!existingId.empty()) {
        return existingId;
    }

    // 2. If missing, generate a new one
    std::string newId = generateRequestId();

    // 3. Inject it back into the headers for downstream services
    headers.set(kRequestIdHeader, newId);

    return newId;
}
