#pragma once


#include "nlohmann/json.hpp"
#include <boost/multiprecision/cpp_int.hpp>
#include "exceptions/JsonValidationException.h"

#define CHECK_STATE_JSON( _EXPRESSION_, __MSG__, __JSON__ )                         \
do {                                                                                \
    if ( !(_EXPRESSION_) ) {                                                        \
        auto __msg__ = std::string( "Check failed: " ) + (__MSG__) + "\n" +         \
                (__JSON__).dump( 4 );                                               \
        throw JsonValidationException( __msg__, __JSON__);                          \
    }                                                                               \
} while (0)

class MachinePalConfig;


class JsonUtils {
public:
    static std::string findPath(const nlohmann::json &root, const nlohmann::json &target,
                                const std::string &current = "") {
        if (&root == &target) {
            return current.empty() ? "/" : current;
        }

        if (root.is_object()) {
            for (auto it = root.begin(); it != root.end(); ++it) {
                std::string child_path = current + "/" + it.key();
                std::string p = findPath(it.value(), target, child_path);
                if (!p.empty())
                    return p;
            }
        } else if (root.is_array()) {
            for (size_t i = 0; i < root.size(); ++i) {
                std::string child_path = current + "/" + std::to_string(i);
                std::string p = findPath(root[i], target, child_path);
                if (!p.empty())
                    return p;
            }
        }

        return "";
    }


    static bool asBool(const std::string &s) {
        std::string lowerS = s;
        folly::toLowerAscii(lowerS);
        return lowerS == "1" || lowerS == "true" || lowerS == "yes" || lowerS == "on";
    };

    // Helper to get a string from a json object with a default value
    static std::string getStringWithDefault(
        const nlohmann::json &j, const std::string &key, const std::string &defaultValue) {
        if (j.contains(key)) {
            CHECK_STATE_JSON(j.at( key ).is_string(), key + " must be string", j);
            return j.at(key).get<std::string>();
        }
        return defaultValue;
    }

    static bool getBoolWithDefault(
        const nlohmann::json &j, const std::string &key, bool defaultValue) {
        if (j.contains(key)) {
            CHECK_STATE_JSON(j.at( key ).is_boolean(), key + " must be boolean", j);
            return j.at(key).get<bool>();
        }
        return defaultValue;
    }


    static uint16_t getUint16WithDefault(
        const nlohmann::json &j, const std::string &key, uint16_t defaultValue) {
        if (j.contains(key)) {
            CHECK_STATE_JSON(j.at( key ).is_number_integer(), key + " must be uint16", j);
            auto value = j.at(key).get<int>();
            CHECK_STATE_JSON(value > 0 && value <= 65535, "Value for key '" + key +
                             "' is out of range for uint16: " + std::to_string(value), j);
            return static_cast<uint16_t>(value);
        }
        return defaultValue;
    }


    static string mustContainString(const nlohmann::json &j, const string &key) {
        CHECK_STATE_JSON(j.contains( key ), "Missing required " + key, j);
        CHECK_STATE_JSON(j.at( key ).is_string(), key + " must be string", j);
        return j.at(key).get<std::string>();
    }

    static nlohmann::json mustContainObject(const nlohmann::json &j, const std::string &key) {
        CHECK_STATE_JSON(j.contains( key ), "Missing required object: " + key, j);
        CHECK_STATE_JSON(j.at( key ).is_object(), key + " must be object", j);
        return j.at(key);
    }

    static nlohmann::json mustContainArray(const nlohmann::json &j, const std::string &key) {
        CHECK_STATE_JSON(j.contains( key ), "Missing required array: " + key, j);
        CHECK_STATE_JSON(j.at( key ).is_array(), key + " must be array", j);
        return j.at(key);
    }

    static std::optional<std::string> getStringIfExists(
        const nlohmann::json &j, const std::string &key) {
        if (j.contains(key)) {
            CHECK_STATE_JSON(j.at( key ).is_string(), key + " must be string", j);
            return j.at(key).get<std::string>();
        }
        return std::nullopt;
    }


    static boost::multiprecision::uint256_t mustContainPrice(
        const nlohmann::json &j, const std::string &key) {
        CHECK_STATE_JSON(j.contains( key ), "Missing required: " + key, j);
        CHECK_STATE_JSON(j.at( key ).is_number_float() || j.at( key ).is_number_integer(),
                         key + " must be integer or float price", j);
        double value = j.at(key).get<double>();
        CHECK_STATE_JSON(value >= 0.0, key + " must be non-negative", j);
        // Convert to 10^18 base (e.g., for Ethereum-like tokens)
        boost::multiprecision::uint256_t result =
                static_cast<boost::multiprecision::uint256_t>(value * 1e18);
        return result;
    }

    static uint64_t mustContainUint64(const nlohmann::json &j, const std::string &key) {
        CHECK_STATE_JSON(j.contains( key ), "Missing required: " + key, j);
        CHECK_STATE_JSON(j.at( key ).is_number_unsigned() || j.at( key ).is_number_integer(),
                         key + " must be unsigned integer", j);
        uint64_t value = j.at(key).get<uint64_t>();
        return value;
    }
};
