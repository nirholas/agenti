#include <boost/test/unit_test.hpp>
#include "admin/TLSCertGenerator.h"
#include <openssl/x509.h>
#include <openssl/pem.h>
#include <openssl/evp.h>
#include <openssl/x509v3.h>
BOOST_AUTO_TEST_CASE(SelfSignedCertBasic) {
    TLSCertGenerator gen;
    auto pemPair = gen.generateSelfSignedCert("localhost", "Localhost Dev", "US", 30);
    auto& cert = pemPair.first;
    auto& key  = pemPair.second;

    // 1. Basic PEM block checks
    BOOST_TEST(!cert.empty());
    BOOST_TEST(!key.empty());
    BOOST_TEST(cert.find("-----BEGIN CERTIFICATE-----") == 0);
    BOOST_TEST(key.find("-----BEGIN PRIVATE KEY-----") == 0);

    // 2. Parse Certificate
    BIO* certBio = BIO_new_mem_buf(cert.data(), static_cast<int>(cert.size()));
    BOOST_TEST(certBio != nullptr);
    X509* x509_cert = PEM_read_bio_X509(certBio, nullptr, nullptr, nullptr);
    BOOST_TEST(x509_cert != nullptr);

    // 3. Parse Private Key
    BIO* keyBio = BIO_new_mem_buf(key.data(), static_cast<int>(key.size()));
    BOOST_TEST(keyBio != nullptr);
    EVP_PKEY* pkey = PEM_read_bio_PrivateKey(keyBio, nullptr, nullptr, nullptr);
    BOOST_TEST(pkey != nullptr);

    // 4. --- NEW: Check that the private key matches the certificate's public key ---
    EVP_PKEY* cert_pubkey = X509_get_pubkey(x509_cert);
    BOOST_TEST(cert_pubkey != nullptr);
    // EVP_PKEY_cmp returns 1 for match, 0 for no match, -1 or -2 for error
    BOOST_TEST(EVP_PKEY_eq(pkey, cert_pubkey) == 1);

    // 5. Check Common Name (CN)
    X509_NAME* subj = X509_get_subject_name(x509_cert);
    BOOST_TEST(subj != nullptr);
    int idx = X509_NAME_get_index_by_NID(subj, NID_commonName, -1);
    BOOST_TEST(idx >= 0);
    X509_NAME_ENTRY* cnEntry = X509_NAME_get_entry(subj, idx);
    BOOST_TEST(cnEntry != nullptr);
    ASN1_STRING* cnAsn1 = X509_NAME_ENTRY_get_data(cnEntry);
    BOOST_TEST(cnAsn1 != nullptr);
    std::string cn(reinterpret_cast<const char*>(ASN1_STRING_get0_data(cnAsn1)),
                   ASN1_STRING_length(cnAsn1));
    BOOST_TEST(cn == "localhost");

    // 6. --- NEW: Check that the Subject Alternative Name (SAN) is correct ---
    int san_ext_idx = X509_get_ext_by_NID(x509_cert, NID_subject_alt_name, -1);
    BOOST_TEST(san_ext_idx >= 0); // Check if SAN extension exists
    X509_EXTENSION* san_ext = X509_get_ext(x509_cert, san_ext_idx);
    BOOST_TEST(san_ext != nullptr);

    // Parse the SAN extension
    GENERAL_NAMES* san_names = (GENERAL_NAMES*)X509V3_EXT_d2i(san_ext);
    BOOST_TEST(san_names != nullptr);

    int num_sans = sk_GENERAL_NAME_num(san_names);
    bool found_san = false;
    for (int i = 0; i < num_sans; ++i) {
        GENERAL_NAME* san = sk_GENERAL_NAME_value(san_names, i);
        if (san->type == GEN_DNS) {
            std::string san_str(
                reinterpret_cast<const char*>(ASN1_STRING_get0_data(san->d.dNSName)),
                ASN1_STRING_length(san->d.dNSName));

            if (san_str == "localhost") {
                found_san = true;
                break;
            }
        }
    }
    BOOST_TEST(found_san); // Verify our "DNS:localhost" entry was found

    // --- Cleanup ---
    GENERAL_NAMES_free(san_names);
    EVP_PKEY_free(cert_pubkey);
    EVP_PKEY_free(pkey);
    X509_free(x509_cert);
    BIO_free(certBio);
    BIO_free(keyBio);
}