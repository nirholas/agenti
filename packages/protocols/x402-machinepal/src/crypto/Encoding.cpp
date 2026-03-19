#include "Encoding.h"
#include "MachinePalCommon.h"


using boost::multiprecision::uint256_t;

std::string Encoding::toHex( const uint256_t& val, bool withPrefix ) {
    std::vector< uint8_t > bytes;
    boost::multiprecision::export_bits( val, std::back_inserter( bytes ), 8 );
    if ( bytes.size() < 32 ) {
        std::vector< uint8_t > padded( 32 - bytes.size(), 0 );
        padded.insert( padded.end(), bytes.begin(), bytes.end() );
        bytes.swap( padded );
    }
    return toHex( std::span< const uint8_t >( bytes.data(), bytes.size() ), withPrefix );
}

std::string Encoding::toHex( std::span< const std::uint8_t > bytes, bool withPrefix ) {
    std::string hex;
    if ( withPrefix )
        hex = "0x";
    boost::algorithm::hex( bytes.begin(), bytes.end(), std::back_inserter( hex ) );
    boost::algorithm::to_lower( hex );
    return hex;
}

std::vector< uint8_t > Encoding::fromHex( const std::string& hexStr ) {
    std::string_view view( hexStr );
    if ( view.size() >= 2 && ( view[0] == '0' ) && ( view[1] == 'x' || view[1] == 'X' ) ) {
        view.remove_prefix( 2 );
    }
    if ( view.size() % 2 != 0 ) {
        throw std::invalid_argument( "Hex string must have even length" );
    }
    std::vector< uint8_t > out;
    out.reserve( view.size() / 2 );
    boost::algorithm::unhex( view.begin(), view.end(), std::back_inserter( out ) );
    return out;
}

uint256_t Encoding::u256FromHexOrDecimal( const std::string& str ) {
    if ( str.empty() )
        throw std::invalid_argument( "Empty input for uint256" );
    if ( std::any_of( str.begin(), str.end(), ::isspace ) )
        throw std::invalid_argument( "Whitespace not allowed in uint256 input" );
    if ( str[0] == '-' )
        throw std::invalid_argument( "Negative numbers not allowed for uint256" );

    if ( str.size() >= 2 && str[0] == '0' && ( str[1] == 'x' || str[1] == 'X' ) ) {
        auto bytes = fromHex( str );
        if ( bytes.empty() )
            throw std::invalid_argument( "Empty hex input for uint256" );
        if ( bytes.size() > 32 )
            throw std::invalid_argument( "Hex input too long for uint256" );
        uint256_t val = 0;
        for ( auto b : bytes ) {
            val = ( val << 8 ) | b;
        }
        return val;
    }
    return uint256_t( str );
}

std::string Encoding::u256ToDecimal( const uint256_t& val ) {
    return val.str( 0, std::ios_base::dec );
}

std::array< uint8_t, 32 > Encoding::fromHexToHash( const std::string& hexStr ) {
    auto bytes = fromHex( hexStr );
    if ( bytes.size() > 32 )
        throw std::invalid_argument( "Hex input too long for array32" );
    std::array< uint8_t, 32 > arr{};
    std::copy( bytes.begin(), bytes.end(), arr.begin() + ( 32 - bytes.size() ) );
    return arr;
}

std::string Encoding::hashToHex( const std::array< uint8_t, 32 >& arr ) {
    std::string hex;
    boost::algorithm::hex_lower( arr.begin(), arr.end(), std::back_inserter( hex ) );
    return hex;
}

std::string Encoding::hashToPartialHex( const std::array< uint8_t, 32 >& arr ) {
    auto full = hashToHex( arr );
    return full.substr( 0, 20 );
}

std::string Encoding::hashToPartialBase64( const std::array< uint8_t, 32 >& arr ) {
    constexpr std::size_t take = 20;
    std::string out( boost::beast::detail::base64::encoded_size( take ), '\0' );
    boost::beast::detail::base64::encode( out.data(), arr.data(), take );
    return out;
}

std::string Encoding::base64Encode( const std::string& input ) {
    if ( input.empty() )
        return {};
    std::string encoded;
    encoded.resize( boost::beast::detail::base64::encoded_size( input.size() ) );
    std::size_t written =
        boost::beast::detail::base64::encode( &encoded[0], input.data(), input.size() );
    encoded.resize( written );
    return encoded;
}

std::string Encoding::base64Decode( const std::string& input ) {
    if ( input.empty() )
        return {};
    std::string decoded;
    decoded.resize( boost::beast::detail::base64::decoded_size( input.size() ) );
    auto len = boost::beast::detail::base64::decode( &decoded[0], input.data(), input.size() );
    decoded.resize( len.first );
    return decoded;
}