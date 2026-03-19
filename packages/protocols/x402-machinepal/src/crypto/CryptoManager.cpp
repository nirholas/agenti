#include "CryptoManager.h"
#include "EthAddress.h"
#include "EthPrivateKey.h"
#include "EthPublicKey.h"
#include "Keccak.h"
#include "MachinePalCommon.h"
#include <openssl/bn.h>
#include <openssl/core_names.h>
#include <openssl/ec.h>
#include <openssl/evp.h>
#include <openssl/obj_mac.h>



std::string CryptoManager::computeBlakeHash( const std::string& filePath ) {
    std::ifstream file( filePath, std::ios::binary );
    if ( !file )
        throw std::runtime_error( "Failed to open file for hashing: " + filePath );
    EVP_MD_CTX* ctx = EVP_MD_CTX_new();
    if ( !ctx )
        throw std::runtime_error( "Failed to create EVP_MD_CTX" );
    const EVP_MD* md = EVP_blake2b512();
    if ( !md ) {
        EVP_MD_CTX_free( ctx );
        throw std::runtime_error( "Failed to get BLAKE2b-512 digest method" );
    }
    if ( EVP_DigestInit_ex( ctx, md, nullptr ) != 1 ) {
        EVP_MD_CTX_free( ctx );
        throw std::runtime_error( "EVP_DigestInit_ex failed" );
    }
    char buf[4096];
    while ( file.good() ) {
        file.read( buf, sizeof( buf ) );
        if ( file.bad() ) {
            EVP_MD_CTX_free( ctx );
            throw std::runtime_error( "Error reading file during hashing: " + filePath );
        }
        if ( file.gcount() > 0 ) {
            if ( EVP_DigestUpdate( ctx, buf, (size_t) file.gcount() ) != 1 ) {
                EVP_MD_CTX_free( ctx );
                throw std::runtime_error( "EVP_DigestUpdate failed" );
            }
        }
    }
    unsigned char hash[EVP_MAX_MD_SIZE];
    unsigned int hashLen = 0;
    if ( EVP_DigestFinal_ex( ctx, hash, &hashLen ) != 1 ) {
        EVP_MD_CTX_free( ctx );
        throw std::runtime_error( "EVP_DigestFinal_ex failed" );
    }
    EVP_MD_CTX_free( ctx );
    std::ostringstream oss;
    for ( unsigned int i = 0; i < hashLen; ++i )
        oss << std::hex << std::setw( 2 ) << std::setfill( '0' ) << ( int ) hash[i];
    return oss.str();
}