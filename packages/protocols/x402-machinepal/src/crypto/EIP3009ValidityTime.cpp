#include "EIP3009ValidityTime.h"
#include "MachinePalCommon.h"
#include <limits>

#include "Encoding.h"

EIP3009ValidityTime::EIP3009ValidityTime( const u256& val ) : time_( val ) {}

std::string EIP3009ValidityTime::toDecimal() const {
    return Encoding::u256ToDecimal( time_ );
}

EIP3009ValidityTime EIP3009ValidityTime::fromHexOrDecimal( const std::string& decStr ) {
    u256 val = Encoding::u256FromHexOrDecimal( decStr );
    return EIP3009ValidityTime( val );
}

EIP3009ValidityTime EIP3009ValidityTime::fromTimeT( std::time_t timeT ) {
    return EIP3009ValidityTime( u256( static_cast< unsigned long long >( timeT ) ) );
}