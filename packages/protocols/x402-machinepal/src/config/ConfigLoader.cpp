#include "MachinePalCommon.h"
#include "ConfigLoader.h"
#include "JsonUtils.h"
#include "MachinePalConfig.h"
#include "config/MachinePalConfigSchema.h"
#include "init/Init.h"
#include <yaml-cpp/yaml.h>
#include <boost/test/tools/detail/fwd.hpp>
#include <cstdlib>
#include <fstream>
#include <mutex>
#include <nlohmann/json-schema.hpp>
#include <nlohmann/json.hpp>
#include <optional>
#include <sstream>
#include <string>
#include <unordered_set>


using nlohmann::json;
using nlohmann::json_schema::json_validator;
;
using namespace nlohmann::literals;  // Enables the _json_pointer literal

// --- Helper Functions ---

// ---------- tiny utils ----------
std::optional< std::string > ConfigLoader::getenvOpt( const char* key ) {
    if ( overridesFromCliAndEnv_.count( key ) ) {
        return overridesFromCliAndEnv_.at( key );
    }
    return std::nullopt;
}

std::string ConfigLoader::readSecretFileFirstLine(
    const std::string& path, const std::string& fallback ) {
    try {
        std::ifstream f( path );
        if ( !f.is_open() )
            return fallback;
        std::string line;
        std::getline( f, line );
        return line;
    } catch ( const std::exception& ex ) {
        RETHROW_NESTED;
    }
}


static inline bool yamlTagIs(
    const YAML::Node& node, std::string_view shortTag /* like "!!bool" */ ) {
    const std::string& tag =
        node.Tag();  // may be "", "!!str", or canonical "tag:yaml.org,2002:str"
    if ( tag.empty() )
        return false;
    if ( tag == shortTag )
        return true;
    // Map "!!foo" -> "tag:yaml.org,2002:foo"
    if ( shortTag.rfind( "!!", 0 ) == 0 ) {
        std::string canon = "tag:yaml.org,2002:" + std::string( shortTag.substr( 2 ) );
        return tag == canon;
    }
    return false;
}


static json yamlNodeToJson( const YAML::Node& node ) {
    using Type = YAML::NodeType::value;

    switch ( node.Type() ) {
    case Type::Null:
        return nullptr;

    case Type::Scalar: {
        const std::string s = node.Scalar();

        // Explicit tags first
        if ( yamlTagIs( node, "!!bool" ) ) {
            return node.as< bool >();
        }
        if ( yamlTagIs( node, "!!int" ) ) {
            try {
                return node.as< int64_t >();
            } catch ( const YAML::BadConversion& ) {
            }
            try {
                return node.as< uint64_t >();
            } catch ( const YAML::BadConversion& ) {
            }
            return s;
        }
        if ( yamlTagIs( node, "!!float" ) ) {
            try {
                double d = node.as< double >();
                if ( std::isfinite( d ) )
                    return d;
                return s;
            } catch ( const YAML::BadConversion& ) {
                return s;
            }
        }
        if ( yamlTagIs( node, "!!str" ) ) {
            return s;
        }

        // --- No tag: try implicit types ---
        // Try bool first
        try {
            return node.as< bool >();
        } catch ( const YAML::BadConversion& ) {
        }

        // Try int64
        try {
            return node.as< int64_t >();
        } catch ( const YAML::BadConversion& ) {
        }

        // Try uint64
        try {
            return node.as< uint64_t >();
        } catch ( const YAML::BadConversion& ) {
        }

        // Try double
        try {
            double d = node.as< double >();
            if ( std::isfinite( d ) )
                return d;
        } catch ( const YAML::BadConversion& ) {
        }

        // Fallback: string
        return s;
    }

    case Type::Sequence: {
        json arr = json::array();
        for ( const auto& it : node ) {
            arr.push_back( yamlNodeToJson( it ) );
        }
        return arr;
    }

    case Type::Map: {
        json obj = json::object();
        for ( auto it = node.begin(); it != node.end(); ++it ) {
            std::string keyStr;
            if ( it->first.Type() == Type::Scalar &&
                 ( it->first.Tag().empty() || yamlTagIs( it->first, "!!str" ) ) ) {
                keyStr = it->first.Scalar();
            } else {
                keyStr = YAML::Dump( it->first );
            }
            obj[keyStr] = yamlNodeToJson( it->second );
        }
        return obj;
    }

    case Type::Undefined:
    default:
        return nullptr;
    }
}

