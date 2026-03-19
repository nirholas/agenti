#include "MachinePalCommon.h"
#include "MachinePalConfigGenerator.h"

#include "crypto/EthPrivateKey.h"

static const char* kYamlTemplate = R"(# Machinepal server configuration. May be overridden by environment variables.
server:
  hostname: localhost
  http:
    enable: true
    port: 8080
  https:
    enable: true
    port: 8443
    cert_file: certs/machinepal_tls_certificate.crt
    key_file: secrets/machinepal_tls_certificate.key

network:
  name: machinepal-easynet
  payment_address: {}

log:
  # Optional Log verbosity level — one of: trace, debug, info, warn, error, fatal
  # Default: info
  level: trace

resources:
  - name: hello_world
    type: local_file
    location: resources/hello_world.txt
    price: 1.545
    token: USDC

  - name: hello_world_api_rest
    type: api-rest
    location: https://jsonplaceholder.typicode.com/posts/1
    price: 12
    token: USDC
)";

void MachinePalConfigGenerator::generateDefaultConfig(const std::filesystem::path& dirPath, EthPrivateKey& machinePalKey) {
    try {
        if (!dirPath.empty()) {
            std::error_code ec;
            std::filesystem::create_directories(dirPath, ec);

            if (ec) {
                throw std::filesystem::filesystem_error(
                    "Failed to create target directory for machinepal.yml", dirPath, ec);
            }
        }
        auto filePath = dirPath / "machinepal.yml";
        if (std::filesystem::exists(filePath)) {
            throw std::runtime_error("Config file already exists. Refusing to overwrite: " + filePath.string());
        }

        // This is already correct and modern C++17
        std::ofstream out(filePath);
        if (!out) {
            throw std::runtime_error("Failed to open config file for writing: " + filePath.string());
        }

        std::string finalYaml = folly::sformat(
            kYamlTemplate,
            machinePalKey.computePublicKey().getAddress().toHex(PREFIX_0x)
        );

        out << finalYaml;
        if (!out) {
            out.close();
            std::error_code ec;
            std::filesystem::remove(filePath, ec);
            throw std::runtime_error("Failed to write YAML content to: " + filePath.string());
        }
        out.close();

        // This permissions call is already correct
        std::error_code permEc;
        std::filesystem::permissions(
            filePath,
            std::filesystem::perms::owner_read | std::filesystem::perms::owner_write,
            std::filesystem::perm_options::replace,
            permEc
        );

        if (permEc) {
            // --- Fix 2: Correct Error Code Handling ---
            // Don't pass the permissions error code (permEc) to remove().
            // Use a new error code for the remove operation.
            std::error_code removeEc;
            std::filesystem::remove(filePath, removeEc); // Try to clean up

            // Throw the *original* and important error
            throw std::filesystem::filesystem_error(
                "Successfully wrote config but failed to set secure permissions", filePath, permEc);
        }
    } catch (...) {
        std::throw_with_nested(std::runtime_error("Failed to generate machinepal.yml in directory: " + dirPath.string()));
    }
}