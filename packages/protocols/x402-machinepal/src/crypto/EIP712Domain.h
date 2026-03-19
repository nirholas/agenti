#pragma once
#include "EIP3009Nonce.h"

#include "Encoding.h"
#include "EthAddress.h"
#include "EthPrivateKey.h"



// https://www.circle.com/multi-chain-usdc

enum class FacilitatorError;
class HttpError;


class EIP712Domain {
    std::string name_;
    std::string version_;
    u256 chainId_;
    EthAddress assetAddress_;
    std::string domainSeparator_;

public:
    [[nodiscard]] EthAddress assetAddress() const { return assetAddress_; }

    [[nodiscard]] std::string domainSeparator() const { return domainSeparator_; }


    // create a unique key for this payment based on domain separator, from address and nonce
    // domain separator includes chain id and asset address
    // payment for a particular unique payment can only be settled once
    std::string uniquePaymentKey( const EthAddress& from, const EIP3009Nonce nonce ) const {
        return domainSeparator_ + "_" + from.toHex( PREFIX_NONE ) + "_" +
               nonce.toHex( PREFIX_NONE );
    }


    // Default constructor
    EIP712Domain() = default;

    EIP712Domain( const std::string& name, const std::string& version, const u256& chainId,
        const EthAddress& verifyingContract,
        const std::optional< std::string > domainSeparator = std::nullopt );

    // Computes the EIP-712 domain separator hash
    std::array< uint8_t, 32 > hashDomain() const;

    static std::array< uint8_t, 32 > getDomainTypeHash();


    static shared_ptr< EIP712Domain > machinePalEasyNet() {
        auto static result = make_shared< EIP712Domain >(
            "USDC", "2", 84542,
            EthAddress( "0x036CbD53842c5426634e7929541eC2318f3dCF7e" ) );
        return result;
    }

    static shared_ptr< EIP712Domain > baseSepolia() {
        auto static result = make_shared< EIP712Domain >( "USDC", "2", 84532,
            EthAddress( "0x036CbD53842c5426634e7929541eC2318f3dCF7e" ),
            "0x71f17a3b2ff373b803d70a5a07c046c1a2bc8e89c09ef722fcb047abe94c9818" );
        return result;
    }


    static shared_ptr< EIP712Domain > baseMainnet() {
        auto static result = make_shared< EIP712Domain >( "USD Coin", "2", 8453,
            EthAddress( "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" ),
            "0x02fa7265e7c5d81118673727957699e4d68f74cd74b7db77da710fe8a2c7834f" );
        return result;
    }

public:
    [[nodiscard]] std::string name() const { return name_; }

    [[nodiscard]] std::string version() const { return version_; }

    [[nodiscard]] u256 chainId() const { return chainId_; }

    [[nodiscard]] EthAddress verifyingContract() const { return assetAddress_; }

    std::array< uint8_t, 32 > hashWithDomain( const std::array< uint8_t, 32 >& structHash ) const;

    EIP712Signature signWithDomain(
        const std::array< uint8_t, 32 >& structHash, const EthPrivateKey& privateKey ) const;


    std::optional< FacilitatorError > verifyWithDomain( const std::array< uint8_t, 32 >& structHash,
        const EIP712Signature& signature, const EthAddress& expectedAddress ) const;
};