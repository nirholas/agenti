#pragma once
#include <array>
#include <string>

class EIP3009Nonce {
    std::array< uint8_t, 32 > bytes_;

public:
    // Construct from vector
    explicit EIP3009Nonce() = default;
    explicit EIP3009Nonce( const std::array< uint8_t, 32 >& arr );
    // Construct from hex string (with or without 0x)
    static EIP3009Nonce fromHex( const std::string& hexStr );
    // Generate a random 32-byte nonce
    static EIP3009Nonce generateRandomNonce();
    const std::array< uint8_t, 32 >& bytes() const;
    std::string toDbString() const;
    std::string toHex( bool withPrefix ) const;
    std::string toBase64() const;

    friend auto operator<=>( const EIP3009Nonce&, const EIP3009Nonce& ) = default;
};