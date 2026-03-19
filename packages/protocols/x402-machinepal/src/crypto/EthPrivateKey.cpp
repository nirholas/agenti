#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"

#include "EthPrivateKey.h"
#include "MachinePalCommon.h"

#include "EIP712Signature.h"
#include "Keccak.h"
#include <openssl/bn.h>
#include <openssl/core_names.h>
#include <openssl/ec.h>
#include <openssl/evp.h>
#include <openssl/obj_mac.h>

#include <secp256k1.h>
#include <secp256k1_recovery.h>

#include <openssl/bn.h>
#include <algorithm>
#include <cctype>
#include <cstring>
#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include "facilitators/FacilitatorErrors.h"

[[maybe_unused]] static std::string trimCopy( const std::string& in ) {
    size_t start = 0;
    while ( start < in.size() && std::isspace( static_cast< unsigned char >( in[start] ) ) )
        ++start;
    size_t end = in.size();
    while ( end > start && std::isspace( static_cast< unsigned char >( in[end - 1] ) ) )
        --end;
    return in.substr( start, end - start );
}


static std::vector< uint8_t > hexToBytesFlexible( const std::string& hex ) {
    std::string s = hex;

    // Strip optional 0x or 0X prefix
    if ( s.rfind( "0x", 0 ) == 0 || s.rfind( "0X", 0 ) == 0 )
        s = s.substr( 2 );

    // Must have even length
    if ( s.size() % 2 != 0 )
        throw std::invalid_argument( "Hex string must have even length" );

    // Optional strict length check (for Ethereum private key = 32 bytes)
    if ( s.size() != 64 )
        throw std::invalid_argument(
            "Private key must be 32 bytes (64 hex chars); got " + std::to_string( s.size() ) );

    std::vector< uint8_t > bytes;
    bytes.reserve( s.size() / 2 );

    try {
        boost::algorithm::unhex( s.begin(), s.end(), std::back_inserter( bytes ) );
    } catch ( const boost::algorithm::hex_decode_error& e ) {
        throw std::invalid_argument( std::string( "Invalid hex input: " ) + e.what() );
    }

    return bytes;
}


EthPrivateKey::EthPrivateKey() : bytes_{} {}

EthPrivateKey::EthPrivateKey( const std::array< uint8_t, 32 >& bytes ) : bytes_( bytes ) {}

EthPrivateKey::EthPrivateKey( std::span< const uint8_t, 32 > bytes ) {
    std::copy( bytes.begin(), bytes.end(), bytes_.begin() );
}

EthPrivateKey::EthPrivateKey( const uint8_t* data, std::size_t len ) {
    if ( len != 32 ) {
        throw std::invalid_argument( "EthPrivateKey must be 32 bytes" );
    }
    std::copy( data, data + len, bytes_.begin() );
}

EthPrivateKey::EthPrivateKey( const std::string& hex ) {
    auto v = hexToBytesFlexible( hex );
    std::copy( v.begin(), v.end(), bytes_.begin() );
    if ( !isValidRange( bytes_ ) )
        throw std::invalid_argument( "Private key out of range for secp256k1" );
}

EthPrivateKey::~EthPrivateKey() {
    volatile uint8_t* p = reinterpret_cast< volatile uint8_t* >( bytes_.data() );
    for ( size_t i = 0; i < bytes_.size(); ++i )
        p[i] = 0;
}

bool EthPrivateKey::isValidRange( const std::array< uint8_t, 32 >& k ) {
    BIGNUM* bn = BN_bin2bn( k.data(), 32, nullptr );
    if ( !bn )
        return false;
    BIGNUM* n = nullptr;
    BN_hex2bn( &n, "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141" );
    bool ok = !BN_is_zero( bn ) && BN_cmp( bn, n ) < 0;  // 0 < k < n
    BN_free( bn );
    BN_free( n );
    return ok;
}

EthPrivateKey EthPrivateKey::parseFlexible( const std::string& hex ) {
    auto v = hexToBytesFlexible( hex );
    std::array< uint8_t, 32 > arr{};
    std::copy( v.begin(), v.end(), arr.begin() );
    // Check that private key is not zero
    if ( std::all_of( arr.begin(), arr.end(), []( uint8_t b ) { return b == 0; } ) ) {
        throw std::invalid_argument( "Private key must not be zero" );
    }
    if ( !isValidRange( arr ) )
        throw std::invalid_argument( "Private key out of range for secp256k1" );
    return EthPrivateKey( arr );
}

