#pragma once
#include "MachinePalCommon.h"
#include "crypto/EIP712Domain.h"
#include "crypto/EthAddress.h"
#include "facilitator_clients/EasyNetFacilitatorClient.h"

class FacilitatorClient;
class FacilitatorConfig;
class FileManager;

class NetworkConfig {
private:
    std::string name_;
    EthAddress revenueWalletAddress_;
    ptr<EthPrivateKey> fundingWalletKey_;

public:
    [[nodiscard]] ptr<EthPrivateKey> fundingWalletKey() const {
        return fundingWalletKey_;
    }

private:
    ptr< FacilitatorConfig > facilitator_;
    ptr< EIP712Domain > eip712Domain_;

    NetworkConfig( const std::string& name, const EthAddress& walletAddress,
        ptr<EthPrivateKey> fundingWalletKey,
        ptr<FacilitatorConfig>& facilitator, ptr< EIP712Domain >& domain ); // moved implementation to cpp


public:


    // Accessor for facilitator client
    [[nodiscard]] std::string name() const;

    const ptr< FacilitatorConfig > facilitator() const {
        return facilitator_;
    }

    [[nodiscard]] EthAddress walletAddress() const { return revenueWalletAddress_; }

    [[nodiscard]] const ptr< EIP712Domain >& eip712Domain() const {
        CHECK_STATE( eip712Domain_ );
        return eip712Domain_;
    }

    static std::shared_ptr< NetworkConfig > createFromJson(
        const nlohmann::json& j, ptr< FileManager > fileManager );

    string getTokenVersion( const string& tokenName ) const;

    string getTokenAddress( const string& tokenName ) const ;
};