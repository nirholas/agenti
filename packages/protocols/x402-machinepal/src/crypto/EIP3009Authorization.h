#pragma once
#include "EIP3009Nonce.h"
#include "EIP712Domain.h"
#include "EIP712Signature.h"
#include "EthAddress.h"
#include "EthPrivateKey.h"
#include "EthPublicKey.h"

enum class FacilitatorError;
class HttpError;
class EIP3009ValidityTime;
class TokenAmount;


class EIP3009Authorization {
public:
    // Signs an EIP-3009 authorization message
    [[nodiscard]] static EIP712Signature signAuthorization( const EIP712Domain& domain,
        const EthAddress& from, const EthAddress& to, const TokenAmount& value,
        const EIP3009ValidityTime& validAfter, const EIP3009ValidityTime& validBefore,
        const EIP3009Nonce& nonce, const EthPrivateKey& privateKey );

    // Verifies an EIP-3009 authorization signature
    [[nodiscard]] static std::optional< FacilitatorError > verifyAuthorizationSignature(
        const EIP712Domain& domain, const EthAddress& from, const EthAddress& to,
        const TokenAmount& value, const EIP3009ValidityTime& validAfter,
        const EIP3009ValidityTime& validBefore, const EIP3009Nonce& nonce,
        const EIP712Signature& signature );

    static constexpr const char* PERMIT_TYPE_HASH =
        "6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9";
    static constexpr const char* RECEIVE_WITH_AUTHORIZATION_TYPE_HASH =
        "d099cc98ef71107a616c4f0f941f04c322d8e254fe26b3c6668db87aae413de8";
    static constexpr const char* TRANSFER_WITH_AUTHORIZATION_TYPE_HASH =
        "7c7c6cdb67a18743f49ec6fa9b35f50d52ed05cbed4cc592e13b44501c1a2267";
    static constexpr const char* CANCEL_AUTHORIZATION_TYPE_HASH =
        "158b0a9edf7a828aad02f63cd515c68ef2f50ba807396f6d12842833a1597429";
};