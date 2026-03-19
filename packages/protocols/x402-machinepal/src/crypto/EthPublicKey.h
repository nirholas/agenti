#pragma once

#include "EthAddress.h"

class EthPublicKey {
public:
    EthPublicKey();
    explicit EthPublicKey( const std::array< uint8_t, 64 >& bytes );
    explicit EthPublicKey( std::span< const uint8_t, 64 > bytes );
    EthPublicKey( const uint8_t* data, std::size_t len );
    explicit EthPublicKey( const std::string& hex );

    [[nodiscard]] std::array< uint8_t, 64 >& bytes() { return bytes_; }
    [[nodiscard]] const std::array< uint8_t, 64 >& bytes() const { return bytes_; }
    EthAddress getAddress() const;

    static EthPublicKey parseHex( const std::string& hex );
    static EthPublicKey parseFlexible( const std::string& hex );  // optional 0x prefix
    std::string toHex() const;

    friend bool operator==( const EthPublicKey& a, const EthPublicKey& b );
    friend bool operator!=( const EthPublicKey& a, const EthPublicKey& b );

    ~EthPublicKey();

private:
    std::array< uint8_t, 64 > bytes_{};
    static bool isValid( const std::array< uint8_t, 64 >& keyBytes );
};