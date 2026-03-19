#pragma once

class FacilitatorClient;
class FileManager;
class ServerConfig;
class LogConfig;
class NetworkConfig;

class OrganizationConfig;

class  MachinePalConfig {
    ptr< ServerConfig > server_;



private:
    ptr< LogConfig > log_;
    ptr< std::map< string, ptr< OrganizationConfig > > > organizationsByName_;
    ptr< std::map< string, ptr< OrganizationConfig > > > organizationsBySubdomain_;
    std::shared_ptr< NetworkConfig > network_;
    ptr<FacilitatorClient> facilitatorClient_;
    MachinePalConfig( const ptr< ServerConfig >& server, const ptr< LogConfig >& log,
        const ptr< std::vector< ptr< OrganizationConfig > > >& organizations,
        std::shared_ptr< NetworkConfig > network );

    [[nodiscard]] ptr< std::map< string, ptr< OrganizationConfig > > > organizationsBySubdomain()
        const {
        CHECK_STATE( organizationsBySubdomain_ )
        return organizationsBySubdomain_;
    }


    [[nodiscard]] ptr< std::map< string, ptr< OrganizationConfig > > > organizationsByName() const {
        CHECK_STATE( organizationsByName_ )
        return organizationsByName_;
    }

public:
    bool isSchemeSupported( const std::string& scheme ) const { return scheme == "exact"; }

    const ptr< ServerConfig >& server() const;

    const ptr< LogConfig >& log() const;
    const std::shared_ptr< NetworkConfig >& network() const;


    static ptr< MachinePalConfig > createFromJson(
        const nlohmann::json& j, ptr< FileManager > fileManager );

    ptr< OrganizationConfig > getDefaultOrganization() const {
        CHECK_STATE( organizationsByName_ );
        auto it = organizationsByName_->find( "" );
        CHECK_STATE( it != organizationsByName_->end() );
        CHECK_STATE( it->second );
        return it->second;
    }

    ptr< OrganizationConfig > getOrganizationBySubdomainName( const std::string& subdomain ) const {
        auto it = organizationsBySubdomain()->find( subdomain );
        if ( it != organizationsBySubdomain()->end() ) {
            return it->second;
        }
        return nullptr;
    }

    [[nodiscard]] ptr< FacilitatorClient > facilitatorClient() const {
        CHECK_STATE( facilitatorClient_ );
        return facilitatorClient_;
    }
};