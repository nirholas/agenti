#pragma once
#include "EthAddress.h"
#include "EthPrivateKey.h"
#include "EthPublicKey.h"



class CryptoManager {
public:
    /**
     * Computes the BLAKE2b-512 hash of the file at the given path.
     * @param filePath Path to the file to hash.
     * @return Hex string of the BLAKE2b-512 hash.
     */
    static std::string computeBlakeHash( const std::string& filePath );
};