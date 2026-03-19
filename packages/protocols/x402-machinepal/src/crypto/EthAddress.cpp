//
// Created by kladko on 10/24/25.
//
#include "MachinePalCommon.h"

#include "EthAddress.h"
#include "Keccak.h"

#include <boost/algorithm/hex.hpp>
#include <algorithm>
#include <cctype>
#include <span>
#include <stdexcept>

EthAddress EthAddress::parseHexAddress( const std::string& hex ) {
    std::string s = hex;
    if ( s.rfind( "0x", 0 ) == 0 || s.rfind( "0X", 0 ) == 0 ) {
        s = s.substr( 2 );
    }
    if ( s.size() != 40 ) {
        throw std::invalid_argument( "Address hex must be 40 characters (20 bytes)" );
    }
    EthAddress addr{};
    try {
        // decode into addr; boost::algorithm::unhex throws hex_decode_error on invalid input
        boost::algorithm::unhex( s.begin(), s.end(), addr.bytes().begin() );
    } catch ( const boost::algorithm::hex_decode_error& e ) {
        throw std::invalid_argument(
            std::string( "Invalid hex character in address: " ) + e.what() );
    }
    return addr;
}

EthAddress EthAddress::parseFlexible( const std::string& hex, bool validateChecksum ) {
    using namespace boost::algorithm;

    // Remove optional 0x prefix
    std::string s = hex;
    if ( istarts_with( s, "0x" ) )
        s.erase( 0, 2 );

    if ( s.size() != 40 )
        throw std::invalid_argument( "Address hex must be 40 characters (20 bytes)" );

    // Validate all characters are hex
    if ( !all( s, is_xdigit() ) )
        throw std::invalid_argument( "Invalid hex character in address" );

    // Detect case pattern
    bool hasUpper = std::any_of( s.begin(), s.end(),
        []( char c ) { return std::isupper( static_cast< unsigned char >( c ) ); } );
    bool hasLower = std::any_of( s.begin(), s.end(),
        []( char c ) { return std::islower( static_cast< unsigned char >( c ) ); } );
    bool mixed = hasUpper && hasLower;

    // Lowercase copy for decoding
    std::string lower = to_lower_copy( s );

    EthAddress addr = parseHexAddress( lower );

    // Checksum validation (EIP-55)
    if ( validateChecksum && mixed ) {
        std::string expected = addr.toChecksumHex().substr( 2 );  // remove "0x"
        if ( expected != s )
            throw std::invalid_argument( "Checksum mismatch for address" );
    }

    return addr;
}

std::string EthAddress::toDbString() const {
    return toHex( PREFIX_NONE );
}

std::string EthAddress::toHex( Prefix prefix ) const {
    std::string out;
    out.reserve( 42 );
    if ( prefix == Prefix::PREFIX_0x ) {
        out += "0x";
    }
    boost::algorithm::hex_lower( bytes().begin(), bytes().end(), std::back_inserter( out ) );
    return out;
}

std::string EthAddress::toBase64() const {
    constexpr std::size_t take = 32;
    std::string out( boost::beast::detail::base64::encoded_size( 32 ), '\0' );
    boost::beast::detail::base64::encode( out.data(), bytes().data(), take );
    return out;
}


std::string EthAddress::toChecksumHex() const {
    // Pre-calculated hex character tables
    static constexpr char lower_hex[] = "0123456789abcdef";
    static constexpr char upper_hex[] = "0123456789ABCDEF";

    // 1) Convert address bytes to a lowercase hex string for hashing
    std::string lower;
    lower.reserve( 40 );
    boost::algorithm::hex_lower( bytes_.begin(), bytes_.end(), std::back_inserter( lower ) );

    // 2) Compute the Keccak-256 hash of the lowercase hex string
    const auto hash = KeccakHash::keccak256( lower );

    // 3) Build the checksummed address
    std::string out = "0x";
    out.reserve( 42 );
    for ( std::size_t i = 0; i < bytes_.size(); ++i ) {
        // Get the two nibbles for the current byte of the address
        const uint8_t addr_nibble_1 = bytes_[i] >> 4;
        const uint8_t addr_nibble_2 = bytes_[i] & 0x0F;

        // Get the two corresponding nibbles from the hash
        const uint8_t hash_nibble_1 = hash[i] >> 4;
        const uint8_t hash_nibble_2 = hash[i] & 0x0F;

        // Determine character case based on hash nibble and append
        out.push_back( hash_nibble_1 >= 8 ? upper_hex[addr_nibble_1] : lower_hex[addr_nibble_1] );
        out.push_back( hash_nibble_2 >= 8 ? upper_hex[addr_nibble_2] : lower_hex[addr_nibble_2] );
    }
    return out;
}


// Constructors
EthAddress::EthAddress() = default;

EthAddress::EthAddress( const std::array< uint8_t, 20 >& bytes ) : bytes_( bytes ) {}

EthAddress::EthAddress( std::span< const uint8_t, 20 > bytes ) {
    std::copy( bytes.begin(), bytes.end(), bytes_.begin() );
}

EthAddress::EthAddress( const uint8_t* data, std::size_t len ) {
    if ( len != 20 )
        throw std::invalid_argument( "Address length must be 20 bytes" );
    std::copy( data, data + 20, bytes_.begin() );
}

EthAddress::EthAddress( const std::string& hex ) {
    *this = parseHexAddress( hex );
}

// Friend operators
bool operator==( const EthAddress& a, const EthAddress& b ) {
    return a.bytes_ == b.bytes_;
}
bool operator!=( const EthAddress& a, const EthAddress& b ) {
    return !( a == b );
}

bool operator<( const EthAddress& a, const EthAddress& b ) {
    return std::lexicographical_compare(
        a.bytes_.begin(), a.bytes_.end(), b.bytes_.begin(), b.bytes_.end() );
}