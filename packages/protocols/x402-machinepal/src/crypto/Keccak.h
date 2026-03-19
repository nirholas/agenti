#pragma once



class KeccakHash {
public:
    static Hash keccak256( std::span< const uint8_t > data );
    static Hash keccak256( const std::vector< uint8_t >& data );
    static Hash keccak256( const std::string& ascii );

    std::string keccak256Hex( std::span< const uint8_t > data );
    std::string keccak256Hex( const std::string& ascii );
};