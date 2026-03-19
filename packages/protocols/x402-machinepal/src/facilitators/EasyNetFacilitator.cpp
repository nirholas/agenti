#include "EasyNetFacilitator.h"

#include "FacilitatorErrors.h"
#include "MachinePalApp.h"
#include "MachinePalCommon.h"

#include "payment/datastructures/PaymentRequirements.h"
#include "payment/datastructures/VerifyResponse.h"
#include "vibemarket/datastructures/VibeBuyRequest.h"

EasyNetFacilitator::EasyNetFacilitator( MachinePalApp& app ) : app_( app ) {
    chainId_ = EIP712Domain::machinePalEasyNet()->chainId();
};

json EasyNetFacilitator::processSettleRequest(
    const nlohmann::json& settlementRequestJson ) {
    std::unique_lock< std::shared_mutex > lock( mutex_ );
    auto db = dynamic_pointer_cast< EasyNetDb >( app_.machinePalDB() );
    CHECK_STATE( db );
    try {
        optional< string > error;
        auto [paymentPayload, paymentReqs] =
            processVerifyRequestUnsafe( settlementRequestJson, error, *db );

        // Obtain from address after verification (available even if error)
        EthAddress fromWalletAddress = paymentPayload->payload()->authorization()->from();

        if ( error ) {
            SettlementResponse response( false, error.value(), "",
                "",  // transaction, network (none here)
                fromWalletAddress.toHex( PREFIX_0x ), std::nullopt );
            return response.toJson();
        }

        EthAddress toWalletAddress = paymentPayload->payload()->authorization()->to();
        EthAddress assetWalletAddress = EthAddress::parseFlexible( paymentReqs->asset() );
        TokenAmount transferValue = paymentPayload->payload()->authorization()->value();
        EIP3009Nonce nonce = paymentPayload->payload()->authorization()->nonce();
        const string& resource = paymentReqs->resource();

        // Prepare extra parameters for updated EasyNetDb API
        std::string jsonInfo = paymentPayload->toJson().dump();
        std::string transactionHash =
            paymentPayload->payload()->signature().toHex( PREFIX_0x );
        std::string authorizationSignatureHash = Encoding::hashToHex(
            paymentPayload->payload()->signature().computeSignatureHash() );

        auto facilitatorError = db->processTransferRequest( fromWalletAddress, toWalletAddress,
            assetWalletAddress, transferValue, nonce, resource, "0.0.0.0", jsonInfo,
            transactionHash, chainId_, authorizationSignatureHash );

        if ( !facilitatorError.has_value() ) {
            SettlementResponse response( true, std::nullopt, "",
                "",  // transaction, network (empty placeholders)
                fromWalletAddress.toHex( PREFIX_0x ), std::nullopt );
            return response.toJson();
        } else {
            SettlementResponse response( false, string(FacilitatorErrors::getErrorString(facilitatorError.value())) , "",
                "",  // transaction, network
                fromWalletAddress.toHex( PREFIX_0x ), std::nullopt );
            return response.toJson();
        }
    } catch ( const std::exception& e ) {
        printNestedException(e);
        SettlementResponse response( false, std::string(
            FacilitatorErrors::getErrorString(FacilitatorError::unexpected_settle_error)), "",
            "",  // transaction, network
            "", std::nullopt );
        return response.toJson();
    }
}