json ConfigLoader::yamlToJson( const std::string& yaml_path ) {
    try {
        YAML::Node root = YAML::LoadFile( yaml_path );
        return yamlNodeToJson( root );
    } catch ( const std::exception& ex ) {
        LOG( ERROR ) << "Error loading YAML file '" << yaml_path << "': " << ex.what();
        std::throw_with_nested( std::runtime_error(
            std::string( "Error loading YAML file '" ) + yaml_path + "': " + ex.what() ) );
    }
}


/**
 * @brief Applies an environment variable as a string to a JSON object at a given path.
 */
void ConfigLoader::applyStringEnv( json& j, const json::json_pointer& path, const char* envVar ) {
    try {
        if ( auto v = getenvOpt( envVar ) ) {
            j[path] = *v;
        }
    } catch ( const std::exception& ex ) {
        RETHROW_NESTED;
    }
}

/**
 * @brief Applies an environment variable as a boolean to a JSON object at a given path.
 */
void ConfigLoader::applyBoolEnv( json& j, const json::json_pointer& path, const char* envVar ) {
    try {
        if ( auto v = getenvOpt( envVar ) ) {
            j[path] = JsonUtils::asBool( *v );
        }
    } catch ( const std::exception& ex ) {
        RETHROW_NESTED;
    }
}

/**
 * @brief Applies an environment variable as an integer to a JSON object at a given path.
 */
void ConfigLoader::applyIntEnv( json& j, const json::json_pointer& path, const char* envVar ) {
    try {
        if ( auto v = getenvOpt( ( std::string( "MACHINE_PAY_" ) + envVar ).c_str() ) ) {
            j[path] = std::stoi( *v );
        }
    } catch ( const std::exception& ex ) {
        RETHROW_NESTED;
    }
}


// --- Refactored applyEnvOverrides Function ---

void ConfigLoader::applyEnvOverrides( json& j ) {
    try {
        // ---------- server ----------
        applyBoolEnv( j, "/server/enable_http"_json_pointer, "ENABLE_HTTP" );
        applyBoolEnv( j, "/server/enable_https"_json_pointer, "ENABLE_HTTPS" );
        applyIntEnv( j, "/server/http_listen_port"_json_pointer, "HTTP_PORT" );
        applyIntEnv( j, "/server/https_listen_port"_json_pointer, "HTTPS_PORT" );
        applyIntEnv( j, "/server/bind_ip"_json_pointer, "BIND_IP" );
        applyIntEnv( j, "/server/hostname"_json_pointer, "HOSTNAME" );

        // ---------- server.tls ----------
        applyStringEnv( j, "/server/tls/cert_file"_json_pointer, "SERVER_TLS_CERT_FILE" );
        applyStringEnv( j, "/server/tls/key_file"_json_pointer, "SERVER_TLS_KEY_FILE" );
        applyStringEnv( j, "/server/tls/key_pass_file"_json_pointer, "SERVER_TLS_KEY_PASS_FILE" );
        applyStringEnv( j, "/server/tls/ca_file"_json_pointer, "SERVER_TLS_CA_FILE" );

        // ---------- facilitator ----------
        applyStringEnv( j, "/facilitator/type"_json_pointer, "FACILITATOR_TYPE" );
        applyStringEnv( j, "/facilitator/base_url"_json_pointer, "FACILITATOR_BASE_URL" );
        applyStringEnv( j, "/facilitator/api_key_file"_json_pointer, "FACILITATOR_API_KEY_FILE" );
        applyStringEnv( j, "/log/level"_json_pointer, "LOG_LEVEL" );
        applyStringEnv( j, "/log/type"_json_pointer, "LOG_TYPE" );
    } catch ( const std::exception& ex ) {
        RETHROW_NESTED;
    }
}


