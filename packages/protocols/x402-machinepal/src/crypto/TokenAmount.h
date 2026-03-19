#pragma once
#include <string>
#include <ostream>


class TokenAmount {
    u256 value_{};

public:
    [[nodiscard]] u256 value() const { return value_; }

    TokenAmount() = default;
    explicit TokenAmount( const u256& val );
    std::string toDecimal() const;
    std::string toDbString() const;
    static TokenAmount fromHexOrDecimal( const std::string& decStr );
    friend bool operator==(const TokenAmount& a, const TokenAmount& b) noexcept {
        return a.value_ == b.value_;
    }
    friend bool operator!=(const TokenAmount& a, const TokenAmount& b) noexcept {
        return !(a == b);
    }
    friend bool operator<(const TokenAmount& a, const TokenAmount& b) noexcept {
        return a.value_ < b.value_;
    }
    friend bool operator>(const TokenAmount& a, const TokenAmount& b) noexcept {
        return b < a;
    }
    friend bool operator<=(const TokenAmount& a, const TokenAmount& b) noexcept {
        return !(b < a);
    }
    friend bool operator>=(const TokenAmount& a, const TokenAmount& b) noexcept {
        return !(a < b);
    }
    // For Boost.Test diagnostics and general logging/printing.
    friend std::ostream& operator<<(std::ostream& os, const TokenAmount& v) {
        return os << v.toDecimal();
    }
};