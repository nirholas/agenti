#include "MachinePalCommon.h"


#include "CertManager.h"
#include "config/MachinePalConfig.h"
#include "filesystem/FileManager.h"
#include <openssl/evp.h>
#include <openssl/pem.h>
#include <openssl/ssl.h>
#include <openssl/x509.h>

#include "config/subconfigs/HTTPSConfig.h"


void CertManager::checkPEMFormat(
    const std::filesystem::path& certPath, const std::filesystem::path& keyPath ) {
    namespace fs = std::filesystem;
    auto cwd = fs::current_path().string();
    FILE* certFile = fopen( certPath.c_str(), "r" );
    if ( !certFile ) {
        throw std::runtime_error( "Cannot open certificate file: " + certPath.string() );
    }
    X509* cert = PEM_read_X509( certFile, nullptr, nullptr, nullptr );
    fclose( certFile );
    if ( !cert ) {
        throw std::runtime_error(
            "Certificate file is not a well-formed PEM: " + certPath.string() );
    }
    FILE* keyFile = fopen( keyPath.c_str(), "r" );
    if ( !keyFile ) {
        throw std::runtime_error( "Cannot open key file: " + keyPath.string() );
    }
    EVP_PKEY* pkey = PEM_read_PrivateKey( keyFile, nullptr, nullptr, nullptr );
    fclose( keyFile );
    if ( !pkey ) {
        throw std::runtime_error( "Key file is not a well-formed PEM: " + keyPath.string() );
    }
    X509_free( cert );
    EVP_PKEY_free( pkey );
}

void CertManager::checkKeyMatchesCert(
    const std::filesystem::path& certPath, const std::filesystem::path& keyPath ) {
    namespace fs = std::filesystem;
    auto cwd = fs::current_path().string();
    FILE* certFile = fopen( certPath.c_str(), "r" );
    if ( !certFile ) {
        throw std::runtime_error( "Cannot open certificate file: " + certPath.string() +
                                  ". Current working directory: " + cwd );
    }
    X509* cert = PEM_read_X509( certFile, nullptr, nullptr, nullptr );
    fclose( certFile );
    if ( !cert ) {
        throw std::runtime_error( "Certificate file is not a well-formed PEM: " +
                                  certPath.string() + ". Current working directory: " + cwd );
    }
    FILE* keyFile = fopen( keyPath.c_str(), "r" );
    if ( !keyFile ) {
        X509_free( cert );
        throw std::runtime_error(
            "Cannot open key file: " + keyPath.string() + ". Current working directory: " + cwd );
    }
    EVP_PKEY* pkey = PEM_read_PrivateKey( keyFile, nullptr, nullptr, nullptr );
    fclose( keyFile );
    if ( !pkey ) {
        X509_free( cert );
        throw std::runtime_error( "Key file is not a well-formed PEM: " + keyPath.string() +
                                  ". Current working directory: " + cwd );
    }
    // Check that the key matches the certificate
    if ( !X509_check_private_key( cert, pkey ) ) {
        X509_free( cert );
        EVP_PKEY_free( pkey );
        throw std::runtime_error( "Key does not match certificate for cert: " + certPath.string() +
                                  ", key: " + keyPath.string() +
                                  ". Current working directory: " + cwd );
    }
    X509_free( cert );
    EVP_PKEY_free( pkey );
}

void CertManager::doThoroughKeyCertFormatCheck(
    const std::filesystem::path& certPath, const std::filesystem::path& keyPath ) {
    // Check existence, readability, and non-emptiness
    // Check PEM format
    checkPEMFormat( certPath, keyPath );
    // Check key matches certificate
    checkKeyMatchesCert( certPath, keyPath );
}


