#include "EIP712Signature.h"
#include "Keccak.h"  // added for hashing
#include <openssl/bn.h>
#include <openssl/ecdsa.h>

EIP712Signature::EIP712Signature() = default;

EIP712Signature::EIP712Signature( const std::array< uint8_t, 65 >& bytes ) : bytes_( bytes ) {}

EIP712Signature::EIP712Signature( std::span< const uint8_t, 65 > bytes ) {
    std::copy( bytes.begin(), bytes.end(), bytes_.begin() );
}

EIP712Signature::EIP712Signature( const uint8_t* data, std::size_t len ) {
    if ( len != 65 )
        throw std::invalid_argument( "Signature must be 65 bytes" );
    std::copy( data, data + 65, bytes_.begin() );
}

EIP712Signature::EIP712Signature( const std::string& hex ) {
    if ( hex.size() > 132 ) {
        throw std::invalid_argument( "Hex string too long to be a valid signature: " +
                                     std::to_string( hex.size() ) + " chars " + hex );
    }
    std::string s = hex;
    if ( s.starts_with( "0x" ) || s.starts_with( "0X" ) )
        s = s.substr( 2 );
    if ( s.size() != 130 ) {
        throw std::invalid_argument( "Hex string must have 130 chars for 65 bytes: " + s );
    }

    boost::algorithm::unhex( s.begin(), s.end(), bytes_.begin() );
}

EIP712Signature::EIP712Signature(
    const std::array< uint8_t, 32 >& r, const std::array< uint8_t, 32 >& s, uint8_t v ) {
    std::copy( r.begin(), r.end(), bytes_.begin() );
    std::copy( s.begin(), s.end(), bytes_.begin() + 32 );
    bytes_[64] = v;
}

std::array< uint8_t, 32 > EIP712Signature::r() const {
    std::array< uint8_t, 32 > r;
    std::copy( bytes_.begin(), bytes_.begin() + 32, r.begin() );
    return r;
}

std::array< uint8_t, 32 > EIP712Signature::s() const {
    std::array< uint8_t, 32 > s;
    std::copy( bytes_.begin() + 32, bytes_.begin() + 64, s.begin() );
    return s;
}

uint8_t EIP712Signature::v() const {
    return bytes_[64];
}

std::string EIP712Signature::toHex( bool withPrefix ) const {
    std::string hex;
    boost::algorithm::hex_lower( bytes_.begin(), bytes_.end(), std::back_inserter( hex ) );
    if ( withPrefix )
        return "0x" + hex;
    return hex;
}

EIP712Signature EIP712Signature::parseHex( const std::string& hex ) {
    return EIP712Signature( hex );
}

EIP712Signature EIP712Signature::parseFlexible( const std::string& hex ) {
    return EIP712Signature( hex );
}

bool operator==( const EIP712Signature& a, const EIP712Signature& b ) {
    return a.bytes_ == b.bytes_;
}

bool operator!=( const EIP712Signature& a, const EIP712Signature& b ) {
    return !( a == b );
}

EIP712Signature::~EIP712Signature() = default;


bool EIP712Signature::isValid( const std::array< uint8_t, 65 >& sigBytes ) {
    uint8_t v = sigBytes[64];
    return isValidV( v );
}

bool EIP712Signature::isValidV( uint8_t v ) {
    return v == 27 || v == 28 || v == 0 || v == 1;
}

Hash EIP712Signature::computeSignatureHash() const {
    return KeccakHash::keccak256( std::span< const uint8_t >( bytes_.data(), bytes_.size() ) );
}