EthPrivateKey EthPrivateKey::parseHex( const std::string& hex ) {
    return parseFlexible( hex );
}

std::string EthPrivateKey::toHex() const {
    std::string out;
    out.reserve( 66 );  // 2 for '0x' + 64 for 32 bytes
    out += "0x";
    boost::algorithm::hex_lower( bytes_.begin(), bytes_.end(), std::back_inserter( out ) );
    return out;
}

bool operator==( const EthPrivateKey& a, const EthPrivateKey& b ) {
    return a.bytes_ == b.bytes_;
}
bool operator!=( const EthPrivateKey& a, const EthPrivateKey& b ) {
    return !( a == b );
}


EthPrivateKey EthPrivateKey::generate() {
    EC_KEY* ec = EC_KEY_new_by_curve_name( NID_secp256k1 );
    if ( !ec )
        throw std::runtime_error( "EC_KEY_new_by_curve_name failed" );
    if ( EC_KEY_generate_key( ec ) != 1 ) {
        EC_KEY_free( ec );
        throw std::runtime_error( "EC_KEY_generate_key failed" );
    }
    const BIGNUM* privBn = EC_KEY_get0_private_key( ec );
    if ( !privBn ) {
        EC_KEY_free( ec );
        throw std::runtime_error( "Failed to get private key BIGNUM" );
    }

    std::array< uint8_t, 32 > privBytes{};
    if ( BN_bn2binpad( privBn, privBytes.data(), 32 ) != 32 ) {
        EC_KEY_free( ec );
        throw std::runtime_error( "BN_bn2binpad private failed" );
    }

    const EC_GROUP* group = EC_KEY_get0_group( ec );
    const EC_POINT* pubPoint = EC_KEY_get0_public_key( ec );
    if ( !group || !pubPoint ) {
        EC_KEY_free( ec );
        throw std::runtime_error( "Failed to get public key point" );
    }

    BIGNUM* x = BN_new();
    BIGNUM* y = BN_new();
    if ( !x || !y ) {
        if ( x )
            BN_free( x );
        if ( y )
            BN_free( y );
        EC_KEY_free( ec );
        throw std::runtime_error( "BN_new failed" );
    }
    if ( EC_POINT_get_affine_coordinates( group, pubPoint, x, y, nullptr ) != 1 ) {
        BN_free( x );
        BN_free( y );
        EC_KEY_free( ec );
        throw std::runtime_error( "EC_POINT_get_affine_coordinates failed" );
    }

    std::array< uint8_t, 64 > pubBytes{};
    BN_bn2binpad( x, pubBytes.data(), 32 );
    BN_bn2binpad( y, pubBytes.data() + 32, 32 );

    EthPrivateKey privateKey( privBytes );
    return privateKey;
}

EthPublicKey EthPrivateKey::computePublicKey() {
    EC_GROUP* group = EC_GROUP_new_by_curve_name( NID_secp256k1 );
    if ( !group )
        throw std::runtime_error( "Failed to create EC_GROUP" );
    BN_CTX* bnCtx = BN_CTX_new();
    if ( !bnCtx ) {
        EC_GROUP_free( group );
        throw std::runtime_error( "Failed to create BN_CTX" );
    }
    BIGNUM* priv = BN_bin2bn( bytes().data(), 32, nullptr );
    if ( !priv ) {
        BN_CTX_free( bnCtx );
        EC_GROUP_free( group );
        throw std::runtime_error( "Failed to create BIGNUM for private key" );
    }
    EC_POINT* pub = EC_POINT_new( group );
    if ( !pub ) {
        BN_free( priv );
        BN_CTX_free( bnCtx );
        EC_GROUP_free( group );
        throw std::runtime_error( "Failed to create EC_POINT" );
    }
    if ( EC_POINT_mul( group, pub, priv, nullptr, nullptr, bnCtx ) != 1 ) {
        EC_POINT_free( pub );
        BN_free( priv );
        BN_CTX_free( bnCtx );
        EC_GROUP_free( group );
        throw std::runtime_error( "EC_POINT_mul failed" );
    }

    BIGNUM* x = BN_new();
    BIGNUM* y = BN_new();
    if ( !x || !y ) {
        if ( x )
            BN_free( x );
        if ( y )
            BN_free( y );
        EC_POINT_free( pub );
        BN_free( priv );
        BN_CTX_free( bnCtx );
        EC_GROUP_free( group );
        throw std::runtime_error( "BN_new failed" );
    }
    if ( EC_POINT_get_affine_coordinates( group, pub, x, y, bnCtx ) != 1 ) {
        BN_free( x );
        BN_free( y );
        EC_POINT_free( pub );
        BN_free( priv );
        BN_CTX_free( bnCtx );
        EC_GROUP_free( group );
        throw std::runtime_error( "EC_POINT_get_affine_coordinates failed" );
    }

    std::array< uint8_t, 64 > pubBytes{};  // uncompressed without prefix
    BN_bn2binpad( x, pubBytes.data(), 32 );
    BN_bn2binpad( y, pubBytes.data() + 32, 32 );

    BN_free( x );
    BN_free( y );
    EC_POINT_free( pub );
    BN_free( priv );
    BN_CTX_free( bnCtx );
    EC_GROUP_free( group );
    return EthPublicKey( pubBytes );
}


