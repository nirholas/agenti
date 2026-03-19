#pragma once
#include "MachinePalCommon.h"
#include "ResourceConfig.h"
#include "ServerConfig.h"
#include <proxygen/lib/http/HTTPMethod.h>


class PassThroughConfig;

class OrganizationConfig {
    ptr< vector< ptr< ResourceConfig > > > resources_;
    std::string organizationName_;
    std::string subdomain_;
    ptr< PassThroughConfig> passThroughConfig_;

    OrganizationConfig( const ptr< vector< ptr< ResourceConfig > > >& server,
        const std::string& organizationName, const std::string& subdomain,
        ptr<PassThroughConfig> passThroughConfig)
        : resources_( server ), organizationName_( organizationName ), subdomain_( subdomain ),
        passThroughConfig_(passThroughConfig) {
    }

public:
    [[nodiscard]] ptr<PassThroughConfig> passThroughConfig() const;

    const ptr< vector< ptr< ResourceConfig > > >& resources() const { return resources_; }
    const std::string& organizationName() const { return organizationName_; }
    const std::string& subdomain() const { return subdomain_; }

    static void validateOrgName( const std::string& name );

    static ptr< OrganizationConfig > createFromJson(
        const nlohmann::json& j, ptr< FileManager > fileManager );

    static std::shared_ptr< std::vector< ptr< OrganizationConfig > > > createVectorFromJsonArray(
        const nlohmann::json& j, ptr< FileManager > fileManager );

    static ptr< OrganizationConfig > createDefaultFromResources(
        ptr< vector< ptr< ResourceConfig > > > resources, ptr<PassThroughConfig> passThroughConfig);

    ptr< ResourceConfig > getResourceByPath(
        const std::string& path, proxygen::HTTPMethod, const std::string& ) const {
        CHECK_STATE( resources_ );
        string matchString;
        // ignore last backslash for matching
        if ( path.size() > 1 && path.back() == '/' ) {
            matchString = path.substr( 0, path.size() - 1 );
        } else {
            matchString = path;
        }
        for ( const auto& resource : *resources_ ) {
            if ( resource->machinePalPath() == matchString ) {
                return resource;
            }
        }
        return nullptr;
    }
};
