    //
    // Created by kladko on 9/29/25.
    //

    #include "MachinePalCommon.h"

    #include "ConfigLoader.h"
    #include "MachinePalConfig.h"
    #include "filesystem/FileManager.h"
    #include "subconfigs/FacilitatorConfig.h"
    #include "subconfigs/LogConfig.h"
    #include "subconfigs/NetworkConfig.h"
    #include "subconfigs/OrganizationConfig.h"
    #include "subconfigs/ServerConfig.h"

    #include <filesystem>
    #include <nlohmann/json.hpp>

    #include "JsonUtils.h"
    #include "subconfigs/PassThroughConfig.h"
    #include "x402_server/X402Handler.h"


    ptr< MachinePalConfig > MachinePalConfig::createFromJson(
        const nlohmann::json& j, ptr< FileManager > fileManager ) {
        try {
            CHECK_STATE( fileManager );
            CHECK_STATE_JSON( j.contains( "server" ), "Missing required 'server' config section", j );
            auto serverConfig = ServerConfig::createFromJson( j.at( "server" ), fileManager );

            ptr< LogConfig > logConfig;
            if ( !j.contains( "log" )) {
                // Default log config if not log element is present
                logConfig = LogConfig::createDefault();
            } else {
                logConfig = LogConfig::createFromJson( j.at( "log" ), fileManager );
            }

            auto resources = ResourceConfig::createVectorFromJsonArray( j, fileManager );

            ptr<PassThroughConfig> passThroughConfig = nullptr;

            if (j.contains("passthrough")) {
                CHECK_STATE_JSON(j.at("passthrough").is_object(), "passthrough must be object", j);
                auto passthroughObj = j.at("passthrough");
                passThroughConfig = PassThroughConfig::createFromJson(passthroughObj, fileManager);
            }

            auto defaultOrganization = OrganizationConfig::createDefaultFromResources( resources,
                passThroughConfig);
            auto networkConfig = NetworkConfig::createFromJson( j, fileManager );
            auto organizations = OrganizationConfig::createVectorFromJsonArray( j, fileManager );
            organizations->push_back( defaultOrganization );

            return ptr< MachinePalConfig >(
                new MachinePalConfig( serverConfig, logConfig, organizations, networkConfig ) );
        } catch ( const std::exception& ex ) {
            RETHROW_NESTED;
        }
    }


    MachinePalConfig::MachinePalConfig( const ptr< ServerConfig >& server, const ptr< LogConfig >& log,
        const ptr< std::vector< ptr< OrganizationConfig > > >& organizations,
        std::shared_ptr< NetworkConfig > network )
        : server_( server ), log_( log ), network_( network ) {
        CHECK_STATE( server );
        CHECK_STATE( network);
        CHECK_STATE( log_ );
        organizationsByName_ = std::make_shared< std::map< string, ptr< OrganizationConfig > > >();
        organizationsBySubdomain_ = std::make_shared< std::map< string, ptr< OrganizationConfig > > >();
        for ( const auto& org : *organizations ) {
            CHECK_STATE( org );
            auto orgName = org->organizationName();
            CHECK_STATE2( !organizationsByName_->contains( orgName ),
                "Duplicate organization name in config: " + orgName );
            organizationsByName_->emplace( orgName, org );

            auto subdomain = org->subdomain();
            CHECK_STATE2( !organizationsBySubdomain_->contains( subdomain ),
                "Duplicate organization domain in config: " + subdomain );
            organizationsBySubdomain_->emplace( subdomain, org );
        }
        CHECK_STATE( organizationsByName_->contains( "" ) );  // Default organization must be present

        string protocol;
        uint64_t port;

        if (server_->https()) {
            protocol = "https://";
            port = server_->https()->port();
        } else if (server_->http()) {
            protocol = "http://";
            port = server_->http()->port();
        } else {
            CHECK_STATE2(false, "Neither HTTP nor HTTPS is enabled in server config");
        }

        const auto& host = server_->hostName(); // provide accessor if missing
        facilitatorClient_ = make_shared<EasyNetFacilitatorClient>(
            protocol + host + ":" + to_string(port) + EASYNET_FACILITATOR_PREFIX);

    }

    const std::shared_ptr< NetworkConfig >& MachinePalConfig::network() const {
        CHECK_STATE( network_ );
        return network_;
    }

    const ptr< LogConfig >& MachinePalConfig::log() const {
        CHECK_STATE( log_ );
        return log_;
    }

    const ptr< ServerConfig >& MachinePalConfig::server() const {
        CHECK_STATE( server_ );
        return server_;
    }