// msg32 must be the 32-byte EIP-712 digest of the authorization
EIP712Signature EthPrivateKey::signAuth( const uint8_t msg32[32], const uint8_t priv32[32] ) {
    static secp256k1_context* ctx = secp256k1_context_create( SECP256K1_CONTEXT_SIGN );

    secp256k1_ecdsa_recoverable_signature rsig;
    if ( !secp256k1_ecdsa_sign_recoverable( ctx, &rsig, msg32, priv32, nullptr, nullptr ) ) {
        throw std::runtime_error( "sign failed" );
    }

    // Serialize to compact r||s and get recovery id
    unsigned char out64[64];
    int recid = 0;
    secp256k1_ecdsa_recoverable_signature_serialize_compact( ctx, out64, &recid, &rsig );

    // out64[0..31]=r, [32..63]=s are already 32-byte big-endian, low-s normalized
    std::array< uint8_t, 65 > sig;
    std::memcpy( sig.data(), out64, 64 );
    sig[64] = static_cast< uint8_t >( 27 + recid );  // or 0+recid if your verifier adds 27

    return EIP712Signature( sig );
}


struct CtxGuard {
    secp256k1_context* ctx;

    explicit CtxGuard( secp256k1_context* c ) : ctx( c ) {}

    ~CtxGuard() {
        if ( ctx )
            secp256k1_context_destroy( ctx );
    }

    CtxGuard( const CtxGuard& ) = delete;

    CtxGuard& operator=( const CtxGuard& ) = delete;
};


// msg32: EXACT 32-byte EIP-712 digest
// priv32: 32-byte secp256k1 secret key (1..n-1)

EIP712Signature EthPrivateKey::signAuthRaw(
    const uint8_t msg32[32], const uint8_t priv32[32], VEncoding vEnc ) {
    if ( !msg32 || !priv32 )
        throw std::invalid_argument( "null pointer" );

    // 1) fresh signing context (no reuse)
    secp256k1_context* ctx = secp256k1_context_create( SECP256K1_CONTEXT_SIGN );
    if ( !ctx )
        throw std::runtime_error( "context_create failed" );
    CtxGuard guard{ ctx };


    // 3) validate private key
    if ( !secp256k1_ec_seckey_verify( ctx, priv32 ) ) {
        throw std::invalid_argument( "invalid secp256k1 private key" );
    }

    // 4) sign (RFC6979 + low-s enforced by libsecp256k1)
    secp256k1_ecdsa_recoverable_signature rsig;
    if ( !secp256k1_ecdsa_sign_recoverable( ctx, &rsig, msg32, priv32, nullptr, nullptr ) ) {
        throw std::runtime_error( "sign_recoverable failed" );
    }

    // 5) serialize r||s and recovery id
    unsigned char out64[64];
    int recid = 0;
    if ( !secp256k1_ecdsa_recoverable_signature_serialize_compact( ctx, out64, &recid, &rsig ) ) {
        throw std::runtime_error( "serialize_compact failed" );
    }

    // 6) build RSV (Ethereum) — use only parity bit of recid
    const uint8_t parity = static_cast< uint8_t >( recid & 1 );

    std::array< uint8_t, 65 > sig{};
    std::memcpy( sig.data(), out64, 64 );
    sig[64] = ( vEnc == VEncoding::V27_28 ) ?
                  static_cast< uint8_t >( 27 + parity )  // on-chain ecrecover
                  :
                  parity;  // 0/1 for some off-chain libs

    return EIP712Signature( sig );
}


