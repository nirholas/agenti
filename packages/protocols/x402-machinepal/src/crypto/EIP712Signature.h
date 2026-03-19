#pragma once
#include "MachinePalCommon.h"  // added for Hash typedef


class EIP712Signature {
public:
    EIP712Signature();
    explicit EIP712Signature( const std::array< uint8_t, 65 >& bytes );  // Ethereum signatures are
                                                                         // 65 bytes (r,s,v)
    explicit EIP712Signature( std::span< const uint8_t, 65 > bytes );
    EIP712Signature( const uint8_t* data, std::size_t len );
    explicit EIP712Signature( const std::string& hex );
    EIP712Signature(
        const std::array< uint8_t, 32 >& r, const std::array< uint8_t, 32 >& s, uint8_t v );

    // Accessors for r, s, v
    [[nodiscard]] std::array< uint8_t, 32 > r() const;
    [[nodiscard]] std::array< uint8_t, 32 > s() const;
    [[nodiscard]] uint8_t v() const;

    [[nodiscard]] std::array< uint8_t, 65 >& bytes() { return bytes_; }
    [[nodiscard]] const std::array< uint8_t, 65 >& bytes() const { return bytes_; }
    [[nodiscard]] std::string toHex( bool withPrefix = false ) const;

    static EIP712Signature parseHex( const std::string& hex );
    static EIP712Signature parseFlexible( const std::string& hex );  // optional 0x prefix


    friend bool operator==( const EIP712Signature& a, const EIP712Signature& b );
    friend bool operator!=( const EIP712Signature& a, const EIP712Signature& b );

    ~EIP712Signature();

    // Validity check for Ethereum/Hardhat signature
    static bool isValid( const std::array< uint8_t, 65 >& sigBytes );

    // Compute keccak256 hash of the 65 signature bytes (r||s||v)
    [[nodiscard]] Hash computeSignatureHash() const;

private:
    std::array< uint8_t, 65 > bytes_{};
    static bool isValidV( uint8_t v );
};