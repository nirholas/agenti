#include "MachinePalCommon.h"

#include <glog/logging.h>
#include "Init.h"

#include "config/ConfigManager.h"
#include "config/subconfigs/LogConfig.h"


#include "spdlog/spdlog.h"
#include "spdlog/async.h"
#include "spdlog/sinks/stdout_sinks.h"       // For uncolored stdout (Access Logs)
#include <cstdlib> // For std::getenv
#include <fmt/chrono.h>
#include <vector>
#include <memory>
#include <iostream>

// New: header callback to collect raw headers
static size_t HeaderCallback(char *buffer, size_t size, size_t nitems, void *userdata) {
    size_t total = size * nitems;
    auto *headers = static_cast<string *>(userdata);
    headers->append(buffer, total);
    return total;
}

atomic<bool> Init::inited_{false};


__attribute__((noreturn)) void ThrowOnFailure() {
    cerr << "Fatal log or CHECK failed in proxygen" << endl;
    throw runtime_error("Fatal log or CHECK failed");
}

void Init::initAllLibs(int _argc, char *_argv[]) {
    static std::mutex mtx;
    static bool is_initialized = false;

    std::lock_guard<std::mutex> lock(mtx);

    if (!is_initialized) {
        try {
            auto rc = curl_global_init(CURL_GLOBAL_DEFAULT);
            CHECK_STATE2(rc == CURLE_OK, "curl_global_init failed");

            FLAGS_logtostderr = 1;
            FLAGS_minloglevel = google::INFO;

            // folly::Init parses flags and may remove them from _argc/_argv
            static folly::Init init(&_argc, &_argv);

            google::InstallFailureFunction(&ThrowOnFailure);
            setupBootStrapLogging();

            // --- Construct Command Line String ---
            std::string cmd_line;
            for (int i = 0; i < _argc; ++i) {
                cmd_line += _argv[i];
                if (i < _argc - 1) {
                    cmd_line += " ";
                }
            }

            spdlog::info("Starting... Command Line: {}", cmd_line);
            // -------------------------------------

            is_initialized = true;
        } catch (...) {
            RETHROW_NESTED2("FATAL: Failed to initialize machinepal libraries.");
        }
    }
}


/*
 * =================================================================================================
 * LOGGING STRATEGY SUMMARY: HYBRID STREAM + ADAPTIVE FORMATTING
 * =================================================================================================
 * This strategy decouples "Data" (Traffic) from "Diagnostics" (System Health) to maximize
 * observability in Cloud/Container environments while maintaining developer ergonomics.
 *
 * 1. STREAM SEPARATION
 * -------------------------------------------------------------------------------------------------
 * | STREAM | CONTENT TYPE      | DESTINATION (Docker) | CONSUMER           |
 * |--------|-------------------|----------------------|--------------------|
 * | STDOUT | Access Logs       | Stream 1             | Machine (Datadog)  |
 * | STDERR | System/Error Logs | Stream 2             | Hybrid (Human/Bot) |
 * -------------------------------------------------------------------------------------------------
 *
 * 2. FORMATTING RULES
 * -------------------------------------------------------------------------------------------------
 * A. ACCESS LOGS (STDOUT) -> ALWAYS JSON
 * - Rationale: High-volume structural data. Must be machine-parsable for metrics/graphing.
 * - Format: { "method": "GET", "status": 200, "latency": 15, ... }
 *
 * B. SYSTEM LOGS (STDERR) -> ADAPTIVE (Controlled by ENV: LOG_FORMAT)
 * * > MODE 1: LOCAL DEVELOPMENT (Default)
 * - Env: LOG_FORMAT is unset or empty.
 * - Format: Colored Plaintext.
 * - Example: [Time] [network] [error] Connection refused
 * - Rationale: Instant readability for humans in a terminal.
 *
 * > MODE 2: CLOUD PRODUCTION (Docker/K8s)
 * - Env: LOG_FORMAT=json
 * - Format: JSON Wrapped.
 * - Example: { "logger": "network", "level": "error", "message": "Connection refused" }
 * - Rationale: Allows aggregators to index 'level' and 'logger' fields and
 * treat multi-line stack traces as single events.
 *
 * -------------------------------------------------------------------------------------------------
 * 3. CATEGORY MAPPING
 * -------------------------------------------------------------------------------------------------
 * - ACCESS   -> STDOUT (JSON)
 * - CORE     -> STDERR (Adaptive)
 * - NETWORK -> STDERR (Adaptive)
 * - DB       -> STDERR (Adaptive)
 * - SECURITY -> STDERR (Adaptive)
 * - ADMIN    -> STDERR (Adaptive)
 * - HEALTH   -> STDERR (Adaptive)
 * =================================================================================================
 */


