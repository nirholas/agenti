#pragma once
#include <boost/multiprecision/cpp_int.hpp>
#include <ctime>
#include <string>

using u256 = boost::multiprecision::uint256_t;

class EIP3009ValidityTime {
    u256 time_{};

public:
    EIP3009ValidityTime() = default;
    explicit EIP3009ValidityTime( const u256& val );

    [[nodiscard]] u256 time() const { return time_; }

    std::string toDecimal() const;
    static EIP3009ValidityTime fromHexOrDecimal( const std::string& decStr );
    static EIP3009ValidityTime fromTimeT( std::time_t timeT );

    friend bool operator==( const EIP3009ValidityTime&, const EIP3009ValidityTime& ) = default;
    friend bool operator!=( const EIP3009ValidityTime& a, const EIP3009ValidityTime& b ) {
        return !( a == b );
    }
    friend bool operator<( const EIP3009ValidityTime& a, const EIP3009ValidityTime& b ) {
        return a.time_ < b.time_;
    }
    friend bool operator<=( const EIP3009ValidityTime& a, const EIP3009ValidityTime& b ) {
        return a.time_ <= b.time_;
    }
    friend bool operator>( const EIP3009ValidityTime& a, const EIP3009ValidityTime& b ) {
        return a.time_ > b.time_;
    }
    friend bool operator>=( const EIP3009ValidityTime& a, const EIP3009ValidityTime& b ) {
        return a.time_ >= b.time_;
    }
};