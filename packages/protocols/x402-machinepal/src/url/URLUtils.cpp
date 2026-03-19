#include "URLUtils.h"
#include "MachinePalCommon.h"

using namespace boost::urls;

std::string URLUtils::getLocationFromUrl(const std::string &urlStr) {
    // Use parse_uri_reference to handle "/path" and "http://host/path"
    auto result = boost::urls::parse_uri_reference(urlStr);

    if (!result) {
        LOG_CORE_ERROR("Invalid URL provided: {}", urlStr);
        throw std::invalid_argument("Invalid URL: " + urlStr);
    }

    boost::urls::url_view u = *result;

    // Use buffer to build path + query safely
    std::string path;
    if (u.encoded_path().empty()) {
        path = "/";
    } else {
        path = std::string(u.encoded_path());
    }

    if (!u.encoded_query().empty()) {
        path += "?";
        path += u.encoded_query();
    }

    return path;
}

bool URLUtils::isIpAddress(const std::string &host) {
    using namespace boost::urls;

    auto h = host;

    // Try IPv4
    if (parse_ipv4_address(h).has_value())
        return true;

    // Handle bracketed IPv6: [::1]
    if (h.size() >= 2 && h.front() == '[' && h.back() == ']')
        h = h.substr(1, h.size() - 2);

    // Try IPv6
    return parse_ipv6_address(h).has_value();
}

bool URLUtils::isDomainName(const std::string &host) {
    using namespace boost::urls;
    using boost::system::result;

    // Wrap host in dummy authority so Boost can parse it
    // e.g., "example.com" → "example.com:80"
    result<authority_view> res = parse_authority(host);

    if (!res) {
        // Not even a valid authority syntax
        return false;
    }

    authority_view auth = *res;
    host_type ht = auth.host_type();

    return ht == host_type::name;
}

bool URLUtils::isValidUrl(const std::string &url) {
    // parse_uri returns a result object which is true on success
    // and false on failure.
    boost::system::result<boost::urls::url_view> result = boost::urls::parse_uri(url);
    return result.has_value();
}



bool URLUtils::decodePath(const std::string& path, std::string& result, std::string& errorMessage) {
    if (path.empty() || path[0] != '/') {
        errorMessage = "Path must start with /";
        return false;
    }

    // 1. Parse as a URI reference.
    // This validates the %-encoding (e.g., rejects "%2" or "%XY").
    boost::system::result<boost::urls::url_view> rv = boost::urls::parse_uri_reference(path);

    if (rv.has_error()) {
        errorMessage = "Path contains invalid encoding: " + rv.error().message();
        return false;
    }

    const boost::urls::url_view u = *rv;

    // 2. SECURITY FIX: Robust Path Traversal Detection.
    // Iterate over the segments identified by the parser.
    // u.segments() returns already decoded segments (std::string).
    for (const auto& segment : u.segments()) {
        // Check if the decoded segment is exactly ".."
        if (segment == "..") {
            errorMessage = "Path traversal attempt (..) detected";
            return false;
        }
    }

    // 3. Decode the path safely.
    // We still use .decode() here on the full encoded_path() view to get the final contiguous string.
    std::string decoded = u.encoded_path().decode();

    // 4. Security Check: Null Byte Poisoning.
    // Essential if the decoded string is passed to C-style APIs.
    if (decoded.find('\0') != std::string::npos) {
        errorMessage = "Null byte detected";
        return false;
    }

    result = decoded;
    return true;
}