/*
 * =================================================================================================
 * LOGGING STRATEGY & CATEGORY REGISTRY
 * =================================================================================================
 * This system partitions logs into distinct categories to facilitate filtering and routing.
 *
 * 1. ACCESS LOGS (STDOUT) -> JSON formatted, meant for machine ingestion (Datadog/Splunk/ELK).
 * 2. SYSTEM LOGS (STDERR) -> Human-readable text, meant for debugging and SRE monitoring.
 *
 * -------------------------------------------------------------------------------------------------
 * | CATEGORY  | STREAM | DEFAULT LEVEL | PURPOSE                                                  |
 * |-----------|--------|---------------|----------------------------------------------------------|
 * | ACCESS    | STDOUT | Info          | Traffic Analysis: JSON logs for Datadog/ELK              |
 * | CORE      | STDERR | Info          | Lifecycle: Startup, Shutdown, unexpected crashes         |
 * | NETWORK  | STDERR | Info/Error    | Network: HTTP Status 5xx, timeouts from backend          |
 * | DB        | STDERR | Error         | Data: SQL connection failures, slow queries              |
 * | SECURITY  | STDERR | Warn          | Threats: WAF blocks, Rate limits, Auth failures          |
 * | ADMIN     | STDERR | Info          | Audit: Configuration changes (API/Control Plane)         |
 * | HEALTH    | STDERR | Error         | Noise Control: Only logs when probes fail                |
 * -------------------------------------------------------------------------------------------------
 */


#include <string>

/**
 * setupDockerLogging
 * -----------------------------------------------------------------------------
 * Configures the spdlog subsystem for a production-grade Proxy Server.
 * * STRATEGY:
 * 1. ACCESS LOGS -> STDOUT (Always JSON)
 * 2. SYSTEM LOGS -> STDERR (Adaptive: Text for Local, JSON for Cloud)
 * * ENVIRONMENT VARIABLES:
 * - LOG_FORMAT=json     :: Forces System logs into JSON format (for Datadog/Splunk).
 * - DISABLE_ANSI_COLORS :: Disables colors in Text mode (for file redirection).
 */


// This is core logging used at the start
// we do not yet know logging config from config file
void Init::setupBootStrapLogging() {
    setupLogging(false, spdlog::level::info);
}


class JsonFormatter : public spdlog::formatter {
public:
    void format(const spdlog::details::log_msg &msg, spdlog::memory_buf_t &dest) override {
        if (msg.logger_name == "access") {
            dest.append(msg.payload.data(), msg.payload.data() + msg.payload.size());
            // Don't forget the newline
            dest.append(spdlog::details::os::default_eol,
                        spdlog::details::os::default_eol + strlen(spdlog::details::os::default_eol));
            return;
        }

        // 1. Efficient Time Formatting (No stringstream overhead)
        auto time_now = std::chrono::system_clock::to_time_t(msg.time);
        auto tm_val = spdlog::details::os::localtime(time_now);
        auto duration = msg.time.time_since_epoch();
        int millis = std::chrono::duration_cast<std::chrono::milliseconds>(duration).count() % 1000;

        char time_buf[64];
        // Standard C way is faster here: YYYY-MM-DD HH:MM:SS
        std::strftime(time_buf, sizeof(time_buf), "%Y-%m-%d %H:%M:%S", &tm_val);

        // 2. Optimized Payload Escaping
        std::string safe_msg;
        // Optimization: Reserve memory to prevent re-allocations
        safe_msg.reserve(msg.payload.size() + 16);

        for (char c: msg.payload) {
            // Check for additional JSON-breaking chars
            if (c == '"') safe_msg += "\\\"";
            else if (c == '\\') safe_msg += "\\\\";
            else if (c == '\n') safe_msg += "\\n";
            else if (c == '\r') safe_msg += "\\r";
            else if (c == '\t') safe_msg += "\\t";
            else safe_msg += c;
        }

        // 3. Format
        // Note: Using fmt::format. If this fails to compile, swap for boost::format logic used previously.
        std::string json = fmt::format(
            R"({{ "timestamp": "{}.{:03d}", "logger": "{}", "level": "{}", "message": "{}" }})",
            time_buf,
            millis,
            std::string(msg.logger_name.data(), msg.logger_name.size()),
            spdlog::level::to_string_view(msg.level),
            safe_msg
        );

        // 4. Append to Buffer
        dest.append(json.data(), json.data() + json.size());
        dest.append(spdlog::details::os::default_eol,
                    spdlog::details::os::default_eol + strlen(spdlog::details::os::default_eol));
    }