pair< ptr< PaymentPayload >, ptr< PaymentRequirements > >
EasyNetFacilitator::processVerifyRequestUnsafe( const nlohmann::json& verifyRequestJson,
    optional< string >& error, EasyNetDb& db ) const {
    auto verifyRequest = SettlementRequest::fromJson( verifyRequestJson );
    auto paymentPayload = verifyRequest.paymentPayload();
    auto paymentRequirements = verifyRequest.paymentRequirements();
    auto fromWalletAddress = paymentPayload->payload()->authorization()->from();
    auto toWalletAddress = paymentPayload->payload()->authorization()->to();
    auto assetWalletAddress = EthAddress::parseFlexible( paymentRequirements->asset() );
    auto transferValue = paymentPayload->payload()->authorization()->value();

    auto payToAddress = EthAddress::parseFlexible(paymentRequirements->payTo());

    auto price = TokenAmount::fromHexOrDecimal(paymentRequirements->maxAmountRequired());

    auto httpError = paymentPayload->validateAndVerifySignature( *app_.configManager()->latestConfig(),
        price, payToAddress, paymentRequirements->scheme());

    if ( httpError ) {
        LOG_NETWORK_ERROR("InvalidPayload: Payment payload validation or signature failed");
        error = FacilitatorErrors::getErrorString(FacilitatorError::invalid_payload );
        return { paymentPayload, paymentRequirements };
    }


    u256 currentBalance = 1000000000 * u256( 1000000000000000000ULL );
    // 1e27 initial funding for new wallets
    auto senderBalanceOpt = db.getBalance( fromWalletAddress, assetWalletAddress );
    if ( senderBalanceOpt.has_value() ) {
        currentBalance = senderBalanceOpt.value();
    }

    // Overflow check on receiver side (if we can read it) purely informational
    auto receiverBalanceOpt = db.getBalance( toWalletAddress, assetWalletAddress );
    if ( receiverBalanceOpt.has_value() ) {
        const u256 maxVal = ( std::numeric_limits< u256 >::max )();
        const u256 receiverBalance = receiverBalanceOpt.value();
        if ( transferValue.value() > maxVal - receiverBalance ) {
            LOG_NETWORK_ERROR("Overflow: Receiver balance would overflow 256-bit limit");
            error = FacilitatorErrors::getErrorString(FacilitatorError::insufficient_funds );
            return { paymentPayload, paymentRequirements };
        }
    }

    if ( transferValue.value() > currentBalance ) {
        LOG_NETWORK_ERROR("InsufficientFunds: Balance lower than requested transfer amount");
        error = FacilitatorErrors::getErrorString(FacilitatorError::insufficient_funds );
        return { paymentPayload, paymentRequirements };
    }

    return { paymentPayload, paymentRequirements };
}

json EasyNetFacilitator::processVerifyRequest(
    const json& verifyRequestJson ) {
    auto db = dynamic_pointer_cast< EasyNetDb >( app_.machinePalDB() );
    CHECK_STATE( db );
    std::shared_lock< std::shared_mutex > lock( mutex_ );
    try {
        optional< string > error;
        auto [payload, paymentReqs] =
            processVerifyRequestUnsafe( verifyRequestJson, error, *db );
            auto fromWalletAddress = payload->payload()->authorization()->from();
        if ( error ) {
            LOG_NETWORK_ERROR("Error processing verify request: {}", error.value());
            VerifyResponse errorResponse(
                false, error.value(), fromWalletAddress.toDbString(), std::nullopt );

            return errorResponse.toJson();
        } else {
            VerifyResponse verifyResponse(
                true, std::nullopt, fromWalletAddress.toDbString(), std::nullopt );
            return verifyResponse.toJson();
        }
    } catch ( const std::exception& e ) {
        LOG_NETWORK_ERROR("Exception processing verify request: {}", e.what());
        optional<string> standardErrorString =
            std::string(FacilitatorErrors::getErrorString(FacilitatorError::unexpected_verify_error));
        VerifyResponse errorResponse( false,
            standardErrorString, "", std::nullopt );
        return errorResponse.toJson();
    }
}

json EasyNetFacilitator::processVibeBuyRequest(const json &vibeBuyRequestJson) {
    auto vibeBuyRequest = VibeBuyRequest::fromJson(vibeBuyRequestJson);
    auto db = dynamic_pointer_cast< EasyNetDb >( app_.machinePalDB() );
    CHECK_STATE( db );
    std::shared_lock< std::shared_mutex > lock( mutex_ );
    return nullptr;
}
