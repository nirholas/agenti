#pragma once
#include <string>
#include <utility>
#include <boost/filesystem/path.hpp>


class TLSCertGenerator {
public:
    std::string getOpenSSLError();

    std::pair<std::string, std::string> generateSelfSignedCert(
        const std::string& commonName = "localhost",
        const std::string& organization = "",
        const std::string& country = "",
        int validDays = 3650);

    void generateDefaultCertFiles(
        const std::filesystem::path& certFilePath,
        const std::filesystem::path& keyFilePath);
};