    std::unique_ptr<spdlog::formatter> clone() const override {
        return std::make_unique<JsonFormatter>();
    }
};

std::shared_ptr<spdlog::logger> Init::createLogger(const std::string &name, const std::vector<spdlog::sink_ptr> &sinks,
                                                   const std::string &pattern, bool useJson) {
    // Use spdlog::logger (Synchronous) instead of async_logger
    auto logger = std::make_shared<spdlog::logger>(name, sinks.begin(), sinks.end());

    logger->flush_on(spdlog::level::err);


    if (useJson) {
        auto formatter = std::make_unique<JsonFormatter>();
        // Set formatter for each sink, or for the logger
        logger->set_formatter(std::move(formatter));
    } else {
        logger->set_pattern(pattern);
    }

    spdlog::register_logger(logger);
    return logger;
}

std::shared_ptr<spdlog::logger> Init::createAccessLogger(const std::vector<spdlog::sink_ptr> &sinks, bool useJson) {
    std::string accessPattern = useJson ? "%v" : "[%Y-%m-%d %H:%M:%S.%e] [%n] [%^%l%$] %v";

    // Use spdlog::logger (Synchronous) instead of async_logger
    auto logger = std::make_shared<spdlog::logger>("access", sinks.begin(), sinks.end());

    logger->flush_on(spdlog::level::err);
    logger->set_pattern(accessPattern);

    spdlog::register_logger(logger);
    return logger;
}


// we call this once we have config file loaded
void Init::setupLogging(bool useJson, spdlog::level::level_enum logLevel) {
    useJsonLogging_ = useJson;
    spdlog::drop_all();

    // Sinks setup (Keep as is)
    auto stdoutSink = std::make_shared<spdlog::sinks::stdout_sink_mt>();
    std::vector<spdlog::sink_ptr> systemSinks{stdoutSink};


    // Simplified system pattern logic
    std::string systemPattern = useJson ? "" : "[%Y-%m-%d %H:%M:%S.%e] [%n] [%^%l%$] %v";

    // 1. Create Access Logger
    createAccessLogger(systemSinks, useJson);

    // 2. Define System Loggers
    std::vector<std::string> loggers = {
        "core", "network", "db", "security",
        "admin", "health", "client"
    };

    std::shared_ptr<spdlog::logger> defaultLogger;

    // 3. Create System Loggers in a loop
    for (const auto &name: loggers) {
        auto logger = createLogger(name, systemSinks, systemPattern, useJson);
        if (name == "core") defaultLogger = logger;
    }

    // 4. Finalize
    if (defaultLogger) spdlog::set_default_logger(defaultLogger);
    spdlog::set_level(logLevel);
    spdlog::flush_every(std::chrono::seconds(1));
}


bool Init::isInited() {
    return inited_;
}


map<string, string> Init::getMachinePalEnvironmentOverloads() {
    map<string, string> envOverloads;
    extern char **environ;
    const string prefix = "MACHINE_PAY_";
    for (char **env = environ; *env != nullptr; ++env) {
        string environmentVariable(*env);
        if (!environmentVariable.starts_with(prefix))
            continue;
        auto pos = environmentVariable.find('=');
        if (pos == string::npos)
            continue;
        string key = environmentVariable.substr(0, pos);
        string strippedKey = key.substr(prefix.size());

        if (strippedKey.empty()) {
            continue;
        }

        if (envOverloads.contains(strippedKey) > 0) {
            throw runtime_error("Duplicate environment variable: " + string(key));
        }
        envOverloads[strippedKey] = environmentVariable.substr(pos + 1);
    }
    return envOverloads;
}


void Init::configureLogging(ptr<ConfigManager> manager) {
    CHECK_STATE(manager);
    auto logConfig = manager->latestConfig()->log();
    auto logLevel = logConfig->level();
    spdlog::level::level_enum spdlogLevel = spdlog::level::info;

    auto logType = logConfig->type();

    bool useJson = logType == LogType::json;

    if (logLevel == LogLevel::trace)
        spdlogLevel = spdlog::level::trace;
    else if (logLevel == LogLevel::debug)
        spdlogLevel = spdlog::level::debug;
    else if (logLevel == LogLevel::info)
        spdlogLevel = spdlog::level::info;
    else if (logLevel == LogLevel::warn)
        spdlogLevel = spdlog::level::warn;
    else if (logLevel == LogLevel::error)
        spdlogLevel = spdlog::level::err;
    else if (logLevel == LogLevel::fatal)
        spdlogLevel = spdlog::level::critical;
    else {
        CHECK_STATE(false); // should never happen
    }

    LOG_CORE_INFO("Logging configuration: level: {}, type: {}",
                  spdlog::level::to_string_view(spdlogLevel),
                  useJson ? "json" : "text");
    setupLogging(useJson, spdlogLevel);
}

