#pragma once


class URLUtils {
public:
    static std::string getLocationFromUrl( const std::string& url );

    static bool isIpAddress( const std::string& host );

    static bool isDomainName( const std::string& host );

    static bool isValidUrl(const std::string& url);

    static bool decodePath(
        const std::string& path, std::string& result, std::string& errorMessage );
};