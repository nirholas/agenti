#pragma once

// Third-party / external libraries
#include <spdlog/spdlog.h>
#include <glog/logging.h>
#include <nlohmann/json_fwd.hpp>
#include <nlohmann/json.hpp>

// Boost libraries
#include <boost/algorithm/hex.hpp>
#include <boost/algorithm/string.hpp>
#include <boost/algorithm/string/case_conv.hpp>
#include <boost/beast/core/detail/base64.hpp>
#include <boost/locale.hpp>
#include <boost/locale/conversion.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/version.hpp>
#include <boost/multiprecision/cpp_int.hpp>
#include <boost/regex.hpp>
#include <boost/url/decode_view.hpp>
#include <boost/locale/encoding.hpp>
#include <boost/url/error.hpp>
#include <boost/url/parse.hpp>
#include <boost/url/url.hpp>


#include <boost/filesystem/directory.hpp>
#include <boost/filesystem/operations.hpp>

#include <algorithm>
#include <array>
#include <atomic>
#include <cassert>
#include <chrono>
#include <cctype>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <iomanip>
#include <iostream>
#include <map>
#include <memory>
#include <optional>
#include <regex>
#include <shared_mutex>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>
#include <span>
#include <set>
#include <variant>
#include <csignal>
#include <curl/curl.h>
#include <folly/json.h>
#include <limits>   // for overflow check
#include <random>   // added for nonce
#include <fstream>
#include <mutex>
#include <cstddef>
#include <utility>

#include <execinfo.h>
#include <iostream>
#include <stdexcept>
#include <spdlog/sinks/stdout_sinks.h>
#include <spdlog/spdlog.h>
#include <sys/utsname.h>
#include <boost/algorithm/string/predicate.hpp>
#include <curl/curl.h>
#include <ctime>
#include <iomanip>
#include <sstream>



#define CHECK_STATE(_EXPRESSION_) \
    if (!(_EXPRESSION_)) { \
        auto __msg__ = std::string("Check failed::") + #_EXPRESSION_ + " " + std::string(__FILE__) + \
                       ":" + std::to_string(__LINE__) + " " + __FUNCTION__; \
        throw std::logic_error(__msg__ + "()"); \
    }


#define CHECK_STATE2(_EXPRESSION_, __MSG__) \
    if (!(_EXPRESSION_)) { \
        auto __msg__ = std::string("Check failed::") + #_EXPRESSION_ + " " + std::string(__FILE__) + \
                       ":" + std::to_string(__LINE__) + " " + __FUNCTION__; \
        throw std::logic_error(__msg__ + "(): " + std::string(__MSG__)); \
    }


inline std::string stripSpaces(std::string _s)
{
    _s.erase(std::remove_if(_s.begin(), _s.end(), ::isspace), _s.end());
    return _s;
}




#define RETHROW_NESTED \
do { std::throw_with_nested(std::runtime_error(std::string(__FILE__) + \
":" + std::to_string(__LINE__) + " " + std::string(__PRETTY_FUNCTION__))); \
} while(0)

#define RETHROW_NESTED2(__MSG__) \
do { std::throw_with_nested(std::runtime_error(std::string(__FILE__) + ":" \
+ std::to_string(__LINE__) + " " + std::string(__PRETTY_FUNCTION__) + ":" + std::string(__MSG__))); \
} while(0)


template <typename T>
using ptr = std::shared_ptr<T>;

using Hash = std::array<uint8_t, 32>;

using u256 = boost::multiprecision::uint256_t;

using json = nlohmann::json;

using namespace std;

enum Prefix
{
    PREFIX_NONE,
    PREFIX_0x
};

using namespace std;

#define LOG_ACCESS_INFO(...) \
    do { if(spdlog::get("access")->should_log(spdlog::level::info))  spdlog::get("access")->info(__VA_ARGS__); } while(0)

#define LOG_ACCESS_WARN(...) \
    do { if(spdlog::get("access")->should_log(spdlog::level::warn))  spdlog::get("access")->warn(__VA_ARGS__); } while(0)

#define LOG_ACCESS_ERROR(...) \
    do { if(spdlog::get("access")->should_log(spdlog::level::err))   spdlog::get("access")->error(__VA_ARGS__); } while(0)

// =============================================================================
// 2. CORE LOGS (STDERR - DEFAULT)
// =============================================================================

#define LOG_CORE_TRACE(...) \
    do { if(spdlog::get("core")->should_log(spdlog::level::trace)) spdlog::get("core")->trace(__VA_ARGS__); } while(0)

#define LOG_CORE_DEBUG(...) \
    do { if(spdlog::get("core")->should_log(spdlog::level::debug)) spdlog::get("core")->debug(__VA_ARGS__); } while(0)

#define LOG_CORE_INFO(...) \
    do { if(spdlog::get("core")->should_log(spdlog::level::info))  spdlog::get("core")->info(__VA_ARGS__); } while(0)

#define LOG_CORE_WARN(...) \
    do { if(spdlog::get("core")->should_log(spdlog::level::warn))  spdlog::get("core")->warn(__VA_ARGS__); } while(0)

#define LOG_CORE_ERROR(...) \
    do { if(spdlog::get("core")->should_log(spdlog::level::err))   spdlog::get("core")->error(__VA_ARGS__); } while(0)

#define LOG_CORE_CRITICAL(...) \
    do { if(spdlog::get("core")->should_log(spdlog::level::critical)) spdlog::get("core")->critical(__VA_ARGS__); } while(0)

// =============================================================================
// 3. NETWORK (Network/Backend)
// =============================================================================

