#pragma once
#include "../payment/datastructures/PaymentRequirements.h"
using json = nlohmann::json;

struct DiscoveredPagination {
    int limit;
    int offset;
    int total;

    bool operator==( const DiscoveredPagination& other ) const {
        return limit == other.limit && offset == other.offset && total == other.total;
    }

    friend std::ostream& operator<<( std::ostream& os, const DiscoveredPagination& p ) {
        os << "{limit: " << p.limit << ", offset: " << p.offset << ", total: " << p.total << "}";
        return os;
    }
};

NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE( DiscoveredPagination, limit, offset, total )

struct DiscoveredResourceMetadata {
    std::optional< std::string > category;
    std::optional< std::string > provider;

    bool operator==( const DiscoveredResourceMetadata& other ) const {
        return category == other.category && provider == other.provider;
    }

    friend std::ostream& operator<<( std::ostream& os, const DiscoveredResourceMetadata& m ) {
        os << "{category: " << ( m.category ? *m.category : "" )
           << ", provider: " << ( m.provider ? *m.provider : "" ) << "}";
        return os;
    }
};

NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE( DiscoveredResourceMetadata, category, provider )

struct DiscoveredResource {
    std::string resource;
    std::string type;
    int x402Version;
    std::vector< PaymentRequirements > accepts;
    int lastUpdated;
    std::optional< DiscoveredResourceMetadata > metadata;

    bool operator==( const DiscoveredResource& other ) const {
        return resource == other.resource && type == other.type &&
               x402Version == other.x402Version && accepts == other.accepts &&
               lastUpdated == other.lastUpdated && metadata == other.metadata;
    }

    friend std::ostream& operator<<( std::ostream& os, const DiscoveredResource& r ) {
        os << "{resource: " << r.resource << ", type: " << r.type
           << ", x402Version: " << r.x402Version << ", accepts: [";
        for ( const auto& a : r.accepts )
            os << a << ", ";
        os << "], lastUpdated: " << r.lastUpdated
           << ", metadata: " << ( r.metadata ? *r.metadata : DiscoveredResourceMetadata{} ) << "}";
        return os;
    }
};

NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(
    DiscoveredResource, resource, type, x402Version, accepts, lastUpdated, metadata )

struct Discovered {
    int x402Version;
    std::vector< DiscoveredResource > items;
    DiscoveredPagination pagination;

    bool operator==( const Discovered& other ) const {
        return x402Version == other.x402Version && items == other.items &&
               pagination == other.pagination;
    }

    friend std::ostream& operator<<( std::ostream& os, const Discovered& d ) {
        os << "{x402Version: " << d.x402Version << ", items: [";
        for ( const auto& i : d.items )
            os << i << ", ";
        os << "], pagination: " << d.pagination << "}";
        return os;
    }
};

NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE( Discovered, x402Version, items, pagination )