void CertManager::validateSSLFiles( const std::filesystem::path& certFile,
    const std::filesystem::path& keyFile, const std::filesystem::path& caFile ) {
    CertManager::doThoroughKeyCertFormatCheck( certFile, keyFile );
    SSL_CTX* ctx = SSL_CTX_new( TLS_server_method() );
    if ( !ctx ) {
        throw std::runtime_error( "Failed to create SSL_CTX" );
    }
    if ( SSL_CTX_use_certificate_file( ctx, certFile.c_str(), SSL_FILETYPE_PEM ) != 1 ) {
        SSL_CTX_free( ctx );
        throw std::runtime_error( "Failed to load certificate file: " + certFile.string() );
    }
    if ( SSL_CTX_use_PrivateKey_file( ctx, keyFile.c_str(), SSL_FILETYPE_PEM ) != 1 ) {
        SSL_CTX_free( ctx );
        throw std::runtime_error( "Failed to load private key file: " + keyFile.string() );
    }
    if ( !caFile.empty() ) {
        if ( SSL_CTX_load_verify_locations( ctx, caFile.c_str(), nullptr ) != 1 ) {
            SSL_CTX_free( ctx );
            throw std::runtime_error( "Failed to load CA file: " + caFile.string() );
        }
    }
    if ( SSL_CTX_check_private_key( ctx ) != 1 ) {
        SSL_CTX_free( ctx );
        throw std::runtime_error( "Private key does not match certificate" );
    }
    // Additional validation: sign and verify using key/cert
    EVP_PKEY* pkey = nullptr;
    X509* cert = nullptr;
    FILE* keyFp = fopen( keyFile.c_str(), "r" );
    if ( keyFp ) {
        pkey = PEM_read_PrivateKey( keyFp, nullptr, nullptr, nullptr );
        fclose( keyFp );
    }
    FILE* certFp = fopen( certFile.c_str(), "r" );
    if ( certFp ) {
        cert = PEM_read_X509( certFp, nullptr, nullptr, nullptr );
        fclose( certFp );
    }
    if ( !pkey || !cert ) {
        if ( pkey )
            EVP_PKEY_free( pkey );
        if ( cert )
            X509_free( cert );
        SSL_CTX_free( ctx );
        throw std::runtime_error( "Failed to load key or certificate for signing test" );
    }
    // Create a test message
    unsigned char testMsg[] = "ssl_test_message";
    unsigned char sig[256];
    unsigned int sigLen = 0;
    EVP_MD_CTX* mdCtx = EVP_MD_CTX_new();
    if ( !mdCtx ) {
        EVP_PKEY_free( pkey );
        X509_free( cert );
        SSL_CTX_free( ctx );
        throw std::runtime_error( "Failed to create EVP_MD_CTX" );
    }
    if ( EVP_SignInit( mdCtx, EVP_sha256() ) != 1 ||
         EVP_SignUpdate( mdCtx, testMsg, sizeof( testMsg ) ) != 1 ||
         EVP_SignFinal( mdCtx, sig, &sigLen, pkey ) != 1 ) {
        EVP_MD_CTX_free( mdCtx );
        EVP_PKEY_free( pkey );
        X509_free( cert );
        SSL_CTX_free( ctx );
        throw std::runtime_error( "Failed to sign test message with private key" );
    }
    EVP_MD_CTX_free( mdCtx );
    // Verify signature using cert's public key
    EVP_PKEY* pubkey = X509_get_pubkey( cert );
    if ( !pubkey ) {
        EVP_PKEY_free( pkey );
        X509_free( cert );
        SSL_CTX_free( ctx );
        throw std::runtime_error( "Failed to extract public key from certificate" );
    }
    EVP_MD_CTX* verifyCtx = EVP_MD_CTX_new();
    if ( !verifyCtx ) {
        EVP_PKEY_free( pubkey );
        EVP_PKEY_free( pkey );
        X509_free( cert );
        SSL_CTX_free( ctx );
        throw std::runtime_error( "Failed to create EVP_MD_CTX for verify" );
    }
    bool verifyOk = EVP_VerifyInit( verifyCtx, EVP_sha256() ) == 1 &&
                    EVP_VerifyUpdate( verifyCtx, testMsg, sizeof( testMsg ) ) == 1 &&
                    EVP_VerifyFinal( verifyCtx, sig, sigLen, pubkey ) == 1;
    EVP_MD_CTX_free( verifyCtx );
    EVP_PKEY_free( pubkey );
    EVP_PKEY_free( pkey );
    X509_free( cert );
    SSL_CTX_free( ctx );
    if ( !verifyOk ) {
        throw std::runtime_error( "Failed to verify signature with certificate public key" );
    }
}

std::filesystem::path CertManager::getCaFilePath( const std::shared_ptr< HTTPSConfig >& https ) {
    if ( https->caFile() ) {
        return https->caFile().value();
    }
    // OS detection
    if ( std::filesystem::exists( "/etc/redhat-release" ) ) {
        return "/etc/pki/tls/certs/ca-bundle.crt";
    }
    std::ifstream f( "/etc/os-release" );
    std::string line;
    while ( std::getline( f, line ) ) {
        if ( line.find( "ID=alpine" ) != std::string::npos ) {
            return "/etc/ssl/cert.pem";
        }
    }
    if ( std::filesystem::exists( "/etc/alpine-release" ) ) {
        return "/etc/ssl/cert.pem";
    }
    return "/etc/ssl/certs/ca-certificates.crt";
}


wangle::SSLContextConfig CertManager::createAndValidateWangleSSLContext(
    ptr< HTTPSConfig > https ) {
    CHECK_STATE( https );
    auto certFile = https->certFile();
    auto keyFile = https->keyFile();
    auto caFile = CertManager::getCaFilePath( https );
    CertManager::validateSSLFiles( certFile, keyFile, caFile );
    wangle::SSLContextConfig sslCfg;
    sslCfg.isDefault = true;  // very important otherwise proxygen will fail
    auto keyPassPath =
        https->keyPassFile() ? https->keyPassFile().value() : std::filesystem::path( "" );
    sslCfg.addCertificate( certFile.string(), keyFile.string(), keyPassPath.string() );
    sslCfg.clientVerification = folly::SSLContext::VerifyClientCertificate::DO_NOT_REQUEST;
    // sslCfg.clientCAFile = caFilePath;
    return sslCfg;
}