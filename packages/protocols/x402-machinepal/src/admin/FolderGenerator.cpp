#include "FolderGenerator.h"
#include <stdexcept>
#include <filesystem> // Main header for filesystem
#include <exception>  // For std::throw_with_nested
#include <string>


// --- Implementation ---

FolderGenerator::FolderGenerator(const std::filesystem::path& baseDir)
    : base_(baseDir) {}

void FolderGenerator::createAndSecure(const std::filesystem::path& p) {
    // Create directory (and parents) if missing
    std::error_code ec; // Use error codes to avoid exceptions for simple checks

    if (!std::filesystem::exists(p, ec)) {
        // Pass ec to avoid throwing an exception on failure here
        if (!std::filesystem::create_directories(p, ec) && ec) {
            // If create_directories failed, throw an error
            throw std::filesystem::filesystem_error(
                "Failed to create directory: " + p.string(), ec);
        }
    } else if (!std::filesystem::is_directory(p, ec)) {
        // Path exists but is not a directory
        throw std::runtime_error("Path exists but is not a directory: " + p.string());
    }

    // Harden permissions: owner only (read, write, execute/search)
    // We use perms::owner_all as a shortcut for rwx for the owner.
    std::filesystem::permissions(
        p,
        std::filesystem::perms::owner_all, // rwx for owner
        std::filesystem::perm_options::replace, // IMPORTANT: Replaces permissions
        ec // Pass error code
    );

    if (ec) {
        // Handle potential error setting permissions (e.g., on Windows/unsupported systems)
        // You might want to log this instead of throwing, depending on how critical
        // the permissions are for your application.
        // For this example, we'll throw.
        throw std::filesystem::filesystem_error(
            "Failed to set permissions on: " + p.string(), ec);
    }
}

void FolderGenerator::generateFolderStructure() {
    try {
        // Use operator/ for path joining
        createAndSecure(base_ / "certs");
        createAndSecure(base_ / "data");
        createAndSecure(base_ / "resources");
        createAndSecure(base_ / "secrets");
    } catch (...) {
        // Standard C++ way to rethrow with nested context
        std::throw_with_nested(std::runtime_error(
            "FolderGenerator failed to create secure directories under base: " + base_.string()
        ));
    }
}




