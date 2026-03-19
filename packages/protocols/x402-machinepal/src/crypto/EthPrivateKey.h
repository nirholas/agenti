#pragma once

#include "EIP712Signature.h"
#include "EthPublicKey.h"

#include <algorithm>
#include <array>
#include <cstdint>
#include <span>
#include <string>


#include "x402_protocol/HttpError.h"

enum class FacilitatorError;

enum class VEncoding : uint8_t { V27_28, V0_1 };

class EthPrivateKey {
public:
    // Constructors
    EthPrivateKey();
    explicit EthPrivateKey( const std::array< uint8_t, 32 >& bytes );
    explicit EthPrivateKey( std::span< const uint8_t, 32 > bytes );
    EthPrivateKey( const uint8_t* data, std::size_t len );
    explicit EthPrivateKey( const std::string& hex );

    // Accessors
    [[nodiscard]] std::array< uint8_t, 32 >& bytes() { return bytes_; }
    [[nodiscard]] const std::array< uint8_t, 32 >& bytes() const { return bytes_; }

    static EthPrivateKey parseHex( const std::string& hex );
    static EthPrivateKey parseFlexible( const std::string& hex );  // optional 0x prefix
    std::string toHex() const;

    // Comparison operators
    friend bool operator==( const EthPrivateKey& a, const EthPrivateKey& b );
    friend bool operator!=( const EthPrivateKey& a, const EthPrivateKey& b );

    /**
     * Generates a random Ethereum private key and address compatible with HardHat.
     * @return Pair of EthPrivateKey and Address objects.
     */
    static EthPrivateKey generate();


    /**
     * Derives the Ethereum address from the given private key.
     * @param key The private key to derive the address from.
     * @return The derived Ethereum address.
     */
    EthPublicKey computePublicKey();

    ~EthPrivateKey();


    // -------------------- Verify against expected address --------------------
    [[nodiscard]] static std::optional< FacilitatorError > eip712VerifyRaw(
        const uint8_t msg32[32], const uint8_t sig65[65], EthAddress address );


    static EIP712Signature signAuthRaw(
        const uint8_t msg32[32], const uint8_t priv32[32], VEncoding vEnc = VEncoding::V27_28 );

private:
    std::array< uint8_t, 32 > bytes_{};

    static bool isValidRange( const std::array< uint8_t, 32 >& k );

    static EIP712Signature signAuth( const uint8_t msg32[32], const uint8_t priv32[32] );

    static EthAddress recoverAddressFromSigRSV( const uint8_t msg32[32], const uint8_t sig65[65] );
};