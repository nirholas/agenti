#pragma once


class Encoding {
public:
    static std::string toHex(
        const boost::multiprecision::uint256_t& val, bool withPrefix = false );
    static std::string toHex( std::span< const std::uint8_t > bytes, bool withPrefix = false );
    static std::vector< uint8_t > fromHex( const std::string& hexStr );
    static boost::multiprecision::uint256_t u256FromHexOrDecimal( const std::string& str );
    static std::string u256ToDecimal( const boost::multiprecision::uint256_t& val );
    static std::array< uint8_t, 32 > fromHexToHash( const std::string& hexStr );
    static std::string hashToHex( const std::array< uint8_t, 32 >& arr );
    static std::string hashToPartialHex( const std::array< uint8_t, 32 >& arr );
    static std::string hashToPartialBase64( const std::array< uint8_t, 32 >& arr );
    static std::string base64Encode( const std::string& input );
    static std::string base64Decode( const std::string& input );
};