#include "NetworkConfig.h"
#include "FacilitatorConfig.h"
#include "MachinePalCommon.h"

// Constructor moved from header
NetworkConfig::NetworkConfig(const std::string &name, const EthAddress &walletAddress,
                             ptr<EthPrivateKey> fundingWalletKey,
                             ptr<FacilitatorConfig> &facilitator, ptr<EIP712Domain> &domain)
    : name_(name),
      revenueWalletAddress_(walletAddress),
      fundingWalletKey_(fundingWalletKey),
      facilitator_(facilitator),
      eip712Domain_(domain) {
    CHECK_STATE(eip712Domain_);
}


std::string NetworkConfig::name() const {
    return name_;
}


std::shared_ptr<NetworkConfig> NetworkConfig::createFromJson(
    const nlohmann::json &j, ptr<FileManager> fileManager) {
    try {
        CHECK_STATE(fileManager);

        CHECK_STATE_JSON(j.contains("network"), "Missing required 'network' config section", j);

        CHECK_STATE_JSON(
            j["network"].is_object(), "'network' config section must be an object", j);

        auto networkJson = j["network"];

        CHECK_STATE_JSON(networkJson.contains( "payment_address" ),
                         "Missing required 'payment_address' in network config", networkJson);
        CHECK_STATE_JSON(networkJson["payment_address"].is_string(),
                         "'payment_address' in network config must be a string", networkJson);

        auto revenueWalletAddressStr = networkJson["payment_address"].get<std::string>();

        auto revenueWalletAddress = EthAddress::parseHexAddress(revenueWalletAddressStr);

        ptr<EthPrivateKey> fundingWalletKey = nullptr;

        if (networkJson.contains("client_wallet_key_file")) {
            CHECK_STATE_JSON(networkJson["client_wallet_key_file"].is_string(),
                             "'client_wallet_key_file' must be a string path", networkJson);
            auto fundingWalletKeyFileStr = networkJson["client_wallet_key_file"].get<std::string>();
            auto fundingWalletPath = fileManager->checkFileExistsAndReadableAndResolve(fundingWalletKeyFileStr);

            // Read file contents
            std::ifstream keyFile(fundingWalletPath);
            CHECK_STATE_JSON(keyFile.is_open(), "Unable to open funding wallet key file", networkJson);
            std::string hexFundingWalletKey; {
                std::ostringstream oss;
                oss << keyFile.rdbuf();
                hexFundingWalletKey = oss.str();
            }
            keyFile.close();
            // Trim whitespace/newlines
            auto trim_inplace = [](std::string &s) {
                auto not_space = [](unsigned char c) { return !std::isspace(c); };
                s.erase(s.begin(), std::find_if(s.begin(), s.end(), not_space));
                s.erase(std::find_if(s.rbegin(), s.rend(), not_space).base(), s.end());
            };
            trim_inplace(hexFundingWalletKey);
            CHECK_STATE_JSON(!hexFundingWalletKey.empty(), "Funding wallet key file is empty", networkJson);

            fundingWalletKey = std::make_shared<EthPrivateKey>(EthPrivateKey::parseHex(hexFundingWalletKey));
        }

        std::string name = networkJson.value("name", "machinepal-easynet");
        std::map<std::string, ptr<EIP712Domain> > supportedNetworks{
            {"machinepal-easynet", EIP712Domain::machinePalEasyNet()},
            {"base-sepolia", EIP712Domain::baseSepolia()}, {"base", EIP712Domain::baseMainnet()}
        };
        CHECK_STATE_JSON(
            supportedNetworks.contains( name ), "Unsupported network name in config:" + name, networkJson);
        // Select domain
        auto domain = supportedNetworks.at(name);
        ptr<FacilitatorConfig> facilitator = nullptr;
        if (networkJson.contains("facilitator") && networkJson["facilitator"].is_object()) {
            facilitator =
                    FacilitatorConfig::createFomJson(networkJson["facilitator"], fileManager);
        }

        if (name != "machinepal-easynet") {
            CHECK_STATE_JSON(facilitator, "Facilitator config is required", networkJson);
        }
        return ptr<NetworkConfig>(
            new NetworkConfig(name, revenueWalletAddress, fundingWalletKey, facilitator, domain));
    } catch (const std::exception &ex) {
        RETHROW_NESTED;
    }
}


string NetworkConfig::getTokenVersion(const string &tokenName) const {
    if (tokenName == "USDC") {
        return "2";
    }
    return "";
}

string NetworkConfig::getTokenAddress(const string &tokenName) const {
    if (tokenName == "USDC") {
        return "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    }
    return "";
}
