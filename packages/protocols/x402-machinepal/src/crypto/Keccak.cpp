#include "Keccak.h"
#include "MachinePalCommon.h"
#include <cryptopp/keccak.h>


Hash KeccakHash::keccak256( std::span< const uint8_t > data ) {
    std::array< uint8_t, 32 > out{};
    CryptoPP::Keccak_256 hash;  // ✅ Ethereum-compatible
    hash.Update( data.data(), data.size() );
    hash.TruncatedFinal( out.data(), out.size() );
    return out;
}


Hash KeccakHash::keccak256( const std::vector< uint8_t >& data ) {
    return keccak256( std::span< const uint8_t >( data.data(), data.size() ) );
}

Hash KeccakHash::keccak256( const std::string& ascii ) {
    return keccak256( std::span< const uint8_t >(
        reinterpret_cast< const uint8_t* >( ascii.data() ), ascii.size() ) );
}

std::string KeccakHash::keccak256Hex( std::span< const uint8_t > data ) {
    auto h = keccak256( data );
    std::ostringstream oss;
    oss << "0x";
    for ( auto b : h ) {
        oss << std::hex << std::nouppercase;
        oss.width( 2 );
        oss.fill( '0' );
        oss << ( int ) b;
    }
    return oss.str();
}

std::string KeccakHash::keccak256Hex( const std::string& ascii ) {
    return keccak256Hex( std::span< const uint8_t >(
        reinterpret_cast< const uint8_t* >( ascii.data() ), ascii.size() ) );
}