bool Init::fetchInternetTime(
    const char *url, string &utcDatetime, string &responseOut, string &errorOut) {
    CURL *curl = curl_easy_init();
    if (!curl) {
        errorOut = "Failed to initialize curl for time check";
        return false;
    }

    // RAII for curl handle
    auto curl_cleanup = [&]() {
        if (curl) {
            curl_easy_cleanup(curl);
            curl = nullptr;
        }
    };
    shared_ptr<void> guard(nullptr, [&](void *) { curl_cleanup(); });


    string headerBuffer;
    // First try: HEAD request to extract Date header
    curl_easy_setopt(curl, CURLOPT_URL, url);
    curl_easy_setopt(curl, CURLOPT_NOBODY, 1L);
    curl_easy_setopt(curl, CURLOPT_HEADERFUNCTION, HeaderCallback);
    curl_easy_setopt(curl, CURLOPT_HEADERDATA, &headerBuffer);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 5L);
    CURLcode res = curl_easy_perform(curl);

    auto parseDateHeader = [&](const string &headers) -> bool {
        istringstream iss(headers);
        string line;
        while (getline(iss, line)) {
            if (line.ends_with("\r"))
                line.pop_back();
            // Case-insensitive starts_with "date:"
            if (line.size() >= 5) {
                string prefix = line.substr(0, 5);
                for (auto &c: prefix)
                    c = static_cast<char>(tolower(static_cast<unsigned char>(c)));
                if (prefix == "date:") {
                    string value = line.substr(5);
                    // trim leading spaces
                    while (
                        !value.empty() && isspace(static_cast<unsigned char>(value.front())))
                        value.erase(value.begin());
                    // Expected: Sun, 16 Nov 2025 12:19:42 GMT
                    // Remove trailing GMT if present for parsing
                    if (value.size() > 4 && value.substr(value.size() - 4) == " GMT") {
                        value = value.substr(0, value.size() - 4);
                    }
                    tm tm{};
                    istringstream parse(value);
                    parse >> get_time(&tm, "%a, %d %b %Y %H:%M:%S");
                    if (!parse.fail()) {
                        time_t t = timegm(&tm);
                        if (t != -1) {
                            auto gmt = gmtime(&t);
                            if (gmt) {
                                ostringstream out;
                                out << put_time(gmt, "%Y-%m-%dT%H:%M:%SZ");
                                utcDatetime = out.str();
                                return true;
                            }
                        }
                    }
                    return false;
                }
            }
        }
        return false;
    };

    if (res == CURLE_OK && parseDateHeader(headerBuffer)) {
        responseOut = headerBuffer;
        return true;
    } else {
        return false;
    }
}

