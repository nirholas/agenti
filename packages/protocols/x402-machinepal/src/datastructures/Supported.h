#pragma once
using json = nlohmann::json;

struct SupportedKind {
    int x402Version;
    std::string scheme;
    std::string network;

    bool operator==( const SupportedKind& other ) const {
        return x402Version == other.x402Version && scheme == other.scheme &&
               network == other.network;
    }

    friend std::ostream& operator<<( std::ostream& os, const SupportedKind& k ) {
        os << "{x402Version: " << k.x402Version << ", scheme: " << k.scheme
           << ", network: " << k.network << "}";
        return os;
    }
};

NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE( SupportedKind, x402Version, scheme, network )

struct Supported {
    std::vector< SupportedKind > kinds;

    bool operator==( const Supported& other ) const { return kinds == other.kinds; }

    friend std::ostream& operator<<( std::ostream& os, const Supported& s ) {
        os << "Supported kinds: [ ";
        for ( const auto& k : s.kinds )
            os << k << ", ";
        os << "]";
        return os;
    }

    static Supported getDefault();
};

NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE( Supported, kinds )