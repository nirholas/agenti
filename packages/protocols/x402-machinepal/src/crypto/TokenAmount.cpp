#include "TokenAmount.h"
#include "MachinePalCommon.h"

#include "Encoding.h"

TokenAmount::TokenAmount( const u256& val ) : value_( val ) {}

std::string TokenAmount::toDecimal() const {
    return Encoding::u256ToDecimal( value_ );
}

std::string TokenAmount::toDbString() const {
    return toDecimal();
}

TokenAmount TokenAmount::fromHexOrDecimal( const std::string& decStr ) {
    u256 val = Encoding::u256FromHexOrDecimal( decStr );
    return TokenAmount( val );
}