void Init::checkSystemTime() {
    string utcDatetime, response, error;
    bool ok = fetchInternetTime("https://google.com", utcDatetime, response, error);
    if (!ok) {
        spdlog::warn("fetchInternetTime failed: {}", error);
        return;
    }
    if (utcDatetime.empty()) {
        spdlog::warn("Empty utcDatetime received. Response: {}", response);
        return;
    }

    // Expect formats like:
    // 1) YYYY-MM-DDTHH:MM:SSZ
    // 2) YYYY-MM-DDTHH:MM:SS.ffffffZ
    // 3) YYYY-MM-DDTHH:MM:SS+00:00
    // 4) YYYY-MM-DDTHH:MM:SS.ffffff+00:00
    // 5) YYYY-MM-DDTHH:MM:SS(.fraction)+00:00
    if (utcDatetime.size() < 19) {
        spdlog::warn("utcDatetime too short: {}", utcDatetime);
        spdlog::warn("Full response: {}", response);
        return;
    }

    string base = utcDatetime.substr(0, 19); // YYYY-MM-DDTHH:MM:SS
    tm tm{};
    istringstream ss(base);
    ss >> get_time(&tm, "%Y-%m-%dT%H:%M:%S");
    if (ss.fail()) {
        spdlog::warn("Failed to parse base datetime: {}", base);
        spdlog::warn("Full utcDatetime: {}", utcDatetime);
        return;
    }

    // Parse remainder for fractional seconds and timezone
    int offsetSeconds = 0;
    size_t idx = 19;
    // Skip fractional seconds if present
    if (idx < utcDatetime.size() && utcDatetime[idx] == '.') {
        ++idx;
        while (idx < utcDatetime.size() &&
               isdigit(static_cast<unsigned char>(utcDatetime[idx])))
            ++idx;
    }

    if (idx < utcDatetime.size()) {
        char tzChar = utcDatetime[idx];
        if (tzChar == 'Z') {
            // UTC, no offset
        } else if (tzChar == '+' || tzChar == '-') {
            int sign = (tzChar == '+') ? 1 : -1;
            ++idx;
            if (idx + 4 < utcDatetime.size()) {
                // HH:MM (5 chars)
                string hhStr = utcDatetime.substr(idx, 2);
                string mmStr = utcDatetime.substr(idx + 3, 2); // skip colon
                if (utcDatetime[idx + 2] == ':' && isdigit(hhStr[0]) && isdigit(hhStr[1]) &&
                    isdigit(mmStr[0]) && isdigit(mmStr[1])) {
                    int hh = stoi(hhStr);
                    int mm = stoi(mmStr);
                    offsetSeconds = sign * (hh * 3600 + mm * 60);
                } else {
                    spdlog::warn("Malformed timezone segment in utcDatetime: {}", utcDatetime);
                    return;
                }
            } else {
                spdlog::warn("Incomplete timezone segment in utcDatetime: {}", utcDatetime);
                return;
            }
        } else {
            spdlog::warn(
                "Unexpected character after datetime '{}' in '{}'", utcDatetime[idx], utcDatetime);
            return;
        }
    }


    // Define a clear, descriptive constant for the synchronization limit.
    // We'll use 5 seconds, as implied by the exception message.
    const long TIME_SYNC_THRESHOLD_SECONDS = 5;

    // --- Time Conversion & Validation ---
    time_t baseUtc = timegm(&tm);
    if (baseUtc == -1) {
        // Log a warning if timegm fails, returning early as time calculation is impossible.
        spdlog::warn("Time conversion failed: timegm returned -1 for '{}'", base);
        return;
    }

    // If offset is +HH:MM, local time is ahead of UTC, so UTC = local - offset.
    time_t internetTime = baseUtc - offsetSeconds;
    time_t systemTime = time(nullptr);

    // Calculate the absolute difference in seconds. Use a descriptive variable name.
    long diffSeconds = labs(systemTime - internetTime);

    // --- Synchronization Check ---
    // Note: The original code checked diff > 60 seconds but the exception mentioned 5 seconds.
    // We use 5 seconds as the logical, strict requirement for application startup.
    if (diffSeconds > TIME_SYNC_THRESHOLD_SECONDS) {
        // Format time strings once for the detailed error log. Use UTC explicitly.
        char sysTimeStr[32], netTimeStr[32];
        strftime(sysTimeStr, sizeof(sysTimeStr), "%Y-%m-%d %H:%M:%S UTC", gmtime(&systemTime));
        strftime(netTimeStr, sizeof(netTimeStr), "%Y-%m-%d %H:%M:%S UTC", gmtime(&internetTime));

        // Log the event as an ERROR (or CRITICAL) since it results in a runtime_error.
        // Use the concise, actionable format.
        spdlog::error(
            "FATAL: Time sync check failed (Threshold: {}s). System ({}) vs. Internet ({}). Diff: {}s.",
            TIME_SYNC_THRESHOLD_SECONDS,
            sysTimeStr,
            netTimeStr,
            diffSeconds
        );

        // Calculate the signed difference to determine direction
        long signedDiff = systemTime - internetTime;

        // Determine the direction string
        std::string direction;
        if (signedDiff > 0) {
            direction = "ahead of"; // System time > Internet time
        } else {
            direction = "behind"; // System time < Internet time (or equal, but the 'if' above handles equal)
        }

        throw runtime_error(
            "FATAL: System clock is out of sync. "
            "System time is " + direction + " internet time by " +
            std::to_string(std::abs(signedDiff)) +
            "s, exceeding the allowed threshold of " +
            std::to_string(TIME_SYNC_THRESHOLD_SECONDS) +
            "s. Please synchronize your system clock and restart machinepal."
        );
    }
}

void Init::checkOperatingSystemConfiguration() {
    utsname buffer{};
    if (uname(&buffer) != 0) {
        throw runtime_error("Failed to get OS information");
    }
    if (string(buffer.sysname) != "Linux") {
        throw runtime_error(
            "Unsupported OS: " + string(buffer.sysname) + ". Only Linux is supported.");
    }

    checkSystemTime();
}


std::atomic<bool> Init::useJsonLogging_;