// ---------- Resolve secret files to actual values ----------
void ConfigLoader::resolveSecrets( json& j ) {
    try {
        if ( j.contains( "database" ) && j["database"].is_object() ) {
            const std::string dbFile = j["database"].value( "passwordFile", "" );
            j["database"]["password"] = readSecretFileFirstLine( dbFile, /*fallback*/ "" );
        }
        // Only resolve password in db, not jwt
    } catch ( const std::exception& ex ) {
        RETHROW_NESTED;
    }
}


// ---------- JSON Schema validation ----------
struct SchemaValidationErrorHandler : public nlohmann::json_schema::error_handler {
    std::string errorMessage_;
    const json& parsedSchema_;

    SchemaValidationErrorHandler( const json& parsedSchema ) : parsedSchema_( parsedSchema ) {}

    std::optional< std::string > getExpectedType(
        const nlohmann::json& schema, const nlohmann::json_pointer< std::string >& path ) {
        const nlohmann::json* node = &schema;
        std::string pathStr = path.to_string();
        std::istringstream iss( pathStr );
        std::string segment;
        // Skip the first empty segment if path starts with '/'
        while ( std::getline( iss, segment, '/' ) ) {
            if ( segment.empty() )
                continue;
            if ( node->contains( "properties" ) && ( *node )["properties"].contains( segment ) ) {
                node = &( *node )["properties"][segment];
            } else {
                return std::nullopt;
            }
        }
        if ( node->contains( "type" ) ) {
            return ( *node )["type"].get< std::string >();
        }
        return std::nullopt;
    }

    void error( const nlohmann::json_pointer< std::string >& path, const json& instance,
        const std::string& message ) override {
        std::ostringstream oss;
        auto fullMessage = message;
        if ( message.find( "instance not found in required enum" ) != std::string::npos ) {
            fullMessage =
                "Invalid parameter value for the configuration option " + path.to_string() + "\n";
        } else if ( message.find( "unexpected instance type" ) != std::string::npos ) {
            fullMessage =
                "Invalid parameter type for the configuration option " + path.to_string() + "\n";

            auto expectedType = getExpectedType( parsedSchema_, path );

            if ( expectedType ) {
                fullMessage += "  Expected type: " + *expectedType + "\n";
            } else {
                fullMessage += "  Expected type: unknown (schema type not found)\n";
            }
        }

        if ( path.to_string() == "/log/level" ) {
            fullMessage += "Valid values are: trace, debug, info, warn, error, fatal.\n";
        }

        oss << "Error at config file element: " << path.to_string() << "\n"
            << "  Value: " << instance.dump( 2 ) << "\n"
            << "  Instance type: " << instance.type_name() << "\n"
            << "  Error:    " << fullMessage << "\n";
        errorMessage_ = oss.str();
        throw std::runtime_error( errorMessage_ );
    }
};

void ConfigLoader::validateJson( const json& j ) {
    json schema;

    CHECK_STATE2( !j.empty(), "Empty config file" );

    try {
        schema = json::parse( MachinePalConfigSchemaJson );
    } catch ( const std::exception& ex ) {
        RETHROW_NESTED;
    }


    SchemaValidationErrorHandler errHandler( schema );
    try {
        json_validator validator;
        validator.set_root_schema( schema );  // throws on invalid schema

        validator.validate( j, errHandler );  // throws on validation error
    } catch ( const std::exception& ex ) {
        std::string errorMsg = std::string(
                                   "MachinePalConfigLoader::validateJson Invalid config file : "
                                   "failed to validate config against schema:\n" ) +
                               errHandler.errorMessage_;
        LOG_CORE_WARN( errorMsg );
        printNestedException( ex );
    }
}


// ---------- Orchestrator ----------
std::shared_ptr< MachinePalConfig > ConfigLoader::loadFromYamlFile(
    const filesystem::path& yamlPath, ptr< FileManager > fileManager ) {
    try {
        CHECK_STATE( fileManager );
        CHECK_STATE( yamlPath.is_absolute() );
        json j = yamlToJson( yamlPath );
        applyEnvOverrides( j );
        resolveSecrets( j );
        validateJson( j );
        auto result = MachinePalConfig::createFromJson( j, fileManager );
        ;
        // sanity check manual validation corresponds to the schema
        validateJson( j );
        return result;
    } catch ( const std::exception& ex ) {
        RETHROW_NESTED2("Could not load MachinePalConfig from: " + yamlPath.string());
    }
}