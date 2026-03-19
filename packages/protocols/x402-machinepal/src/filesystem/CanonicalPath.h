#pragma once

#include <filesystem>
#include <stdexcept>

// AbsolutePath: enforces that the path is absolute at construction
class CanonicalPath {
private:
    std::filesystem::path path_;

public:
    // Construct from any path, throws if not absolute after weakly_canonical
    explicit CanonicalPath( const std::filesystem::path& p ) {
        std::filesystem::path canonical = std::filesystem::weakly_canonical( p );
        if ( !canonical.is_absolute() ) {
            throw std::invalid_argument(
                "Path needs to be absolute after weakly_canonical: " + canonical.string() );
        }
        path_ = canonical;
    }

    // Construct from string
    explicit CanonicalPath( const std::string& s ) : CanonicalPath( std::filesystem::path( s ) ) {}

    // Get the underlying path
    const std::filesystem::path& get() const { return path_; }
    // Implicit conversion to std::filesystem::path
    operator const std::filesystem::path&() const { return path_; }
    // Comparison operators
    bool operator==( const CanonicalPath& other ) const { return path_ == other.path_; }
    bool operator!=( const CanonicalPath& other ) const { return path_ != other.path_; }
    // String representation
    std::string string() const { return path_.string(); }
};