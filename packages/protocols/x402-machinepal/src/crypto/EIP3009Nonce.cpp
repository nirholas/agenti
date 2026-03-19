#include "EIP3009Nonce.h"
#include "Encoding.h"
#include "MachinePalCommon.h"
#undef random

EIP3009Nonce::EIP3009Nonce( const std::array< uint8_t, 32 >& arr ) : bytes_( arr ) {}


EIP3009Nonce EIP3009Nonce::generateRandomNonce() {
    std::array< uint8_t, 32 > arr;
    std::random_device rd;
    std::mt19937 gen( rd() );
    std::uniform_int_distribution< uint16_t > dis( 0, 255 );
    for ( auto& b : arr ) {
        b = static_cast< uint8_t >( dis( gen ) );
    }
    return EIP3009Nonce( arr );
}

const std::array< uint8_t, 32 >& EIP3009Nonce::bytes() const {
    return bytes_;
}

std::string EIP3009Nonce::toDbString() const {
    return toHex( PREFIX_NONE );
}

std::string EIP3009Nonce::toHex( bool withPrefix ) const {
    return Encoding::toHex(
        std::span< const uint8_t >( bytes_.data(), bytes_.size() ), withPrefix );
}

std::string EIP3009Nonce::toBase64() const {
    constexpr std::size_t take = 32;
    std::string out( boost::beast::detail::base64::encoded_size( 32 ), '\0' );
    boost::beast::detail::base64::encode( out.data(), bytes().data(), take );
    return out;
}

EIP3009Nonce EIP3009Nonce::fromHex( const std::string& hexStr ) {
    auto vec = Encoding::fromHex( hexStr );
    if ( vec.size() > 32 )
        throw std::invalid_argument( "EIP3009Nonce must be at most 32 bytes" );
    std::array< uint8_t, 32 > arr{};
    // Pad with zeros on the left
    std::copy( vec.begin(), vec.end(), arr.begin() + ( 32 - vec.size() ) );
    return EIP3009Nonce( arr );
}