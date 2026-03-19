#pragma once

#include <algorithm>
#include <array>
#include <cstdint>
#include <span>
#include <string>

class EthAddress {
public:
    // Standard constructors (implemented in Address.cpp)
    EthAddress();
    explicit EthAddress( const std::array< uint8_t, 20 >& bytes );
    explicit EthAddress( std::span< const uint8_t, 20 > bytes );
    EthAddress( const uint8_t* data, std::size_t len );
    explicit EthAddress( const std::string& hex );

    // Mutable and const accessors (kept inline)
    [[nodiscard]] std::array< uint8_t, 20 >& bytes() { return bytes_; }
    [[nodiscard]] const std::array< uint8_t, 20 >& bytes() const { return bytes_; }

    static EthAddress parseHexAddress( const std::string& hex );
    static EthAddress parseFlexible( const std::string& hex, bool validateChecksum = true );
    std::string toDbString() const;
    std::string toHex( Prefix _prefix ) const;
    std::string toBase64() const;
    std::string toChecksumHex() const;

    // Comparison operators (defined in Address.cpp)
    friend bool operator==( const EthAddress& a, const EthAddress& b );
    friend bool operator!=( const EthAddress& a, const EthAddress& b );
    friend bool operator<( const EthAddress& a, const EthAddress& b );

private:
    std::array< uint8_t, 20 > bytes_{};
};