constexpr uint8_t N[32] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFE, 0xBA, 0xAE, 0xDC, 0xE6, 0xAF, 0x48, 0xA0, 0x3B, 0xBF, 0xD2, 0x5E, 0x8C,
    0xD0, 0x36, 0x41, 0x41 };
constexpr uint8_t N_HALF[32] = { 0x7F, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x5D, 0x57, 0x6E, 0x73, 0x57, 0xA4, 0x50, 0x1D, 0xDF, 0xE9, 0x2F,
    0x46, 0x68, 0x1B, 0x20, 0xA0 };

inline int be_cmp32( const uint8_t* a, const uint8_t* b ) {
    return std::memcmp( a, b, 32 );
}

inline bool be_is_zero32( const uint8_t* a ) {
    static const uint8_t z[32] = { 0 };
    return std::memcmp( a, z, 32 ) == 0;
}

inline bool rs_low_s_and_in_range( const uint8_t* r, const uint8_t* s ) {
    return !be_is_zero32( r ) && be_cmp32( r, N ) < 0 && !be_is_zero32( s ) &&
           be_cmp32( s, N_HALF ) <= 0;
}

inline bool normalize_v( uint8_t v, int& recid ) {
    // do not allow 0 or 1
    if ( v == 27 || v == 28 ) {
        recid = v - 27;
        return true;
    }
    // do not allow 0 or 1
    return false;
}


EthAddress EthPrivateKey::recoverAddressFromSigRSV( const uint8_t msg32[32], const uint8_t sig65[65] ) {
    if ( !msg32 || !sig65 )
        throw std::invalid_argument( "null pointer" );

    const uint8_t* r = sig65;
    const uint8_t* s = sig65 + 32;
    uint8_t v = sig65[64];

    if ( !rs_low_s_and_in_range( r, s ) )
        throw std::invalid_argument( "invalid r/s" );

    int recid = 0;
    if ( !normalize_v( v, recid ) )
        throw std::invalid_argument( "invalid v (0/1/27/28 expected)" );

    auto ctx = secp256k1_context_create( SECP256K1_CONTEXT_VERIFY );
    if ( !ctx )
        throw std::invalid_argument( "context_create failed" );
    CtxGuard guard{ ctx };

    secp256k1_ecdsa_recoverable_signature rsig;
    if ( !secp256k1_ecdsa_recoverable_signature_parse_compact( ctx, &rsig, r, recid ) )
        throw std::invalid_argument( "parse_compact failed" );

    secp256k1_pubkey pub;
    if ( !secp256k1_ecdsa_recover( ctx, &pub, &rsig, msg32 ) )
        throw std::invalid_argument( "ecdsa_recover failed" );

    uint8_t pubkey[65];
    size_t len = sizeof( pubkey );
    if ( !secp256k1_ec_pubkey_serialize( ctx, pubkey, &len, &pub, SECP256K1_EC_UNCOMPRESSED ) ||
         len != 65 )
        throw std::invalid_argument( "pubkey_serialize failed" );

    auto hash = KeccakHash::keccak256( std::span< const uint8_t >( pubkey + 1, 64 ) );
    EthAddress addr{};
    std::memcpy( addr.bytes().data(), hash.data() + 12, 20 );
    return addr;
}

// -------------------- Verify against expected address --------------------
std::optional< FacilitatorError > EthPrivateKey::eip712VerifyRaw(
    const uint8_t msg32[32], const uint8_t sig65[65], EthAddress expectedAddress ) {
    try {
        EthAddress rec = recoverAddressFromSigRSV( msg32, sig65 );
        if ( std::memcmp( rec.bytes().data(), expectedAddress.bytes().data(), 20 ) != 0 ) {
            LOG_CORE_WARN("Recovered address: {}, Expected address: {}",
                rec.toHex( PREFIX_0x ), expectedAddress.toHex( PREFIX_0x ));
            return FacilitatorError::invalid_exact_evm_payload_signature;
        }
    } catch ( std::exception& e ) {
        LOG_CORE_ERROR("Signature verification failed: {}", e.what() );
        return FacilitatorError::invalid_exact_evm_payload_signature;
    }
    return std::nullopt;
}