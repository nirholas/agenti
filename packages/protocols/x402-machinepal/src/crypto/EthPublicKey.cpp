#include "EthPublicKey.h"
#include "EthAddress.h"
#include "Keccak.h"
#include "MachinePalCommon.h"

#include <boost/algorithm/hex.hpp>

static std::string trimCopy( const std::string& in ) {
    size_t start = 0;
    while ( start < in.size() && std::isspace( static_cast< unsigned char >( in[start] ) ) )
        ++start;
    size_t end = in.size();
    while ( end > start && std::isspace( static_cast< unsigned char >( in[end - 1] ) ) )
        --end;
    return in.substr( start, end - start );
}

static std::vector< uint8_t > hexToBytesFlexible( const std::string& hex ) {
    std::string s = trimCopy( hex );
    if ( s.rfind( "0x", 0 ) == 0 || s.rfind( "0X", 0 ) == 0 )
        s = s.substr( 2 );
    if ( s.size() != 130 || s.substr( 0, 2 ) != "04" )
        throw std::invalid_argument(
            "Public key hex must be 130 characters (0x04 + 64 bytes); got " +
            std::to_string( s.size() ) );
    for ( char c : s )
        if ( !std::isxdigit( static_cast< unsigned char >( c ) ) )
            throw std::invalid_argument( "Invalid hex character in public key" );
    std::vector< uint8_t > bytes;
    bytes.reserve( 65 );
    boost::algorithm::unhex( s.begin(), s.end(), std::back_inserter( bytes ) );
    return bytes;
}

EthPublicKey::EthPublicKey() : bytes_{} {}

EthPublicKey::EthPublicKey( const std::array< uint8_t, 64 >& bytes ) : bytes_( bytes ) {}

EthPublicKey::EthPublicKey( std::span< const uint8_t, 64 > bytes ) {
    std::copy( bytes.begin(), bytes.end(), bytes_.begin() );
}

EthPublicKey::EthPublicKey( const uint8_t* data, std::size_t len ) {
    if ( len != 64 )
        throw std::invalid_argument( "EthPublicKey must be 64 bytes" );
    std::copy( data, data + len, bytes_.begin() );
}

EthPublicKey::EthPublicKey( const std::string& hex ) {
    auto v = hexToBytesFlexible( hex );
    std::copy( v.begin(), v.end(), bytes_.begin() );
    if ( !isValid( bytes_ ) )
        throw std::invalid_argument( "Invalid public key" );
}

EthPublicKey::~EthPublicKey() {
    volatile uint8_t* p = reinterpret_cast< volatile uint8_t* >( bytes_.data() );
    for ( size_t i = 0; i < bytes_.size(); ++i )
        p[i] = 0;
}

bool EthPublicKey::isValid( const std::array< uint8_t, 64 >& k ) {
    // Not all zero
    return !std::all_of( k.begin(), k.end(), []( uint8_t b ) { return b == 0; } );
}

EthPublicKey EthPublicKey::parseFlexible( const std::string& hex ) {
    auto v = hexToBytesFlexible( hex );
    std::array< uint8_t, 64 > arr{};
    std::copy( v.begin(), v.end(), arr.begin() );
    if ( !isValid( arr ) )
        throw std::invalid_argument( "Invalid public key" );
    return EthPublicKey( arr );
}

EthPublicKey EthPublicKey::parseHex( const std::string& hex ) {
    return parseFlexible( hex );
}

std::string EthPublicKey::toHex() const {
    std::string hexString;
    hexString.reserve( 132 );  // 2 for '0x' + 2 for prefix + 128 for 64 bytes
    hexString += "0x04";       // prefix byte for uncompressed public key
    boost::algorithm::hex_lower( bytes_.begin(), bytes_.end(), std::back_inserter( hexString ) );
    CHECK_STATE2( hexString.size() == 132,
        "Invalid hex string size" );  // 2 for '0x' + 2 for prefix + 128 for 64 bytes
    return hexString;
}

EthAddress EthPublicKey::getAddress() const {
    auto hash = KeccakHash::keccak256( std::span< const uint8_t >( bytes_.data(), 64 ) );
    return EthAddress( hash.data() + 12, 20 );
}

bool operator==( const EthPublicKey& a, const EthPublicKey& b ) {
    return a.bytes_ == b.bytes_;
}
bool operator!=( const EthPublicKey& a, const EthPublicKey& b ) {
    return !( a == b );
}