#define LOG_NETWORK_TRACE(...) \
    do { if(spdlog::get("network")->should_log(spdlog::level::trace)) spdlog::get("network")->trace(__VA_ARGS__); } while(0)

#define LOG_NETWORK_DEBUG(...) \
    do { if(spdlog::get("network")->should_log(spdlog::level::debug)) spdlog::get("network")->debug(__VA_ARGS__); } while(0)

#define LOG_NETWORK_INFO(...) \
    do { if(spdlog::get("network")->should_log(spdlog::level::info))  spdlog::get("network")->info(__VA_ARGS__); } while(0)

#define LOG_NETWORK_WARN(...) \
    do { if(spdlog::get("network")->should_log(spdlog::level::warn))  spdlog::get("network")->warn(__VA_ARGS__); } while(0)

#define LOG_NETWORK_ERROR(...) \
    do { if(spdlog::get("network")->should_log(spdlog::level::err))   spdlog::get("network")->error(__VA_ARGS__); } while(0)

#define LOG_NETWORK_CRITICAL(...) \
do { if(spdlog::get("network")->should_log(spdlog::level::critical))   spdlog::get("network")->critical(__VA_ARGS__); } while(0)

// =============================================================================
// 4. DATABASE
// =============================================================================

#define LOG_DB_TRACE(...) \
    do { if(spdlog::get("db")->should_log(spdlog::level::trace)) spdlog::get("db")->trace(__VA_ARGS__); } while(0)

#define LOG_DB_DEBUG(...) \
    do { if(spdlog::get("db")->should_log(spdlog::level::debug)) spdlog::get("db")->debug(__VA_ARGS__); } while(0)

#define LOG_DB_INFO(...) \
    do { if(spdlog::get("db")->should_log(spdlog::level::info))  spdlog::get("db")->info(__VA_ARGS__); } while(0)

#define LOG_DB_WARN(...) \
    do { if(spdlog::get("db")->should_log(spdlog::level::warn))  spdlog::get("db")->warn(__VA_ARGS__); } while(0)

#define LOG_DB_ERROR(...) \
    do { if(spdlog::get("db")->should_log(spdlog::level::err))   spdlog::get("db")->error(__VA_ARGS__); } while(0)

// =============================================================================
// 5. SECURITY (WAF / Auth)
// =============================================================================

#define LOG_SECURITY_INFO(...) \
    do { if(spdlog::get("security")->should_log(spdlog::level::info))  spdlog::get("security")->info(__VA_ARGS__); } while(0)

#define LOG_SECURITY_WARN(...) \
    do { if(spdlog::get("security")->should_log(spdlog::level::warn))  spdlog::get("security")->warn(__VA_ARGS__); } while(0)

#define LOG_SECURITY_ERROR(...) \
    do { if(spdlog::get("security")->should_log(spdlog::level::err))   spdlog::get("security")->error(__VA_ARGS__); } while(0)

// =============================================================================
// 6. ADMIN (Audit)
// =============================================================================

#define LOG_ADMIN_INFO(...) \
    do { if(spdlog::get("admin")->should_log(spdlog::level::info))  spdlog::get("admin")->info(__VA_ARGS__); } while(0)

#define LOG_ADMIN_WARN(...) \
    do { if(spdlog::get("admin")->should_log(spdlog::level::warn))  spdlog::get("admin")->warn(__VA_ARGS__); } while(0)

#define LOG_ADMIN_ERROR(...) \
    do { if(spdlog::get("admin")->should_log(spdlog::level::err))   spdlog::get("admin")->error(__VA_ARGS__); } while(0)

// =============================================================================
// 7. HEALTH (Noise Control)
// =============================================================================

#define LOG_HEALTH_INFO(...) \
    do { if(spdlog::get("health")->should_log(spdlog::level::info)) spdlog::get("health")->info(__VA_ARGS__); } while(0)

#define LOG_HEALTH_ERROR(...) \
    do { if(spdlog::get("health")->should_log(spdlog::level::err))  spdlog::get("health")->error(__VA_ARGS__); } while(0)

#define LOG_HEALTH_CRITICAL(...) \
do { if(spdlog::get("health")->should_log(spdlog::level::critical)) spdlog::get("health")->critical(__VA_ARGS__); } while(0)

#define LOG_HEALTH_ERROR(...) \
do { if(spdlog::get("health")->should_log(spdlog::level::err))  spdlog::get("health")->error(__VA_ARGS__); } while(0)

// =============================================================================
// 8. CLIENT (Client specific errors)
// =============================================================================

#define LOG_CLIENT_DEBUG(...) \
    do { if(spdlog::get("client")->should_log(spdlog::level::debug)) spdlog::get("client")->debug(__VA_ARGS__); } while(0)

#define LOG_CLIENT_INFO(...) \
    do { if(spdlog::get("client")->should_log(spdlog::level::info))  spdlog::get("client")->info(__VA_ARGS__); } while(0)

#define LOG_CLIENT_WARN(...) \
    do { if(spdlog::get("client")->should_log(spdlog::level::warn))  spdlog::get("client")->warn(__VA_ARGS__); } while(0)

#define LOG_CLIENT_ERROR(...) \
    do { if(spdlog::get("client")->should_log(spdlog::level::err))   spdlog::get("client")->error(__VA_ARGS__); } while(0)

inline void printNestedException(const std::exception& e, int level = 0)
{
    LOG_CORE_ERROR("{}Exception: {}", std::string(level, '*'), e.what());
    try
    {
        std::rethrow_if_nested(e);
    }
    catch (const std::exception& nested)
    {
        printNestedException(nested, level + 2);
    }
    catch (...)
    {
        LOG_CORE_ERROR("{}Non-std::exception nested", std::string(level + 2, '*'));
    }
}